import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useDelayedRequest } from './useDelayedRequest';

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe('delayed request lifecycle', () => {
  it('does not show slow feedback for a fast completed operation', async () => {
    const { result } = renderHook(() => useDelayedRequest());
    let operation!: NonNullable<ReturnType<typeof result.current.begin>>;
    act(() => {
      operation = result.current.begin()!;
    });
    expect(result.current.pending).toBe(true);
    expect(result.current.waiting).toBe(false);
    act(() => operation.finish());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(8000);
    });
    expect(result.current.pending).toBe(false);
    expect(result.current.waiting).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('shows waiting only after eight seconds while the current operation remains pending', async () => {
    const { result } = renderHook(() => useDelayedRequest());
    act(() => {
      result.current.begin();
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(7999);
    });
    expect(result.current.waiting).toBe(false);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(result.current.waiting).toBe(true);
    act(() => result.current.cancel());
    expect(result.current.waiting).toBe(false);
  });

  it('rejects duplicate begins while one operation is pending', () => {
    const { result } = renderHook(() => useDelayedRequest());
    let first: ReturnType<typeof result.current.begin>;
    let duplicate: ReturnType<typeof result.current.begin>;
    act(() => {
      first = result.current.begin();
      duplicate = result.current.begin();
    });
    expect(first!).not.toBeNull();
    expect(duplicate!).toBeNull();
    act(() => result.current.cancel());
  });

  it('retires before abort listeners can publish a result', () => {
    const { result } = renderHook(() => useDelayedRequest());
    let operation!: NonNullable<ReturnType<typeof result.current.begin>>;
    act(() => {
      operation = result.current.begin()!;
    });
    const currentAtAbort: boolean[] = [];
    operation.signal.addEventListener('abort', () => {
      currentAtAbort.push(operation.isCurrent());
    });
    act(() => result.current.cancel());
    expect(currentAtAbort).toEqual([false]);
    expect(operation.signal.aborted).toBe(true);
    expect(result.current.pending).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('does not let the old operation finish a newer pending operation', async () => {
    const { result } = renderHook(() => useDelayedRequest());
    let old!: NonNullable<ReturnType<typeof result.current.begin>>;
    let current!: NonNullable<ReturnType<typeof result.current.begin>>;
    act(() => {
      old = result.current.begin()!;
      result.current.cancel();
      current = result.current.begin()!;
    });
    act(() => old.finish());
    expect(old.isCurrent()).toBe(false);
    expect(current.isCurrent()).toBe(true);
    expect(result.current.pending).toBe(true);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(8000);
    });
    expect(result.current.waiting).toBe(true);
    act(() => current.finish());
    expect(result.current.pending).toBe(false);
    expect(result.current.waiting).toBe(false);
  });

  it('retires and aborts pending work on unmount', () => {
    const { result, unmount } = renderHook(() => useDelayedRequest());
    let operation!: NonNullable<ReturnType<typeof result.current.begin>>;
    act(() => {
      operation = result.current.begin()!;
    });
    unmount();
    expect(operation.signal.aborted).toBe(true);
    expect(operation.isCurrent()).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });
});
