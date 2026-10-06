import { createHmac, randomUUID } from 'node:crypto';
import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

// This suite only creates synthetic records against the isolated local QA stack.
const apiURL = 'http://127.0.0.1:5051';
const password = 'Local QA passphrase 2026!';
const email = () => `browser-${randomUUID()}@example.test`;
const secret = 'taskforge-integration-test-secret';

test.describe.configure({ mode: 'serial' });
test.beforeEach(async ({ baseURL }) => {
  expect(baseURL, 'Browser smoke must target the guarded local QA client').toBe(
    'http://127.0.0.1:5174',
  );
});

const loginUI = async (page: Page, accountEmail: string) => {
  await page.goto('/login');
  await page.getByLabel(/^Email/).fill(accountEmail);
  await page.getByLabel(/^Password/).fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(/\/home$/);
};

const registerAPI = async (api: APIRequestContext, accountEmail: string) => {
  const registration = await api.post('/api/auth/register', {
    data: { email: accountEmail, password },
  });
  expect(registration.status()).toBe(201);
  const user = (await registration.json()).user as { id: string };
  const login = await api.post('/api/auth/login', { data: { email: accountEmail, password } });
  expect(login.status()).toBe(200);
  return { id: user.id, token: (await login.json()).token as string };
};

const signedExpiredToken = (owner: string) => {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(
    JSON.stringify({ id: owner, exp: Math.floor(Date.now() / 1000) - 60 }),
  ).toString('base64url');
  const signature = createHmac('sha256', secret).update(`${header}.${payload}`).digest('base64url');
  return `${header}.${payload}.${signature}`;
};

test('registers, signs in, and persists assigned task CRUD through refresh', async ({
  page,
  playwright,
}) => {
  const accountEmail = email();
  await page.goto('/register');
  await page.getByLabel(/^Email/).fill(accountEmail);
  await page.getByLabel(/^Password/).fill(password);
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  await loginUI(page, accountEmail);

  await page.goto('/workforce');
  const agentName = 'Smoke agent ' + randomUUID();
  await page.getByLabel(/^Name/).fill(agentName);
  await page.getByLabel(/^Role/).fill('Researcher');
  await page.getByRole('button', { name: 'Create Agent', exact: true }).click();
  await expect(page.getByRole('link', { name: agentName, exact: true })).toBeVisible();
  const token = await page.evaluate(() => localStorage.getItem('token'));
  expect(token).toBeTruthy();
  const api = await playwright.request.newContext({
    baseURL: apiURL,
    extraHTTPHeaders: { Authorization: 'Bearer ' + token },
  });
  try {
    const agents = await api.get('/api/agents');
    expect(agents.status()).toBe(200);
    const agent = (await agents.json()).agents.find(
      (item: { name: string }) => item.name === agentName,
    );
    expect(agent).toBeTruthy();
    const taskTitle = 'Persisted smoke task ' + randomUUID();
    await page.goto('/work');
    await page.getByLabel(/^Title/).fill(taskTitle);
    await page.getByLabel('Assignee', { exact: true }).selectOption('agent:' + agent._id);
    await page.getByRole('button', { name: 'Create Task', exact: true }).click();
    await expect(page.getByRole('heading', { name: taskTitle, exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Agent: ' + agentName })).toBeVisible();

    await page.getByRole('button', { name: 'Edit', exact: true }).click();
    const renamed = taskTitle + ' edited';
    await page.getByLabel(/^Title/).fill(renamed);
    await page.getByLabel('Description', { exact: true }).fill('Saved through the real local API.');
    await page.getByRole('button', { name: 'Save Changes', exact: true }).click();
    await expect(page.getByRole('heading', { name: renamed, exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Start Progress', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Mark Done', exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByRole('heading', { name: renamed, exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Mark Done', exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Agent: ' + agentName })).toBeVisible();
    const tasks = await api.get('/api/tasks');
    expect(tasks.status()).toBe(200);
    const saved = (await tasks.json()).tasks.find(
      (item: { title: string }) => item.title === renamed,
    );
    expect(saved).toMatchObject({
      description: 'Saved through the real local API.',
      status: 'in-progress',
      assigneeType: 'agent',
      assigneeAgent: agent._id,
    });

    await page.getByRole('button', { name: 'Delete', exact: true }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Delete task' }).click();
    await expect(page.getByRole('heading', { name: renamed, exact: true })).toHaveCount(0);
    await page.reload();
    await expect(page.getByRole('heading', { name: 'No tasks yet' })).toBeVisible();
    expect((await (await api.get('/api/tasks')).json()).tasks).toEqual([]);
  } finally {
    await api.dispose();
  }
});

test('isolates two owners and expires a browser session after a real API 401', async ({
  page,
  playwright,
}) => {
  const anonymous = await playwright.request.newContext({ baseURL: apiURL });
  const alice = await registerAPI(anonymous, email());
  const bobEmail = email();
  const bob = await registerAPI(anonymous, bobEmail);
  await anonymous.dispose();
  const aliceAPI = await playwright.request.newContext({
    baseURL: apiURL,
    extraHTTPHeaders: { Authorization: 'Bearer ' + alice.token },
  });
  const bobAPI = await playwright.request.newContext({
    baseURL: apiURL,
    extraHTTPHeaders: { Authorization: 'Bearer ' + bob.token },
  });
  try {
    const agentResponse = await aliceAPI.post('/api/agents', {
      data: { name: 'Private Alice agent', role: 'Researcher' },
    });
    expect(agentResponse.status()).toBe(201);
    const agent = (await agentResponse.json()).agent;
    const title = 'Private Alice task ' + randomUUID();
    const created = await aliceAPI.post('/api/tasks', {
      data: { title, assigneeType: 'agent', assigneeAgent: agent._id },
    });
    expect(created.status()).toBe(201);
    const task = (await created.json()).task;
    const bobTasks = await bobAPI.get('/api/tasks');
    expect(bobTasks.status()).toBe(200);
    expect((await bobTasks.json()).tasks).toEqual([]);
    expect(
      (await bobAPI.patch('/api/tasks/' + task._id, { data: { title: 'Intrusion' } })).status(),
    ).toBe(404);
    expect((await bobAPI.delete('/api/tasks/' + task._id)).status()).toBe(404);
    expect(
      (
        await bobAPI.post('/api/tasks', {
          data: { title: 'Foreign assignment', assigneeType: 'agent', assigneeAgent: agent._id },
        })
      ).status(),
    ).toBe(400);
    expect((await bobAPI.get('/api/agents/' + agent._id)).status()).toBe(404);
    expect((await (await aliceAPI.get('/api/tasks')).json()).tasks).toEqual([
      expect.objectContaining({ _id: task._id, title, assigneeAgent: agent._id }),
    ]);

    await loginUI(page, bobEmail);
    await page.goto('/work');
    await expect(page.getByRole('heading', { name: 'No tasks yet' })).toBeVisible();
    await expect(page.getByText(title, { exact: true })).toHaveCount(0);
    // Its valid future exp passes the UI check, while the invalid signature reaches requireAuth.
    const parts = bob.token.split('.');
    parts[2] = 'invalid-signature';
    await page.evaluate((token) => localStorage.setItem('token', token), parts.join('.'));
    await page.reload();
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByText('Your session has expired. Please log in again.')).toBeVisible();
    expect(await page.evaluate(() => localStorage.getItem('token'))).toBeNull();
    await expect(page.getByText(title, { exact: true })).toHaveCount(0);
  } finally {
    await aliceAPI.dispose();
    await bobAPI.dispose();
  }
});

test('supports mobile drawer navigation and expires an elapsed JWT', async ({
  page,
  playwright,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const anonymous = await playwright.request.newContext({ baseURL: apiURL });
  const accountEmail = email();
  const user = await registerAPI(anonymous, accountEmail);
  await anonymous.dispose();
  await loginUI(page, accountEmail);
  const openNavigation = page.getByRole('button', { name: 'Open navigation' });
  await openNavigation.click();
  const drawer = page.getByRole('dialog');
  await expect(drawer).toBeVisible();
  await drawer.getByRole('link', { name: 'Work', exact: true }).click();
  await expect(page).toHaveURL(/\/work$/);
  await expect(drawer).not.toBeVisible();
  await expect(page.getByRole('heading', { name: 'Create Task', exact: true })).toBeVisible();
  await openNavigation.click();
  await drawer.getByRole('link', { name: 'Workforce', exact: true }).click();
  await expect(page).toHaveURL(/\/workforce$/);
  await expect(drawer).not.toBeVisible();
  await expect(page.getByRole('heading', { name: 'Workforce', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );

  await page.evaluate((token) => localStorage.setItem('token', token), signedExpiredToken(user.id));
  await page.reload();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByText('Your session has expired. Please log in again.')).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('token'))).toBeNull();
});
