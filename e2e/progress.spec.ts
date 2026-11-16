import { randomUUID } from 'node:crypto';
import { expect, test, type Page } from '@playwright/test';

const apiURL = 'http://127.0.0.1:5051';
const password = 'Progress QA passphrase 2026!';

test.beforeEach(async ({ baseURL }) => {
  expect(baseURL, 'Progress QA requires the guarded local client').toBe('http://127.0.0.1:5174');
});

const registerAndLogin = async (page: Page) => {
  const email = 'progress-' + randomUUID() + '@example.test';
  await page.goto('/register');
  await page.getByLabel(/^Email/).fill(email);
  await page.getByLabel(/^Password/).fill(password);
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.getByLabel(/^Email/).fill(email);
  await page.getByLabel(/^Password/).fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(/\/home$/);
  const token = await page.evaluate(() => localStorage.getItem('token'));
  expect(token).toBeTruthy();
  return token;
};

test('shows real completions on the Progress page on mobile and switches range by keyboard', async ({
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
    const created = await api.post('/api/tasks', {
      data: { title: 'Progress task ' + randomUUID() },
    });
    expect(created.status()).toBe(201);
    const task = (await created.json()).task;
    const finished = await api.patch('/api/tasks/' + task._id, { data: { status: 'done' } });
    expect(finished.status()).toBe(200);
    expect((await finished.json()).task.completedAt).toEqual(expect.any(String));

    await page.goto('/progress');
    await expect(page.getByRole('heading', { level: 1, name: 'Progress' })).toBeVisible();
    await expect(page.getByRole('status')).toHaveText('Showing the last 7 days: 1 task completed.');
    const table = page.getByRole('table', { name: /tasks completed each day/i });
    await expect(table.getByRole('row')).toHaveCount(8);

    const month = page.getByRole('button', { name: 'Last 28 days', exact: true });
    await month.focus();
    await page.keyboard.press('Enter');
    await expect(month).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('status')).toHaveText(
      'Showing the last 28 days: 1 task completed.',
    );
    await expect(
      page.getByRole('table', { name: /tasks completed each week/i }).getByRole('row'),
    ).toHaveCount(5);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
  } finally {
    await api.dispose();
  }
});
