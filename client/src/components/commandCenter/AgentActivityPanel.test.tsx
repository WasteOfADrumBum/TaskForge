import { ChakraProvider } from '@chakra-ui/react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as api from '../../api/runs';
import { system } from '../../assets/theme/theme';
import { store } from '../../redux/store';
import { clearAuth, setToken } from '../../redux/slices/authSlice';
import { setAgents } from '../../redux/slices/agentSlice';
import { setTasks } from '../../redux/slices/taskSlice';
import { validToken } from '../../test/renderApp';
import type { AgentRun } from '../../types/run';
import AgentActivityPanel from './AgentActivityPanel';

vi.mock('../../api/runs', () => ({ getRuns: vi.fn() }));

const now = new Date('2026-11-15T12:00:00.000Z');
const run = (id: string, extra: Partial<AgentRun> = {}): AgentRun => ({
  _id: id,
  task: 'task-1',
  agent: 'agent-1',
  input: 'Synthetic input',
  result: null,
  resultDigest: null,
  status: 'awaiting-approval',
  version: 1,
  executionMode: 'demo',
  createdAt: '2026-11-15T11:00:00.000Z',
  ...extra,
});

const renderPanel = () =>
  render(
    <Provider store={store}>
      <ChakraProvider value={system}>
        <MemoryRouter>
          <AgentActivityPanel now={now} />
        </MemoryRouter>
      </ChakraProvider>
    </Provider>,
  );

beforeEach(() => {
  vi.mocked(api.getRuns).mockReset();
  store.dispatch(setToken(validToken()));
  store.dispatch(
    setAgents([
      {
        _id: 'agent-1',
        name: 'Research agent',
        role: 'Research',
        description: '',
        status: 'active',
        skills: [],
        permissions: ['task.read'],
      },
    ]),
  );
  store.dispatch(
    setTasks([
      {
        _id: 'task-1',
        title: 'Draft the launch note',
        description: '',
        status: 'todo',
        priority: 'medium',
        dueDate: null,
      },
    ]),
  );
});
afterEach(() => {
  store.dispatch(clearAuth());
});

describe('AgentActivityPanel', () => {
  it('announces loading in one status region, then shows counts and recent runs', async () => {
    let resolve!: (runs: AgentRun[]) => void;
    vi.mocked(api.getRuns).mockReturnValue(new Promise((yes) => (resolve = yes)));
    renderPanel();
    const region = screen.getByRole('region', { name: /agent activity/i });
    expect(within(region).getByRole('status')).toHaveTextContent('Loading agent activity...');
    resolve([
      run('run-1'),
      run('run-2', { status: 'running' }),
      run('run-3', { status: 'failed', createdAt: '2026-11-14T00:00:00.000Z' }),
    ]);
    const list = await within(region).findByRole('list', { name: 'Most recent runs' });
    expect(within(region).getByRole('status')).toHaveTextContent('');
    expect(within(list).getAllByRole('listitem')).toHaveLength(3);
    const link = within(list).getAllByRole('link', { name: 'Draft the launch note' })[0];
    expect(link).toHaveAttribute('href', '/workforce/runs/run-1');
    expect(within(list).getAllByText(/Research agent/)).toHaveLength(3);
    const counts = within(region).getByText('Awaiting your review').parentElement!;
    expect(counts).toHaveTextContent('1');
    expect(within(region).getByText('Failed in the last 7 days').parentElement!).toHaveTextContent(
      '1',
    );
    expect(within(region).getByText('Awaiting approval')).toBeInTheDocument();
  });

  it('explains when there are no runs yet', async () => {
    vi.mocked(api.getRuns).mockResolvedValue([]);
    renderPanel();
    expect(await screen.findByText(/No runs yet/)).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Most recent runs' })).not.toBeInTheDocument();
  });

  it('reports a load failure and retries on request', async () => {
    vi.mocked(api.getRuns)
      .mockRejectedValueOnce(new Error('Unable to load run activity'))
      .mockResolvedValueOnce([run('run-9')]);
    renderPanel();
    expect(await screen.findByText('Unable to load run activity')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Agent activity could not be loaded.');
    await userEvent.click(screen.getByRole('button', { name: 'Retry loading activity' }));
    expect(await screen.findByRole('list', { name: 'Most recent runs' })).toBeInTheDocument();
    expect(api.getRuns).toHaveBeenCalledTimes(2);
  });

  it('renders nothing without a session', () => {
    store.dispatch(clearAuth());
    const { container } = renderPanel();
    expect(container).toBeEmptyDOMElement();
    expect(api.getRuns).not.toHaveBeenCalled();
  });
});
