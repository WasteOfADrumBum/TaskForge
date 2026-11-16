import { randomUUID } from 'node:crypto';
import { expect, test, type Page } from '@playwright/test';

const apiURL = 'http://127.0.0.1:5051';
const password = 'Growth QA passphrase 2026!';

test.beforeEach(async ({ baseURL }) => {
  expect(baseURL, 'Growth QA requires the guarded local client').toBe('http://127.0.0.1:5174');
});

const registerAndLogin = async (page: Page) => {
  const email = 'growth-' + randomUUID() + '@example.test';
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

// One account for the Phase 5 and 6 flows: the guarded API caps registrations per run, so each new
// spec should reuse an account where it can.
test('growth flows on mobile by keyboard: progress, reviews, goals, career, applications, skill growth, learning and project ideas', async ({
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
    await expect(
      page
        .getByRole('main')
        .getByRole('status')
        .filter({ hasText: /^Showing the last/ }),
    ).toHaveText('Showing the last 7 days: 1 task completed.');
    const table = page.getByRole('table', { name: /tasks completed each day/i });
    await expect(table.getByRole('row')).toHaveCount(8);

    const month = page.getByRole('button', { name: 'Last 28 days', exact: true });
    await month.focus();
    await page.keyboard.press('Enter');
    await expect(month).toHaveAttribute('aria-pressed', 'true');
    await expect(
      page
        .getByRole('main')
        .getByRole('status')
        .filter({ hasText: /^Showing the last/ }),
    ).toHaveText('Showing the last 28 days: 1 task completed.');
    await expect(
      page.getByRole('table', { name: /tasks completed each week/i }).getByRole('row'),
    ).toHaveCount(5);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);

    // Daily review: the completed task is in Look back; choose an open task as focus.
    const title = 'Review focus ' + randomUUID();
    const open = await api.post('/api/tasks', { data: { title } });
    expect(open.status()).toBe(201);
    const focusTask = (await open.json()).task;
    await page.goto('/reviews');
    await expect(page.getByRole('heading', { level: 1, name: 'Reviews' })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Look back' })).toContainText(task.title);
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
      focusTasks: [focusTask._id],
    });
    await page.reload();
    await expect(page.getByRole('textbox', { name: /what went well today/i })).toHaveValue(
      'Synthetic reflection.',
    );
    await expect(page.getByRole('checkbox', { name: new RegExp(title) })).toBeChecked();

    // Goals: add one by keyboard, then check in on it from the weekly review.
    const goalTitle = 'Goal ' + randomUUID();
    await page.goto('/goals');
    await expect(page.getByRole('heading', { level: 1, name: 'Goals' })).toBeVisible();
    const goalField = page.getByRole('textbox', { name: /title/i });
    await goalField.focus();
    await page.keyboard.type(goalTitle);
    await page.keyboard.press('Enter');
    await expect(page.getByRole('region', { name: /active goals/i })).toContainText(goalTitle);
    await page.goto('/reviews');
    const weekly = page.getByRole('button', { name: 'Weekly review', exact: true });
    await weekly.focus();
    await page.keyboard.press('Enter');
    const goalsStep = page.getByRole('region', { name: 'Check in on your goals' });
    const achieve = goalsStep.getByRole('button', { name: 'Mark achieved: ' + goalTitle });
    await achieve.focus();
    await page.keyboard.press('Enter');
    await expect(goalsStep.getByText('Marked achieved: ' + goalTitle + '.')).toBeVisible();
    const storedGoals = (await (await api.get('/api/goals')).json()).goals;
    expect(storedGoals).toEqual([
      expect.objectContaining({
        title: goalTitle,
        status: 'achieved',
        achievedAt: expect.any(String),
      }),
    ]);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);

    // Career: a career goal, a skill, a saved job, and a learning task from its skill gap.
    const careerGoal = 'Career goal ' + randomUUID().slice(0, 8);
    const createdGoal = await api.post('/api/goals', {
      data: { title: careerGoal, area: 'career' },
    });
    expect(createdGoal.status()).toBe(201);
    await page.goto('/career');
    await expect(page.getByRole('heading', { level: 1, name: 'Career' })).toBeVisible();
    await expect(
      page.getByRole('region', { name: 'Career goals' }).getByRole('list', {
        name: 'Active career goals',
      }),
    ).toContainText(careerGoal);
    const skillsSection = page.getByRole('region', { name: /^skills/i });
    const skillField = skillsSection.getByRole('textbox', { name: /skill/i });
    await skillField.focus();
    await page.keyboard.type('React');
    await page.keyboard.press('Enter');
    await expect(skillsSection.getByText('react', { exact: true })).toBeVisible();
    const jobsSection = page.getByRole('region', { name: /saved jobs/i });
    const jobTitle = 'Frontend Engineer ' + randomUUID().slice(0, 8);
    await jobsSection.getByRole('textbox', { name: /job title/i }).fill(jobTitle);
    await jobsSection.getByRole('textbox', { name: /required skills/i }).fill('react, graphql');
    const saveJob = jobsSection.getByRole('button', { name: 'Save job', exact: true });
    await saveJob.focus();
    await page.keyboard.press('Enter');
    const learn = jobsSection.getByRole('button', {
      name: 'Add learning task: graphql for ' + jobTitle,
    });
    // The button waits for the task list, which the app shell loads.
    await expect(learn).toBeEnabled();
    await learn.focus();
    await page.keyboard.press('Enter');
    await expect(jobsSection.getByText('Learning task added')).toBeVisible();
    const learningTitle = 'Learn graphql for ' + jobTitle;
    const allTasks = (await (await api.get('/api/tasks')).json()).tasks;
    expect(allTasks).toEqual(
      expect.arrayContaining([expect.objectContaining({ title: learningTitle, status: 'todo' })]),
    );

    // Resume: typed and saved by keyboard, then checked against the skills above.
    const resumeSection = page.getByRole('region', { name: 'Resume' });
    const summaryField = resumeSection.getByRole('textbox', { name: 'Summary' });
    await summaryField.focus();
    await page.keyboard.type('Builds accessible React apps.');
    const saveResume = resumeSection.getByRole('button', { name: 'Save resume', exact: true });
    await saveResume.focus();
    await page.keyboard.press('Enter');
    await expect(resumeSection.getByText(/^Saved at /)).toBeVisible();
    await expect(
      resumeSection.getByRole('list', { name: 'Your skills it mentions: 1' }),
    ).toContainText('react');
    await expect(
      resumeSection.getByRole('list', {
        name: 'Skills your open saved jobs need that it does not mention',
      }),
    ).toContainText('graphql: needed by 1 job');
    expect((await (await api.get('/api/resume')).json()).resume).toMatchObject({
      summary: 'Builds accessible React apps.',
    });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);

    // Applications: marking the job applied lists it, dated today, with no follow-up yet.
    const statusSelect = jobsSection.getByRole('combobox', { name: 'Status for ' + jobTitle });
    await statusSelect.focus();
    await statusSelect.selectOption('applied');
    await expect(page.getByText(jobTitle + ' is now Applied.')).toBeVisible();
    const applications = page.getByRole('region', { name: 'Applications', exact: true });
    await expect(applications.getByRole('list', { name: 'Applications by status' })).toContainText(
      'Applied: 1',
    );
    const activeApplications = applications.getByRole('list', { name: 'Active applications' });
    await expect(activeApplications).toContainText(jobTitle);
    await expect(activeApplications).toContainText(/Applied\. Since .+ \(today\)/);
    await expect(applications.getByRole('button', { name: /follow-up/i })).toHaveCount(0);
    const jobsNow = (await (await api.get('/api/jobs')).json()).jobs;
    const appliedJob = jobsNow.find((item: { title: string }) => item.title === jobTitle);
    expect(appliedJob).toMatchObject({ status: 'applied' });
    expect(Number.isFinite(Date.parse(appliedJob.statusChangedAt))).toBe(true);

    // Skill growth in the weekly review: the new skill, the finished learning task and the gap.
    const learningTask = allTasks.find((item: { title: string }) => item.title === learningTitle);
    const learnedDone = await api.patch('/api/tasks/' + learningTask._id, {
      data: { status: 'done' },
    });
    expect(learnedDone.status()).toBe(200);
    await page.goto('/reviews');
    const weeklyAgain = page.getByRole('button', { name: 'Weekly review', exact: true });
    await weeklyAgain.focus();
    await page.keyboard.press('Enter');
    const growthStep = page.getByRole('region', { name: 'Review your skill growth' });
    // List names start with a count, so match the start: other flows on this account may add more.
    await expect(growthStep.getByRole('list', { name: /^Skills added this week: / })).toContainText(
      'react, working knowledge',
    );
    await expect(
      growthStep.getByRole('list', { name: /^Learning tasks finished this week: / }),
    ).toContainText(learningTitle);
    await expect(
      growthStep.getByRole('list', { name: 'Skills your open saved jobs need most' }),
    ).toContainText('graphql: needed by 1 job');
    const careerLink = growthStep.getByRole('link', { name: 'Update skills and jobs in Career' });
    await careerLink.focus();
    await expect(careerLink).toBeFocused();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);

    // Learning: the graphql gap becomes a roadmap item, then it is started, all by keyboard.
    await page.goto('/learning');
    await expect(page.getByRole('heading', { level: 1, name: 'Learning' })).toBeVisible();
    const gapsSection = page.getByRole('region', { name: /from your skill gaps/i });
    const addGap = gapsSection.getByRole('button', { name: 'Add to roadmap: graphql' });
    await addGap.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByText('Added to your roadmap: Learn graphql.')).toBeFocused();
    await expect(gapsSection.getByText('On your roadmap')).toBeVisible();
    const start = page
      .getByRole('region', { name: /^planned/i })
      .getByRole('button', { name: 'Start: Learn graphql' });
    await start.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByText('Learn graphql is now in progress.')).toBeFocused();
    const roadmap = (await (await api.get('/api/learning')).json()).items;
    expect(roadmap).toEqual([
      expect.objectContaining({ title: 'Learn graphql', skill: 'graphql', status: 'in_progress' }),
    ]);

    // Portfolio project: the graphql gap pairs with react, which the same job lists.
    const projectTitle = 'Portfolio project: graphql with react';
    const addProject = page
      .getByRole('region', { name: /portfolio project ideas/i })
      .getByRole('button', { name: 'Add project: ' + projectTitle });
    await addProject.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByText('Added to your roadmap: ' + projectTitle + '.')).toBeFocused();
    const withProject = (await (await api.get('/api/learning')).json()).items;
    expect(withProject).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ title: projectTitle, skill: 'graphql', kind: 'project' }),
      ]),
    );
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
  } finally {
    await api.dispose();
  }
});
