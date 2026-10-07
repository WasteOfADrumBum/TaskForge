import { randomUUID } from 'node:crypto';
import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

// Real browser/API coverage uses only synthetic records in the guarded local QA stack.
const apiURL = 'http://127.0.0.1:5051';
const password = 'Local approval QA passphrase 2026!';

test.beforeEach(async ({ baseURL }) => {
  expect(baseURL, 'Approval QA must use the isolated local client').toBe('http://127.0.0.1:5174');
});

const createDraft = async (api: APIRequestContext) => {
  const agentResponse = await api.post('/api/agents', {
    data: {
      name: 'Approval QA agent ' + randomUUID(),
      role: 'Researcher',
      permissions: ['task.read', 'artifact.draft'],
    },
  });
  expect(agentResponse.status()).toBe(201);
  const agent = (await agentResponse.json()).agent;
  const taskResponse = await api.post('/api/tasks', {
    data: {
      title: 'Approval QA task ' + randomUUID(),
      description: 'This task must remain unchanged after draft review.',
      assigneeType: 'agent',
      assigneeAgent: agent._id,
    },
  });
  expect(taskResponse.status()).toBe(201);
  const task = (await taskResponse.json()).task;
  const input = 'Prepare a synthetic proposal ' + randomUUID();
  const created = await api.post('/api/runs', {
    headers: { 'Idempotency-Key': randomUUID() },
    data: { taskId: task._id, agentId: agent._id, input },
  });
  expect(created.status()).toBe(201);
  const executed = await api.post('/api/runs/' + (await created.json()).run._id + '/execute', {
    data: { mode: 'demo' },
  });
  expect(executed.status()).toBe(200);
  const run = (await executed.json()).run;
  expect(run).toMatchObject({ status: 'awaiting-approval', executionMode: 'demo' });
  expect(run.result).toMatchObject({ simulation: true, provider: 'demo' });
  return { agent, task, run, input };
};

const registerAndLogin = async (page: Page) => {
  const email = 'approval-browser-' + randomUUID() + '@example.test';
  await page.goto('/register');
  await page.getByLabel(/^Email/).fill(email);
  await page.getByLabel(/^Password/).fill(password);
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  // URL changes before the lazy login page necessarily replaces the registration form.
  // Both forms share input labels, so wait for the login-specific UI before filling.
  await expect(page.getByRole('heading', { name: 'Welcome back', exact: true })).toBeVisible();
  await page.getByLabel(/^Email/).fill(email);
  await page.getByLabel(/^Password/).fill(password);
  const loginResponse = page.waitForResponse(
    (response) =>
      response.url() === apiURL + '/api/auth/login' && response.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  expect((await loginResponse).status(), 'Browser sign-in must succeed at the API').toBe(200);
  await expect(page).toHaveURL(/\/home$/);
  const token = await page.evaluate(() => localStorage.getItem('token'));
  expect(token).toBeTruthy();
  return token;
};

for (const decision of ['approved', 'rejected'] as const) {
  test(
    'persists an exact simulated draft ' + decision + ' through browser review and refresh',
    async ({ page, playwright }) => {
      const token = await registerAndLogin(page);
      const api = await playwright.request.newContext({
        baseURL: apiURL,
        extraHTTPHeaders: { Authorization: 'Bearer ' + token },
      });
      try {
        const { agent, task, run, input } = await createDraft(api);
        await page.goto('/workforce/' + agent._id);
        const panel = page.getByRole('region', { name: 'Drafts awaiting review' });
        await expect(panel.getByText(input, { exact: true })).toBeVisible();
        await expect(panel.getByText('Simulation: canned output, no model called.')).toBeVisible();
        await expect(panel.getByRole('heading', { name: 'Proposed output' })).toBeVisible();
        await expect(panel.getByText(run.result.text, { exact: true })).toBeVisible();
        const note = 'Browser decision note ' + randomUUID();
        await panel.getByLabel('Review note (optional)').fill(note);
        await panel
          .getByRole('button', { name: decision === 'approved' ? 'Approve draft' : 'Reject draft' })
          .click();
        await expect(
          panel.getByText('Draft ' + decision + '. No tasks were changed.'),
        ).toBeVisible();
        await expect(panel.getByText('No drafts awaiting review.')).toBeVisible();

        const persisted = await api.get('/api/runs/' + run._id);
        expect(persisted.status()).toBe(200);
        const ownedRun = (await persisted.json()).run;
        expect(ownedRun).toMatchObject({
          input,
          status: decision,
          version: run.version + 1,
          result: run.result,
          resultDigest: run.resultDigest,
          review: {
            decision,
            note,
            reviewedVersion: run.version,
            resultDigest: run.resultDigest,
          },
        });
        expect(ownedRun.review.at).toEqual(expect.any(String));
        expect(ownedRun.auditEvents.slice(0, -1)).toEqual(run.auditEvents);
        expect(ownedRun.auditEvents.at(-1)).toMatchObject({
          kind: decision,
          from: 'awaiting-approval',
          to: decision,
          version: run.version + 1,
          resultDigest: run.resultDigest,
        });
        const audit = await api.get('/api/runs/' + run._id + '/audit');
        expect(audit.status()).toBe(200);
        expect((await audit.json()).events).toEqual(ownedRun.auditEvents);
        expect(JSON.stringify(ownedRun.auditEvents)).not.toContain(note);
        const unchangedTask = (await (await api.get('/api/tasks')).json()).tasks.find(
          (item: { _id: string }) => item._id === task._id,
        );
        expect(unchangedTask).toEqual(task);

        // An opposing replay cannot rewrite the persisted decision or append another event.
        const replay = await api.post('/api/runs/' + run._id + '/review', {
          data: {
            decision: decision === 'approved' ? 'rejected' : 'approved',
            version: run.version,
            resultDigest: run.resultDigest,
            note: 'Replay must not persist',
          },
        });
        expect(replay.status()).toBe(409);
        expect((await (await api.get('/api/runs/' + run._id)).json()).run).toEqual(ownedRun);
        await page.reload();
        await expect(panel.getByText('No drafts awaiting review.')).toBeVisible();
        await expect(panel.getByRole('button', { name: 'Approve draft' })).toHaveCount(0);
        await expect(panel.getByRole('button', { name: 'Reject draft' })).toHaveCount(0);
      } finally {
        await api.dispose();
      }
    },
  );
}
