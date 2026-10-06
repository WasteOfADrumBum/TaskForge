import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getTasks, createTask, updateTask, deleteTask } from './tasks';
import { getAgents } from './agents';
import { getProjects } from './projects';
import { login, register } from './auth';
import { ApiCancelledError, ApiTimeoutError, UNCERTAIN_CHANGE_MESSAGE } from './request';
import { store } from '../redux/store';
import { clearAuth, setToken } from '../redux/slices/authSlice';
import { SessionExpiredError } from '../utils/session';

const fetchMock = vi.fn();
const token = 'same-jwt-string';
const outcome = (promise: Promise<unknown>) =>
  promise.then(
    (value) => ({ value, error: undefined }),
    (error: unknown) => ({ value: undefined, error }),
  );
beforeEach(() => {
  vi.useFakeTimers();
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  store.dispatch(clearAuth());
  store.dispatch(setToken(token));
  localStorage.setItem('token', token);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  store.dispatch(clearAuth());
  localStorage.clear();
});

describe('API transport integration', () => {
  it.each([
    ['tasks', getTasks],
    ['projects', getProjects],
    ['agents', getAgents],
  ] as const)(
    'accepts caller cancellation for current-session %s reads without expiring auth',
    async (_name, load) => {
      fetchMock.mockReturnValue(new Promise(() => {}));
      const caller = new AbortController();
      const result = outcome(load(token, caller.signal));
      caller.abort();
      expect((await result).error).toBeInstanceOf(ApiCancelledError);
      expect(store.getState().auth.token).toBe(token);
      expect(store.getState().auth.error).toBeNull();
      expect(vi.getTimerCount()).toBe(0);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    },
  );

  it.each(['headers', 'body'] as const)(
    'keeps original session-version priority over a %s timeout with a reused JWT',
    async (phase) => {
      fetchMock.mockImplementation(() =>
        phase === 'headers'
          ? new Promise(() => {})
          : Promise.resolve({ status: 200, ok: true, json: () => new Promise(() => {}) }),
      );
      const result = outcome(getTasks(token));
      await vi.advanceTimersByTimeAsync(1);
      store.dispatch(clearAuth());
      store.dispatch(setToken(token));
      localStorage.setItem('token', token);
      await vi.advanceTimersByTimeAsync(90_000);
      expect((await result).error).toBeInstanceOf(SessionExpiredError);
      expect(store.getState().auth.token).toBe(token);
      expect(store.getState().auth.error).toBeNull();
      expect(localStorage.getItem('token')).toBe(token);
      expect(vi.getTimerCount()).toBe(0);
    },
  );

  it('discards an old cancellation without expiring a later session using the same JWT', async () => {
    fetchMock.mockReturnValue(new Promise(() => {}));
    const caller = new AbortController();
    const result = outcome(getTasks(token, caller.signal));
    store.dispatch(clearAuth());
    store.dispatch(setToken(token));
    localStorage.setItem('token', token);
    caller.abort();
    expect((await result).error).toBeInstanceOf(SessionExpiredError);
    expect(store.getState().auth.token).toBe(token);
    expect(store.getState().auth.error).toBeNull();
  });

  it('does not hide a timed-out server error body behind a generic load fallback', async () => {
    fetchMock.mockResolvedValue({ status: 500, ok: false, json: () => new Promise(() => {}) });
    const result = outcome(getTasks(token));
    await vi.advanceTimersByTimeAsync(90_000);
    expect((await result).error).toBeInstanceOf(ApiTimeoutError);
    expect(store.getState().auth.token).toBe(token);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('finishes a 401 response without leaving a transport timer alive', async () => {
    fetchMock.mockResolvedValue({ status: 401, ok: false });
    await expect(getTasks(token)).rejects.toBeInstanceOf(SessionExpiredError);
    expect(store.getState().auth.token).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each([
    ['create', () => createTask(token, { title: 'One change' })],
    ['update', () => updateTask(token, 't1', { title: 'One change' })],
    ['delete', () => deleteTask(token, 't1')],
    ['register', () => register({ email: 'qa@example.com', password: 'long-test-password' })],
  ] as const)('reports uncertain %s outcome once and never replays it', async (_name, action) => {
    fetchMock.mockReturnValue(new Promise(() => {}));
    const result = outcome(action());
    await vi.advanceTimersByTimeAsync(90_000);
    expect((await result).error).toBeInstanceOf(ApiTimeoutError);
    expect(((await result).error as Error).message).toBe(UNCERTAIN_CHANGE_MESSAGE);
    await vi.advanceTimersByTimeAsync(180_000);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('gives login retry feedback after its total body deadline', async () => {
    fetchMock.mockResolvedValue({ status: 200, ok: true, json: () => new Promise(() => {}) });
    const result = outcome(login({ email: 'qa@example.com', password: 'test-password' }));
    await vi.advanceTimersByTimeAsync(90_000);
    expect((await result).error).toBeInstanceOf(ApiTimeoutError);
    expect(((await result).error as Error).message).toMatch(/Try again/);
    expect(((await result).error as Error).message).not.toBe(UNCERTAIN_CHANGE_MESSAGE);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

it.each([
  ['create', () => createTask(token, { title: 'One change' })],
  ['update', () => updateTask(token, 't1', { title: 'One change' })],
  ['register', () => register({ email: 'qa@example.com', password: 'long-test-password' })],
] as const)(
  'does not claim %s rollback after headers succeeded but JSON timed out',
  async (_name, action) => {
    fetchMock.mockResolvedValue({ status: 200, ok: true, json: () => new Promise(() => {}) });
    const result = outcome(action());
    await vi.advanceTimersByTimeAsync(90_000);
    expect((await result).error).toBeInstanceOf(ApiTimeoutError);
    expect(((await result).error as Error).message).toBe(UNCERTAIN_CHANGE_MESSAGE);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  },
);

it('finishes successful bodyless deletion without a remaining deadline', async () => {
  fetchMock.mockResolvedValue({ status: 204, ok: true });
  await expect(deleteTask(token, 't1')).resolves.toBeUndefined();
  expect(vi.getTimerCount()).toBe(0);
  expect(fetchMock).toHaveBeenCalledTimes(1);
});
