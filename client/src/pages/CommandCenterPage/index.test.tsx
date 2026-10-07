import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { store } from '../../redux/store';
import { clearAuth } from '../../redux/slices/authSlice';
import {
  makeAgent,
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

const activeProjects = () => within(screen.getByRole('region', { name: /active projects/i }));

describe('Command Center active projects', () => {
  it('lists only active projects with real open-task counts', async () => {
    signIn();
    stubTaskApi(
      [
        makeTask({ _id: 't1', title: 'One', project: 'p1' }),
        makeTask({ _id: 't2', title: 'Two', project: 'p1', status: 'done' }),
        makeTask({ _id: 't3', title: 'Three', project: 'p1', status: 'in-progress' }),
      ],
      [
        makeProject({ _id: 'p1', name: 'Launch' }),
        makeProject({ _id: 'p2', name: 'Empty project' }),
        makeProject({ _id: 'p3', name: 'Finished', status: 'completed' }),
        makeProject({ _id: 'p4', name: 'Shelved', status: 'archived' }),
      ],
    );
    renderApp('/home');
    await screen.findByRole('heading', { level: 1, name: /good/i });

    const panel = await waitFor(() => activeProjects());
    expect(panel.getByText('2')).toBeInTheDocument();
    const rows = panel.getAllByRole('listitem').map((row) => within(row));
    expect(rows).toHaveLength(2);
    expect(rows[0].getByRole('link', { name: 'Launch' })).toBeInTheDocument();
    expect(rows[0].getByText('2 open')).toBeInTheDocument();
    expect(rows[1].getByRole('link', { name: 'Empty project' })).toBeInTheDocument();
    expect(rows[1].getByText('No tasks')).toBeInTheDocument();
    expect(panel.queryByText('Finished')).not.toBeInTheDocument();
    expect(panel.queryByText('Shelved')).not.toBeInTheDocument();
    expect(panel.getByRole('progressbar', { name: 'Launch completion' })).toHaveAttribute(
      'aria-valuenow',
      '33',
    );
  });

  it('links to the project and to all projects', async () => {
    signIn();
    stubTaskApi([], [makeProject({ _id: 'p1', name: 'Launch' })]);
    renderApp('/home');
    const panel = await waitFor(() => activeProjects());
    await userEvent.click(panel.getByRole('link', { name: 'Launch' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Launch' })).toBeInTheDocument();
  });

  it('summarizes the workforce by status when agents exist', async () => {
    signIn();
    stubTaskApi(
      [],
      [],
      [
        makeAgent({ _id: 'a1', name: 'Scout' }),
        makeAgent({ _id: 'a2', name: 'Builder' }),
        makeAgent({ _id: 'a3', name: 'Napper', status: 'paused' }),
        makeAgent({ _id: 'a4', name: 'Retired', status: 'disabled' }),
      ],
    );
    renderApp('/home');
    const panel = within(await screen.findByRole('region', { name: /workforce/i }));
    expect(panel.getByText('4')).toBeInTheDocument();
    expect(panel.getByText('Active').nextSibling).toHaveTextContent('2');
    expect(panel.getByText('Paused').nextSibling).toHaveTextContent('1');
    expect(panel.getByText('Disabled').nextSibling).toHaveTextContent('1');
    expect(panel.getByText(/assignments do not start runs/i)).toBeInTheDocument();
    await userEvent.click(panel.getByRole('link', { name: 'Open Workforce' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Workforce' })).toBeInTheDocument();
  });

  it('summarizes open assignments from real task data', async () => {
    signIn();
    const on = (agent: string) => ({ assigneeType: 'agent', assigneeAgent: agent }) as const;
    stubTaskApi(
      [
        makeTask({ _id: 't1', title: 'One', ...on('a1') }),
        makeTask({ _id: 't2', title: 'Two', ...on('a1'), status: 'in-progress' }),
        makeTask({ _id: 't3', title: 'Three', ...on('a2'), status: 'done' }),
        makeTask({ _id: 't4', title: 'Mine', assigneeType: 'user' }),
        makeTask({ _id: 't5', title: 'Loose' }),
        makeTask({ _id: 't6', title: 'Loose too' }),
      ],
      [],
      [makeAgent({ _id: 'a1', name: 'Scout' }), makeAgent({ _id: 'a2', name: 'Builder' })],
    );
    renderApp('/home');
    const panel = within(await screen.findByRole('region', { name: /workforce/i }));
    await waitFor(() =>
      expect(panel.getByText('Open tasks on agents').nextSibling).toHaveTextContent('2'),
    );
    expect(panel.getByText('Agents with open tasks').nextSibling).toHaveTextContent('1');
    expect(panel.getByText('Open tasks on you').nextSibling).toHaveTextContent('1');
    expect(panel.getByText('Unassigned open tasks').nextSibling).toHaveTextContent('2');
    expect(panel.getByText(/assignments do not start runs/i)).toBeInTheDocument();
  });

  it('hides the workforce panel when there are no agents', async () => {
    signIn();
    stubTaskApi();
    renderApp('/home');
    await screen.findByRole('heading', { level: 1, name: /good/i });
    await waitFor(() => expect(store.getState().agents.loaded).toBe(true));
    expect(screen.queryByRole('region', { name: /workforce/i })).not.toBeInTheDocument();
  });

  it('hides the panel when there are no active projects', async () => {
    signIn();
    stubTaskApi([], [makeProject({ _id: 'p1', name: 'Done', status: 'completed' })]);
    renderApp('/home');
    await screen.findByRole('heading', { level: 1, name: /good/i });
    await waitFor(() => expect(store.getState().projects.loaded).toBe(true));
    expect(screen.queryByRole('region', { name: /active projects/i })).not.toBeInTheDocument();
  });
});

describe('Command Center assignment counts while tasks are unknown', () => {
  it.each([false, true])(
    'keeps task metrics unknown while pending or failed (failure: %s)',
    async (failure) => {
      signIn();
      const api = stubTaskApi(
        [makeTask({ _id: 't1', title: 'Research', assigneeType: 'agent', assigneeAgent: 'a1' })],
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
            ? {
                status: 500,
                ok: false,
                json: async () => ({ message: 'Task database unavailable' }),
              }
            : pending;
        }
        return original(url, options);
      });
      renderApp('/home');
      const panel = within(await screen.findByRole('region', { name: /workforce/i }));
      await waitFor(() => {
        for (const label of [
          'Agents with open tasks',
          'Open tasks on agents',
          'Open tasks on you',
          'Unassigned open tasks',
        ]) {
          expect(panel.getByText(label).nextSibling).toHaveTextContent(
            failure ? 'Unavailable' : 'Loading...',
          );
        }
      });
      expect(panel.getByText('Active').nextSibling).toHaveTextContent('1');
      if (!failure) {
        await act(async () => {
          resolve(await original('http://localhost:5000/api/tasks'));
        });
        await waitFor(() =>
          expect(panel.getByText('Open tasks on agents').nextSibling).toHaveTextContent('1'),
        );
        expect(panel.getByText('Unassigned open tasks').nextSibling).toHaveTextContent('0');
      }
    },
  );
});
