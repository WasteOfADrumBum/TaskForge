import { randomUUID } from 'node:crypto';
import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

const apiURL = 'http://127.0.0.1:5051';
const password = 'Handoff QA passphrase 2026!';

test.beforeEach(async ({ baseURL }) => {
  expect(baseURL, 'Handoff QA requires the guarded local client').toBe('http://127.0.0.1:5174');
});

const registerAndLogin = async (page: Page) => {
  const email = 'handoff-' + randomUUID() + '@example.test';
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

test('explicitly hands approved output to a different assigned agent without executing or approving the child automatically', async ({
  page,
  playwright,
}) => {
  const token = await registerAndLogin(page);
  const api = await playwright.request.newContext({
    baseURL: apiURL,
    extraHTTPHeaders: { Authorization: 'Bearer ' + token },
  });
  try {
    const source = await fixture(api, 'SOURCE_TASK_PRIVATE_NOTES_EXCLUDED');
    const target = await fixture(api, 'Target task notes.');
    const created = await api.post('/api/runs', {
      headers: { 'Idempotency-Key': randomUUID() },
      data: { taskId: source.task._id, agentId: source.agent._id, input: 'Source request' },
    });
    expect(created.status()).toBe(201);
    const parent = (await created.json()).run;
    const execution = await api.post('/api/runs/' + parent._id + '/execute', {
      data: { mode: 'demo' },
    });
    expect(execution.status()).toBe(200);
    const draft = (await execution.json()).run;
    const approval = await api.post('/api/runs/' + parent._id + '/review', {
      data: {
        decision: 'approved',
        version: draft.version,
        resultDigest: draft.resultDigest,
        note: 'SOURCE_REVIEW_PRIVATE_NOTE_EXCLUDED',
      },
    });
    expect(approval.status()).toBe(200);
    const approved = (await approval.json()).run;
    const beforeTasks = (await (await api.get('/api/tasks')).json()).tasks;
    await page.goto('/workforce/runs/' + parent._id);
    await expect(page.getByText('No child handoffs.', { exact: true })).toBeVisible();
    await page.getByLabel('Handoff target task', { exact: true }).selectOption(target.task._id);
    await page.getByLabel('Handoff request', { exact: true }).fill('Explicit next handoff work');
    const handedOff = page.waitForResponse(
      (response) =>
        response.url() === apiURL + '/api/runs/' + parent._id + '/handoff' &&
        response.request().method() === 'POST',
    );
    await page.getByRole('button', { name: 'Create queued handoff', exact: true }).click();
    const response = await handedOff;
    expect(response.status()).toBe(201);
    expect(response.request().postDataJSON()).toEqual({
      taskId: target.task._id,
      agentId: target.agent._id,
      input: 'Explicit next handoff work',
      version: approved.version,
      resultDigest: approved.resultDigest,
    });
    const child = (await response.json()).run;
    expect(child).toMatchObject({
      status: 'queued',
      result: null,
      version: 0,
      handoff: {
        parent: parent._id,
        ancestors: [parent._id],
        sourceVersion: approved.version,
        sourceResultDigest: approved.resultDigest,
      },
    });
    await expect(
      page.getByText('Handoff queued. No model was called or task changed.', { exact: true }),
    ).toBeVisible();
    const childLink = page.getByRole('link', { name: 'View child run', exact: true });
    await childLink.focus();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL('/workforce/runs/' + child._id);
    await expect(page.getByRole('link', { name: 'View parent run', exact: true })).toHaveAttribute(
      'href',
      '/workforce/runs/' + parent._id,
    );
    await expect(page.getByLabel('Execution mode', { exact: true })).toHaveValue('');
    await expect(page.getByRole('button', { name: 'Execute draft', exact: true })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Approve draft', exact: true })).toHaveCount(0);
    expect((await (await api.get('/api/runs/' + child._id)).json()).run.status).toBe('queued');
    await page.getByLabel('Execution mode', { exact: true }).selectOption('demo');
    await page.getByRole('button', { name: 'Execute draft', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Approve draft', exact: true })).toBeEnabled();
    const childDraft = (await (await api.get('/api/runs/' + child._id)).json()).run;
    expect(childDraft.status).toBe('awaiting-approval');
    expect(childDraft.context.sources.map((source: { kind: string }) => source.kind)).toEqual([
      'task',
      'run',
    ]);
    expect(childDraft.context.sources[1]).toMatchObject({
      id: parent._id,
      version: approved.version,
      resultDigest: approved.resultDigest,
      description: approved.result.text,
    });
    expect(JSON.stringify(childDraft.context)).not.toContain('SOURCE_TASK_PRIVATE_NOTES_EXCLUDED');
    expect(JSON.stringify(childDraft.context)).not.toContain('SOURCE_REVIEW_PRIVATE_NOTE_EXCLUDED');
    await page
      .getByLabel('Review note (optional)', { exact: true })
      .fill('Separate child decision');
    await page.getByRole('button', { name: 'Approve draft', exact: true }).click();
    await expect(page.getByText('Separate child decision', { exact: true })).toBeVisible();
    expect((await (await api.get('/api/runs/' + child._id)).json()).run.status).toBe('approved');
    expect((await (await api.get('/api/runs/' + parent._id)).json()).run).toEqual(approved);
    expect((await (await api.get('/api/tasks')).json()).tasks).toEqual(beforeTasks);
    await page.reload();
    await expect(page.getByText('Separate child decision', { exact: true })).toBeVisible();
  } finally {
    await api.dispose();
  }
});
