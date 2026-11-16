import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { store } from '../../redux/store';
import { clearAuth } from '../../redux/slices/authSlice';
import {
  daysFromNow,
  makeProject,
  makeTask,
  renderApp,
  signIn,
  stubTaskApi,
} from '../../test/renderApp';

vi.mock('../../components/ui/toaster', () => ({ toaster: { create: vi.fn() } }));

afterEach(() => {
  store.dispatch(clearAuth());
  localStorage.clear();
  vi.unstubAllGlobals();
});

// Local noon `days` ago, as the API returns a moment.
const completedDaysAgo = (days: number) => {
  const date = new Date();
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() - days, 12).toISOString();
};
const done = (id: string, daysAgo: number, overrides = {}) =>
  makeTask({
    _id: id,
    title: 'Task ' + id,
    status: 'done',
    completedAt: completedDaysAgo(daysAgo),
    ...overrides,
  });
const metric = (label: string) =>
  within(screen.getByRole('region', { name: 'Progress metrics' }))
    .getByText(label)
    .closest('div')!.parentElement!;
const table = () => screen.getByRole('table', { name: /tasks completed each/i });

describe('Progress page', () => {
  it('is linked from the sidebar and shows rule-based figures for the last 7 days', async () => {
    signIn();
    stubTaskApi(
      [
        done('a', 0, { project: 'p1', dueDate: daysFromNow(0) }),
        done('b', 1, { project: 'p1', dueDate: daysFromNow(-3) }),
        done('c', 2),
        done('previous', 10),
        makeTask({ _id: 'open', title: 'Open', createdAt: completedDaysAgo(0) }),
      ],
      [makeProject({ _id: 'p1', name: 'Launch' })],
    );
    renderApp('/progress');
    expect(await screen.findByRole('heading', { level: 1, name: 'Progress' })).toBeInTheDocument();
    const nav = within(screen.getByRole('navigation', { name: /main/i, hidden: true }));
    expect(nav.getByRole('link', { name: 'Progress', hidden: true })).toHaveAttribute(
      'href',
      '/progress',
    );
    expect(screen.getByText(/rule-based, not AI/)).toBeInTheDocument();
    expect(await screen.findByRole('status')).toHaveTextContent(
      'Showing the last 7 days: 3 tasks completed.',
    );
    expect(within(metric('Completed')).getByText('3')).toBeInTheDocument();
    expect(
      within(metric('Completed')).getByText('2 more than the previous 7 days'),
    ).toBeInTheDocument();
    expect(within(metric('Created')).getByText('1')).toBeInTheDocument();
    expect(within(metric('Finished on time')).getByText('1')).toBeInTheDocument();
    expect(
      within(metric('Finished on time')).getByText('50% of 2 tasks with a due date'),
    ).toBeInTheDocument();

    const rows = within(table()).getAllByRole('row');
    // A header row plus one row per day, oldest first, with the count as text.
    expect(rows).toHaveLength(8);
    expect(within(rows[0]).getByRole('columnheader', { name: 'Day' })).toBeInTheDocument();
    expect(within(rows[7]).getAllByRole('cell')[1]).toHaveTextContent('1');
    expect(within(rows[5]).getAllByRole('cell')[1]).toHaveTextContent('1');
    expect(within(rows[1]).getAllByRole('cell')[1]).toHaveTextContent('0');

    const byProject = within(screen.getByRole('region', { name: 'By project' }));
    const items = byProject.getAllByRole('listitem');
    expect(items[0]).toHaveTextContent('Launch');
    expect(items[0]).toHaveTextContent('2 completed');
    expect(items[1]).toHaveTextContent('No project');
  });

  it('switches to weekly rows for 28 days and announces the change', async () => {
    signIn();
    stubTaskApi([done('a', 0), done('b', 20), done('c', 40)]);
    renderApp('/progress');
    const week = await screen.findByRole('button', { name: 'Last 28 days' });
    expect(screen.getByRole('button', { name: 'Last 7 days' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(week).toHaveAttribute('aria-pressed', 'false');
    await userEvent.click(week);
    expect(week).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('status')).toHaveTextContent(
      'Showing the last 28 days: 2 tasks completed.',
    );
    expect(screen.getByRole('heading', { name: 'Completed each week' })).toBeInTheDocument();
    const rows = within(table()).getAllByRole('row');
    expect(rows).toHaveLength(5);
    expect(within(rows[0]).getByRole('columnheader', { name: 'Week' })).toBeInTheDocument();
    expect(within(rows[1]).getAllByRole('cell')[0]).toHaveTextContent(/ to /);
  });

  it('explains done tasks without a completion date instead of guessing one', async () => {
    signIn();
    stubTaskApi([
      makeTask({ _id: 'legacy', title: 'Legacy', status: 'done', completedAt: null }),
      makeTask({ _id: 'legacy-2', title: 'Legacy two', status: 'done' }),
    ]);
    renderApp('/progress');
    expect(
      await screen.findByText(
        '2 done tasks were finished before TaskForge recorded completion dates, so they are not counted here.',
      ),
    ).toBeInTheDocument();
    expect(within(metric('Completed')).getByText('0')).toBeInTheDocument();
    expect(
      within(metric('Finished on time')).getByText('No completed tasks had a due date'),
    ).toBeInTheDocument();
    expect(screen.getByText('Nothing completed yet')).toBeInTheDocument();
  });

  it('shows loading and load-error states', async () => {
    signIn();
    vi.stubGlobal(
      'fetch',
      vi.fn(() => new Promise(() => {})),
    );
    const { unmount } = renderApp('/progress');
    expect(await screen.findByText('Loading your progress...')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Progress metrics' })).not.toBeInTheDocument();
    unmount();

    const { fetchMock } = stubTaskApi();
    fetchMock.mockResolvedValueOnce({
      status: 500,
      ok: false,
      json: async () => ({ message: 'Database unavailable' }),
    });
    renderApp('/progress');
    expect(await screen.findByText('Database unavailable')).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.queryByRole('region', { name: 'Progress metrics' })).not.toBeInTheDocument(),
    );
  });
});
