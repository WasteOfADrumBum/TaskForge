import { ChakraProvider } from '@chakra-ui/react';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import HandoffPanel from './HandoffPanel';
import { system } from '../../assets/theme/theme';
import { store } from '../../redux/store';
import { clearAuth, setToken } from '../../redux/slices/authSlice';
import { setTasks } from '../../redux/slices/taskSlice';
import { setAgents } from '../../redux/slices/agentSlice';
import * as api from '../../api/handoffs';
import { UNCERTAIN_CHANGE_MESSAGE } from '../../api/request';
import type { AgentRun } from '../../types/run';
vi.mock('../../api/handoffs', () => ({ getHandoffs: vi.fn(), createHandoff: vi.fn() }));
const parent: AgentRun = {
  _id: 'parent',
  task: 'source-task',
  agent: 'source-agent',
  input: 'Source work',
  result: { text: 'Approved' },
  resultDigest: 'a'.repeat(64),
  status: 'approved',
  version: 3,
  executionMode: 'demo',
  createdAt: '2026-01-01Z',
};
const child: AgentRun = {
  ...parent,
  _id: 'child',
  agent: 'target-agent',
  input: 'Next work',
  status: 'queued',
  result: null,
  resultDigest: null,
  version: 0,
};
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
        _id: 'target-task',
        title: 'Target task',
        assigneeType: 'agent',
        assigneeAgent: 'target-agent',
        description: '',
        status: 'todo',
        priority: 'medium',
        dueDate: null,
      },
    ]),
  );
  store.dispatch(
    setAgents([
      {
        _id: 'target-agent',
        name: 'Target agent',
        role: 'Draft',
        description: '',
        status: 'active',
        skills: [],
        permissions: ['task.read', 'artifact.draft'],
      },
    ]),
  );
};
const show = (run = parent) =>
  render(
    <Provider store={store}>
      <ChakraProvider value={system}>
        <MemoryRouter>
          <HandoffPanel run={run} />
        </MemoryRouter>
      </ChakraProvider>
    </Provider>,
  );
beforeEach(() => {
  vi.resetAllMocks();
  store.dispatch(clearAuth());
  store.dispatch(setToken('token'));
  vi.mocked(api.getHandoffs).mockResolvedValue([]);
  vi.mocked(api.createHandoff).mockResolvedValue(child);
});
afterEach(() => {
  store.dispatch(clearAuth());
  localStorage.clear();
});
const fill = async (user: ReturnType<typeof userEvent.setup>) => {
  await screen.findByText('No child handoffs.');
  await user.selectOptions(screen.getByLabelText('Handoff target task'), 'target-task');
  await user.type(screen.getByLabelText('Handoff request'), 'Next work');
};
it('fails closed for unapproved parent and max-depth source', async () => {
  const view = show({ ...parent, status: 'awaiting-approval' });
  await screen.findByText(/Approve this run before/);
  expect(screen.queryByRole('button', { name: 'Create queued handoff' })).not.toBeInTheDocument();
  view.rerender(
    <Provider store={store}>
      <ChakraProvider value={system}>
        <MemoryRouter>
          <HandoffPanel
            run={{
              ...parent,
              handoff: {
                parent: 'p',
                ancestors: ['a', 'b', 'c'],
                sourceVersion: 3,
                sourceResultDigest: parent.resultDigest!,
              },
            }}
          />
        </MemoryRouter>
      </ChakraProvider>
    </Provider>,
  );
  expect(screen.getByText('Handoff depth limit reached.')).toBeInTheDocument();
  expect(screen.queryByLabelText('Handoff target task')).not.toBeInTheDocument();
  expect(api.createHandoff).not.toHaveBeenCalled();
});
it('requires successfully loaded assignment data before target selection', async () => {
  show();
  await screen.findByText('No child handoffs.');
  expect(screen.getByLabelText('Handoff target task')).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Create queued handoff' })).toBeDisabled();
});
it('creates only explicitly queued child with exact parent and links actual child', async () => {
  seed();
  const user = userEvent.setup();
  show();
  await fill(user);
  await user.click(screen.getByRole('button', { name: 'Create queued handoff' }));
  await screen.findByText('Handoff queued. No model was called or task changed.');
  expect(api.createHandoff).toHaveBeenCalledWith(
    'token',
    parent,
    { taskId: 'target-task', agentId: 'target-agent', input: 'Next work' },
    expect.any(String),
    expect.any(AbortSignal),
  );
  expect(api.createHandoff).toHaveBeenCalledTimes(1);
  expect(screen.getByRole('link', { name: 'View child run' })).toHaveAttribute(
    'href',
    '/workforce/runs/child',
  );
  expect(screen.getByText('Queued')).toBeInTheDocument();
});
it('locks actual pending native controls and retains identical manual retry key across failed refresh', async () => {
  seed();
  const pending = deferred<AgentRun>();
  vi.mocked(api.createHandoff).mockReturnValueOnce(pending.promise);
  const user = userEvent.setup();
  show();
  await fill(user);
  await user.click(screen.getByRole('button', { name: 'Create queued handoff' }));
  expect(screen.getByLabelText('Handoff target task')).toBeDisabled();
  expect(screen.getByLabelText('Handoff request')).toBeDisabled();
  const key = vi.mocked(api.createHandoff).mock.calls[0][3];
  await act(async () => pending.reject(new Error(UNCERTAIN_CHANGE_MESSAGE)));
  vi.mocked(api.getHandoffs).mockRejectedValueOnce(new Error('History unavailable'));
  await user.click(screen.getByRole('button', { name: 'Refresh handoffs' }));
  await screen.findByText('History unavailable');
  expect(screen.getByRole('button', { name: 'Create queued handoff' })).toBeDisabled();
  expect(api.createHandoff).toHaveBeenCalledTimes(1);
  await user.click(screen.getByRole('button', { name: 'Refresh handoffs' }));
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Create queued handoff' })).toBeEnabled(),
  );
  await user.click(screen.getByRole('button', { name: 'Create queued handoff' }));
  await screen.findByRole('link', { name: 'View child run' });
  expect(vi.mocked(api.createHandoff).mock.calls[1][3]).toBe(key);
});
it('discards late child creation after same-token replacement session', async () => {
  seed();
  const pending = deferred<AgentRun>();
  vi.mocked(api.createHandoff).mockReturnValue(pending.promise);
  const user = userEvent.setup();
  show();
  await fill(user);
  await user.click(screen.getByRole('button', { name: 'Create queued handoff' }));
  act(() => {
    store.dispatch(clearAuth());
    store.dispatch(setToken('token'));
  });
  await screen.findByText('No child handoffs.');
  await act(async () => pending.resolve(child));
  expect(screen.queryByRole('link', { name: 'View child run' })).not.toBeInTheDocument();
  expect(
    screen.queryByText('Handoff queued. No model was called or task changed.'),
  ).not.toBeInTheDocument();
  expect(store.getState().auth.token).toBe('token');
});
