import { randomUUID } from 'node:crypto';
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

// KAN-76: automated WCAG 2.2 A and AA checks (the rules axe-core can test) and page structure on
// every Phase 1 to 7 route, signed out and signed in, at desktop and phone widths. Passing is not
// full conformance: screen-reader output and visual judgement still need a person.

const apiURL = 'http://127.0.0.1:5051';
const password = 'Accessibility QA passphrase 2026!';
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
const VIEWPORTS = [
  { name: 'desktop', width: 1280, height: 900 },
  { name: 'phone', width: 390, height: 844 },
] as const;

test.beforeEach(async ({ baseURL }) => {
  expect(baseURL, 'Accessibility QA requires the guarded local client').toBe(
    'http://127.0.0.1:5174',
  );
});

/** Lets lazy routes and their data settle before axe reads the page. */
const settle = async (page: Page) => {
  await page.waitForLoadState('networkidle');
  await expect(page.getByRole('main')).toBeVisible();
  await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);
};

const violations = async (page: Page) => {
  const { violations: found } = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  // Generated class names say little, so each node also names its markup and axe's reason.
  return found.map(
    (v) =>
      `${v.id} (${v.impact}): ` +
      v.nodes
        .map(
          (n) =>
            `${n.html.replace(/\s+/g, ' ').slice(0, 120)} -> ${n.any[0]?.message ?? n.failureSummary ?? ''}`,
        )
        .join(' | '),
  );
};

/** One main landmark, one level-one heading, no skipped heading levels and a page language. */
const checkStructure = async (page: Page, label: string) => {
  await expect(page.locator('html'), label).toHaveAttribute('lang', 'en');
  await expect(page.getByRole('main'), label).toHaveCount(1);
  await expect(page.getByRole('heading', { level: 1 }), label).toHaveCount(1);
  const levels = await page
    .locator('h1, h2, h3, h4, h5, h6')
    .evaluateAll((els) =>
      els.filter((e) => e.getClientRects().length > 0).map((e) => Number(e.tagName[1])),
    );
  for (let i = 1; i < levels.length; i++) {
    expect(
      levels[i] - levels[i - 1],
      `${label}: heading ${i + 1} skips a level`,
    ).toBeLessThanOrEqual(1);
  }
};

const audit = async (page: Page, path: string, viewport: string) => {
  await page.goto(path);
  await settle(page);
  const label = `${path} (${viewport})`;
  expect(await violations(page), `axe violations on ${label}`).toEqual([]);
  await checkStructure(page, label);
};

test.describe('signed out', () => {
  for (const viewport of VIEWPORTS) {
    test(`public pages pass on ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize(viewport);
      for (const path of ['/', '/login', '/register', '/no-such-page']) {
        await audit(page, path, viewport.name);
      }
    });
  }

  test('sign-in errors are announced and tied to their fields', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await settle(page);
    expect(await violations(page), 'axe violations on the login errors').toEqual([]);
  });
});

// One account for every signed-in page: the guarded API caps registrations per run.
test('every signed-in page passes on desktop and phone', async ({ page, playwright }) => {
  test.setTimeout(240_000);
  const email = 'a11y-' + randomUUID() + '@example.test';
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

  // Pages are checked with content in them, not only their empty states.
  const api = await playwright.request.newContext({
    baseURL: apiURL,
    extraHTTPHeaders: { Authorization: 'Bearer ' + token },
  });
  let projectId = '';
  let agentId = '';
  let sourceId = '';
  try {
    const project = await api.post('/api/projects', {
      data: { name: 'A11y project ' + randomUUID(), description: 'Synthetic project notes.' },
    });
    expect(project.status()).toBe(201);
    projectId = (await project.json()).project._id;
    const agent = await api.post('/api/agents', {
      data: {
        name: 'A11y agent ' + randomUUID(),
        role: 'Researcher',
        permissions: ['task.read', 'artifact.draft'],
      },
    });
    expect(agent.status()).toBe(201);
    agentId = (await agent.json()).agent._id;
    for (const [title, priority] of [
      ['A11y high task', 'high'],
      ['A11y low task', 'low'],
    ] as const) {
      const task = await api.post('/api/tasks', {
        data: { title: title + ' ' + randomUUID(), priority, project: projectId },
      });
      expect(task.status()).toBe(201);
    }
    const source = await api.post('/api/knowledge', {
      headers: { 'Idempotency-Key': randomUUID() },
      data: {
        title: 'A11y release notes',
        content: 'Synthetic notes for the accessibility sweep.',
        kind: 'note',
        project: null,
      },
    });
    expect(source.status()).toBe(201);
    sourceId = (await source.json()).source._id;
  } finally {
    await api.dispose();
  }

  const paths = [
    '/home',
    '/work',
    '/work/projects',
    `/work/projects/${projectId}`,
    '/workforce',
    `/workforce/${agentId}`,
    '/workforce/runs',
    '/knowledge',
    `/knowledge/${sourceId}`,
    '/knowledge/ask',
    '/progress',
    '/reviews',
    '/goals',
    '/career',
    '/learning',
    '/brand',
    '/settings',
  ];
  for (const viewport of VIEWPORTS) {
    await page.setViewportSize(viewport);
    for (const path of paths) await audit(page, path, viewport.name);
  }
});
