import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { store } from '../../redux/store';
import { clearAuth } from '../../redux/slices/authSlice';
import {
  daysFromNow,
  makeTask,
  renderApp,
  requestsTo,
  signIn,
  stubTaskApi,
} from '../../test/renderApp';
import { localCalendarDate } from '../../utils/dates';
import { weekStart } from '../../utils/reviews';

vi.mock('../../components/ui/toaster', () => ({ toaster: { create: vi.fn() } }));

afterEach(() => {
  store.dispatch(clearAuth());
  localStorage.clear();
  vi.unstubAllGlobals();
});

const today = () => localCalendarDate(new Date());
const justNow = () => new Date().toISOString();
const step = (name: RegExp) => within(screen.getByRole('region', { name }));

describe('Reviews page', () => {
  it('guides a daily review and saves focus tasks and a reflection', async () => {
    signIn();
    const { fetchMock, reviews } = stubTaskApi([
      makeTask({ _id: 'd1', title: 'Shipped analytics', status: 'done', completedAt: justNow() }),
      makeTask({ _id: 'o1', title: 'Late invoice', dueDate: daysFromNow(-1) }),
      makeTask({ _id: 'o2', title: 'Plan sprint', dueDate: daysFromNow(2) }),
      makeTask({ _id: 'o3', title: 'Write notes' }),
      makeTask({ _id: 'o4', title: 'Call bank' }),
    ]);
    renderApp('/reviews');
    expect(await screen.findByRole('heading', { level: 1, name: 'Reviews' })).toBeInTheDocument();
    expect(screen.getByText(/rule-based, not AI/)).toBeInTheDocument();
    const nav = within(screen.getByRole('navigation', { name: /main/i, hidden: true }));
    expect(nav.getByRole('link', { name: 'Reviews', hidden: true })).toHaveAttribute(
      'href',
      '/reviews',
    );

    const lookBack = await waitFor(() => step(/look back/i));
    expect(lookBack.getByText('Completed today: 1')).toBeInTheDocument();
    expect(lookBack.getByText('Shipped analytics')).toBeInTheDocument();
    expect(step(/needs attention/i).getByText('Late invoice')).toBeInTheDocument();
    expect(step(/needs attention/i).queryByText('Plan sprint')).not.toBeInTheDocument();

    const focus = step(/choose your focus/i);
    expect(focus.getByRole('group', { name: /up to 3 tasks/i })).toBeInTheDocument();
    for (const name of [/late invoice/i, /plan sprint/i, /write notes/i]) {
      await userEvent.click(focus.getByRole('checkbox', { name }));
    }
    expect(focus.getByText('3 of 3 chosen')).toBeInTheDocument();
    expect(focus.getByRole('checkbox', { name: /call bank/i })).toBeDisabled();

    await userEvent.type(
      screen.getByRole('textbox', { name: /what went well today/i }),
      '  Good focus.  ',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Save daily review' }));
    expect(await screen.findByText(/^Saved at /)).toBeInTheDocument();
    const [put] = requestsTo(fetchMock, 'PUT', '/api/reviews/daily/' + today());
    expect(JSON.parse(String(put[1]?.body))).toEqual({
      reflection: '  Good focus.  ',
      focusTasks: ['o1', 'o2', 'o3'],
    });
    expect(reviews).toHaveLength(1);
    expect(reviews[0]).toMatchObject({ reflection: 'Good focus.', focusTasks: ['o1', 'o2', 'o3'] });
  });

  it('reopens today’s saved review and drops focus tasks that were deleted', async () => {
    signIn();
    const { fetchMock } = stubTaskApi(
      [makeTask({ _id: 'o1', title: 'Write notes' })],
      [],
      [],
      [
        {
          _id: 'r1',
          kind: 'daily',
          period: today(),
          reflection: 'Earlier thoughts',
          focusTasks: ['o1', 'gone'],
          updatedAt: justNow(),
        },
      ],
    );
    renderApp('/reviews');
    expect(await screen.findByRole('textbox', { name: /what went well today/i })).toHaveValue(
      'Earlier thoughts',
    );
    expect(screen.getByRole('checkbox', { name: /write notes/i })).toBeChecked();
    expect(screen.getByText('1 of 3 chosen')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Save daily review' }));
    await waitFor(() =>
      expect(requestsTo(fetchMock, 'PUT', '/api/reviews/daily/' + today())).toHaveLength(1),
    );
    const [put] = requestsTo(fetchMock, 'PUT', '/api/reviews/daily/' + today());
    expect(JSON.parse(String(put[1]?.body)).focusTasks).toEqual(['o1']);
  });

  it('starts a fresh review when the latest saved one is from an earlier day', async () => {
    signIn();
    stubTaskApi(
      [makeTask({ _id: 'o1', title: 'Write notes' })],
      [],
      [],
      [{ kind: 'daily', period: '2020-01-01', reflection: 'Old', focusTasks: ['o1'] }],
    );
    renderApp('/reviews');
    expect(await screen.findByRole('textbox', { name: /what went well today/i })).toHaveValue('');
    expect(screen.getByRole('checkbox', { name: /write notes/i })).not.toBeChecked();
  });

  it('switches to the weekly review for this week, with up to five focus tasks', async () => {
    signIn();
    const { fetchMock } = stubTaskApi([makeTask({ _id: 'o1', title: 'Write notes' })]);
    renderApp('/reviews');
    const weekly = await screen.findByRole('button', { name: 'Weekly review' });
    expect(screen.getByRole('button', { name: 'Daily review' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await userEvent.click(weekly);
    expect(weekly).toHaveAttribute('aria-pressed', 'true');
    expect(await screen.findByRole('group', { name: /up to 5 tasks/i })).toBeInTheDocument();
    expect(screen.getByText(/^Week of /)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Save weekly review' }));
    await waitFor(() =>
      expect(
        requestsTo(fetchMock, 'PUT', '/api/reviews/weekly/' + weekStart(new Date())),
      ).toHaveLength(1),
    );
  });

  it('shows a load error with a retry, and a save error without losing the draft', async () => {
    signIn();
    const { fetchMock } = stubTaskApi([makeTask({ _id: 'o1', title: 'Write notes' })]);
    const passThrough = fetchMock.getMockImplementation()!;
    let failLoad = true;
    let failSave = true;
    fetchMock.mockImplementation(async (url: string, options: RequestInit = {}) => {
      if (url.includes('/api/reviews?') && failLoad) {
        failLoad = false;
        return { status: 500, ok: false, json: async () => ({ message: 'Reviews offline' }) };
      }
      if ((options.method ?? 'GET') === 'PUT' && failSave) {
        failSave = false;
        return { status: 503, ok: false, json: async () => ({ message: 'Try again soon' }) };
      }
      return passThrough(url, options);
    });
    renderApp('/reviews');
    expect(await screen.findByText('Reviews offline')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Retry loading review' }));
    const reflection = await screen.findByRole('textbox', { name: /what went well today/i });
    await userEvent.type(reflection, 'Keep me');
    await userEvent.click(screen.getByRole('button', { name: 'Save daily review' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Try again soon');
    expect(reflection).toHaveValue('Keep me');
  });

  it('drops a focus task deleted elsewhere when the save is rejected, and keeps the rest', async () => {
    signIn();
    const { fetchMock, tasks } = stubTaskApi([
      makeTask({ _id: 'o1', title: 'Write notes' }),
      makeTask({ _id: 'o2', title: 'Call bank' }),
    ]);
    const passThrough = fetchMock.getMockImplementation()!;
    let rejectOnce = true;
    fetchMock.mockImplementation(async (url: string, options: RequestInit = {}) => {
      if ((options.method ?? 'GET') === 'PUT' && rejectOnce) {
        rejectOnce = false;
        // Deleted in another tab after this page loaded its tasks.
        tasks.splice(
          tasks.findIndex((task) => task._id === 'o2'),
          1,
        );
        return { status: 400, ok: false, json: async () => ({ message: 'Task not found' }) };
      }
      return passThrough(url, options);
    });
    renderApp('/reviews');
    await userEvent.click(await screen.findByRole('checkbox', { name: /write notes/i }));
    await userEvent.click(screen.getByRole('checkbox', { name: /call bank/i }));
    await userEvent.click(screen.getByRole('button', { name: 'Save daily review' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/was deleted elsewhere/);
    expect(screen.getByText('1 of 3 chosen')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Save daily review' }));
    expect(await screen.findByText(/^Saved at /)).toBeInTheDocument();
    const puts = requestsTo(fetchMock, 'PUT', '/api/reviews/daily/' + today());
    expect(JSON.parse(String(puts.at(-1)![1]?.body)).focusTasks).toEqual(['o1']);
  });

  it('waits for tasks instead of showing empty lists while they load', async () => {
    signIn();
    const { fetchMock } = stubTaskApi([makeTask({ _id: 'o1', title: 'Write notes' })]);
    const passThrough = fetchMock.getMockImplementation()!;
    fetchMock.mockImplementation(async (url: string, options: RequestInit = {}) =>
      /\/api\/tasks$/.test(url) ? new Promise(() => {}) : passThrough(url, options),
    );
    renderApp('/reviews');
    expect(await screen.findAllByText('Waiting for your tasks to load...')).toHaveLength(3);
    expect(screen.queryByText(/Nothing completed yet/)).not.toBeInTheDocument();
    expect(screen.queryByText(/No open tasks/)).not.toBeInTheDocument();
  });
});

describe('Weekly goal check-in', () => {
  it('lists active goals in the weekly review and marks one achieved', async () => {
    signIn();
    const { goals } = stubTaskApi(
      [makeTask({ _id: 'o1', title: 'Write notes' })],
      [],
      [],
      [],
      [
        { _id: 'g1', title: 'Learn Rust', description: '', status: 'active', targetDate: null },
        { _id: 'g2', title: 'Old goal', description: '', status: 'dropped', targetDate: null },
      ],
    );
    renderApp('/reviews');
    expect(await screen.findByText('Step 1 of 4')).toBeInTheDocument();
    expect(
      screen.queryByRole('region', { name: /check in on your goals/i }),
    ).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Weekly review' }));
    const goalsStep = await waitFor(() => step(/check in on your goals/i));
    expect(screen.getByText('Step 3 of 5')).toBeInTheDocument();
    expect(await goalsStep.findByText('Learn Rust')).toBeInTheDocument();
    expect(goalsStep.queryByText('Old goal')).not.toBeInTheDocument();
    expect(goalsStep.getByRole('link', { name: 'Add or update goals' })).toHaveAttribute(
      'href',
      '/goals',
    );
    await userEvent.click(goalsStep.getByRole('button', { name: 'Mark achieved: Learn Rust' }));
    expect(await goalsStep.findByText('Marked achieved: Learn Rust.')).toHaveFocus();
    expect(goalsStep.getByText('No active goals yet.')).toBeInTheDocument();
    expect(goals[0]).toMatchObject({ status: 'achieved', achievedAt: expect.any(String) });
  });
});

it('shows a failed goal check-in as an alert and keeps the goal listed', async () => {
  signIn();
  const { fetchMock } = stubTaskApi(
    [],
    [],
    [],
    [],
    [{ _id: 'g1', title: 'Learn Rust', description: '', status: 'active', targetDate: null }],
  );
  const passThrough = fetchMock.getMockImplementation()!;
  fetchMock.mockImplementation(async (url: string, options: RequestInit = {}) =>
    (options.method ?? 'GET') === 'PATCH'
      ? { status: 500, ok: false, json: async () => ({ message: 'Could not save goal' }) }
      : passThrough(url, options),
  );
  renderApp('/reviews');
  await userEvent.click(await screen.findByRole('button', { name: 'Weekly review' }));
  const goalsStep = await waitFor(() => step(/check in on your goals/i));
  await userEvent.click(
    await goalsStep.findByRole('button', { name: 'Mark achieved: Learn Rust' }),
  );
  expect(await goalsStep.findByRole('alert')).toHaveTextContent('Could not save goal');
  expect(goalsStep.getByText('Learn Rust')).toBeInTheDocument();
});
