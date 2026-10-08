import { randomUUID } from 'node:crypto';
import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

const apiURL = 'http://127.0.0.1:5051';
const password = 'Chief of Staff QA passphrase 2026!';

test.beforeEach(async ({ baseURL }) => {
  expect(baseURL, 'Chief of Staff QA requires the guarded local client').toBe(
    'http://127.0.0.1:5174',
  );
});

const registerAndLogin = async (page: Page) => {
  const email = 'chief-of-staff-' + randomUUID() + '@example.test';
  await page.goto('/register');
  await page.getByLabel(/^Email/).fill(email);
  await page.getByLabel(/^Password/).fill(password);
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('heading', { name: 'Welcome back', exact: true })).toBeVisible();
  await page.getByLabel(/^Email/).fill(email);
  await page.getByLabel(/^Password/).fill(password);
  const signedIn = page.waitForResponse(
    (response) =>
      response.url() === apiURL + '/api/auth/login' && response.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  expect((await signedIn).status()).toBe(200);
  await expect(page).toHaveURL(/\/home$/);
  const token = await page.evaluate(() => localStorage.getItem('token'));
  expect(token).toBeTruthy();
  return token;
};

const fixture = async (
  api: APIRequestContext,
  taskNotes = 'Synthetic task notes for this run.',
) => {
  const agentResponse = await api.post('/api/agents', {
    data: {
      name: 'Activity agent ' + randomUUID(),
      role: 'Researcher',
      permissions: ['task.read', 'artifact.draft', 'project.read'],
    },
  });
  expect(agentResponse.status()).toBe(201);
  const agent = (await agentResponse.json()).agent;
  const projectResponse = await api.post('/api/projects', {
    data: { name: 'Activity project ' + randomUUID(), description: 'Synthetic project notes.' },
  });
  expect(projectResponse.status()).toBe(201);
  const project = (await projectResponse.json()).project;
  const taskResponse = await api.post('/api/tasks', {
    data: {
      title: 'Activity task ' + randomUUID(),
      description: taskNotes,
      project: project._id,
      assigneeType: 'agent',
      assigneeAgent: agent._id,
    },
  });
  expect(taskResponse.status()).toBe(201);
  return { agent, project, task: (await taskResponse.json()).task };
};

test('Developer plan is explicit text-only simulation and exact human approval leaves tasks unchanged', async ({
  page,
  playwright,
}) => {
  const token = await registerAndLogin(page);
  const api = await playwright.request.newContext({
    baseURL: apiURL,
    extraHTTPHeaders: { Authorization: 'Bearer ' + token },
  });
  try {
    const source = await fixture(api, 'Suggest a TypeScript numeric double function as text only.');
    const before = (await (await api.get('/api/tasks')).json()).tasks;
    const created = await api.post('/api/runs', {
      headers: { 'Idempotency-Key': randomUUID() },
      data: {
        taskId: source.task._id,
        agentId: source.agent._id,
        input: 'Draft a technical plan, no code execution',
      },
    });
    expect(created.status()).toBe(201);
    const queued = (await created.json()).run;
    await page.goto('/workforce/runs/' + queued._id);
    await page.getByLabel('Run workflow', { exact: true }).selectOption('developer');
    await expect(page.getByRole('button', { name: 'Execute draft', exact: true })).toBeDisabled();
    expect((await (await api.get('/api/runs/' + queued._id)).json()).run.status).toBe('queued');
    await page.getByLabel('Execution mode', { exact: true }).selectOption('demo');
    const executed = page.waitForResponse(
      (r) => r.url() === apiURL + '/api/runs/' + queued._id + '/execute',
    );
    await page.getByRole('button', { name: 'Execute draft', exact: true }).click();
    const response = await executed;
    expect(response.status()).toBe(200);
    const draft = (await response.json()).run;
    expect(draft).toMatchObject({
      workflow: 'developer',
      status: 'awaiting-approval',
      result: { simulation: true, provider: 'demo' },
    });
    expect(response.request().postDataJSON()).toEqual({
      mode: 'demo',
      includeProject: false,
      workflow: 'developer',
    });
    const output = page.getByRole('region', { name: 'Proposed output', exact: true });
    await expect(output).toContainText('Code suggestion (text only; unexecuted/unverified)');
    await expect(output).toContainText('Proposed checks (not run)');
    await page
      .getByLabel('Review note (optional)', { exact: true })
      .fill('Developer text reviewed');
    await page.getByRole('button', { name: 'Approve draft', exact: true }).click();
    await expect(page.getByText('Developer text reviewed', { exact: true })).toBeVisible();
    const approved = (await (await api.get('/api/runs/' + queued._id)).json()).run;
    expect(approved.review.resultDigest).toBe(draft.resultDigest);
    expect(approved.result).toEqual(draft.result);
    expect((await (await api.get('/api/tasks')).json()).tasks).toEqual(before);
    await page.reload();
    await expect(page.getByText('Developer text reviewed', { exact: true })).toBeVisible();
  } finally {
    await api.dispose();
  }
});
