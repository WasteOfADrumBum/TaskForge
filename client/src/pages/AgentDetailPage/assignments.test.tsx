import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { toaster } from '../../components/ui/toaster';
import { store } from '../../redux/store';
import { clearAuth } from '../../redux/slices/authSlice';
import {
  daysFromNow,
  makeAgent,
  makeProject,
  makeTask,
  renderApp,
  signIn,
  stubTaskApi,
} from '../../test/renderApp';
import type { Agent } from '../../types/agent';
import { formatCalendarDate } from '../../utils/dates';

vi.mock('../../components/ui/toaster', () => ({ toaster: { create: vi.fn() } }));

afterEach(() => {
  store.dispatch(clearAuth());
  localStorage.clear();
  vi.unstubAllGlobals();
  vi.mocked(toaster.create).mockClear();
});

const onScout = { assigneeType: 'agent', assigneeAgent: 'a1' } as const;
const tasks = [
  makeTask({ _id: 't1', title: 'Collect sources', ...onScout, priority: 'high', project: 'p1' }),
  makeTask({
    _id: 't2',
    title: 'Summarize findings',
    ...onScout,
    status: 'in-progress',
    dueDate: daysFromNow(3),
  }),
  makeTask({ _id: 't3', title: 'Old research', ...onScout, status: 'done' }),
  makeTask({ _id: 't4', title: 'Someone else', assigneeType: 'agent', assigneeAgent: 'a2' }),
  makeTask({ _id: 't5', title: 'My own', assigneeType: 'user' }),
];

const renderDetail = async (scout: Agent = makeAgent({ _id: 'a1', name: 'Scout' })) => {
  signIn();
  const api = stubTaskApi(
    tasks,
    [makeProject({ _id: 'p1', name: 'Launch' })],
    [scout, makeAgent({ _id: 'a2', name: 'Builder' })],
  );
  renderApp('/workforce/a1');
  await screen.findByRole('heading', { level: 1, name: 'Scout' });
  return api;
};
const assignments = () => within(screen.getByRole('region', { name: /assigned tasks/i }));

describe('Agent detail assigned tasks', () => {
  it('lists only this agent’s tasks, in progress first, with status, priority, project, and due date', async () => {
    await renderDetail();
    const region = await waitFor(() => assignments());
    const rows = within(region.getByRole('list', { name: 'Assigned tasks' })).getAllByRole(
      'listitem',
    );
    expect(rows.map((row) => row.querySelector('p')?.textContent)).toEqual([
      'Summarize findings',
      'Collect sources',
      'Old research',
    ]);
    expect(region.getByText('3')).toBeInTheDocument();

    const [summarize, collect, old] = rows.map((row) => within(row));
    expect(summarize.getByText('In Progress')).toBeInTheDocument();
    expect(summarize.getByText('Due ' + formatCalendarDate(daysFromNow(3)))).toBeInTheDocument();
    expect(collect.getByText('To Do')).toBeInTheDocument();
    expect(collect.getByText('high')).toBeInTheDocument();
    expect(collect.getByRole('link', { name: 'Launch' })).toHaveAttribute(
      'href',
      '/work/projects/p1',
    );
    expect(old.getByText('Done')).toBeInTheDocument();
    expect(region.queryByText('Someone else')).not.toBeInTheDocument();
    expect(region.queryByText('My own')).not.toBeInTheDocument();

    const details = within(screen.getByRole('region', { name: 'Details' }));
    expect(details.getByText('3 (2 open)')).toBeInTheDocument();
  });

  it('links to the Work page', async () => {
    await renderDetail();
    await userEvent.click(assignments().getByRole('link', { name: 'Open Work' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Work' })).toBeInTheDocument();
  });

  it('opens a new task already assigned to this agent', async () => {
    const { fetchMock } = await renderDetail();
    await userEvent.click(screen.getByRole('button', { name: 'Assign a new task' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Work' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Assignee' })).toHaveValue('agent:a1');
    await waitFor(() => expect(screen.getByRole('textbox', { name: /title/i })).toHaveFocus());

    await userEvent.type(screen.getByRole('textbox', { name: /title/i }), 'Check citations');
    await userEvent.click(screen.getByRole('button', { name: 'Create Task' }));
    await screen.findByRole('heading', { name: 'Check citations' });
    const post = fetchMock.mock.calls.find(([, options]) => options?.method === 'POST');
    expect(JSON.parse(String(post?.[1]?.body))).toMatchObject({
      assigneeType: 'agent',
      assigneeAgent: 'a1',
    });
  });

  it('keeps a paused agent’s tasks visible and offers no new assignment', async () => {
    await renderDetail(makeAgent({ _id: 'a1', name: 'Scout', status: 'paused' }));
    const region = await waitFor(() => assignments());
    expect(region.getByText(/this agent is paused\. it keeps existing assignments/i)).toBeVisible();
    expect(region.getByText('Collect sources')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Assign a new task' })).not.toBeInTheDocument();
  });

  it('shows an empty state when nothing is assigned', async () => {
    signIn();
    stubTaskApi([], [], [makeAgent({ _id: 'a1', name: 'Scout' })]);
    renderApp('/workforce/a1');
    expect(await screen.findByText('No assigned tasks')).toBeInTheDocument();
  });

  it('deletes the agent after warning that its tasks become unassigned, keeping them', async () => {
    const api = await renderDetail();
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
    const dialog = await screen.findByRole('alertdialog');
    expect(dialog).toHaveTextContent('Its 3 assigned tasks become unassigned.');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Delete agent' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Workforce' })).toBeInTheDocument();
    const items = store.getState().tasks.items;
    expect(items).toHaveLength(5);
    expect(items.filter((task) => task.assigneeAgent === 'a1')).toEqual([]);
    expect(items.find((task) => task._id === 't4')?.assigneeAgent).toBe('a2');

    // The server unassigned the same tasks, so a refresh would agree with the local state.
    expect(api.tasks.filter((task) => task.assigneeAgent === 'a1')).toEqual([]);
    expect(api.tasks).toHaveLength(5);
  });
});

describe('Assignment counts while task data is unknown', () => {
  const renderUnknownTasks = async (failure: boolean) => {
    signIn();
    const api = stubTaskApi(
      [
        makeTask({
          _id: 't1',
          title: 'Collect sources',
          assigneeType: 'agent',
          assigneeAgent: 'a1',
        }),
      ],
      [],
      [makeAgent({ _id: 'a1', name: 'Scout' })],
    );
    const original = api.fetchMock.getMockImplementation()!;
    let resolve!: (response: Awaited<ReturnType<typeof original>>) => void;
    const pending = new Promise<Awaited<ReturnType<typeof original>>>((done) => {
      resolve = done;
    });
    api.fetchMock.mockImplementation(async (url: string, options?: RequestInit) => {
      if (url.endsWith('/api/tasks') && (options?.method ?? 'GET') === 'GET') {
        return failure
          ? { status: 500, ok: false, json: async () => ({ message: 'Task database unavailable' }) }
          : pending;
      }
      return original(url, options);
    });
    renderApp('/workforce/a1');
    await screen.findByRole('heading', { level: 1, name: 'Scout' });
    return async () => {
      await act(async () => {
        resolve(await original('http://localhost:5000/api/tasks'));
      });
    };
  };

  it('shows pending assignments without claiming zero, and updates when tasks arrive', async () => {
    const finish = await renderUnknownTasks(false);
    expect(assignments().getByText('Loading assigned tasks...')).toBeVisible();
    expect(assignments().queryByText('No assigned tasks')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
    const dialog = await screen.findByRole('alertdialog');
    expect(dialog).toHaveTextContent('Any assigned tasks become unassigned.');
    expect(dialog).not.toHaveTextContent('Your tasks and projects are not affected.');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    await finish();
    await waitFor(() => {
      expect(assignments().getByText('Collect sources')).toBeVisible();
    });
  });

  it('shows unavailable assignments after a task load failure and gives a truthful delete warning', async () => {
    await renderUnknownTasks(true);
    expect(await assignments().findByText('Assigned tasks unavailable.')).toBeVisible();
    expect(assignments().queryByText('No assigned tasks')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
    const dialog = await screen.findByRole('alertdialog');
    expect(dialog).toHaveTextContent('Any assigned tasks become unassigned.');
    expect(dialog).not.toHaveTextContent('Your tasks and projects are not affected.');
  });
});
