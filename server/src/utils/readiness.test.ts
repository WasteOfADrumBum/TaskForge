import { createReadinessProbe } from './readiness';

const deferred = () => {
  let resolve!: (value: unknown) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<unknown>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
};

beforeEach(() => {
  jest.useFakeTimers();
});
afterEach(() => {
  jest.useRealTimers();
});

describe('bounded database readiness probe', () => {
  it('does not ping a disconnected database', async () => {
    const ping = jest.fn().mockResolvedValue({ ok: 1 });
    const probe = createReadinessProbe({ isConnected: () => false, ping });
    await expect(probe()).resolves.toBe(false);
    expect(ping).not.toHaveBeenCalled();
  });

  it('requires a successful ping and passes a finite timeout and abort signal', async () => {
    const ping = jest.fn().mockResolvedValue({ ok: 1 });
    const probe = createReadinessProbe({ isConnected: () => true, ping, timeoutMs: 20 });
    await expect(probe()).resolves.toBe(true);
    expect(ping).toHaveBeenCalledWith({ timeoutMS: 20, signal: expect.any(AbortSignal) });
  });

  it('returns false for a rejected ping, then recovers after the cache expires', async () => {
    const ping = jest
      .fn()
      .mockRejectedValueOnce(new Error('private database credentials'))
      .mockResolvedValue({ ok: 1 });
    const probe = createReadinessProbe({ isConnected: () => true, ping, cacheMs: 5 });
    await expect(probe()).resolves.toBe(false);
    await jest.advanceTimersByTimeAsync(6);
    await expect(probe()).resolves.toBe(true);
    expect(ping).toHaveBeenCalledTimes(2);
  });

  it('shares an in-flight ping across concurrent readiness requests', async () => {
    const pending = deferred();
    const ping = jest.fn().mockReturnValue(pending.promise);
    const probe = createReadinessProbe({ isConnected: () => true, ping });
    const first = probe();
    const second = probe();
    pending.resolve({ ok: 1 });
    await expect(first).resolves.toBe(true);
    await expect(second).resolves.toBe(true);
    expect(ping).toHaveBeenCalledTimes(1);
  });

  it('bounds a hanging ping, aborts it and prevents retries piling up until it settles', async () => {
    const pending = deferred();
    const ping = jest.fn().mockReturnValueOnce(pending.promise).mockResolvedValue({ ok: 1 });
    const probe = createReadinessProbe({
      isConnected: () => true,
      ping,
      timeoutMs: 20,
      cacheMs: 5,
    });
    const result = probe();
    await jest.advanceTimersByTimeAsync(19);
    expect(ping.mock.calls[0][0].signal.aborted).toBe(false);
    await jest.advanceTimersByTimeAsync(1);
    await expect(result).resolves.toBe(false);
    expect(ping.mock.calls[0][0].signal.aborted).toBe(true);
    await jest.advanceTimersByTimeAsync(100);
    await expect(probe()).resolves.toBe(false);
    expect(ping).toHaveBeenCalledTimes(1);
    pending.resolve({ ok: 1 });
    await jest.advanceTimersByTimeAsync(6);
    await expect(probe()).resolves.toBe(true);
    expect(ping).toHaveBeenCalledTimes(2);
  });

  it('handles a late ping rejection after the request timed out', async () => {
    const pending = deferred();
    const ping = jest.fn().mockReturnValue(pending.promise);
    const probe = createReadinessProbe({ isConnected: () => true, ping, timeoutMs: 20 });
    const result = probe();
    await jest.advanceTimersByTimeAsync(20);
    await expect(result).resolves.toBe(false);
    pending.reject(new Error('late network failure'));
    await jest.advanceTimersByTimeAsync(0);
  });
});

it('does not reuse a healthy result once the database disconnects', async () => {
  let connected = true;
  const ping = jest.fn().mockResolvedValue({ ok: 1 });
  const probe = createReadinessProbe({ isConnected: () => connected, ping });
  await expect(probe()).resolves.toBe(true);
  connected = false;
  await expect(probe()).resolves.toBe(false);
  expect(ping).toHaveBeenCalledTimes(1);
});

it('converts a synchronous ping exception into unavailable readiness', async () => {
  const ping = jest.fn(() => {
    throw new Error('private failure');
  });
  const probe = createReadinessProbe({ isConnected: () => true, ping });
  await expect(probe()).resolves.toBe(false);
});
