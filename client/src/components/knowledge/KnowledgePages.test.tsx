import { ChakraProvider } from '@chakra-ui/react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { MemoryRouter, Routes, Route, Link } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import KnowledgePage from '../../pages/KnowledgePage';
import KnowledgeDetailPage from '../../pages/KnowledgeDetailPage';
import { system } from '../../assets/theme/theme';
import { store } from '../../redux/store';
import { clearAuth, setToken } from '../../redux/slices/authSlice';
import { setProjects } from '../../redux/slices/projectSlice';
import * as api from '../../api/knowledge';
import { KnowledgeApiError } from '../../api/knowledge';
import type { KnowledgeSource, KnowledgeHit } from '../../types/knowledge';
vi.mock('../../api/knowledge', async (original) => ({
  ...(await original<typeof import('../../api/knowledge')>()),
  getKnowledgeSources: vi.fn(),
  getKnowledgeSource: vi.fn(),
  createKnowledgeSource: vi.fn(),
  updateKnowledgeSource: vi.fn(),
  deleteKnowledgeSource: vi.fn(),
  searchKnowledge: vi.fn(),
}));
const source: KnowledgeSource = {
  id: 's1',
  title: 'Private note',
  content: '<script>hostile data</script> citation text',
  kind: 'note',
  project: null,
  version: 2,
  contentDigest: 'a'.repeat(64),
  createdAt: '',
  updatedAt: '',
};
const hit: KnowledgeHit = {
  sourceId: 's1',
  title: source.title,
  version: 2,
  contentDigest: source.contentDigest,
  score: 1,
  matchedInContent: true,
  citation: { field: 'content', start: 0, end: 28, quote: source.content.slice(0, 28) },
};
const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
};
const mount = (path = '/knowledge', state?: unknown) =>
  render(
    <ChakraProvider value={system}>
      <Provider store={store}>
        <MemoryRouter initialEntries={[{ pathname: path, state }]}>
          <Link to="/knowledge/s2">Other source</Link>
          <Routes>
            <Route path="/knowledge" element={<KnowledgePage />} />
            <Route path="/knowledge/:id" element={<KnowledgeDetailPage />} />
          </Routes>
        </MemoryRouter>
      </Provider>
    </ChakraProvider>,
  );
beforeEach(() => {
  vi.clearAllMocks();
  store.dispatch(clearAuth());
  store.dispatch(setToken('knowledge-session'));
  store.dispatch(setProjects([]));
  vi.mocked(api.getKnowledgeSources).mockResolvedValue([source]);
  vi.mocked(api.getKnowledgeSource).mockResolvedValue(source);
});
afterEach(() => {
  store.dispatch(clearAuth());
  vi.useRealTimers();
});
it('renders hosted capabilities honestly and source text as inert data', async () => {
  const { container } = mount('/knowledge/s1');
  expect(await screen.findByText(source.content)).toBeVisible();
  expect(container.querySelector('script')).toBeNull();
  expect(screen.getByText(/no AI model called/)).toBeVisible();
  expect(screen.queryByRole('button', { name: /execute/i })).toBeNull();
});
it('bounds multibyte input and offers notes/text/project association', async () => {
  const user = userEvent.setup();
  mount();
  await screen.findByRole('link', { name: source.title });
  await user.type(screen.getByLabelText(/^Source title/), 'New');
  await user.selectOptions(screen.getByLabelText('Source type'), 'text');
  await user.click(screen.getByLabelText(/^Source text/));
  await user.paste('😀'.repeat(5001));
  expect(screen.getByRole('button', { name: 'Save source' })).toBeDisabled();
  expect(api.createKnowledgeSource).not.toHaveBeenCalled();
});
it('locks uncertain creation and manually retries the same input and key only after a successful refresh', async () => {
  const user = userEvent.setup();
  vi.mocked(api.createKnowledgeSource).mockRejectedValue(new Error('Unknown outcome'));
  mount();
  await screen.findByRole('link', { name: source.title });
  await user.type(screen.getByLabelText(/^Source title/), 'New');
  await user.type(screen.getByLabelText(/^Source text/), 'New text');
  await user.click(screen.getByRole('button', { name: 'Save source' }));
  await screen.findByRole('alert');
  expect(screen.getByLabelText(/^Source title/)).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Retry same save' })).toBeDisabled();
  vi.mocked(api.getKnowledgeSources).mockRejectedValueOnce(new Error('Unavailable'));
  await user.click(screen.getByRole('button', { name: 'Refresh sources' }));
  await screen.findByText('Unavailable');
  expect(screen.getByRole('button', { name: 'Retry same save' })).toBeDisabled();
  await user.click(screen.getByRole('button', { name: 'Refresh sources' }));
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Retry same save' })).toBeEnabled(),
  );
  await user.click(screen.getByRole('button', { name: 'Retry same save' }));
  await waitFor(() => expect(api.createKnowledgeSource).toHaveBeenCalledTimes(2));
  expect(vi.mocked(api.createKnowledgeSource).mock.calls[0].slice(1, 3)).toEqual(
    vi.mocked(api.createKnowledgeSource).mock.calls[1].slice(1, 3),
  );
});
it('requires current displayed version/digest and locks conflicts until explicit refresh', async () => {
  const user = userEvent.setup();
  vi.mocked(api.updateKnowledgeSource).mockRejectedValue(
    new KnowledgeApiError(409, 'Source changed'),
  );
  mount('/knowledge/s1');
  await screen.findByText(source.content);
  await user.click(screen.getByRole('button', { name: 'Edit source' }));
  await user.clear(screen.getByLabelText(/^Source title/));
  await user.type(screen.getByLabelText(/^Source title/), 'Edited');
  await user.click(screen.getByRole('button', { name: 'Save changes' }));
  await screen.findByRole('alert');
  expect(api.updateKnowledgeSource).toHaveBeenCalledWith(
    'knowledge-session',
    source,
    expect.objectContaining({ title: 'Edited' }),
    expect.any(AbortSignal),
  );
  expect(screen.getByRole('button', { name: 'Save changes' })).toBeDisabled();
  vi.mocked(api.getKnowledgeSource).mockResolvedValue({
    ...source,
    title: 'Updated elsewhere',
    version: 3,
  });
  await user.click(screen.getByRole('button', { name: 'Refresh source (discard edits)' }));
  await screen.findByRole('heading', { name: 'Updated elsewhere' });
  expect(screen.queryByRole('button', { name: 'Save changes' })).toBeNull();
});
it('requires explicit deletion confirmation and locks the pending action', async () => {
  const user = userEvent.setup();
  const pending = deferred<void>();
  vi.mocked(api.deleteKnowledgeSource).mockReturnValue(pending.promise);
  mount('/knowledge/s1');
  await screen.findByText(source.content);
  await user.click(screen.getByRole('button', { name: 'Delete source' }));
  expect(api.deleteKnowledgeSource).not.toHaveBeenCalled();
  await user.click(screen.getByRole('button', { name: 'Confirm delete source' }));
  expect(api.deleteKnowledgeSource).toHaveBeenCalledWith(
    'knowledge-session',
    source,
    expect.any(AbortSignal),
  );
  expect(screen.getByRole('button', { name: 'Confirm delete source' })).toBeDisabled();
  await act(async () => pending.resolve());
  await screen.findByRole('heading', { name: 'Knowledge' });
});
it('verifies a clicked excerpt against current source and invalidates it after an edit', async () => {
  const user = userEvent.setup();
  vi.mocked(api.searchKnowledge).mockResolvedValue({
    mode: 'keyword',
    modelUsed: false,
    results: [hit],
  });
  mount();
  await screen.findByRole('link', { name: source.title });
  await user.type(screen.getByLabelText('Search knowledge'), 'hostile');
  await user.click(screen.getByRole('button', { name: 'Search sources' }));
  await user.click(await screen.findByRole('link', { name: 'Private note — version 2' }));
  await screen.findByText('Citation verified against this current source version.');
  vi.mocked(api.getKnowledgeSource).mockResolvedValue({ ...source, version: 3 });
  await user.click(screen.getByRole('button', { name: 'Refresh source (discard edits)' }));
  await screen.findByText('Citation is stale or invalid. Search again for a current excerpt.');
});
it('handles foreign/missing sources without leaking router citation data', async () => {
  vi.mocked(api.getKnowledgeSource).mockRejectedValue(
    new KnowledgeApiError(404, 'Knowledge source not found'),
  );
  mount('/knowledge/foreign', {
    citation: { ...hit, citation: { ...hit.citation, quote: 'secret route quote' } },
  });
  await screen.findByText('Knowledge source not found');
  expect(screen.queryByText('secret route quote')).toBeNull();
  expect(screen.queryByRole('button', { name: 'Edit source' })).toBeNull();
});
it('discards a late detail response after route replacement', async () => {
  const user = userEvent.setup();
  const pending = deferred<KnowledgeSource>();
  vi.mocked(api.getKnowledgeSource)
    .mockReturnValueOnce(pending.promise)
    .mockResolvedValueOnce({ ...source, id: 's2', title: 'Second', content: 'Second body' });
  mount('/knowledge/s1');
  await user.click(screen.getByRole('link', { name: 'Other source' }));
  await screen.findByText('Second body');
  await act(async () => pending.resolve(source));
  expect(screen.queryByText(source.content)).toBeNull();
});
it('retires loaded private text and late replies on repeated-token login', async () => {
  const pending = deferred<KnowledgeSource>();
  vi.mocked(api.getKnowledgeSource)
    .mockReturnValueOnce(pending.promise)
    .mockRejectedValueOnce(new Error('New session source unavailable'));
  mount('/knowledge/s1');
  await act(async () => {
    store.dispatch(clearAuth());
    store.dispatch(setToken('knowledge-session'));
  });
  await act(async () => pending.resolve(source));
  await screen.findByText('New session source unavailable');
  expect(screen.queryByText(source.content)).toBeNull();
});
it('bounds search and labels title-only excerpts honestly', async () => {
  const user = userEvent.setup();
  vi.mocked(api.searchKnowledge).mockResolvedValue({
    mode: 'keyword',
    modelUsed: false,
    results: [{ ...hit, matchedInContent: false }],
  });
  mount();
  await screen.findByRole('link', { name: source.title });
  await user.type(screen.getByLabelText('Search knowledge'), 'Private');
  await user.click(screen.getByRole('button', { name: 'Search sources' }));
  await screen.findByText('Title match; source excerpt shown for context');
  expect(api.searchKnowledge).toHaveBeenCalledTimes(1);
});

it('stopping an uncertain save retires its late completion and keeps the same identity for manual retry', async () => {
  const user = userEvent.setup();
  const pending = deferred<KnowledgeSource>();
  vi.mocked(api.createKnowledgeSource).mockReturnValue(pending.promise);
  mount();
  await screen.findByRole('link', { name: source.title });
  await user.type(screen.getByLabelText(/^Source title/), 'New');
  await user.type(screen.getByLabelText(/^Source text/), 'Text');
  vi.useFakeTimers();
  fireEvent.click(screen.getByRole('button', { name: 'Save source' }));
  await act(async () => vi.advanceTimersByTime(8000));
  fireEvent.click(screen.getByRole('button', { name: 'Stop waiting for save' }));
  expect(screen.getByRole('button', { name: 'Retry same save' })).toBeDisabled();
  expect(screen.getByLabelText(/^Source title/)).toBeDisabled();
  await act(async () => pending.resolve(source));
  expect(screen.getByRole('heading', { name: 'Knowledge' })).toBeVisible();
  expect(api.createKnowledgeSource).toHaveBeenCalledTimes(1);
});
it('does not show a late search from a retired session', async () => {
  const user = userEvent.setup();
  const pending = deferred<import('../../types/knowledge').KnowledgeSearch>();
  vi.mocked(api.searchKnowledge).mockReturnValue(pending.promise);
  mount();
  await screen.findByRole('link', { name: source.title });
  await user.type(screen.getByLabelText('Search knowledge'), 'private');
  await user.click(screen.getByRole('button', { name: 'Search sources' }));
  await act(async () => {
    store.dispatch(clearAuth());
    store.dispatch(setToken('knowledge-session'));
  });
  await act(async () => pending.resolve({ mode: 'keyword', modelUsed: false, results: [hit] }));
  expect(screen.queryByRole('link', { name: 'Private note — version 2' })).toBeNull();
});

it('uses a main heading and reports unknown capacity on failed list reads', async () => {
  vi.mocked(api.getKnowledgeSources).mockRejectedValue(new Error('List offline'));
  mount();
  await screen.findByText('List offline');
  expect(screen.getByRole('heading', { name: 'Knowledge', level: 1 })).toBeVisible();
  expect(screen.getByText('Source count unavailable')).toBeVisible();
  expect(screen.queryByText('0 / 50 active sources')).toBeNull();
});
