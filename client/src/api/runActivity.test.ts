import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import {
  cancelRun,
  createRun,
  executeRun,
  getRun,
  getRunAudit,
  getRunProviderStatus,
  getRuns,
  RunApiError,
} from './runs';
import { UNCERTAIN_CHANGE_MESSAGE } from './request';
import { store } from '../redux/store';
import { clearAuth, setToken } from '../redux/slices/authSlice';
import { setTasks } from '../redux/slices/taskSlice';
import { SessionExpiredError } from '../utils/session';

const token = 'activity-token';
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

it.each([
  {
    path: '/api/runs',
    body: { runs: [] },
    result: [],
    call: (signal: AbortSignal) => getRuns(token, signal),
  },
  {
    path: '/api/runs/run%2F%3Fowner%3Dother',
    body: { run: { id: 'run-1' } },
    result: { id: 'run-1' },
    call: (signal: AbortSignal) => getRun(token, 'run/?owner=other', signal),
  },
  {
    path: '/api/runs/run%2F%3Fowner%3Dother/audit',
    body: { events: [] },
    result: [],
    call: (signal: AbortSignal) => getRunAudit(token, 'run/?owner=other', signal),
  },
  {
    path: '/api/ai/status',
    body: { defaultMode: 'disabled' },
    result: { defaultMode: 'disabled' },
    call: (signal: AbortSignal) => getRunProviderStatus(token, signal),
  },
])(
  'reads authenticated $path without injecting caller IDs into routes',
  async ({ path, body, result, call }) => {
    fetchMock.mockResolvedValue(json(body));
    expect(await call(new AbortController().signal)).toEqual(result);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe('http://localhost:5000' + path);
    expect(options.headers).toEqual({
      Authorization: 'Bearer ' + token,
      'Content-Type': 'application/json',
    });
    expect(options.signal).toBeInstanceOf(AbortSignal);
    expect(options.body).toBeUndefined();
  },
);
it('allowlists creation fields and forwards stable idempotency identity once', async () => {
  fetchMock.mockResolvedValue(json({ run: { id: 'queued' } }, 201));
  const input = {
    taskId: 'task-1',
    agentId: 'agent-1',
    input: 'Requested work',
    owner: 'foreign',
    context: { secret: true },
    permissions: ['*'],
  };
  expect(await createRun(token, input, 'stable-creation-key')).toEqual({ id: 'queued' });
  const [url, options] = fetchMock.mock.calls[0];
  expect(url).toBe('http://localhost:5000/api/runs');
  expect(options.method).toBe('POST');
  expect(options.headers['Idempotency-Key']).toBe('stable-creation-key');
  expect(JSON.parse(options.body)).toEqual({
    taskId: 'task-1',
    agentId: 'agent-1',
    input: 'Requested work',
  });
  expect(fetchMock).toHaveBeenCalledTimes(1);
});
it.each(['demo', 'local'] as const)(
  'sends explicit %s execution and opt-in context with cancellation',
  async (mode) => {
    fetchMock.mockResolvedValue(json({ run: { id: 'draft' } }));
    const controller = new AbortController();
    await executeRun(token, 'run/?owner=other', mode, true, controller.signal);
    expect(fetchMock.mock.calls[0][0]).toBe(
      'http://localhost:5000/api/runs/run%2F%3Fowner%3Dother/execute',
    );
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ mode, includeProject: true });
    expect(fetchMock.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
    expect(fetchMock.mock.calls[0][1].headers['Idempotency-Key']).toBeUndefined();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  },
);
it('defaults project context off and cancels with an empty fenced command', async () => {
  fetchMock.mockImplementation(() => Promise.resolve(json({ run: { id: 'run' } })));
  await executeRun(token, 'run', 'demo');
  expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
    mode: 'demo',
    includeProject: false,
  });
  await cancelRun(token, 'run');
  expect(fetchMock.mock.calls[1][0]).toBe('http://localhost:5000/api/runs/run/cancel');
  expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({});
});
it.each([403, 404, 409, 500])('preserves HTTP %s as an actionable RunApiError', async (status) => {
  fetchMock.mockResolvedValue(json({ message: 'Owned run unavailable' }, status));
  const error = await getRun(token, 'run').catch((failure: unknown) => failure);
  expect(error).toBeInstanceOf(RunApiError);
  expect(error).toMatchObject({ status, message: 'Owned run unavailable' });
  expect(fetchMock).toHaveBeenCalledTimes(1);
});
it.each([
  () => createRun(token, { taskId: 'task', agentId: 'agent', input: 'Work' }, 'stable-key'),
  () => executeRun(token, 'run', 'demo'),
  () => cancelRun(token, 'run'),
])('never retries uncertain writes after losing a response', async (request) => {
  fetchMock.mockRejectedValue(new Error('network disconnected'));
  await expect(request()).rejects.toThrow(UNCERTAIN_CHANGE_MESSAGE);
  expect(fetchMock).toHaveBeenCalledTimes(1);
});
it('forwards caller cancellation to the actual fetch and never replays execution', async () => {
  fetchMock.mockImplementation(() => new Promise(() => {}));
  const controller = new AbortController();
  const result = executeRun(token, 'run', 'demo', false, controller.signal).catch(
    (error: unknown) => error,
  );
  await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
  controller.abort();
  expect(await result).toMatchObject({ message: UNCERTAIN_CHANGE_MESSAGE });
  expect(fetchMock.mock.calls[0][1].signal.aborted).toBe(true);
  expect(fetchMock).toHaveBeenCalledTimes(1);
});
it.each([
  () => getRuns(token),
  () => getRun(token, 'run'),
  () => getRunAudit(token, 'run'),
  () => getRunProviderStatus(token),
  () => createRun(token, { taskId: 'task', agentId: 'agent', input: 'Work' }, 'stable-key'),
  () => executeRun(token, 'run', 'demo'),
  () => cancelRun(token, 'run'),
])('expires current sessions and clears private resources on 401', async (request) => {
  store.dispatch(setTasks([{ _id: 'private', title: 'Private task' }] as never));
  fetchMock.mockResolvedValue(new Response(null, { status: 401 }));
  await expect(request()).rejects.toBeInstanceOf(SessionExpiredError);
  expect(store.getState().auth.token).toBeNull();
  expect(store.getState().tasks.items).toEqual([]);
  expect(localStorage.getItem('token')).toBeNull();
});
it.each([200, 401])('discards a delayed HTTP %s from an older same-JWT session', async (status) => {
  let finish!: (response: Response) => void;
  fetchMock.mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const result = getRuns(token).catch((error: unknown) => error);
  await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
  store.dispatch(clearAuth());
  store.dispatch(setToken(token));
  finish(
    status === 200 ? json({ runs: [{ input: 'OLD_PRIVATE' }] }) : new Response(null, { status }),
  );
  expect(await result).toBeInstanceOf(SessionExpiredError);
  expect(store.getState().auth.token).toBe(token);
  expect(store.getState().auth.error).toBeNull();
  expect(localStorage.getItem('token')).toBe(token);
});
