import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { store } from '../../redux/store';
import { clearAuth } from '../../redux/slices/authSlice';
import { makeAgent, makeTask, renderApp, signIn, stubTaskApi } from '../../test/renderApp';

vi.mock('../../components/ui/toaster', () => ({ toaster: { create: vi.fn() } }));

afterEach(() => {
  store.dispatch(clearAuth());
  localStorage.clear();
  vi.unstubAllGlobals();
});

const on = (agent: string) => ({ assigneeType: 'agent', assigneeAgent: agent }) as const;

const renderWorkforce = async () => {
  signIn();
  const api = stubTaskApi(
    [
      makeTask({ _id: 't1', title: 'One', ...on('a1') }),
      makeTask({ _id: 't2', title: 'Two', ...on('a1'), status: 'in-progress' }),
      makeTask({ _id: 't3', title: 'Three', ...on('a1'), status: 'done' }),
      makeTask({ _id: 't4', title: 'Four', ...on('a2') }),
      makeTask({ _id: 't5', title: 'Mine', assigneeType: 'user' }),
    ],
    [],
    [
      makeAgent({ _id: 'a1', name: 'Scout' }),
      makeAgent({ _id: 'a2', name: 'Builder', status: 'paused' }),
      makeAgent({ _id: 'a3', name: 'Idle' }),
    ],
  );
  renderApp('/workforce');
  await screen.findByRole('heading', { level: 1, name: 'Workforce' });
  await waitFor(() => expect(store.getState().tasks.items).toHaveLength(5));
  return api;
};

const card = (name: string) =>
  within(
    within(screen.getByRole('region', { name: 'Your Agents' }))
      .getByRole('link', { name })
      .closest('li') as HTMLElement,
  );

describe('Workforce workload', () => {
  it('shows each agent’s assigned and open task counts', async () => {
    await renderWorkforce();
    expect(card('Scout').getByText('3 assigned tasks · 2 open')).toBeInTheDocument();
    expect(card('Builder').getByText(/1 assigned task.*1 open/)).toBeInTheDocument();
    expect(card('Idle').getByText('No assigned tasks')).toBeInTheDocument();
    expect(screen.queryByText(/productivity|performance/i)).not.toBeInTheDocument();
  });

  it('says agents can be assigned tasks but don’t run', async () => {
    await renderWorkforce();
    expect(screen.getByText(/assign tasks to active agents/i)).toHaveTextContent(
      'agents don’t run or call any AI model yet',
    );
  });

  it('warns how many tasks a delete unassigns, then updates every count', async () => {
    await renderWorkforce();
    await userEvent.click(card('Scout').getByRole('button', { name: 'Delete Scout' }));
    const dialog = await screen.findByRole('alertdialog');
    expect(dialog).toHaveTextContent('Its 3 assigned tasks become unassigned.');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Delete agent' }));

    await waitFor(() => expect(store.getState().agents.items).toHaveLength(2));
    expect(store.getState().tasks.items).toHaveLength(5);
    expect(card('Builder').getByText(/1 assigned task.*1 open/)).toBeInTheDocument();
  });

  it('keeps the original wording for an agent with no tasks', async () => {
    await renderWorkforce();
    await userEvent.click(card('Idle').getByRole('button', { name: 'Delete Idle' }));
    expect(await screen.findByRole('alertdialog')).toHaveTextContent(
      'Your tasks and projects are not affected.',
    );
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
    renderApp('/workforce');
    await screen.findByRole('heading', { level: 1, name: 'Workforce' });
    await screen.findByRole('link', { name: 'Scout' });
    return async () => {
      await act(async () => {
        resolve(await original('http://localhost:5000/api/tasks'));
      });
    };
  };

  it('shows pending assignments without claiming zero, and updates when tasks arrive', async () => {
    const finish = await renderUnknownTasks(false);
    expect(card('Scout').getByText('Loading assigned tasks...')).toBeVisible();
    expect(card('Scout').queryByText('No assigned tasks')).not.toBeInTheDocument();
    await userEvent.click(card('Scout').getByRole('button', { name: 'Delete Scout' }));
    const dialog = await screen.findByRole('alertdialog');
    expect(dialog).toHaveTextContent('Any assigned tasks become unassigned.');
    expect(dialog).not.toHaveTextContent('Your tasks and projects are not affected.');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    await finish();
    await waitFor(() => {
      expect(card('Scout').getByText(/1 assigned task.*1 open/)).toBeVisible();
    });
  });

  it('shows unavailable assignments after a task load failure and gives a truthful delete warning', async () => {
    await renderUnknownTasks(true);
    expect(await card('Scout').findByText('Assigned tasks unavailable.')).toBeVisible();
    expect(card('Scout').queryByText('No assigned tasks')).not.toBeInTheDocument();
    await userEvent.click(card('Scout').getByRole('button', { name: 'Delete Scout' }));
    const dialog = await screen.findByRole('alertdialog');
    expect(dialog).toHaveTextContent('Any assigned tasks become unassigned.');
    expect(dialog).not.toHaveTextContent('Your tasks and projects are not affected.');
  });
});
