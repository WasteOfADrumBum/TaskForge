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
    expect(screen.getByRole('status')).toHaveTextContent('Added skill: type-script.');
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
    expect(screen.getByRole('status')).toHaveTextContent('react is now Expert.');
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
    expect(screen.getByRole('status')).toHaveFocus();
    expect(screen.getByRole('status')).toHaveTextContent(
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
    expect(screen.getByRole('status')).toHaveFocus();
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
  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('react is now Expert.'));
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
