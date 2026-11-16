import { randomUUID } from 'node:crypto';
import { expect, test, type Page } from '@playwright/test';

const apiURL = 'http://127.0.0.1:5051';
const password = 'Reviews QA passphrase 2026!';

test.beforeEach(async ({ baseURL }) => {
  expect(baseURL, 'Reviews QA requires the guarded local client').toBe('http://127.0.0.1:5174');
});

const registerAndLogin = async (page: Page) => {
  const email = 'reviews-' + randomUUID() + '@example.test';
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

test('completes and reopens a daily review on mobile using the keyboard', async ({
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
    const title = 'Review focus ' + randomUUID();
    const created = await api.post('/api/tasks', { data: { title } });
    expect(created.status()).toBe(201);
    const task = (await created.json()).task;

    await page.goto('/reviews');
    await expect(page.getByRole('heading', { level: 1, name: 'Reviews' })).toBeVisible();
    const focus = page.getByRole('checkbox', { name: new RegExp(title) });
    await focus.focus();
    await page.keyboard.press('Space');
    await expect(focus).toBeChecked();
    const reflection = page.getByRole('textbox', { name: /what went well today/i });
    await reflection.focus();
    await page.keyboard.type('Synthetic reflection.');
    const save = page.getByRole('button', { name: 'Save daily review', exact: true });
    await save.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('main').getByText(/^Saved at /)).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);

    const saved = (await (await api.get('/api/reviews?kind=daily&limit=1')).json()).reviews;
    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({
      reflection: 'Synthetic reflection.',
      focusTasks: [task._id],
    });

    await page.reload();
    await expect(page.getByRole('textbox', { name: /what went well today/i })).toHaveValue(
      'Synthetic reflection.',
    );
    await expect(page.getByRole('checkbox', { name: new RegExp(title) })).toBeChecked();
  } finally {
    await api.dispose();
  }
});
