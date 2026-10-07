import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createHandoff, getHandoffs } from './handoffs';
import { UNCERTAIN_CHANGE_MESSAGE } from './request';
import { store } from '../redux/store';
import { clearAuth, setToken } from '../redux/slices/authSlice';
import { SessionExpiredError } from '../utils/session';
import type { AgentRun } from '../types/run';
const token = 'handoff-token';
const parent: AgentRun = {
  id: 'parent/?owner=other',
  task: 'task',
  agent: 'source',
  input: 'Private source request',
  result: { text: 'Approved' },
  resultDigest: 'a'.repeat(64),
  status: 'approved',
  version: 3,
  executionMode: 'demo',
  createdAt: '2026-01-01Z',
};
const input = { taskId: 'target-task', agentId: 'target-agent', input: 'Explicit next work' };
const fetchMock = vi.fn();
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
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
it('encodes owned parent history route and forwards authentication/cancellation', async () => {
  fetchMock.mockResolvedValue(json({ runs: [] }));
  expect(await getHandoffs(token, parent.id!, new AbortController().signal)).toEqual([]);
  expect(fetchMock.mock.calls[0][0]).toBe(
    'http://localhost:5000/api/runs/parent%2F%3Fowner%3Dother/handoffs',
  );
  expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer ' + token);
  expect(fetchMock.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
});
it('sends exact approved parent version/digest, allowlisted target fields and stable key once', async () => {
  fetchMock.mockResolvedValue(json({ run: { id: 'child', status: 'queued' } }, 201));
  expect(
    await createHandoff(
      token,
      parent,
      { ...input, owner: 'foreign', context: 'SECRET', status: 'approved' } as never,
      'stable-handoff-key',
    ),
  ).toEqual({ id: 'child', status: 'queued' });
  const [url, options] = fetchMock.mock.calls[0];
  expect(url).toBe('http://localhost:5000/api/runs/parent%2F%3Fowner%3Dother/handoff');
  expect(options.method).toBe('POST');
  expect(options.headers['Idempotency-Key']).toBe('stable-handoff-key');
  expect(JSON.parse(options.body)).toEqual({
    ...input,
    version: 3,
    resultDigest: parent.resultDigest,
  });
  expect(fetchMock).toHaveBeenCalledTimes(1);
});
it.each(['queued', 'running', 'awaiting-approval', 'rejected', 'failed'] as const)(
  'refuses %s source before network traffic',
  async (status) => {
    await expect(createHandoff(token, { ...parent, status }, input, 'key')).rejects.toThrow(
      'Refresh the approved parent',
    );
    expect(fetchMock).not.toHaveBeenCalled();
  },
);
it('requires reviewed digest before handing off', async () => {
  await expect(
    createHandoff(token, { ...parent, resultDigest: null }, input, 'key'),
  ).rejects.toThrow('Refresh the approved parent');
  expect(fetchMock).not.toHaveBeenCalled();
});
it.each([400, 403, 404, 409, 503])(
  'retains safe HTTP %s failure without write replay',
  async (status) => {
    fetchMock.mockResolvedValue(json({ message: 'Safe handoff failure' }, status));
    await expect(createHandoff(token, parent, input, 'key')).rejects.toThrow(
      'Safe handoff failure',
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  },
);
it.each(['network', 'body'] as const)(
  'reports uncertain %s writes and never retries',
  async (failure) => {
    if (failure === 'network') fetchMock.mockRejectedValue(new Error('lost response'));
    else fetchMock.mockResolvedValue(new Response('not JSON'));
    await expect(createHandoff(token, parent, input, 'key')).rejects.toThrow(
      UNCERTAIN_CHANGE_MESSAGE,
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  },
);
it.each([() => getHandoffs(token, parent.id!), () => createHandoff(token, parent, input, 'key')])(
  'expires current 401 session',
  async (request) => {
    fetchMock.mockResolvedValue(new Response(null, { status: 401 }));
    await expect(request()).rejects.toBeInstanceOf(SessionExpiredError);
    expect(store.getState().auth.token).toBeNull();
    expect(localStorage.getItem('token')).toBeNull();
  },
);
it.each([200, 401])(
  'discards delayed old HTTP %s after replacement same-JWT login',
  async (status) => {
    let finish!: (response: Response) => void;
    fetchMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const pending = createHandoff(token, parent, input, 'key').catch((error: unknown) => error);
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    store.dispatch(clearAuth());
    store.dispatch(setToken(token));
    finish(
      status === 200 ? json({ run: { input: 'OLD_PRIVATE' } }) : new Response(null, { status }),
    );
    expect(await pending).toBeInstanceOf(SessionExpiredError);
    expect(store.getState().auth.token).toBe(token);
    expect(store.getState().auth.error).toBeNull();
  },
);
