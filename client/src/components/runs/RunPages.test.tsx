import { ChakraProvider } from '@chakra-ui/react';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { MemoryRouter, Routes, Route, Link } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import RunActivityPage from '../../pages/RunActivityPage';
import RunDetailPage from '../../pages/RunDetailPage';
import { system } from '../../assets/theme/theme';
import { store } from '../../redux/store';
import { clearAuth, setToken } from '../../redux/slices/authSlice';
import { setTasks } from '../../redux/slices/taskSlice';
import { setAgents } from '../../redux/slices/agentSlice';
import * as api from '../../api/runs';
import * as handoffs from '../../api/handoffs';
import { UNCERTAIN_CHANGE_MESSAGE } from '../../api/request';
import type { AgentRun } from '../../types/run';
vi.mock('../../api/handoffs', () => ({
  getHandoffs: vi.fn().mockResolvedValue([]),
  createHandoff: vi.fn(),
}));
vi.mock('../../api/runs', () => ({
  createRun: vi.fn(),
  getRuns: vi.fn(),
  getRun: vi.fn(),
  getRunAudit: vi.fn(),
  getRunProviderStatus: vi.fn(),
  executeRun: vi.fn(),
  cancelRun: vi.fn(),
  reviewRunDraft: vi.fn(),
}));
const run = (extra: Partial<AgentRun> = {}): AgentRun => ({
  _id: 'run-1',
  task: 'task-1',
  agent: 'agent-1',
  input: 'Requested synthetic work',
  result: { text: 'Proposed synthetic output' },
  resultDigest: 'a'.repeat(64),
  status: 'awaiting-approval',
  version: 2,
  executionMode: 'demo',
  createdAt: '2026-10-07T00:00:00Z',
  context: { sources: [{ description: '<script>hostile notes</script>' }] },
  ...extra,
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
const seed = () => {
  store.dispatch(
    setTasks([
      {
        _id: 'task-1',
        title: 'Assigned task one',
        description: '',
        status: 'todo',
        priority: 'medium',
        dueDate: null,
        assigneeType: 'agent',
        assigneeAgent: 'agent-1',
      },
    ]),
  );
  store.dispatch(
    setAgents([
      {
        _id: 'agent-1',
        name: 'Agent one',
        role: 'Draft',
        description: '',
        status: 'active',
        skills: [],
        permissions: ['task.read', 'artifact.draft'],
      },
    ]),
  );
};
const show = (start = '/workforce/runs/run-1') =>
  render(
    <Provider store={store}>
      <ChakraProvider value={system}>
        <MemoryRouter initialEntries={[start]}>
          <Link to="/workforce/runs/run-2">Next run</Link>
          <Routes>
            <Route path="/workforce/runs" element={<RunActivityPage />} />
            <Route path="/workforce/runs/:id" element={<RunDetailPage />} />
          </Routes>
        </MemoryRouter>
      </ChakraProvider>
    </Provider>,
  );
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(handoffs.getHandoffs).mockResolvedValue([]);
  store.dispatch(clearAuth());
  store.dispatch(setToken('run-token'));
  vi.mocked(api.getRuns).mockResolvedValue([]);
  vi.mocked(api.getRun).mockResolvedValue(run());
  vi.mocked(api.getRunAudit).mockResolvedValue([]);
  vi.mocked(api.getRunProviderStatus).mockResolvedValue({
    defaultMode: 'disabled',
    available: false,
    capabilities: { chat: false, structuredOutput: false, embeddings: false },
  });
  vi.mocked(api.createRun).mockResolvedValue(run({ status: 'queued' }));
  vi.mocked(api.reviewRunDraft).mockResolvedValue(run({ status: 'approved' }));
  vi.mocked(api.executeRun).mockResolvedValue(run());
  vi.mocked(api.cancelRun).mockResolvedValue(run({ status: 'failed' }));
});
afterEach(() => {
  store.dispatch(clearAuth());
  localStorage.clear();
});
const ready = async () => {
  await screen.findByText(/Proposed synthetic output/);
  await waitFor(() => expect(screen.getByRole('button', { name: 'Refresh run' })).toBeEnabled());
};

it('fails closed for unloaded resources and excludes assignments to paused agents', async () => {
  show('/workforce/runs');
  await screen.findByText('No runs yet.');
  expect(screen.getByLabelText('Assigned task')).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Create queued run' })).toBeDisabled();
  act(() => {
    seed();
    store.dispatch(
      setAgents([
        {
          _id: 'agent-1',
          name: 'Paused agent',
          role: 'Draft',
          description: '',
          status: 'paused',
          skills: [],
          permissions: [],
        },
      ]),
    );
  });
  expect(
    screen.getByText('No tasks assigned to an active agent. Assign a task in Work first.'),
  ).toBeInTheDocument();
  expect(screen.queryByRole('option', { name: 'Assigned task one' })).not.toBeInTheDocument();
});
it('retains the creation key for a manual identical retry after authoritative refresh, then navigates to detail', async () => {
  seed();
  vi.mocked(api.createRun).mockRejectedValueOnce(new Error(UNCERTAIN_CHANGE_MESSAGE));
  const user = userEvent.setup();
  show('/workforce/runs');
  await screen.findByText('No runs yet.');
  await user.selectOptions(screen.getByLabelText('Assigned task'), 'task-1');
  await user.type(screen.getByLabelText('Requested work'), 'Draft this');
  await user.click(screen.getByRole('button', { name: 'Create queued run' }));
  await screen.findByRole('alert');
  expect(screen.getByRole('button', { name: 'Create queued run' })).toBeDisabled();
  expect(screen.getByLabelText('Assigned task')).toBeDisabled();
  expect(api.createRun).toHaveBeenCalledTimes(1);
  const firstKey = vi.mocked(api.createRun).mock.calls[0][2];
  await user.click(screen.getByRole('button', { name: 'Refresh runs' }));
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Create queued run' })).toBeEnabled(),
  );
  await user.click(screen.getByRole('button', { name: 'Create queued run' }));
  await screen.findByRole('heading', { name: 'Run detail' });
  expect(api.createRun).toHaveBeenCalledTimes(2);
  expect(vi.mocked(api.createRun).mock.calls[1][2]).toBe(firstKey);
  expect(vi.mocked(api.createRun).mock.calls[1][1]).toEqual({
    taskId: 'task-1',
    agentId: 'agent-1',
    input: 'Draft this',
  });
});
it('labels a filtered latest-100 subset and provides real detail navigation', async () => {
  vi.mocked(api.getRuns).mockResolvedValue([
    run(),
    run({ _id: 'foreign-agent-run', agent: 'agent-2', input: 'Excluded agent input' }),
  ]);
  const user = userEvent.setup();
  show('/workforce/runs?agentId=agent-1');
  await screen.findByRole('link', { name: 'View run' });
  expect(screen.getByText(/Showing this agent’s subset/)).toBeInTheDocument();
  expect(screen.queryByText('Excluded agent input')).not.toBeInTheDocument();
  await user.click(screen.getByRole('link', { name: 'View run' }));
  await screen.findByRole('heading', { name: 'Run detail' });
});
it('keeps run detail visible when independent audit and capability reads fail', async () => {
  vi.mocked(api.getRunAudit).mockRejectedValue(new Error('Audit unavailable'));
  vi.mocked(api.getRunProviderStatus).mockRejectedValue(new Error('Capability unavailable'));
  show();
  await ready();
  expect(screen.getByText('Audit unavailable')).toBeInTheDocument();
  expect(screen.getByText('Requested synthetic work')).toBeInTheDocument();
  expect(document.querySelector('script')).toBeNull();
  expect(screen.getByText(/hostile notes/)).toBeInTheDocument();
});
it('requires explicit mode and project context defaults off; configured local capability remains honest', async () => {
  vi.mocked(api.getRun).mockResolvedValue(
    run({ status: 'queued', result: null, executionMode: null }),
  );
  vi.mocked(api.getRunProviderStatus).mockResolvedValue({
    defaultMode: 'local',
    available: false,
    capabilities: { chat: true, structuredOutput: true, embeddings: false },
  });
  const user = userEvent.setup();
  show();
  await screen.findByLabelText('Execution mode');
  await waitFor(() => expect(screen.getByRole('button', { name: 'Refresh run' })).toBeEnabled());
  expect(screen.getByLabelText('Execution mode')).toHaveValue('');
  expect(screen.getByLabelText('Include project notes')).not.toBeChecked();
  expect(screen.getByRole('button', { name: 'Execute draft' })).toBeDisabled();
  expect(screen.getByText(/availability has not been verified/)).toBeInTheDocument();
  await user.selectOptions(screen.getByLabelText('Execution mode'), 'demo');
  await user.click(screen.getByRole('button', { name: 'Execute draft' }));
  await waitFor(() =>
    expect(api.executeRun).toHaveBeenCalledWith(
      'run-token',
      'run-1',
      'demo',
      false,
      expect.any(AbortSignal),
    ),
  );
  expect(api.executeRun).toHaveBeenCalledTimes(1);
});
it('locks uncertain execution until a successful authoritative detail refresh and never replays automatically', async () => {
  vi.mocked(api.getRun).mockResolvedValue(
    run({ status: 'queued', result: null, executionMode: null }),
  );
  vi.mocked(api.executeRun).mockRejectedValue(new Error(UNCERTAIN_CHANGE_MESSAGE));
  const user = userEvent.setup();
  show();
  await screen.findByLabelText('Execution mode');
  await waitFor(() => expect(screen.getByRole('button', { name: 'Refresh run' })).toBeEnabled());
  await user.selectOptions(screen.getByLabelText('Execution mode'), 'demo');
  await user.click(screen.getByRole('button', { name: 'Execute draft' }));
  await screen.findByRole('alert');
  expect(screen.getByRole('button', { name: 'Execute draft' })).toBeDisabled();
  expect(screen.getByLabelText('Execution mode')).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Cancel run' })).toBeDisabled();
  vi.mocked(api.getRun).mockResolvedValue(run());
  await user.click(screen.getByRole('button', { name: 'Refresh run' }));
  await ready();
  expect(screen.queryByRole('button', { name: 'Execute draft' })).not.toBeInTheDocument();
  expect(api.executeRun).toHaveBeenCalledTimes(1);
  expect(screen.getByRole('button', { name: 'Approve draft' })).toBeEnabled();
});
it('reviews the exact displayed version/digest and refreshes its recorded decision', async () => {
  const user = userEvent.setup();
  show();
  await ready();
  await user.type(screen.getByLabelText('Review note (optional)'), 'Human decision');
  vi.mocked(api.getRun).mockResolvedValue(
    run({
      status: 'approved',
      review: {
        decision: 'approved',
        note: 'Human decision',
        at: '2026-10-07T00:00:00Z',
        reviewedVersion: 2,
        resultDigest: 'a'.repeat(64),
      },
    }),
  );
  await user.click(screen.getByRole('button', { name: 'Approve draft' }));
  await screen.findByRole('region', { name: 'Human review' });
  expect(api.reviewRunDraft).toHaveBeenCalledWith(
    'run-token',
    run(),
    'approved',
    'Human decision',
    expect.any(AbortSignal),
  );
  expect(screen.queryByRole('button', { name: 'Reject draft' })).not.toBeInTheDocument();
  expect(screen.getByText('Human decision')).toBeInTheDocument();
});
it('explicitly cancels queued work and refreshes outcome without claiming task changes', async () => {
  vi.mocked(api.getRun).mockResolvedValue(
    run({ status: 'queued', result: null, executionMode: null }),
  );
  const user = userEvent.setup();
  show();
  await screen.findByRole('button', { name: 'Cancel run' });
  await waitFor(() => expect(screen.getByRole('button', { name: 'Cancel run' })).toBeEnabled());
  vi.mocked(api.getRun).mockResolvedValue(run({ status: 'failed', failureReason: 'cancelled' }));
  await user.click(screen.getByRole('button', { name: 'Cancel run' }));
  await screen.findByText('Failure reason: cancelled');
  expect(api.cancelRun).toHaveBeenCalledWith('run-token', 'run-1', expect.any(AbortSignal));
  expect(api.cancelRun).toHaveBeenCalledTimes(1);
});
it('retires a previous route read so late private content cannot replace the new run', async () => {
  const old = deferred<AgentRun>();
  vi.mocked(api.getRun).mockImplementation((_token, id) =>
    id === 'run-1'
      ? old.promise
      : Promise.resolve(run({ _id: 'run-2', input: 'Replacement route input' })),
  );
  const user = userEvent.setup();
  show();
  await user.click(screen.getByRole('link', { name: 'Next run' }));
  await screen.findByText('Replacement route input');
  await act(async () => old.resolve(run({ input: 'OLD_PRIVATE_ROUTE_MARKER' })));
  expect(screen.queryByText('OLD_PRIVATE_ROUTE_MARKER')).not.toBeInTheDocument();
  expect(screen.getByText('Replacement route input')).toBeInTheDocument();
});
it('retires late mutation success when a replacement login repeats the same token', async () => {
  const old = deferred<AgentRun>();
  vi.mocked(api.reviewRunDraft).mockReturnValue(old.promise);
  const user = userEvent.setup();
  show();
  await ready();
  await user.click(screen.getByRole('button', { name: 'Approve draft' }));
  vi.mocked(api.getRun).mockResolvedValue(run({ input: 'Replacement session input' }));
  act(() => {
    store.dispatch(clearAuth());
    store.dispatch(setToken('run-token'));
  });
  await screen.findByText('Replacement session input');
  await act(async () => old.resolve(run({ status: 'approved' })));
  expect(screen.queryByText('Draft approved. No tasks were changed.')).not.toBeInTheDocument();
  expect(screen.getByText('Replacement session input')).toBeInTheDocument();
  expect(store.getState().auth.token).toBe('run-token');
});
it('disables actual native fields during pending creation, and a failed refresh keeps the uncertain lock', async () => {
  seed();
  const pending = deferred<AgentRun>();
  vi.mocked(api.createRun).mockReturnValue(pending.promise);
  const user = userEvent.setup();
  show('/workforce/runs');
  await screen.findByText('No runs yet.');
  await user.selectOptions(screen.getByLabelText('Assigned task'), 'task-1');
  await user.type(screen.getByLabelText('Requested work'), 'Draft this');
  await user.click(screen.getByRole('button', { name: 'Create queued run' }));
  expect(screen.getByLabelText('Assigned task')).toBeDisabled();
  expect(screen.getByLabelText('Requested work')).toBeDisabled();
  await act(async () => pending.reject(new Error(UNCERTAIN_CHANGE_MESSAGE)));
  await screen.findByRole('alert');
  vi.mocked(api.getRuns).mockRejectedValueOnce(new Error('Authoritative list unavailable'));
  await user.click(screen.getByRole('button', { name: 'Refresh runs' }));
  await screen.findByText('Authoritative list unavailable');
  expect(screen.getByRole('button', { name: 'Create queued run' })).toBeDisabled();
  expect(screen.getByLabelText('Assigned task')).toBeDisabled();
  expect(api.createRun).toHaveBeenCalledTimes(1);
});
it('disables the actual execution field during a pending write and preserves its lock after failed refresh', async () => {
  vi.mocked(api.getRun).mockResolvedValue(
    run({ status: 'queued', result: null, executionMode: null }),
  );
  const pending = deferred<AgentRun>();
  vi.mocked(api.executeRun).mockReturnValue(pending.promise);
  const user = userEvent.setup();
  show();
  await screen.findByLabelText('Execution mode');
  await waitFor(() => expect(screen.getByRole('button', { name: 'Refresh run' })).toBeEnabled());
  await user.selectOptions(screen.getByLabelText('Execution mode'), 'demo');
  await user.click(screen.getByRole('button', { name: 'Execute draft' }));
  expect(screen.getByLabelText('Execution mode')).toBeDisabled();
  expect(screen.getByLabelText('Include project notes')).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Cancel run' })).toBeDisabled();
  await act(async () => pending.reject(new Error(UNCERTAIN_CHANGE_MESSAGE)));
  await screen.findByRole('alert');
  vi.mocked(api.getRun).mockRejectedValueOnce(new Error('Authoritative detail unavailable'));
  await user.click(screen.getByRole('button', { name: 'Refresh run' }));
  await screen.findByText('Authoritative detail unavailable');
  expect(screen.getByText(/Refresh run before deciding or executing again/)).toBeInTheDocument();
  expect(screen.queryByLabelText('Execution mode')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Execute draft' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Cancel run' })).not.toBeInTheDocument();
  expect(api.executeRun).toHaveBeenCalledTimes(1);
});
it('retains handoff creation identity when a failed parent refresh unmounts the panel', async () => {
  seed();
  const approved = run({ status: 'approved', agent: 'source-agent' });
  vi.mocked(api.getRun).mockResolvedValue(approved);
  vi.mocked(handoffs.createHandoff)
    .mockRejectedValueOnce(new Error(UNCERTAIN_CHANGE_MESSAGE))
    .mockResolvedValueOnce(run({ _id: 'child-1', status: 'queued' }));
  const user = userEvent.setup();
  show();
  await screen.findByLabelText('Handoff target task');
  await waitFor(() => expect(screen.getByRole('button', { name: 'Refresh run' })).toBeEnabled());
  await user.selectOptions(screen.getByLabelText('Handoff target task'), 'task-1');
  await user.type(screen.getByLabelText('Handoff request'), 'Next identical handoff');
  await user.click(screen.getByRole('button', { name: 'Create queued handoff' }));
  await screen.findByText(/Refresh handoffs before trying again/);
  const firstKey = vi.mocked(handoffs.createHandoff).mock.calls[0][3];
  vi.mocked(api.getRun).mockRejectedValueOnce(new Error('Parent temporarily unavailable'));
  await user.click(screen.getByRole('button', { name: 'Refresh run' }));
  await screen.findByText('Parent temporarily unavailable');
  expect(screen.queryByLabelText('Handoff target task')).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Refresh run' }));
  await screen.findByLabelText('Handoff target task');
  await screen.findByText('No child handoffs.');
  await user.selectOptions(screen.getByLabelText('Handoff target task'), 'task-1');
  await user.type(screen.getByLabelText('Handoff request'), 'Next identical handoff');
  await user.click(screen.getByRole('button', { name: 'Create queued handoff' }));
  await screen.findByRole('link', { name: 'View child run' });
  expect(vi.mocked(handoffs.createHandoff).mock.calls[1][3]).toBe(firstKey);
  expect(handoffs.createHandoff).toHaveBeenCalledTimes(2);
});
