import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ApiCancelledError,
  ApiNetworkError,
  ApiTimeoutError,
  fetchApi,
  finishApiResponse,
  readApiJson,
  UNCERTAIN_CHANGE_MESSAGE,
} from './request';

const deferred = <T>() => {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
};
const fetchMock = vi.fn();
const response = (body: () => Promise<unknown> = async () => ({ ok: true })) =>
  ({ status: 200, ok: true, json: vi.fn(body) }) as unknown as Response;
const outcome = <T>(promise: Promise<T>) =>
  promise.then(
    (value) => ({ value, error: undefined }),
    (error: unknown) => ({ value: undefined, error }),
  );
beforeEach(() => {
  vi.useFakeTimers();
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('bounded request transport', () => {
  it('keeps the original Response and clears its timer after a fast body', async () => {
    const original = response();
    fetchMock.mockResolvedValue(original);
    const received = await fetchApi('/tasks');
    expect(received).toBe(original);
    expect(vi.getTimerCount()).toBe(1);
    expect(await readApiJson(received)).toEqual({ ok: true });
    expect(vi.getTimerCount()).toBe(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('permits a slow response within the total deadline', async () => {
    const headers = deferred<Response>();
    fetchMock.mockReturnValue(headers.promise);
    const pending = fetchApi('/tasks', {}, { timeoutMs: 100 });
    await vi.advanceTimersByTimeAsync(60);
    headers.resolve(response());
    expect(await readApiJson(await pending)).toEqual({ ok: true });
    expect(vi.getTimerCount()).toBe(0);
  });

  it('bounds default hanging headers at 90 seconds and aborts the transport', async () => {
    fetchMock.mockReturnValue(new Promise(() => {}));
    const pending = outcome(fetchApi('/tasks'));
    const signal = fetchMock.mock.calls[0][1].signal as AbortSignal;
    await vi.advanceTimersByTimeAsync(89_999);
    expect(signal.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect((await pending).error).toBeInstanceOf(ApiTimeoutError);
    expect(signal.aborted).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('includes JSON time in the original deadline rather than restarting after headers', async () => {
    const headers = deferred<Response>();
    const body = deferred<unknown>();
    fetchMock.mockReturnValue(headers.promise);
    const pending = fetchApi('/tasks', {}, { timeoutMs: 100 });
    await vi.advanceTimersByTimeAsync(60);
    headers.resolve(response(() => body.promise));
    const result = outcome(readApiJson(await pending));
    await vi.advanceTimersByTimeAsync(39);
    expect((fetchMock.mock.calls[0][1].signal as AbortSignal).aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect((await result).error).toBeInstanceOf(ApiTimeoutError);
    expect(vi.getTimerCount()).toBe(0);
    body.reject(new Error('late body failure'));
    await vi.advanceTimersByTimeAsync(0);
  });

  it('observes a late fetch rejection after timeout without replaying', async () => {
    const headers = deferred<Response>();
    fetchMock.mockReturnValue(headers.promise);
    const result = outcome(fetchApi('/tasks', {}, { timeoutMs: 10 }));
    await vi.advanceTimersByTimeAsync(10);
    expect((await result).error).toBeInstanceOf(ApiTimeoutError);
    headers.reject(new Error('late connection failure'));
    await vi.advanceTimersByTimeAsync(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('can safely read a body after its deadline and observe a late body rejection', async () => {
    const body = deferred<unknown>();
    fetchMock.mockResolvedValue(response(() => body.promise));
    const received = await fetchApi('/tasks', {}, { timeoutMs: 10 });
    await vi.advanceTimersByTimeAsync(10);
    const result = outcome(readApiJson(received));
    expect((await result).error).toBeInstanceOf(ApiTimeoutError);
    body.reject(new Error('late unread body failure'));
    await vi.advanceTimersByTimeAsync(0);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('clears a failed read request while preserving existing network error identity', async () => {
    const error = new TypeError('Network request failed');
    fetchMock.mockRejectedValue(error);
    const result = await outcome(fetchApi('/tasks'));
    expect(result.error).toBe(error);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('reports uncertain mutation outcomes on connection failure without leaking internal details', async () => {
    fetchMock.mockRejectedValue(new TypeError('private implementation details'));
    const result = await outcome(fetchApi('/tasks', { method: 'POST' }));
    expect(result.error).toBeInstanceOf(ApiNetworkError);
    expect((result.error as Error).message).toBe(UNCERTAIN_CHANGE_MESSAGE);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('clears the total timer if body parsing rejects', async () => {
    fetchMock.mockResolvedValue(
      response(async () => {
        throw new SyntaxError('invalid JSON');
      }),
    );
    const received = await fetchApi('/tasks');
    await expect(readApiJson(received)).rejects.toThrow('invalid JSON');
    expect(vi.getTimerCount()).toBe(0);
  });

  it('does not dispatch a request already cancelled by its caller', async () => {
    const caller = new AbortController();
    caller.abort();
    await expect(fetchApi('/tasks', { signal: caller.signal })).rejects.toBeInstanceOf(
      ApiCancelledError,
    );
    expect(fetchMock).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each(['headers', 'body'] as const)(
    'cancels a pending %s phase and removes the caller listener',
    async (phase) => {
      const caller = new AbortController();
      const add = vi.spyOn(caller.signal, 'addEventListener');
      const remove = vi.spyOn(caller.signal, 'removeEventListener');
      fetchMock.mockImplementation(() =>
        phase === 'headers'
          ? new Promise(() => {})
          : Promise.resolve(response(() => new Promise(() => {}))),
      );
      const fetched = fetchApi('/tasks', { signal: caller.signal });
      const result = phase === 'headers' ? outcome(fetched) : outcome(readApiJson(await fetched));
      caller.abort();
      expect((await result).error).toBeInstanceOf(ApiCancelledError);
      expect(remove).toHaveBeenCalledWith('abort', add.mock.calls[0][1]);
      expect(vi.getTimerCount()).toBe(0);
    },
  );

  it('removes caller cancellation and timer once a no-body response is finished', async () => {
    const caller = new AbortController();
    const remove = vi.spyOn(caller.signal, 'removeEventListener');
    fetchMock.mockResolvedValue(response());
    const received = await fetchApi('/tasks/1', { method: 'DELETE', signal: caller.signal });
    finishApiResponse(received);
    expect(remove).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
    caller.abort();
    await vi.advanceTimersByTimeAsync(90_000);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it.each(['POST', 'PATCH', 'DELETE'])(
    'never automatically replays a timed-out %s and reports uncertainty',
    async (method) => {
      fetchMock.mockReturnValue(new Promise(() => {}));
      const result = outcome(fetchApi('/tasks/1', { method }, { timeoutMs: 10 }));
      await vi.advanceTimersByTimeAsync(10);
      expect((await result).error).toBeInstanceOf(ApiTimeoutError);
      expect(((await result).error as Error).message).toBe(UNCERTAIN_CHANGE_MESSAGE);
      await vi.advanceTimersByTimeAsync(10_000);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    },
  );

  it('uses retryable feedback for login only when explicitly designated a non-mutation', async () => {
    fetchMock.mockReturnValue(new Promise(() => {}));
    const result = outcome(
      fetchApi('/api/auth/login', { method: 'POST' }, { timeoutMs: 10, mutation: false }),
    );
    await vi.advanceTimersByTimeAsync(10);
    expect(((await result).error as Error).message).toMatch(/Try again/);
    expect(((await result).error as Error).message).not.toBe(UNCERTAIN_CHANGE_MESSAGE);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('only sends a second GET after an explicit new call', async () => {
    fetchMock.mockReturnValueOnce(new Promise(() => {})).mockResolvedValueOnce(response());
    const first = outcome(fetchApi('/tasks', {}, { timeoutMs: 10 }));
    await vi.advanceTimersByTimeAsync(10);
    expect((await first).error).toBeInstanceOf(ApiTimeoutError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const retry = await fetchApi('/tasks');
    expect(await readApiJson(retry)).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

it('detaches caller cancellation immediately when the deadline expires between headers and body', async () => {
  const caller = new AbortController();
  const remove = vi.spyOn(caller.signal, 'removeEventListener');
  fetchMock.mockResolvedValue(response());
  const received = await fetchApi('/tasks', { signal: caller.signal }, { timeoutMs: 10 });
  await vi.advanceTimersByTimeAsync(10);
  expect(remove).toHaveBeenCalledTimes(1);
  expect(vi.getTimerCount()).toBe(0);
  await expect(readApiJson(received)).rejects.toBeInstanceOf(ApiTimeoutError);
});

it('observes cancellation failure from an unread response stream', async () => {
  const cancel = vi.fn().mockRejectedValue(new Error('already closed'));
  fetchMock.mockResolvedValue({ ...response(), body: { cancel } });
  const received = await fetchApi('/tasks');
  finishApiResponse(received);
  await vi.advanceTimersByTimeAsync(0);
  expect(cancel).toHaveBeenCalledTimes(1);
  expect(vi.getTimerCount()).toBe(0);
});

it('reports an aborted mutation as uncertain without automatic replay', async () => {
  const caller = new AbortController();
  fetchMock.mockReturnValue(new Promise(() => {}));
  const result = outcome(fetchApi('/tasks', { method: 'POST', signal: caller.signal }));
  caller.abort();
  expect((await result).error).toBeInstanceOf(ApiCancelledError);
  expect(((await result).error as Error).message).toBe(UNCERTAIN_CHANGE_MESSAGE);
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(vi.getTimerCount()).toBe(0);
});

it('keeps a mutation outcome uncertain when its successful response body cannot be parsed', async () => {
  fetchMock.mockResolvedValue(
    response(async () => {
      throw new SyntaxError('private parse details');
    }),
  );
  const received = await fetchApi('/tasks', { method: 'POST' });
  const result = await outcome(readApiJson(received));
  expect(result.error).toBeInstanceOf(ApiNetworkError);
  expect((result.error as Error).message).toBe(UNCERTAIN_CHANGE_MESSAGE);
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(vi.getTimerCount()).toBe(0);
});
