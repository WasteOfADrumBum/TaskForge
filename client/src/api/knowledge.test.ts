import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import {
  createKnowledgeSource,
  deleteKnowledgeSource,
  getKnowledgeSource,
  getKnowledgeSources,
  searchKnowledge,
  updateKnowledgeSource,
  KnowledgeApiError,
} from './knowledge';
import { store } from '../redux/store';
import { clearAuth, setToken } from '../redux/slices/authSlice';
import { SessionExpiredError } from '../utils/session';
import type { KnowledgeSource } from '../types/knowledge';
const token = 'knowledge-token';
const source: KnowledgeSource = {
  id: 'source/1',
  title: 'Private',
  content: '<script>untrusted</script>',
  kind: 'text',
  project: null,
  version: 4,
  contentDigest: 'a'.repeat(64),
  createdAt: '',
  updatedAt: '',
};
const fetchMock = vi.fn();
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset();
  store.dispatch(setToken(token));
});
afterEach(() => {
  store.dispatch(clearAuth());
  vi.unstubAllGlobals();
});
it('encodes source IDs and query/project data as data', async () => {
  fetchMock.mockResolvedValue(json({ source }));
  expect(await getKnowledgeSource(token, source.id)).toEqual(source);
  expect(fetchMock.mock.calls[0][0]).toBe('http://localhost:5000/api/knowledge/source%2F1');
  fetchMock.mockResolvedValue(json({ mode: 'keyword', modelUsed: false, results: [] }));
  await searchKnowledge(token, '[x]&owner=foreign', 'p&x=1');
  expect(fetchMock.mock.calls[1][0]).toBe(
    'http://localhost:5000/api/knowledge/search?q=%5Bx%5D%26owner%3Dforeign&project=p%26x%3D1',
  );
});
it('lists owned summaries with caller cancellation', async () => {
  fetchMock.mockResolvedValue(json({ sources: [source] }));
  const controller = new AbortController();
  expect(await getKnowledgeSources(token, controller.signal)).toEqual([source]);
  expect(fetchMock.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
});
it('sends literal text and stable creation key exactly once', async () => {
  fetchMock.mockResolvedValue(json({ source }, 201));
  const input = { title: source.title, content: source.content, kind: source.kind, project: null };
  await createKnowledgeSource(token, input, 'same-key');
  const options = fetchMock.mock.calls[0][1];
  expect(options.headers['Idempotency-Key']).toBe('same-key');
  expect(JSON.parse(options.body)).toEqual(input);
  expect(fetchMock).toHaveBeenCalledTimes(1);
});
it('sends the displayed exact version/digest for edit and delete', async () => {
  fetchMock
    .mockResolvedValueOnce(json({ source }))
    .mockResolvedValueOnce(new Response(null, { status: 204 }));
  const input = { title: 'New', content: 'Changed', kind: 'note' as const, project: null };
  await updateKnowledgeSource(token, source, input);
  await deleteKnowledgeSource(token, source);
  expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
    ...input,
    version: 4,
    contentDigest: source.contentDigest,
  });
  expect(fetchMock.mock.calls[0][1].method).toBe('PUT');
  expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({
    version: 4,
    contentDigest: source.contentDigest,
  });
  expect(fetchMock.mock.calls[1][1].method).toBe('DELETE');
});
it('preserves conflict status without automatic retry', async () => {
  fetchMock.mockResolvedValue(json({ message: 'Refresh current source' }, 409));
  await expect(getKnowledgeSource(token, 's')).rejects.toEqual(
    new KnowledgeApiError(409, 'Refresh current source'),
  );
  expect(fetchMock).toHaveBeenCalledTimes(1);
});
it('expires only current 401 session', async () => {
  fetchMock.mockResolvedValue(json({ message: 'Unauthorized' }, 401));
  await expect(getKnowledgeSources(token)).rejects.toBeInstanceOf(SessionExpiredError);
  expect(store.getState().auth.token).toBeNull();
});
it('discards old responses when an identical token is logged in again', async () => {
  let resolve!: (response: Response) => void;
  fetchMock.mockImplementation(
    () =>
      new Promise<Response>((done) => {
        resolve = done;
      }),
  );
  const pending = getKnowledgeSources(token);
  store.dispatch(clearAuth());
  store.dispatch(setToken(token));
  resolve(json({ sources: [source] }));
  await expect(pending).rejects.toBeInstanceOf(SessionExpiredError);
  expect(store.getState().auth.token).toBe(token);
});
it('does not replay an uncertain create after network failure', async () => {
  fetchMock.mockRejectedValue(new Error('offline'));
  await expect(createKnowledgeSource(token, source, 'key')).rejects.toThrow('confirm your change');
  expect(fetchMock).toHaveBeenCalledTimes(1);
});
