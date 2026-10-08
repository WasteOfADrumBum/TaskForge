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

test('explicitly simulates a Chief of Staff proposal and records review without applying priority or assignment changes', async ({
  page,
  playwright,
}) => {
  const token = await registerAndLogin(page);
  const api = await playwright.request.newContext({
    baseURL: apiURL,
    extraHTTPHeaders: { Authorization: 'Bearer ' + token },
  });
  try {
    const source = await fixture(api, 'Urgent research task for human review.');
    const candidateResponse = await api.post('/api/agents', {
      data: {
        name: 'Captured Research Candidate',
        role: 'Researcher',
        skills: ['research'],
        permissions: ['task.read', 'artifact.draft'],
      },
    });
    expect(candidateResponse.status()).toBe(201);
    const candidate = (await candidateResponse.json()).agent;
    const beforeTasks = (await (await api.get('/api/tasks')).json()).tasks;
    const create = await api.post('/api/runs', {
      headers: { 'Idempotency-Key': randomUUID() },
      data: {
        taskId: source.task._id,
        agentId: source.agent._id,
        input: 'Suggest priority and an eligible agent for this task.',
      },
    });
    expect(create.status()).toBe(201);
    const queued = (await create.json()).run;
    await page.goto('/workforce/runs/' + queued._id);
    await expect(page.getByLabel('Run workflow', { exact: true })).toHaveValue('draft');
    await page.getByLabel('Run workflow', { exact: true }).selectOption('chief-of-staff');
    await expect(page.getByRole('button', { name: 'Execute draft', exact: true })).toBeDisabled();
    expect((await (await api.get('/api/runs/' + queued._id)).json()).run.status).toBe('queued');
    await page.getByLabel('Execution mode', { exact: true }).selectOption('demo');
    const executed = page.waitForResponse(
      (response) =>
        response.url() === apiURL + '/api/runs/' + queued._id + '/execute' &&
        response.request().method() === 'POST',
    );
    await page.getByRole('button', { name: 'Execute draft', exact: true }).click();
    const response = await executed;
    expect(response.status()).toBe(200);
    expect(response.request().postDataJSON()).toEqual({
      mode: 'demo',
      includeProject: false,
      workflow: 'chief-of-staff',
    });
    const draft = (await response.json()).run;
    expect(draft).toMatchObject({
      workflow: 'chief-of-staff',
      status: 'awaiting-approval',
      result: {
        provider: 'demo',
        simulation: true,
        proposal: { taskId: source.task._id, agentId: candidate._id, priority: 'high' },
      },
    });
    expect(draft.result.text).toContain('No AI model was called');
    expect(draft.result.text).toContain(candidate._id);
    expect(draft.result.text).toContain('no task changes are applied');
    expect(
      draft.context.sources
        .filter((item: { kind: string }) => item.kind === 'agent')
        .map((item: { id: string }) => item.id),
    ).toEqual([candidate._id]);
    await expect(
      page.getByText('Chief of Staff triage: proposals only.', { exact: true }),
    ).toBeVisible();
    await expect(page.getByRole('region', { name: 'Proposed output', exact: true })).toContainText(
      'Suggested priority: high',
    );
    await expect(page.getByRole('region', { name: 'Proposed output', exact: true })).toContainText(
      'Captured Research Candidate',
    );
    expect((await (await api.get('/api/tasks')).json()).tasks).toEqual(beforeTasks);
    await page
      .getByLabel('Review note (optional)', { exact: true })
      .fill('Reviewed advisory Chief proposal');
    await page.getByRole('button', { name: 'Approve draft', exact: true }).click();
    await expect(page.getByText('Reviewed advisory Chief proposal', { exact: true })).toBeVisible();
    const reviewed = (await (await api.get('/api/runs/' + queued._id)).json()).run;
    expect(reviewed).toMatchObject({
      status: 'approved',
      result: draft.result,
      context: draft.context,
      review: { resultDigest: draft.resultDigest, reviewedVersion: draft.version },
    });
    expect((await (await api.get('/api/tasks')).json()).tasks).toEqual(beforeTasks);
    await page.reload();
    await expect(page.getByText('Reviewed advisory Chief proposal', { exact: true })).toBeVisible();
  } finally {
    await api.dispose();
  }
});
