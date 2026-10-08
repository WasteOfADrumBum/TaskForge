import { randomUUID } from 'node:crypto';
import { expect, test, type Page, type PlaywrightWorkerArgs } from '@playwright/test';
const apiURL = 'http://127.0.0.1:5051';
const login = async (page: Page, playwright: PlaywrightWorkerArgs['playwright']) => {
  const publicApi = await playwright.request.newContext({ baseURL: apiURL });
  const credentials = {
    email: 'knowledge-' + randomUUID() + '@example.test',
    password: 'Knowledge QA passphrase 2026!',
  };
  expect((await publicApi.post('/api/auth/register', { data: credentials })).status()).toBe(201);
  const response = await publicApi.post('/api/auth/login', { data: credentials });
  expect(response.status()).toBe(200);
  const token = (await response.json()).token;
  await publicApi.dispose();
  await page.goto('/login');
  await page.evaluate((value) => localStorage.setItem('token', value), token);
  const api = await playwright.request.newContext({
    baseURL: apiURL,
    extraHTTPHeaders: { Authorization: 'Bearer ' + token },
  });
  return { api, token };
};
test.beforeEach(async ({ baseURL }) =>
  expect(baseURL, 'Knowledge QA uses only guarded local infrastructure').toBe(
    'http://127.0.0.1:5174',
  ),
);
test('private text persists, searches and verifies citations, edits with versions, and deletes on mobile', async ({
  page,
  playwright,
}) => {
  const { api } = await login(page, playwright);
  try {
    const projectResponse = await api.post('/api/projects', {
      data: { name: 'Knowledge QA project' },
    });
    expect(projectResponse.status()).toBe(201);
    const project = (await projectResponse.json()).project;
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/knowledge');
    await expect(page.getByRole('heading', { name: 'Knowledge', exact: true })).toBeVisible();
    await expect(page.getByText(/no AI model is called/)).toBeVisible();
    const text =
      '<script>window.hostile=true</script> Release notes: lunar retrieval belongs to this private source.';
    await page.getByLabel(/^Source title/).fill('Knowledge browser note');
    await page.getByLabel(/^Source text/).fill(text);
    await page.getByLabel('Source type').selectOption('text');
    await page.getByLabel('Source project (optional)').selectOption(project._id);
    await page.getByRole('button', { name: 'Save source', exact: true }).click();
    await expect(page).toHaveURL(/\/knowledge\/[a-f0-9]{24}$/);
    const id = page.url().split('/').at(-1)!;
    await expect(page.getByText(text, { exact: true })).toBeVisible();
    expect(await page.evaluate(() => 'hostile' in window)).toBe(false);
    const stored = (await (await api.get('/api/knowledge/' + id)).json()).source;
    expect(stored.content).toBe(text);
    expect(stored.project).toBe(project._id);
    expect(stored.version).toBe(1);
    await page.getByRole('link', { name: 'Back to Knowledge' }).click();
    await page.getByLabel('Search knowledge').fill('lunar');
    await page.getByLabel('Search project').selectOption(project._id);
    await page.getByRole('button', { name: 'Search sources' }).click();
    await page.getByRole('link', { name: 'Knowledge browser note — version 1' }).click();
    await expect(
      page.getByText('Citation verified against this current source version.'),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Edit source', exact: true }).click();
    await page.getByLabel(/^Source text/).fill('New version: revised lunar notes.');
    await page.getByRole('button', { name: 'Save changes' }).click();
    await expect(page.getByText('Source saved.', { exact: true })).toBeVisible();
    await expect(
      page.getByText('Citation is stale or invalid. Search again for a current excerpt.'),
    ).toBeVisible();
    expect((await (await api.get('/api/knowledge/' + id)).json()).source.version).toBe(2);
    await page.getByRole('button', { name: 'Delete source', exact: true }).click();
    expect((await api.get('/api/knowledge/' + id)).status()).toBe(200);
    await page.getByRole('button', { name: 'Confirm delete source' }).click();
    await expect(page).toHaveURL(/\/knowledge$/);
    expect((await api.get('/api/knowledge/' + id)).status()).toBe(404);
    await page.goto('/knowledge/' + id);
    await expect(page.getByText('Knowledge source not found')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Edit source', exact: true })).toHaveCount(0);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    );
    expect(overflow).toBe(false);
  } finally {
    await api.dispose();
  }
});
test('conflicting edits cannot overwrite source and foreign source routes reveal no text', async ({
  page,
  playwright,
}) => {
  const { api } = await login(page, playwright);
  try {
    const create = await api.post('/api/knowledge', {
      headers: { 'Idempotency-Key': randomUUID() },
      data: {
        title: 'Conflict source',
        content: 'Original private content',
        kind: 'note',
        project: null,
      },
    });
    expect(create.status()).toBe(201);
    const source = (await create.json()).source;
    await page.goto('/knowledge/' + source.id);
    await page.getByRole('button', { name: 'Edit source', exact: true }).click();
    await page.getByLabel(/^Source text/).fill('Unsaved conflicting text');
    const update = await api.put('/api/knowledge/' + source.id, {
      data: {
        title: source.title,
        content: 'Updated elsewhere',
        kind: 'note',
        project: null,
        version: source.version,
        contentDigest: source.contentDigest,
      },
    });
    expect(update.status()).toBe(200);
    await page.getByRole('button', { name: 'Save changes' }).click();
    await expect(page.getByRole('alert')).toContainText('Refresh');
    await expect(page.getByRole('button', { name: 'Save changes' })).toBeDisabled();
    expect((await (await api.get('/api/knowledge/' + source.id)).json()).source.content).toBe(
      'Updated elsewhere',
    );
    await page.getByRole('button', { name: 'Refresh source (discard edits)' }).click();
    await expect(page.getByText('Updated elsewhere', { exact: true })).toBeVisible();
    const foreignPage = await page.context().newPage();
    const foreign = await login(foreignPage, playwright);
    try {
      await foreignPage.goto('/knowledge/' + source.id);
      await expect(foreignPage.getByText('Knowledge source not found')).toBeVisible();
      await expect(foreignPage.getByText('Updated elsewhere', { exact: true })).toHaveCount(0);
      expect((await foreign.api.get('/api/knowledge/search?q=elsewhere')).status()).toBe(200);
      expect(
        (await (await foreign.api.get('/api/knowledge/search?q=elsewhere')).json()).results,
      ).toEqual([]);
    } finally {
      await foreign.api.dispose();
      await foreignPage.close();
    }
  } finally {
    await api.dispose();
  }
});
