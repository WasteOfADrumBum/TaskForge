import { ChakraProvider } from '@chakra-ui/react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import RunDetailPage from '../../pages/RunDetailPage';
import { system } from '../../assets/theme/theme';
import { store } from '../../redux/store';
import { clearAuth, setToken } from '../../redux/slices/authSlice';
import * as api from '../../api/runs';
import * as handoffs from '../../api/handoffs';
import type { AgentRun, RunProviderStatus } from '../../types/run';

vi.mock('../../api/handoffs', () => ({
  getHandoffs: vi.fn().mockResolvedValue([]),
  createHandoff: vi.fn(),
}));
vi.mock('../../api/runs', () => ({
  getRun: vi.fn(),
  getRunAudit: vi.fn(),
  getRunProviderStatus: vi.fn(),
  executeRun: vi.fn(),
  cancelRun: vi.fn(),
  reviewRunDraft: vi.fn(),
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
const queued = (): AgentRun => ({
  _id: 'run-1',
  task: 'task-1',
  agent: 'agent-1',
  input: 'When do we confirm backups?',
  result: null,
  resultDigest: null,
  status: 'queued',
  version: 1,
  executionMode: null,
  createdAt: '2026-11-12T00:00:00Z',
});
const content = 'Launch checklist: confirm backups before every release.';
const groundedRun = (excerpts?: unknown[]): AgentRun => ({
  ...queued(),
  status: 'awaiting-approval',
  version: 3,
  workflow: 'knowledge',
  executionMode: 'local',
  resultDigest: 'e'.repeat(64),
  result: {
    text: 'Before every release [K1].\n\nSource quotes ...',
    provider: 'ollama',
    simulation: false,
    knowledge: {
      retrieval: {
        mode: 'semantic',
        project: null,
        question: 'When do we confirm backups?',
        excerpts: excerpts ?? [
          {
            key: 'K1',
            sourceId: 'b'.repeat(24),
            title: 'Release notes',
            project: null,
            version: 3,
            contentDigest: 'd'.repeat(64),
            start: 18,
            end: 55,
            quote: content.slice(18, 55),
            score: 0.8,
          },
          {
            key: 'K2',
            sourceId: 'c'.repeat(24),
            title: 'Old plan',
            project: null,
            version: 1,
            contentDigest: 'f'.repeat(64),
            start: 0,
            end: 17,
            quote: content.slice(0, 17),
            score: 0.4,
          },
        ],
      },
      answer: { answer: 'Before every release [K1].', citations: ['K1'] },
    },
  },
});
function SourceTarget() {
  const location = useLocation();
  return <p>Source page state {JSON.stringify(location.state)}</p>;
}
const show = (state?: unknown) =>
  render(
    <Provider store={store}>
      <ChakraProvider value={system}>
        <MemoryRouter initialEntries={[{ pathname: '/workforce/runs/run-1', state }]}>
          <Routes>
            <Route path="/workforce/runs/:id" element={<RunDetailPage />} />
            <Route path="/knowledge/:id" element={<SourceTarget />} />
          </Routes>
        </MemoryRouter>
      </ChakraProvider>
    </Provider>,
  );
const settled = async () => {
  await screen.findByText('Run status');
  await waitFor(() => expect(screen.getByRole('button', { name: 'Refresh run' })).toBeEnabled());
};

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(handoffs.getHandoffs).mockResolvedValue([]);
  store.dispatch(clearAuth());
  store.dispatch(setToken('run-token'));
  vi.mocked(api.getRun).mockResolvedValue(queued());
  vi.mocked(api.getRunAudit).mockResolvedValue([]);
  vi.mocked(api.getRunProviderStatus).mockResolvedValue(local);
  vi.mocked(api.executeRun).mockResolvedValue(groundedRun());
});
afterEach(() => {
  store.dispatch(clearAuth());
});

it('preselects the knowledge workflow from Ask, offers no simulation and executes only on request', async () => {
  const user = userEvent.setup();
  show({ askWorkflow: 'knowledge', includeProject: false });
  await settled();
  expect(screen.getByLabelText('Run workflow')).toHaveValue('knowledge');
  expect(screen.queryByRole('option', { name: /Simulation/ })).toBeNull();
  expect(screen.getByText(/There is no simulation for this workflow/)).toBeVisible();
  expect(api.executeRun).not.toHaveBeenCalled();
  const execute = screen.getByRole('button', { name: 'Execute draft' });
  expect(execute).toBeDisabled();
  await user.selectOptions(screen.getByLabelText('Execution mode'), 'local');
  await user.click(execute);
  await waitFor(() =>
    expect(api.executeRun).toHaveBeenCalledWith(
      'run-token',
      'run-1',
      'local',
      false,
      expect.any(AbortSignal),
      'knowledge',
    ),
  );
});

it('keeps a preselected knowledge workflow blocked when local capability is missing', async () => {
  vi.mocked(api.getRunProviderStatus).mockResolvedValue(hosted);
  show({ askWorkflow: 'knowledge', includeProject: true });
  await settled();
  expect(await screen.findByRole('alert')).toHaveTextContent(/They are unavailable here/);
  expect(screen.getByRole('button', { name: 'Execute draft' })).toBeDisabled();
});

it('does not offer the knowledge workflow on a hosted deployment', async () => {
  vi.mocked(api.getRunProviderStatus).mockResolvedValue(hosted);
  show();
  await settled();
  expect(screen.getByLabelText('Run workflow')).toHaveValue('draft');
  expect(screen.queryByRole('option', { name: /Grounded knowledge/ })).toBeNull();
});

it('shows a grounded draft with cited and uncited excerpts linked for current-source checks', async () => {
  const user = userEvent.setup();
  vi.mocked(api.getRun).mockResolvedValue(groundedRun());
  show();
  await settled();
  expect(screen.getByRole('heading', { name: 'Grounded answer and citations' })).toBeVisible();
  expect(screen.getByText('Before every release [K1].')).toBeVisible();
  expect(screen.getByText('[K1] Cited in the answer')).toBeVisible();
  expect(screen.getByText('[K2] Retrieved, not cited')).toBeVisible();
  expect(screen.getByText(/not that it is true/)).toBeVisible();
  await user.click(screen.getByRole('link', { name: 'Release notes — version 3' }));
  expect(await screen.findByText(/Source page state/)).toHaveTextContent(
    '"sourceId":"' + 'b'.repeat(24) + '"',
  );
});

it('falls back to the recorded text when a knowledge result is malformed', async () => {
  vi.mocked(api.getRun).mockResolvedValue(groundedRun([{ key: 'K1', sourceId: 'not-an-id' }]));
  show();
  await settled();
  expect(screen.queryByRole('heading', { name: 'Grounded answer and citations' })).toBeNull();
  expect(screen.getByRole('heading', { name: 'Proposed output' })).toBeVisible();
});
