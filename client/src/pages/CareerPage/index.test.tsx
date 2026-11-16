import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { store } from '../../redux/store';
import { clearAuth } from '../../redux/slices/authSlice';
import { makeTask, renderApp, requestsTo, signIn, stubTaskApi } from '../../test/renderApp';
import type { SavedJob, Skill } from '../../types/career';

vi.mock('../../components/ui/toaster', () => ({ toaster: { create: vi.fn() } }));

afterEach(() => {
  store.dispatch(clearAuth());
  localStorage.clear();
  vi.unstubAllGlobals();
});

const skill = (name: string, level: Skill['level'] = 'working'): Skill => ({
  _id: 'skill-' + name,
  name,
  level,
});
const job = (overrides: Partial<SavedJob> = {}): SavedJob => ({
  _id: 'job-1',
  title: 'Frontend Engineer',
  company: 'Example Co',
  url: 'https://jobs.example.com/1',
  requiredSkills: ['react', 'graphql'],
  status: 'saved',
  notes: '',
  ...overrides,
});
// The page's own status line comes first; sections below have their own.
const pageStatus = () => screen.getAllByRole('status')[0];
const stub = (
  skills: Skill[] = [],
  jobs: SavedJob[] = [],
  tasks = [] as ReturnType<typeof makeTask>[],
) => stubTaskApi(tasks, [], [], [], [], skills, jobs);
const region = (name: RegExp) => within(screen.getByRole('region', { name }));

describe('Career page', () => {
  it('adds a skill as a slug, refuses a duplicate, and changes its level', async () => {
    signIn();
    const { fetchMock, skills } = stub([skill('react')]);
    renderApp('/career');
    expect(await screen.findByRole('heading', { level: 1, name: 'Career' })).toBeInTheDocument();
    const nav = within(screen.getByRole('navigation', { name: /main/i, hidden: true }));
    expect(nav.getByRole('link', { name: 'Career', hidden: true })).toHaveAttribute(
      'href',
      '/career',
    );

    const section = await waitFor(() => region(/^skills/i));
    await userEvent.type(section.getByRole('textbox', { name: /skill/i }), ' Type Script ');
    await userEvent.selectOptions(section.getByRole('combobox', { name: 'Level' }), 'strong');
    await userEvent.click(section.getByRole('button', { name: 'Add skill' }));
    expect(await section.findByText('type-script')).toBeInTheDocument();
    expect(pageStatus()).toHaveTextContent('Added skill: type-script.');
    expect(JSON.parse(String(requestsTo(fetchMock, 'POST', '/api/skills')[0][1]?.body))).toEqual({
      name: 'type-script',
      level: 'strong',
    });

    await userEvent.type(section.getByRole('textbox', { name: /skill/i }), 'React');
    await userEvent.click(section.getByRole('button', { name: 'Add skill' }));
    expect(section.getByRole('alert')).toHaveTextContent('react is already in your skills.');
    expect(requestsTo(fetchMock, 'POST', '/api/skills')).toHaveLength(1);

    await userEvent.selectOptions(
      section.getByRole('combobox', { name: 'Level for react' }),
      'expert',
    );
    await waitFor(() => expect(skills.find((item) => item.name === 'react')?.level).toBe('expert'));
    expect(pageStatus()).toHaveTextContent('react is now Expert.');
  });

  it('saves a job with parsed skills and shows what you have and what is missing', async () => {
    signIn();
    const { fetchMock } = stub([skill('react')]);
    renderApp('/career');
    const section = await waitFor(() => region(/saved jobs/i));
    await userEvent.type(section.getByRole('textbox', { name: /job title/i }), 'Frontend Engineer');
    await userEvent.type(section.getByRole('textbox', { name: /company/i }), 'Example Co');
    await userEvent.type(
      section.getByRole('textbox', { name: /link/i }),
      'https://jobs.example.com/1',
    );
    await userEvent.type(
      section.getByRole('textbox', { name: /required skills/i }),
      'React, GraphQL, react',
    );
    await userEvent.click(section.getByRole('button', { name: 'Save job' }));
    expect(
      await section.findByRole('heading', { level: 3, name: 'Frontend Engineer' }),
    ).toBeInTheDocument();
    expect(
      JSON.parse(String(requestsTo(fetchMock, 'POST', '/api/jobs')[0][1]?.body)),
    ).toMatchObject({
      title: 'Frontend Engineer',
      requiredSkills: ['react', 'graphql'],
    });
    expect(section.getByText(/^react$/, { selector: 'li *, li' })).toBeInTheDocument();
    expect(section.getByText('Missing: 1')).toBeInTheDocument();
    const missing = section.getByRole('list', { name: 'Missing skills for Frontend Engineer' });
    expect(within(missing).getByText('graphql')).toBeInTheDocument();
    const link = section.getByRole('link', { name: /job posting for frontend engineer/i });
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('rejects a bad skill in the job form without saving', async () => {
    signIn();
    const { fetchMock } = stub();
    renderApp('/career');
    const section = await waitFor(() => region(/saved jobs/i));
    await userEvent.type(section.getByRole('textbox', { name: /job title/i }), 'Dev');
    await userEvent.type(section.getByRole('textbox', { name: /required skills/i }), 'react, C#');
    await userEvent.click(section.getByRole('button', { name: 'Save job' }));
    expect(section.getByRole('alert')).toHaveTextContent('"C#" is not a valid skill.');
    expect(requestsTo(fetchMock, 'POST', '/api/jobs')).toHaveLength(0);
  });

  it('turns a missing skill into a learning task once, then says it was added', async () => {
    signIn();
    const { fetchMock, tasks } = stub([skill('react')], [job()]);
    renderApp('/career');
    const add = await screen.findByRole('button', {
      name: 'Add learning task: graphql for Frontend Engineer',
    });
    await userEvent.click(add);
    expect(await screen.findByText('Learning task added')).toBeInTheDocument();
    expect(pageStatus()).toHaveFocus();
    expect(pageStatus()).toHaveTextContent(
      'Added learning task: Learn graphql for Frontend Engineer.',
    );
    const [post] = requestsTo(fetchMock, 'POST', '/api/tasks');
    expect(JSON.parse(String(post[1]?.body))).toMatchObject({
      title: 'Learn graphql for Frontend Engineer',
      status: 'todo',
    });
    expect(tasks[0].title).toBe('Learn graphql for Frontend Engineer');
    expect(
      screen.queryByRole('button', { name: /add learning task: graphql/i }),
    ).not.toBeInTheDocument();
  });

  it('shows an existing learning task as added and every-skill jobs as covered', async () => {
    signIn();
    stub(
      [skill('react')],
      [job(), job({ _id: 'job-2', title: 'React Dev', requiredSkills: ['react'] })],
      [makeTask({ _id: 't1', title: 'Learn graphql for Frontend Engineer' })],
    );
    renderApp('/career');
    expect(await screen.findByText('Learning task added')).toBeInTheDocument();
    expect(screen.getByText('You have every listed skill.')).toBeInTheDocument();
  });

  it('changes a job status and deletes a job after confirming, keeping focus', async () => {
    signIn();
    const { jobs } = stub([], [job()]);
    renderApp('/career');
    await userEvent.selectOptions(
      await screen.findByRole('combobox', { name: 'Status for Frontend Engineer' }),
      'applied',
    );
    await waitFor(() => expect(jobs[0].status).toBe('applied'));
    await userEvent.click(screen.getByRole('button', { name: 'Delete: Frontend Engineer' }));
    expect(screen.getByRole('button', { name: 'Confirm delete: Frontend Engineer' })).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    await waitFor(() => expect(jobs).toHaveLength(0));
    expect(pageStatus()).toHaveFocus();
    expect(screen.getByText('No saved jobs yet.')).toBeInTheDocument();
  });

  it('shows load errors with retries and a failed learning task as an alert', async () => {
    signIn();
    const { fetchMock } = stub([skill('react')], [job()]);
    const passThrough = fetchMock.getMockImplementation()!;
    let failSkills = true;
    fetchMock.mockImplementation(async (url: string, options: RequestInit = {}) => {
      const method = options.method ?? 'GET';
      if (url.endsWith('/api/skills') && method === 'GET' && failSkills) {
        failSkills = false;
        return { status: 500, ok: false, json: async () => ({ message: 'Skills offline' }) };
      }
      if (url.endsWith('/api/tasks') && method === 'POST') {
        return { status: 500, ok: false, json: async () => ({ message: 'Could not add task' }) };
      }
      return passThrough(url, options);
    });
    renderApp('/career');
    expect(await screen.findByText('Skills offline')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Retry loading skills' }));
    await userEvent.click(
      await screen.findByRole('button', {
        name: 'Add learning task: graphql for Frontend Engineer',
      }),
    );
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not add task');
  });
});

it('never renders a non-https job link and checks the link before saving', async () => {
  signIn();
  const { fetchMock } = stubTaskApi(
    [],
    [],
    [],
    [],
    [],
    [],
    [
      {
        _id: 'job-x',
        title: 'Old record',
        company: '',
        url: 'javascript:alert(1)',
        requiredSkills: [],
        status: 'saved',
        notes: '',
      },
    ],
  );
  renderApp('/career');
  expect(await screen.findByRole('heading', { level: 3, name: 'Old record' })).toBeInTheDocument();
  expect(screen.queryByRole('link', { name: /job posting/i })).not.toBeInTheDocument();
  const section = within(screen.getByRole('region', { name: /saved jobs/i }));
  await userEvent.type(section.getByRole('textbox', { name: /job title/i }), 'Dev');
  await userEvent.type(section.getByRole('textbox', { name: /link/i }), 'jobs.example.com');
  await userEvent.click(section.getByRole('button', { name: 'Save job' }));
  expect(section.getByRole('alert')).toHaveTextContent('Use a full https link');
  expect(requestsTo(fetchMock, 'POST', '/api/jobs')).toHaveLength(0);
});

it('keeps focus on a level select after changing it', async () => {
  signIn();
  stubTaskApi([], [], [], [], [], [{ _id: 's1', name: 'react', level: 'working' }]);
  renderApp('/career');
  const select = await screen.findByRole('combobox', { name: 'Level for react' });
  await userEvent.selectOptions(select, 'expert');
  await waitFor(() => expect(pageStatus()).toHaveTextContent('react is now Expert.'));
  expect(select).toBeEnabled();
  expect(select).toHaveFocus();
});

describe('Career goals panel', () => {
  it('lists active career goals with their targets and links to Goals', async () => {
    signIn();
    stubTaskApi(
      [],
      [],
      [],
      [],
      [
        {
          _id: 'g1',
          title: 'Reach senior engineer',
          description: '',
          status: 'active',
          area: 'career',
          targetDate: '2099-06-30T00:00:00.000Z',
        },
        { _id: 'g2', title: 'Run a 5K', description: '', status: 'active', targetDate: null },
        {
          _id: 'g3',
          title: 'Old career goal',
          description: '',
          status: 'achieved',
          area: 'career',
          targetDate: null,
        },
      ],
    );
    renderApp('/career');
    const panel = within(await screen.findByRole('region', { name: 'Career goals' }));
    const list = await panel.findByRole('list', { name: 'Active career goals' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(1);
    expect(within(list).getByText('Reach senior engineer')).toBeInTheDocument();
    expect(within(list).getByText(/^Target /)).toBeInTheDocument();
    expect(panel.queryByText('Run a 5K')).not.toBeInTheDocument();
    expect(panel.getByRole('link', { name: 'Add or update goals' })).toHaveAttribute(
      'href',
      '/goals',
    );
  });

  it('shows an empty state and retries a failed load', async () => {
    signIn();
    const { fetchMock } = stubTaskApi();
    const passThrough = fetchMock.getMockImplementation()!;
    let fail = true;
    fetchMock.mockImplementation(async (url: string, options: RequestInit = {}) =>
      fail && /\/api\/goals$/.test(url)
        ? { status: 500, ok: false, json: async () => ({ message: 'Goals are unavailable' }) }
        : passThrough(url, options),
    );
    renderApp('/career');
    const panel = within(await screen.findByRole('region', { name: 'Career goals' }));
    expect(await panel.findByRole('alert')).toHaveTextContent('Goals are unavailable');
    fail = false;
    await userEvent.click(panel.getByRole('button', { name: 'Retry loading goals' }));
    expect(await panel.findByText(/No active career goals yet/)).toBeInTheDocument();
  });
});

describe('Resume section', () => {
  const resumeStub = (resume: Parameters<typeof stubTaskApi>[8] = null) =>
    stubTaskApi(
      [],
      [],
      [],
      [],
      [],
      [skill('react'), skill('node-js'), skill('aws')],
      [
        job({ _id: 'j1', title: 'Frontend Engineer', requiredSkills: ['react', 'graphql'] }),
        job({ _id: 'j2', title: 'Platform', requiredSkills: ['graphql', 'docker'] }),
      ],
      [],
      resume,
    );

  it('loads the saved resume, checks skills by whole word and saves changes', async () => {
    signIn();
    const { fetchMock, getResume } = resumeStub({
      _id: 'r1',
      headline: 'Developer',
      summary: 'Builds with React and Node.js.',
      body: '',
      updatedAt: new Date().toISOString(),
    });
    renderApp('/career');
    const section = within(await screen.findByRole('region', { name: 'Resume' }));
    const summary = await section.findByRole('textbox', { name: 'Summary' });
    expect(summary).toHaveValue('Builds with React and Node.js.');
    expect(section.getByText(/^Saved at /)).toBeInTheDocument();
    const mentioned = await section.findByRole('list', { name: 'Your skills it mentions: 2' });
    expect(
      within(mentioned)
        .getAllByRole('listitem')
        .map((item) => item.textContent),
    ).toEqual(['node-js', 'react']);
    expect(
      within(section.getByRole('list', { name: 'Your skills it does not mention: 1' })).getByText(
        'aws',
      ),
    ).toBeInTheDocument();
    const needs = section.getByRole('list', {
      name: 'Skills your open saved jobs need that it does not mention',
    });
    expect(
      within(needs)
        .getAllByRole('listitem')
        .map((item) => item.textContent),
    ).toEqual(['graphql: needed by 2 jobs', 'docker: needed by 1 job']);

    await userEvent.type(
      section.getByRole('textbox', { name: /experience, education/i }),
      'AWS Lambda',
    );
    expect(section.getByRole('list', { name: 'Your skills it mentions: 3' })).toBeInTheDocument();
    expect(section.getByText('Unsaved changes.')).toBeInTheDocument();
    await userEvent.click(section.getByRole('button', { name: 'Save resume' }));
    await waitFor(() => expect(getResume()?.body).toBe('AWS Lambda'));
    expect(await section.findByText(/^Saved at /)).toBeInTheDocument();
    expect(JSON.parse(String(requestsTo(fetchMock, 'PUT', '/api/resume')[0][1]?.body))).toEqual({
      headline: 'Developer',
      summary: 'Builds with React and Node.js.',
      body: 'AWS Lambda',
    });
  });

  it('starts empty when there is no resume and shows a failed save as an alert', async () => {
    signIn();
    const { fetchMock } = resumeStub();
    const passThrough = fetchMock.getMockImplementation()!;
    fetchMock.mockImplementation(async (url: string, options: RequestInit = {}) =>
      options.method === 'PUT'
        ? { status: 503, ok: false, json: async () => ({ message: 'Resume unavailable' }) }
        : passThrough(url, options),
    );
    renderApp('/career');
    const section = within(await screen.findByRole('region', { name: 'Resume' }));
    expect(await section.findByRole('textbox', { name: 'Headline' })).toHaveValue('');
    await userEvent.click(section.getByRole('button', { name: 'Save resume' }));
    expect(await section.findByRole('alert')).toHaveTextContent('Resume unavailable');
    expect(section.getByRole('status')).toHaveTextContent('');
  });

  it('retries a failed load', async () => {
    signIn();
    const { fetchMock } = resumeStub();
    const passThrough = fetchMock.getMockImplementation()!;
    let fail = true;
    fetchMock.mockImplementation(async (url: string, options: RequestInit = {}) =>
      fail && url.endsWith('/api/resume')
        ? { status: 500, ok: false, json: async () => ({ message: 'Resume is down' }) }
        : passThrough(url, options),
    );
    renderApp('/career');
    const section = within(await screen.findByRole('region', { name: 'Resume' }));
    expect(await section.findByRole('alert')).toHaveTextContent('Resume is down');
    fail = false;
    await userEvent.click(section.getByRole('button', { name: 'Retry loading resume' }));
    expect(section.getByRole('status')).toHaveFocus();
    expect(await section.findByRole('textbox', { name: 'Headline' })).toBeInTheDocument();
  });
});

describe('Applications', () => {
  const daysAgo = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString();

  it('counts active applications, lists them oldest first and adds a follow-up task once', async () => {
    signIn();
    const { fetchMock, tasks } = stub(
      [],
      [
        job({ _id: 'j1', title: 'Saved only', statusChangedAt: daysAgo(40) }),
        job({ _id: 'j2', title: 'Interview', status: 'interviewing', statusChangedAt: daysAgo(3) }),
        job({ _id: 'j3', title: 'Waiting', status: 'applied', statusChangedAt: daysAgo(20) }),
        job({ _id: 'j4', title: 'Legacy', status: 'applied', company: '' }),
      ],
    );
    renderApp('/career');
    const section = await waitFor(() => region(/^applications$/i));
    const counts = await section.findByRole('list', { name: 'Applications by status' });
    expect(
      within(counts)
        .getAllByRole('listitem')
        .map((entry) => entry.textContent),
    ).toEqual(['Applied: 2', 'Interviewing: 1', 'Offers: 0']);
    const rows = within(section.getByRole('list', { name: 'Active applications' })).getAllByRole(
      'listitem',
    );
    expect(rows.map((row) => row.querySelector('p')?.textContent)).toEqual([
      'Waiting at Example Co',
      'Interview at Example Co',
      'Legacy',
    ]);
    expect(rows[0]).toHaveTextContent(/No update in \d+ days\. Time to follow up\./);
    expect(rows[1]).not.toHaveTextContent(/follow up/i);
    expect(rows[2]).toHaveTextContent(/^LegacyApplied$/);

    const add = within(rows[0]).getByRole('button', { name: 'Add follow-up task: Waiting' });
    await waitFor(() => expect(add).not.toHaveAttribute('aria-disabled'));
    await userEvent.dblClick(add);
    expect(await section.findByText('Follow-up task added')).toBeInTheDocument();
    expect(pageStatus()).toHaveFocus();
    expect(pageStatus()).toHaveTextContent(
      'Added follow-up task: Follow up on Waiting at Example Co.',
    );
    const posts = requestsTo(fetchMock, 'POST', '/api/tasks');
    expect(posts).toHaveLength(1);
    expect(JSON.parse(String(posts[0][1]?.body))).toMatchObject({
      title: 'Follow up on Waiting at Example Co',
      status: 'todo',
    });
    expect(tasks[0].title).toBe('Follow up on Waiting at Example Co');
  });

  it('shows an existing follow-up task as added and an empty state', async () => {
    signIn();
    stub(
      [],
      [job({ _id: 'j3', title: 'Waiting', status: 'applied', statusChangedAt: daysAgo(30) })],
      [makeTask({ _id: 't1', title: 'Follow up on Waiting at Example Co' })],
    );
    renderApp('/career');
    const section = await waitFor(() => region(/^applications$/i));
    expect(await section.findByText('Follow-up task added')).toBeInTheDocument();
    expect(section.queryByRole('button', { name: /follow-up/i })).not.toBeInTheDocument();
  });

  it('says when there are no active applications', async () => {
    signIn();
    stub([], [job({ status: 'rejected' })]);
    renderApp('/career');
    const section = await waitFor(() => region(/^applications$/i));
    expect(
      await section.findByText(
        'No active applications. Set a saved job to Applied when you apply.',
      ),
    ).toBeInTheDocument();
  });
});
