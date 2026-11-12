import { ChakraProvider } from '@chakra-ui/react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import AskPage from '../../pages/AskPage';
import { system } from '../../assets/theme/theme';
import { store } from '../../redux/store';
import { clearAuth, setToken } from '../../redux/slices/authSlice';
import { setProjects } from '../../redux/slices/projectSlice';
import { setTasks } from '../../redux/slices/taskSlice';
import { setAgents } from '../../redux/slices/agentSlice';
import * as knowledgeApi from '../../api/knowledge';
import * as runApi from '../../api/runs';
import type { Agent } from '../../types/agent';
import type { Task } from '../../types/task';
import type { AgentRun, RunProviderStatus } from '../../types/run';
import type { KnowledgeHit } from '../../types/knowledge';

vi.mock('../../api/knowledge', async (original) => ({
  ...(await original<typeof import('../../api/knowledge')>()),
  searchKnowledge: vi.fn(),
}));
vi.mock('../../api/runs', async (original) => ({
  ...(await original<typeof import('../../api/runs')>()),
  getRunProviderStatus: vi.fn(),
  createRun: vi.fn(),
}));

const hosted: RunProviderStatus = {
  defaultMode: 'disabled',
  available: false,
  capabilities: { chat: false, structuredOutput: false, embeddings: false },
};
const local: RunProviderStatus = {
  defaultMode: 'local',
  available: false,
  capabilities: { chat: true, structuredOutput: true, embeddings: true },
};
const agent: Agent = {
  _id: 'a1',
  name: 'Researcher',
  role: 'Research',
  description: '',
  status: 'active',
  skills: [],
  permissions: ['task.read', 'artifact.draft', 'knowledge.read'],
};
const task = {
  _id: 't1',
  title: 'Plan launch',
  status: 'todo',
  priority: 'medium',
  assigneeType: 'agent',
  assigneeAgent: 'a1',
  project: null,
} as unknown as Task;
const hit: KnowledgeHit = {
  sourceId: 's1',
  title: 'Release notes',
  version: 2,
  contentDigest: 'a'.repeat(64),
  score: 1,
  matchedInContent: true,
  citation: { field: 'content', start: 0, end: 23, quote: '<b>confirm backups</b>!' },
};
const created = { _id: 'r9' } as AgentRun;

function RunTarget() {
  const location = useLocation();
  return <p>Run page state {JSON.stringify(location.state)}</p>;
}
function SourceTarget() {
  const location = useLocation();
  return <p>Source page state {JSON.stringify(location.state)}</p>;
}
const mount = () =>
  render(
    <ChakraProvider value={system}>
      <Provider store={store}>
        <MemoryRouter initialEntries={['/knowledge/ask']}>
          <Routes>
            <Route path="/knowledge/ask" element={<AskPage />} />
            <Route path="/knowledge/:id" element={<SourceTarget />} />
            <Route path="/workforce/runs/:id" element={<RunTarget />} />
            <Route path="/workforce/runs" element={<p>Run activity</p>} />
            <Route path="/knowledge" element={<p>Knowledge home</p>} />
          </Routes>
        </MemoryRouter>
      </Provider>
    </ChakraProvider>,
  );

beforeEach(() => {
  vi.clearAllMocks();
  store.dispatch(clearAuth());
  store.dispatch(setToken('ask-session'));
  store.dispatch(setProjects([]));
  store.dispatch(setTasks([task]));
  store.dispatch(setAgents([agent]));
  vi.mocked(runApi.getRunProviderStatus).mockResolvedValue(hosted);
});
afterEach(() => {
  store.dispatch(clearAuth());
});

it('labels both modes and disables grounded answers on a hosted deployment', async () => {
  mount();
  expect(screen.getByRole('heading', { level: 1, name: 'Ask TaskForge' })).toBeVisible();
  const group = screen.getByRole('group', { name: 'Choose how to ask' });
  const keyword = within(group).getByRole('radio', { name: /keyword, no AI/ });
  expect(keyword).toBeChecked();
  const grounded = within(group).getByRole('radio', { name: /Grounded answer/ });
  await waitFor(() => expect(grounded).toBeDisabled());
  expect(grounded).toHaveAccessibleDescription(/does not run AI models/);
  expect(grounded).toHaveAccessibleName('Grounded answer (local AI, human review)');
  expect(screen.queryByLabelText('Your question')).toBeNull();
});

it('treats an unreadable capability status as unavailable', async () => {
  vi.mocked(runApi.getRunProviderStatus).mockRejectedValue(new Error('down'));
  mount();
  const grounded = screen.getByRole('radio', { name: /Grounded answer/ });
  await waitFor(() => expect(grounded).toHaveAccessibleDescription(/could not be loaded/));
  expect(grounded).toBeDisabled();
});

it('finds keyword sources as inert text with verifiable source links', async () => {
  const user = userEvent.setup();
  vi.mocked(knowledgeApi.searchKnowledge).mockResolvedValue({
    mode: 'keyword',
    modelUsed: false,
    results: [hit],
  });
  const { container } = mount();
  await user.type(screen.getByLabelText('Words to look for'), 'backups');
  await user.click(screen.getByRole('button', { name: 'Find sources' }));
  expect(await screen.findByRole('heading', { name: '1 cited source' })).toBeVisible();
  expect(screen.getByRole('status')).toHaveTextContent('1 cited source found.');
  expect(screen.getByText(hit.citation.quote)).toBeVisible();
  expect(container.querySelector('b')).toBeNull();
  expect(knowledgeApi.searchKnowledge).toHaveBeenCalledWith(
    'ask-session',
    'backups',
    null,
    expect.any(AbortSignal),
  );
  await user.click(screen.getByRole('link', { name: 'Release notes — version 2' }));
  expect(await screen.findByText(/Source page state/)).toHaveTextContent('"sourceId":"s1"');
});

it('shows honest empty and error states and bounds the keyword query', async () => {
  const user = userEvent.setup();
  vi.mocked(knowledgeApi.searchKnowledge)
    .mockResolvedValueOnce({ mode: 'keyword', modelUsed: false, results: [] })
    .mockRejectedValueOnce(new Error('Search is temporarily unavailable'));
  mount();
  const input = screen.getByLabelText('Words to look for');
  await user.type(input, 'one two three four five six seven eight nine');
  expect(screen.getByRole('button', { name: 'Find sources' })).toBeDisabled();
  await user.clear(input);
  await user.type(input, 'missing');
  await user.click(screen.getByRole('button', { name: 'Find sources' }));
  expect(await screen.findByRole('heading', { name: 'No matching sources' })).toBeVisible();
  await user.click(screen.getByRole('button', { name: 'Find sources' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Search is temporarily unavailable');
});

it('creates a queued question run and hands off to explicit execution', async () => {
  const user = userEvent.setup();
  vi.mocked(runApi.getRunProviderStatus).mockResolvedValue(local);
  vi.mocked(runApi.createRun).mockResolvedValue(created);
  mount();
  const grounded = screen.getByRole('radio', { name: /Grounded answer/ });
  await waitFor(() => expect(grounded).toBeEnabled());
  await user.click(grounded);
  expect(screen.getByText(/nothing runs automatically/)).toBeVisible();
  const submit = screen.getByRole('button', { name: 'Create question run' });
  expect(submit).toBeDisabled();
  await user.selectOptions(screen.getByLabelText(/Task and agent/), 't1');
  expect(screen.getByRole('checkbox', { name: /project sources/ })).toBeDisabled();
  await user.click(screen.getByLabelText(/Your question/));
  await user.paste('😀'.repeat(121));
  expect(submit).toBeDisabled();
  expect(screen.getByText('Shorten the question to 480 bytes or fewer.')).toBeVisible();
  await user.clear(screen.getByLabelText(/Your question/));
  await user.type(screen.getByLabelText(/Your question/), 'When do we confirm backups?');
  await user.click(submit);
  expect(await screen.findByText(/Run page state/)).toHaveTextContent(
    '{"askWorkflow":"knowledge","includeProject":false}',
  );
  expect(runApi.createRun).toHaveBeenCalledWith(
    'ask-session',
    { taskId: 't1', agentId: 'a1', input: 'When do we confirm backups?' },
    expect.any(String),
    expect.any(AbortSignal),
  );
});

it('explains when no assigned agent has knowledge access', async () => {
  const user = userEvent.setup();
  vi.mocked(runApi.getRunProviderStatus).mockResolvedValue(local);
  store.dispatch(setAgents([{ ...agent, permissions: ['task.read', 'artifact.draft'] }]));
  mount();
  const grounded = screen.getByRole('radio', { name: /Grounded answer/ });
  await waitFor(() => expect(grounded).toBeEnabled());
  await user.click(grounded);
  expect(screen.getByText(/No task is assigned to an active agent/)).toBeVisible();
  expect(screen.queryByRole('option', { name: /Plan launch/ })).toBeNull();
});

it('locks an uncertain creation and retries with the same idempotency key', async () => {
  const user = userEvent.setup();
  vi.mocked(runApi.getRunProviderStatus).mockResolvedValue(local);
  vi.mocked(runApi.createRun)
    .mockRejectedValueOnce(new Error('Network error.'))
    .mockResolvedValueOnce(created);
  mount();
  const grounded = screen.getByRole('radio', { name: /Grounded answer/ });
  await waitFor(() => expect(grounded).toBeEnabled());
  await user.click(grounded);
  await user.selectOptions(screen.getByLabelText(/Task and agent/), 't1');
  await user.type(screen.getByLabelText(/Your question/), 'What changed?');
  await user.click(screen.getByRole('button', { name: 'Create question run' }));
  expect(await screen.findByRole('alert')).toHaveTextContent(/may already exist/);
  expect(screen.getByLabelText(/Your question/)).toBeDisabled();
  expect(screen.getByRole('link', { name: 'Open Run activity' })).toBeVisible();
  await user.click(screen.getByRole('button', { name: 'Retry same request' }));
  await screen.findByText(/Run page state/);
  const calls = vi.mocked(runApi.createRun).mock.calls;
  expect(calls).toHaveLength(2);
  expect(calls[0][2]).toBe(calls[1][2]);
});
