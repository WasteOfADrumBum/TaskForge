import { randomUUID } from 'node:crypto';
import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

const apiURL = 'http://127.0.0.1:5051';
const password = 'Run activity QA passphrase 2026!';

test.beforeEach(async ({ baseURL }) => {
  expect(baseURL, 'Run activity QA requires the guarded local client').toBe(
    'http://127.0.0.1:5174',
  );
});

const registerAndLogin = async (page: Page) => {
  const email = 'run-activity-' + randomUUID() + '@example.test';
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

for (const decision of ['approved', 'rejected'] as const) {
  test(
    'creates, explicitly simulates and ' + decision + ' a run through activity UI',
    async ({ page, playwright }) => {
      const token = await registerAndLogin(page);
      const api = await playwright.request.newContext({
        baseURL: apiURL,
        extraHTTPHeaders: { Authorization: 'Bearer ' + token },
      });
      try {
        const { agent, project, task } = await fixture(api);
        await page.goto('/workforce/runs');
        await expect(
          page.getByRole('heading', { name: 'Run activity', exact: true }),
        ).toBeVisible();
        await page.getByLabel('Assigned task', { exact: true }).selectOption(task._id);
        const input = 'Synthetic UI run request ' + randomUUID();
        await page.getByLabel('Requested work', { exact: true }).fill(input);
        const createdResponse = page.waitForResponse(
          (response) =>
            response.url() === apiURL + '/api/runs' && response.request().method() === 'POST',
        );
        await page.getByRole('button', { name: 'Create queued run', exact: true }).click();
        const created = await createdResponse;
        expect(created.status()).toBe(201);
        expect(created.request().headers()['idempotency-key']).toMatch(
          /^[a-zA-Z0-9][a-zA-Z0-9._-]{15,127}$/,
        );
        const queued = (await created.json()).run;
        expect(queued).toMatchObject({ task: task._id, agent: agent._id, input, status: 'queued' });
        await expect(page).toHaveURL('/workforce/runs/' + queued._id);
        await expect(page.getByRole('heading', { name: 'Run detail', exact: true })).toBeVisible();
        const mode = page.getByLabel('Execution mode', { exact: true });
        await expect(mode).toHaveValue('');
        await expect(
          page.getByRole('button', { name: 'Execute draft', exact: true }),
        ).toBeDisabled();
        await expect(page.getByLabel('Include project notes', { exact: true })).not.toBeChecked();
        await expect(page.getByRole('button', { name: 'Approve draft', exact: true })).toHaveCount(
          0,
        );
        expect((await (await api.get('/api/runs/' + queued._id)).json()).run.status).toBe('queued');
        await mode.selectOption('demo');
        await page.getByLabel('Include project notes', { exact: true }).check();
        const executedResponse = page.waitForResponse(
          (response) =>
            response.url() === apiURL + '/api/runs/' + queued._id + '/execute' &&
            response.request().method() === 'POST',
        );
        await page.getByRole('button', { name: 'Execute draft', exact: true }).click();
        const executed = await executedResponse;
        expect(executed.request().postDataJSON()).toEqual({ mode: 'demo', includeProject: true });
        expect(executed.status()).toBe(200);
        const draft = (await executed.json()).run;
        expect(draft).toMatchObject({ status: 'awaiting-approval', executionMode: 'demo' });
        expect(draft.result).toMatchObject({ simulation: true, provider: 'demo' });
        expect(
          draft.context.sources.map((source: { kind: string; id: string }) => ({
            kind: source.kind,
            id: source.id,
          })),
        ).toEqual([
          { kind: 'task', id: task._id },
          { kind: 'project', id: project._id },
        ]);
        await expect(
          page.getByText(JSON.stringify(draft.result, null, 2), { exact: true }),
        ).toBeVisible();
        await expect(
          page.getByRole('heading', { name: 'Context snapshot', exact: true }),
        ).toBeVisible();
        await expect(
          page.getByRole('heading', { name: 'Lifecycle audit', exact: true }),
        ).toBeVisible();
        const note = 'Activity human decision ' + randomUUID();
        await page.getByLabel('Review note (optional)', { exact: true }).fill(note);
        await page
          .getByRole('button', {
            name: decision === 'approved' ? 'Approve draft' : 'Reject draft',
            exact: true,
          })
          .click();
        await expect(page.getByRole('button', { name: 'Approve draft', exact: true })).toHaveCount(
          0,
        );
        const persisted = (await (await api.get('/api/runs/' + queued._id)).json()).run;
        expect(persisted).toMatchObject({
          status: decision,
          version: draft.version + 1,
          context: draft.context,
          contextDigest: draft.contextDigest,
          result: draft.result,
          review: {
            decision,
            note,
            reviewedVersion: draft.version,
            resultDigest: draft.resultDigest,
          },
        });
        expect(persisted.auditEvents.map((event: { kind: string }) => event.kind)).toEqual([
          'created',
          'claimed',
          'drafted',
          decision,
        ]);
        expect(JSON.stringify(persisted.auditEvents)).not.toContain(note);
        expect((await (await api.get('/api/tasks')).json()).tasks).toEqual([task]);
        await page.reload();
        await expect(
          page.getByRole('heading', { name: 'Human review', exact: true }),
        ).toBeVisible();
        await expect(page.getByText(note, { exact: true })).toBeVisible();
        await page.goto('/workforce/runs');
        await expect(page.getByText(input, { exact: true })).toBeVisible();
        await expect(
          page.getByText(decision === 'approved' ? 'Approved' : 'Rejected', { exact: true }),
        ).toBeVisible();
      } finally {
        await api.dispose();
      }
    },
  );
}

test('opens run details by keyboard on mobile and renders hostile context as plain data without overflow', async ({
  page,
  playwright,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const token = await registerAndLogin(page);
  const api = await playwright.request.newContext({
    baseURL: apiURL,
    extraHTTPHeaders: { Authorization: 'Bearer ' + token },
  });
  try {
    const hostile = '<script>window.taskforgeInjected = true</script>' + 'context'.repeat(200);
    const { task, agent } = await fixture(api, hostile);
    const created = await api.post('/api/runs', {
      headers: { 'Idempotency-Key': randomUUID() },
      data: { taskId: task._id, agentId: agent._id, input: 'Mobile activity request' },
    });
    expect(created.status()).toBe(201);
    const queued = (await created.json()).run;
    const execute = await api.post('/api/runs/' + queued._id + '/execute', {
      data: { mode: 'demo' },
    });
    expect(execute.status()).toBe(200);
    await page.goto('/workforce/runs');
    const viewRun = page.getByRole('link', { name: /^View run/ });
    await expect(viewRun).toBeVisible();
    await viewRun.focus();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL('/workforce/runs/' + queued._id);
    await expect(
      page.getByRole('heading', { name: 'Context snapshot', exact: true }),
    ).toBeVisible();
    await expect(page.getByRole('region', { name: 'Context snapshot', exact: true })).toContainText(
      hostile,
    );
    expect(await page.evaluate(() => 'taskforgeInjected' in window)).toBe(false);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    const refresh = page.getByRole('button', { name: 'Refresh run', exact: true });
    await refresh.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('button', { name: 'Approve draft', exact: true })).toBeEnabled();
    expect((await (await api.get('/api/runs/' + queued._id)).json()).run.status).toBe(
      'awaiting-approval',
    );
    const cancellationFixture = await api.post('/api/runs', {
      headers: { 'Idempotency-Key': randomUUID() },
      data: { taskId: task._id, agentId: agent._id, input: 'Mobile queued cancellation' },
    });
    expect(cancellationFixture.status()).toBe(201);
    const cancellable = (await cancellationFixture.json()).run;
    await page.goto('/workforce/runs/' + cancellable._id);
    const cancel = page.getByRole('button', { name: 'Cancel run', exact: true });
    await expect(cancel).toBeEnabled();
    await cancel.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByText('Failed', { exact: true })).toBeVisible();
    const cancelled = (await (await api.get('/api/runs/' + cancellable._id)).json()).run;
    expect(cancelled).toMatchObject({ status: 'failed', failureReason: 'cancelled', result: null });
    await expect(page.getByRole('button', { name: 'Execute draft', exact: true })).toHaveCount(0);
    await page.reload();
    await expect(page.getByText('Failed', { exact: true })).toBeVisible();
    expect((await (await api.get('/api/tasks')).json()).tasks).toEqual([task]);
  } finally {
    await api.dispose();
  }
});
