import { ChakraProvider } from '@chakra-ui/react';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ApprovalPanel from './ApprovalPanel';
import { system } from '../../assets/theme/theme';
import { getRunApprovals, reviewRunDraft } from '../../api/runs';
import { UNCERTAIN_CHANGE_MESSAGE } from '../../api/request';
import { store } from '../../redux/store';
import { clearAuth, setToken } from '../../redux/slices/authSlice';
import { setTasks } from '../../redux/slices/taskSlice';
import type { AgentRun } from '../../types/run';
vi.mock('../../api/runs', () => ({ getRunApprovals: vi.fn(), reviewRunDraft: vi.fn() }));
const read = vi.mocked(getRunApprovals);
const review = vi.mocked(reviewRunDraft);
const draft = (id = 'run-1', agent = 'agent-1'): AgentRun => ({
  _id: id,
  agent,
  task: 'task-1',
  input: 'Requested work ' + id,
  result: { text: 'Proposed output ' + id, simulation: true },
  resultDigest: 'a'.repeat(64),
  status: 'awaiting-approval',
  version: 7,
  executionMode: 'demo',
  createdAt: '2026-10-07T00:00:00Z',
});
const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
};
const panel = (agentId = 'agent-1') => (
  <Provider store={store}>
    <ChakraProvider value={system}>
      <ApprovalPanel agentId={agentId} />
    </ChakraProvider>
  </Provider>
);
beforeEach(() => {
  read.mockReset();
  review.mockReset();
  store.dispatch(clearAuth());
  store.dispatch(setToken('review-token'));
  read.mockResolvedValue([draft()]);
  review.mockResolvedValue({ ...draft(), status: 'approved', version: 8 });
});
afterEach(() => {
  store.dispatch(clearAuth());
  localStorage.clear();
});
const ready = async () => {
  const view = render(panel());
  await screen.findByText('Proposed output run-1');
  return view;
};

describe('human approval panel', () => {
  it('shows requested work, exact proposed output and simulation boundaries with labelled controls', async () => {
    await ready();
    expect(screen.getByRole('region', { name: 'Drafts awaiting review' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: 'Requested work' })).toBeInTheDocument();
    expect(screen.getByText('Requested work run-1', { selector: 'p' })).toBeInTheDocument();
    expect(screen.getByText('Simulation: canned output, no model called.')).toBeInTheDocument();
    expect(screen.getByLabelText('Pending draft')).toBeInTheDocument();
    expect(screen.getByLabelText('Review note (optional)')).toHaveAttribute('maxlength', '2000');
    expect(screen.getByText(/does not apply content to tasks/)).toBeInTheDocument();
  });

  it.each(['approved', 'rejected'] as const)(
    'records %s once for the displayed snapshot using keyboard and leaves tasks unchanged',
    async (decision) => {
      const user = userEvent.setup();
      const savedTasks = [{ _id: 'task-1', title: 'Original task' }];
      store.dispatch(setTasks(savedTasks as never));
      await ready();
      const note = screen.getByLabelText('Review note (optional)');
      await user.click(note);
      await user.type(note, 'Human review note');
      await user.tab();
      if (decision === 'rejected') await user.tab();
      expect(
        screen.getByRole('button', {
          name: decision === 'approved' ? 'Approve draft' : 'Reject draft',
        }),
      ).toHaveFocus();
      await user.keyboard('{Enter}');
      await screen.findByText(
        decision === 'approved'
          ? 'Draft approved. No tasks were changed.'
          : 'Draft rejected. No tasks were changed.',
      );
      expect(review).toHaveBeenCalledTimes(1);
      expect(review).toHaveBeenCalledWith('review-token', draft(), decision, 'Human review note');
      expect(screen.queryByText('Proposed output run-1')).not.toBeInTheDocument();
      expect(screen.getByText('No drafts awaiting review.')).toBeInTheDocument();
      expect(store.getState().tasks.items).toEqual(savedTasks);
    },
  );

  it('disables decisions, notes, selection and refresh while saving to prevent duplicate actions', async () => {
    const user = userEvent.setup();
    const saved = deferred<AgentRun>();
    review.mockReturnValue(saved.promise);
    await ready();
    await user.dblClick(screen.getByRole('button', { name: 'Approve draft' }));
    expect(review).toHaveBeenCalledTimes(1);
    for (const name of ['Approve draft', 'Reject draft', 'Refresh drafts'])
      expect(screen.getByRole('button', { name })).toBeDisabled();
    expect(screen.getByLabelText('Review note (optional)')).toBeDisabled();
    expect(screen.getByLabelText('Pending draft')).toBeDisabled();
    await act(async () => saved.resolve({ ...draft(), status: 'approved' }));
    await screen.findByText('No drafts awaiting review.');
  });

  it.each(['Draft changed; refresh before reviewing.', UNCERTAIN_CHANGE_MESSAGE])(
    'requires fresh data after decision failure: %s',
    async (message) => {
      const user = userEvent.setup();
      review.mockRejectedValueOnce(new Error(message));
      await ready();
      await user.click(screen.getByRole('button', { name: 'Approve draft' }));
      await screen.findByText('Refresh drafts before deciding again.');
      expect(screen.getByRole('alert')).toHaveTextContent(message);
      await user.click(screen.getByRole('button', { name: 'Reject draft' }));
      expect(review).toHaveBeenCalledTimes(1);
      read.mockResolvedValueOnce([{ ...draft(), version: 9, resultDigest: 'b'.repeat(64) }]);
      await user.click(screen.getByRole('button', { name: 'Refresh drafts' }));
      await waitFor(() =>
        expect(screen.getByRole('button', { name: 'Reject draft' })).toBeEnabled(),
      );
      await user.click(screen.getByRole('button', { name: 'Reject draft' }));
      expect(review).toHaveBeenNthCalledWith(
        2,
        'review-token',
        expect.objectContaining({ version: 9, resultDigest: 'b'.repeat(64) }),
        'rejected',
        '',
      );
    },
  );

  it.each(['resolve', 'reject'] as const)(
    'retires a cancelled read and allows explicit refresh after late %s',
    async (outcome) => {
      const user = userEvent.setup();
      const pending = deferred<AgentRun[]>();
      read.mockReturnValueOnce(pending.promise);
      render(panel());
      await screen.findByRole('button', { name: 'Cancel loading' });
      const signal = read.mock.calls[0][2]!;
      await user.click(screen.getByRole('button', { name: 'Cancel loading' }));
      expect(signal.aborted).toBe(true);
      await act(async () =>
        outcome === 'resolve'
          ? pending.resolve([draft('private-old')])
          : pending.reject(new Error('Private old failure')),
      );
      expect(screen.queryByText('Proposed output private-old')).not.toBeInTheDocument();
      expect(screen.queryByText('Private old failure')).not.toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: 'Refresh drafts' }));
      await screen.findByText('Proposed output run-1');
      expect(read).toHaveBeenCalledTimes(2);
    },
  );

  it('retires old agent reads without clearing the new read loading state', async () => {
    const old = deferred<AgentRun[]>();
    const next = deferred<AgentRun[]>();
    read.mockReturnValueOnce(old.promise).mockReturnValueOnce(next.promise);
    const view = render(panel());
    await waitFor(() => expect(read).toHaveBeenCalledTimes(1));
    view.rerender(panel('agent-2'));
    await waitFor(() => expect(read).toHaveBeenCalledTimes(2));
    expect(read.mock.calls[0][2]!.aborted).toBe(true);
    await act(async () => old.resolve([draft('old-agent')]));
    expect(screen.getByText('Loading drafts...')).toBeInTheDocument();
    expect(screen.queryByText('Proposed output old-agent')).not.toBeInTheDocument();
    await act(async () => next.resolve([draft('new-agent', 'agent-2')]));
    await screen.findByText('Proposed output new-agent');
  });

  it('aborts an unmounted read and ignores its late failure', async () => {
    const pending = deferred<AgentRun[]>();
    read.mockReturnValueOnce(pending.promise);
    const view = render(panel());
    await waitFor(() => expect(read).toHaveBeenCalledTimes(1));
    const signal = read.mock.calls[0][2]!;
    view.unmount();
    expect(signal.aborted).toBe(true);
    await act(async () => pending.reject(new Error('Late private failure')));
    expect(screen.queryByText('Late private failure')).not.toBeInTheDocument();
  });

  it('does not let an old agent decision overwrite drafts for a newly selected agent', async () => {
    const user = userEvent.setup();
    const saved = deferred<AgentRun>();
    review.mockReturnValueOnce(saved.promise);
    const view = await ready();
    await user.click(screen.getByRole('button', { name: 'Approve draft' }));
    read.mockResolvedValueOnce([draft('new-agent', 'agent-2')]);
    view.rerender(panel('agent-2'));
    await screen.findByText('Proposed output new-agent');
    await act(async () => saved.resolve({ ...draft(), status: 'approved' }));
    expect(screen.getByText('Proposed output new-agent')).toBeInTheDocument();
    expect(screen.queryByText('Draft approved. No tasks were changed.')).not.toBeInTheDocument();
  });

  it('drops old session save continuations and enables new session decisions', async () => {
    const user = userEvent.setup();
    const saved = deferred<AgentRun>();
    review.mockReturnValueOnce(saved.promise);
    await ready();
    await user.click(screen.getByRole('button', { name: 'Approve draft' }));
    read.mockResolvedValueOnce([draft('new-session')]);
    await act(async () => {
      store.dispatch(clearAuth());
      store.dispatch(setToken('new-token'));
    });
    await screen.findByText('Proposed output new-session');
    expect(screen.getByRole('button', { name: 'Approve draft' })).toBeEnabled();
    await act(async () => saved.reject(new Error('Private old save failure')));
    expect(screen.queryByText('Private old save failure')).not.toBeInTheDocument();
    expect(screen.getByText('Proposed output new-session')).toBeInTheDocument();
  });
});

it('requires a displayed digest and never offers decisions for an unchecked result', async () => {
  read.mockResolvedValueOnce([{ ...draft(), resultDigest: null }]);
  await ready();
  expect(screen.getByRole('button', { name: 'Approve draft' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Reject draft' })).toBeDisabled();
  expect(review).not.toHaveBeenCalled();
});

it('recovers a current read failure only after explicit refresh', async () => {
  const user = userEvent.setup();
  read.mockRejectedValueOnce(new Error('Drafts temporarily unavailable'));
  render(panel());
  expect(await screen.findByRole('alert')).toHaveTextContent('Drafts temporarily unavailable');
  expect(read).toHaveBeenCalledTimes(1);
  expect(screen.queryByRole('button', { name: 'Approve draft' })).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Refresh drafts' }));
  await screen.findByText('Proposed output run-1');
  expect(read).toHaveBeenCalledTimes(2);
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

it.each(['resolve', 'reject'] as const)(
  'ignores unmounted decision %s without changing private tasks',
  async (outcome) => {
    const user = userEvent.setup();
    const saved = deferred<AgentRun>();
    review.mockReturnValueOnce(saved.promise);
    const view = await ready();
    await user.click(screen.getByRole('button', { name: 'Approve draft' }));
    view.unmount();
    const tasks = [{ _id: 'new-private', title: 'New private task' }];
    store.dispatch(setTasks(tasks as never));
    await act(async () =>
      outcome === 'resolve'
        ? saved.resolve({ ...draft(), status: 'approved' })
        : saved.reject(new Error('Private late save failure')),
    );
    expect(store.getState().tasks.items).toEqual(tasks);
    expect(screen.queryByText('Draft approved. No tasks were changed.')).not.toBeInTheDocument();
    expect(screen.queryByText('Private late save failure')).not.toBeInTheDocument();
  },
);
