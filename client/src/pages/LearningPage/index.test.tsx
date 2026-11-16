import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { store } from '../../redux/store';
import { clearAuth } from '../../redux/slices/authSlice';
import { renderApp, requestsTo, signIn, stubTaskApi } from '../../test/renderApp';
import type { SavedJob, Skill } from '../../types/career';
import type { LearningItem } from '../../types/learning';

vi.mock('../../components/ui/toaster', () => ({ toaster: { create: vi.fn() } }));

afterEach(() => {
  store.dispatch(clearAuth());
  localStorage.clear();
  vi.unstubAllGlobals();
});

const region = (name: RegExp) => within(screen.getByRole('region', { name }));
const item = (overrides: Partial<LearningItem> & { _id: string; title: string }): LearningItem => ({
  skill: '',
  kind: 'course',
  url: '',
  status: 'planned',
  targetDate: null,
  notes: '',
  ...overrides,
});
const skill = (name: string): Skill => ({ _id: 'skill-' + name, name, level: 'working' });
const job = (title: string, requiredSkills: string[], status: SavedJob['status'] = 'saved') =>
  ({
    _id: 'job-' + title,
    title,
    company: '',
    url: '',
    requiredSkills,
    status,
    notes: '',
  }) satisfies SavedJob;
const stub = (learning: LearningItem[] = [], skills: Skill[] = [], jobs: SavedJob[] = []) =>
  stubTaskApi([], [], [], [], [], skills, jobs, learning);

describe('Learning page', () => {
  it('is in the sidebar and adds an item with a slug skill, link and target date', async () => {
    signIn();
    const { fetchMock, learning } = stub();
    renderApp('/learning');
    expect(await screen.findByRole('heading', { level: 1, name: 'Learning' })).toBeInTheDocument();
    const nav = within(screen.getByRole('navigation', { name: /main/i, hidden: true }));
    expect(nav.getByRole('link', { name: 'Learning', hidden: true })).toHaveAttribute(
      'href',
      '/learning',
    );
    const form = within(screen.getByRole('form', { name: 'Add to your roadmap' }));
    const add = form.getByRole('button', { name: 'Add to roadmap' });
    await waitFor(() => expect(add).toBeEnabled());

    await userEvent.click(add);
    expect(form.getByRole('alert')).toHaveTextContent('Give the item a title.');
    expect(form.getByRole('textbox', { name: /title/i })).toHaveAttribute('aria-invalid', 'true');

    await userEvent.type(form.getByRole('textbox', { name: /title/i }), 'GraphQL course');
    await userEvent.type(form.getByRole('textbox', { name: /skill/i }), 'C++');
    await userEvent.click(add);
    expect(form.getByRole('alert')).toHaveTextContent(/for the skill/);
    expect(form.getByRole('textbox', { name: /skill/i })).toHaveAttribute('aria-invalid', 'true');
    await userEvent.clear(form.getByRole('textbox', { name: /skill/i }));
    await userEvent.type(form.getByRole('textbox', { name: /skill/i }), 'Graph QL');
    await userEvent.type(form.getByRole('textbox', { name: /link/i }), 'http://example.com');
    await userEvent.click(add);
    expect(form.getByRole('alert')).toHaveTextContent(/full https link/);
    expect(form.getByRole('textbox', { name: /link/i })).toHaveAttribute('aria-invalid', 'true');
    await userEvent.clear(form.getByRole('textbox', { name: /link/i }));
    await userEvent.type(
      form.getByRole('textbox', { name: /link/i }),
      'https://learn.example.com/gql',
    );
    await userEvent.selectOptions(form.getByRole('combobox', { name: 'Kind' }), 'Video');
    await userEvent.type(form.getByLabelText(/target date/i), '2099-01-15');
    await userEvent.click(add);

    expect(await screen.findByText('Added to your roadmap: GraphQL course.')).toBeInTheDocument();
    expect(JSON.parse(String(requestsTo(fetchMock, 'POST', '/api/learning')[0][1]?.body))).toEqual({
      title: 'GraphQL course',
      skill: 'graph-ql',
      kind: 'video',
      url: 'https://learn.example.com/gql',
      targetDate: '2099-01-15',
      notes: '',
    });
    expect(learning).toHaveLength(1);
    const planned = region(/^planned/i);
    expect(planned.getByText('GraphQL course')).toBeInTheDocument();
    expect(planned.getByText(/^Video · Skill: graph-ql · Target /)).toBeInTheDocument();
    const link = planned.getByRole('link', {
      name: 'Open link: GraphQL course (opens in a new tab)',
    });
    expect(link).toHaveAttribute('href', 'https://learn.example.com/gql');
    expect(link).toHaveAttribute('target', '_blank');
    expect(form.getByRole('textbox', { name: /title/i })).toHaveValue('');
  });

  it('moves items between statuses and deletes one after confirming, keeping focus', async () => {
    signIn();
    const { learning } = stub([
      item({ _id: 'l1', title: 'Rust book', kind: 'book', targetDate: '2020-01-01T00:00:00.000Z' }),
    ]);
    renderApp('/learning');
    const planned = await waitFor(() => region(/^planned/i));
    expect(await planned.findByText(/Past target \(/)).toBeInTheDocument();
    expect(region(/in progress/i).getByText('Nothing in progress.')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: /^done/i })).not.toBeInTheDocument();

    await userEvent.click(planned.getByRole('button', { name: 'Start: Rust book' }));
    expect(await screen.findByText('Rust book is now in progress.')).toHaveFocus();
    const inProgress = region(/in progress/i);
    await userEvent.click(inProgress.getByRole('button', { name: 'Mark done: Rust book' }));
    expect(await screen.findByText('Rust book is now done.')).toHaveFocus();
    const done = region(/^done/i);
    expect(done.queryByText(/Past target/)).not.toBeInTheDocument();
    expect(learning[0]).toMatchObject({ status: 'done', completedAt: expect.any(String) });

    await userEvent.click(done.getByRole('button', { name: 'Delete: Rust book' }));
    const confirm = done.getByRole('button', { name: 'Confirm delete: Rust book' });
    expect(confirm).toHaveFocus();
    await userEvent.click(confirm);
    expect(await screen.findByText('Deleted from your roadmap: Rust book.')).toHaveFocus();
    expect(learning).toHaveLength(0);
  });

  it('shows a failed change as an alert and keeps the item', async () => {
    signIn();
    const { fetchMock } = stub([item({ _id: 'l1', title: 'Rust book' })]);
    const passThrough = fetchMock.getMockImplementation()!;
    fetchMock.mockImplementation(async (url: string, options: RequestInit = {}) =>
      (options.method ?? 'GET') === 'PATCH'
        ? { status: 500, ok: false, json: async () => ({ message: 'Could not update' }) }
        : passThrough(url, options),
    );
    renderApp('/learning');
    const planned = await waitFor(() => region(/^planned/i));
    const start = await planned.findByRole('button', { name: 'Start: Rust book' });
    await userEvent.click(start);
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not update');
    expect(start).toHaveFocus();
    expect(planned.getByText('Rust book')).toBeInTheDocument();
  });

  it('turns a skill gap into a roadmap item and says when a gap is already planned', async () => {
    signIn();
    const { learning } = stub(
      [item({ _id: 'l1', title: 'AWS course', skill: 'aws' })],
      [skill('react')],
      [
        job('Frontend', ['react', 'graphql', 'aws']),
        job('Platform', ['aws', 'docker'], 'applied'),
        job('Old', ['kotlin'], 'closed'),
      ],
    );
    renderApp('/learning');
    const gaps = await waitFor(() => region(/from your skill gaps/i));
    const list = await gaps.findByRole('list', { name: 'Skills your open saved jobs need' });
    expect(
      within(list)
        .getAllByRole('listitem')
        .map((entry) => entry.textContent),
    ).toEqual([
      'aws: needed by 2 jobsOn your roadmap',
      'docker: needed by 1 jobAdd to roadmap',
      'graphql: needed by 1 jobAdd to roadmap',
    ]);
    await userEvent.click(gaps.getByRole('button', { name: 'Add to roadmap: graphql' }));
    expect(await screen.findByText('Added to your roadmap: Learn graphql.')).toHaveFocus();
    expect(learning[0]).toMatchObject({ title: 'Learn graphql', skill: 'graphql', kind: 'course' });
    expect(gaps.queryByRole('button', { name: 'Add to roadmap: graphql' })).not.toBeInTheDocument();
    expect(gaps.getByRole('link', { name: 'Update skills and jobs in Career' })).toHaveAttribute(
      'href',
      '/career',
    );
  });

  it('turns a portfolio-project idea into a roadmap project and marks planned ones', async () => {
    signIn();
    const { learning } = stub(
      [item({ _id: 'l1', title: 'Docker side project', skill: 'docker', kind: 'project' })],
      [skill('react'), skill('node-js')],
      [
        job('Frontend', ['react', 'graphql']),
        job('Platform', ['node-js', 'docker', 'graphql'], 'interviewing'),
        job('Old', ['kotlin'], 'rejected'),
      ],
    );
    renderApp('/learning');
    const projects = await waitFor(() => region(/portfolio project ideas/i));
    const list = await projects.findByRole('list', {
      name: 'Portfolio project ideas from your skill gaps',
    });
    const entries = within(list).getAllByRole('listitem');
    expect(entries.map((entry) => entry.textContent)).toEqual([
      'Portfolio project: graphql with node-jsAdd projectBuild a small project that uses graphql and shows your node-js. Wanted by: Frontend; Platform.',
      'Portfolio project: docker with node-jsOn your roadmapBuild a small project that uses docker and shows your node-js. Wanted by: Platform.',
    ]);
    await userEvent.click(
      projects.getByRole('button', {
        name: 'Add project: Portfolio project: graphql with node-js',
      }),
    );
    expect(
      await screen.findByText('Added to your roadmap: Portfolio project: graphql with node-js.'),
    ).toHaveFocus();
    expect(learning[0]).toMatchObject({
      title: 'Portfolio project: graphql with node-js',
      skill: 'graphql',
      kind: 'project',
      notes:
        'Build a small project that uses graphql and shows your node-js. Wanted by: Frontend; Platform.',
    });
    expect(projects.queryByRole('button', { name: /^Add project/ })).not.toBeInTheDocument();
    // The project is learning for that skill, so the gap list counts it as planned too.
    expect(
      region(/from your skill gaps/i).queryByRole('button', { name: 'Add to roadmap: graphql' }),
    ).not.toBeInTheDocument();
  });

  it('explains when there are no project ideas', async () => {
    signIn();
    stub([], [skill('react')], [job('Frontend', ['react'])]);
    renderApp('/learning');
    const projects = await waitFor(() => region(/portfolio project ideas/i));
    expect(
      await projects.findByText(
        'Your skills cover every open saved job, so there are no gaps to build a project around.',
      ),
    ).toBeInTheDocument();
  });

  it('retries a failed roadmap load and a failed skill-gap load', async () => {
    signIn();
    const { fetchMock } = stub([item({ _id: 'l1', title: 'Rust book' })], [], [job('A', ['go'])]);
    const passThrough = fetchMock.getMockImplementation()!;
    let fail = true;
    fetchMock.mockImplementation(async (url: string, options: RequestInit = {}) =>
      fail && /\/api\/(learning|jobs)$/.test(url)
        ? { status: 500, ok: false, json: async () => ({ message: 'Unavailable right now' }) }
        : passThrough(url, options),
    );
    renderApp('/learning');
    expect(await screen.findByText('Your roadmap could not be loaded.')).toBeInTheDocument();
    const gaps = region(/from your skill gaps/i);
    expect(
      screen.getByRole('button', { name: 'Add to roadmap', description: /must load/ }),
    ).toBeDisabled();
    expect(await gaps.findByRole('alert')).toHaveTextContent('Unavailable right now');
    fail = false;
    await userEvent.click(screen.getByRole('button', { name: 'Retry loading roadmap' }));
    expect(await region(/^planned/i).findByText('Rust book')).toBeInTheDocument();
    await userEvent.click(gaps.getByRole('button', { name: 'Retry loading skill gaps' }));
    expect(await gaps.findByText('go: needed by 1 job')).toBeInTheDocument();
  });
});
