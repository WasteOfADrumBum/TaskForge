import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getRunApprovals, reviewRunDraft } from './runs';
import { UNCERTAIN_CHANGE_MESSAGE } from './request';
import { store } from '../redux/store';
import { clearAuth, setToken } from '../redux/slices/authSlice';
import { setTasks } from '../redux/slices/taskSlice';
import { SessionExpiredError, SESSION_EXPIRED_MESSAGE } from '../utils/session';
import type { AgentRun } from '../types/run';

const token = 'review-token';
const draft: AgentRun = {
  _id: 'run-1',
  task: 'task-1',
  agent: 'agent-1',
  input: 'Private input',
  result: { text: 'Displayed draft', simulation: true },
  resultDigest: 'a'.repeat(64),
  status: 'awaiting-approval',
  version: 7,
  executionMode: 'demo',
  createdAt: '2026-10-07T00:00:00Z',
};
const fetchMock = vi.fn();
const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  store.dispatch(clearAuth());
  store.dispatch(setToken(token));
  localStorage.setItem('token', token);
});
afterEach(() => {
  vi.unstubAllGlobals();
  store.dispatch(clearAuth());
  localStorage.clear();
});

describe('owned run approval API', () => {
  it('encodes the agent filter without allowing extra query parameters and forwards cancellation', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ runs: [draft] }));
    const caller = new AbortController();
    expect(await getRunApprovals(token, 'agent &owner=someone/else', caller.signal)).toEqual([
      draft,
    ]);
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe(
      'http://localhost:5000/api/runs/approvals?agentId=agent%20%26owner%3Dsomeone%2Felse',
    );
    expect(options.headers).toEqual({
      Authorization: 'Bearer ' + token,
      'Content-Type': 'application/json',
    });
    expect(options.signal).toBeInstanceOf(AbortSignal);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it.each(['approved', 'rejected'] as const)(
    'sends the exact displayed digest/version and %s decision with verbatim note',
    async (decision) => {
      const reviewed = { ...draft, status: decision, version: 8 };
      fetchMock.mockResolvedValue(jsonResponse({ run: reviewed }));
      const note = '  Human note\nKeep the original text.  ';
      expect(await reviewRunDraft(token, draft, decision, note)).toEqual(reviewed);
      expect(fetchMock).toHaveBeenCalledWith(
        'http://localhost:5000/api/runs/run-1/review',
        expect.objectContaining({
          method: 'POST',
          headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
          body: JSON.stringify({ decision, version: 7, resultDigest: 'a'.repeat(64), note }),
        }),
      );
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(draft.version).toBe(7);
    },
  );

  it('uses the id fallback when the displayed run has no _id', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ run: draft }));
    await reviewRunDraft(token, { ...draft, _id: undefined, id: 'fallback-run' }, 'approved', '');
    expect(fetchMock.mock.calls[0][0]).toBe('http://localhost:5000/api/runs/fallback-run/review');
  });

  it.each([
    { ...draft, resultDigest: null },
    { ...draft, resultDigest: '' },
    { ...draft, status: 'queued' as const },
    { ...draft, status: 'approved' as const },
  ])('requires a current awaiting-approval snapshot before network activity (%s)', async (run) => {
    await expect(reviewRunDraft(token, run, 'approved', '')).rejects.toThrow(
      'Refresh before reviewing this draft.',
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([403, 409, 500])(
    'preserves server HTTP %s feedback without replaying the decision',
    async (status) => {
      fetchMock.mockResolvedValue(
        jsonResponse({ message: 'Refresh the displayed draft before deciding.' }, status),
      );
      await expect(reviewRunDraft(token, draft, 'rejected', 'Human decision')).rejects.toThrow(
        'Refresh the displayed draft before deciding.',
      );
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(store.getState().auth.token).toBe(token);
    },
  );

  it.each(['network', 'body'] as const)(
    'reports an uncertain %s failure and never retries an approval write',
    async (failure) => {
      if (failure === 'network') fetchMock.mockRejectedValue(new Error('lost response'));
      else fetchMock.mockResolvedValue(new Response('not JSON', { status: 200 }));
      await expect(reviewRunDraft(token, draft, 'approved', '')).rejects.toThrow(
        UNCERTAIN_CHANGE_MESSAGE,
      );
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(store.getState().auth.token).toBe(token);
    },
  );

  it.each([
    () => getRunApprovals(token, 'agent-1'),
    () => reviewRunDraft(token, draft, 'approved', ''),
  ])('expires the current session and clears private resources on 401', async (request) => {
    store.dispatch(setTasks([{ _id: 'private-task', title: 'Private' }] as never));
    fetchMock.mockResolvedValue(new Response(null, { status: 401 }));
    await expect(request()).rejects.toBeInstanceOf(SessionExpiredError);
    expect(store.getState().auth.token).toBeNull();
    expect(store.getState().auth.error).toBe(SESSION_EXPIRED_MESSAGE);
    expect(store.getState().tasks.items).toEqual([]);
    expect(localStorage.getItem('token')).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('does not let a delayed old approval 401 sign out a new session with the same JWT', async () => {
    let finish!: (response: Response) => void;
    fetchMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const pending = reviewRunDraft(token, draft, 'approved', '').catch((error: unknown) => error);
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    store.dispatch(clearAuth());
    store.dispatch(setToken(token));
    finish(new Response(null, { status: 401 }));
    expect(await pending).toBeInstanceOf(SessionExpiredError);
    expect(store.getState().auth.token).toBe(token);
    expect(store.getState().auth.error).toBeNull();
    expect(localStorage.getItem('token')).toBe(token);
  });

  it('discards private old approval-list JSON after a new session starts', async () => {
    let finish!: (body: unknown) => void;
    const json = vi.fn(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    fetchMock.mockResolvedValue({ ok: true, status: 200, json } as unknown as Response);
    const pending = getRunApprovals(token, 'agent-1').catch((error: unknown) => error);
    await vi.waitFor(() => expect(json).toHaveBeenCalledTimes(1));
    store.dispatch(clearAuth());
    store.dispatch(setToken('new-token'));
    localStorage.setItem('token', 'new-token');
    finish({ runs: [draft] });
    expect(await pending).toBeInstanceOf(SessionExpiredError);
    expect(store.getState().auth.token).toBe('new-token');
    expect(store.getState().auth.error).toBeNull();
  });
});

it('cancels an approval read without retrying or expiring the current session', async () => {
  fetchMock.mockImplementation(() => new Promise(() => {}));
  const caller = new AbortController();
  const pending = getRunApprovals(token, 'agent-1', caller.signal);
  const rejected = expect(pending).rejects.toMatchObject({ name: 'ApiCancelledError' });
  await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
  caller.abort();
  await rejected;
  expect(fetchMock.mock.calls[0][1].signal.aborted).toBe(true);
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(store.getState().auth.token).toBe(token);
  expect(store.getState().auth.error).toBeNull();
});
