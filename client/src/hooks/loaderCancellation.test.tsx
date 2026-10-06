import type { ReactNode } from 'react';
import { act, renderHook } from '@testing-library/react';
import { Provider } from 'react-redux';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getTasks } from '../api/tasks';
import { getProjects } from '../api/projects';
import { getAgents } from '../api/agents';
import { ApiTimeoutError } from '../api/request';
import { store } from '../redux/store';
import { clearAuth, setToken } from '../redux/slices/authSlice';
import { makeAgent, makeProject, makeTask } from '../test/renderApp';
import { useTaskLoader } from './useTaskLoader';
import { useProjectLoader } from './useProjectLoader';
import { useAgentLoader } from './useAgentLoader';

vi.mock('../api/tasks', () => ({ getTasks: vi.fn() }));
vi.mock('../api/projects', () => ({ getProjects: vi.fn() }));
vi.mock('../api/agents', () => ({ getAgents: vi.fn() }));
const wrapper = ({ children }: { children: ReactNode }) => (
  <Provider store={store}>{children}</Provider>
);
const deferred = () => {
  let resolve!: (value: unknown[]) => void;
  let reject!: (failure: unknown) => void;
  const promise = new Promise<unknown[]>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
};
beforeEach(() => {
  vi.useFakeTimers();
  vi.resetAllMocks();
  store.dispatch(clearAuth());
  store.dispatch(setToken('current-token'));
});
afterEach(() => {
  store.dispatch(clearAuth());
  localStorage.clear();
  vi.useRealTimers();
});
const cases = [
  {
    name: 'tasks',
    hook: useTaskLoader,
    api: getTasks,
    resource: makeTask({ _id: 'private', title: 'Old task' }),
    state: () => store.getState().tasks,
  },
  {
    name: 'projects',
    hook: useProjectLoader,
    api: getProjects,
    resource: makeProject({ _id: 'private', name: 'Old project' }),
    state: () => store.getState().projects,
  },
  {
    name: 'agents',
    hook: useAgentLoader,
    api: getAgents,
    resource: makeAgent({ _id: 'private', name: 'Old agent' }),
    state: () => store.getState().agents,
  },
];

describe.each(cases)('$name controlled loading', (entry) => {
  it('starts silently, shows slow feedback at eight seconds, then cancels without automatic reload', async () => {
    vi.mocked(entry.api).mockImplementation((() => new Promise(() => {})) as never);
    const { result } = renderHook(() => entry.hook(), { wrapper });
    const signal = vi.mocked(entry.api).mock.calls[0][1]!;
    expect(signal).toBeInstanceOf(AbortSignal);
    expect(result.current.waiting).toBe(false);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(7999);
    });
    expect(result.current.waiting).toBe(false);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(result.current.waiting).toBe(true);
    act(() => result.current.cancel());
    expect(signal.aborted).toBe(true);
    expect(entry.state().loading).toBe(false);
    expect(entry.state().error).toMatch(/cancel/i);
    expect(result.current.waiting).toBe(false);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(90_000);
    });
    expect(entry.api).toHaveBeenCalledTimes(1);
    expect(store.getState().auth.token).toBe('current-token');
  });

  it.each(['success', 'error'] as const)(
    'ignores cancelled old %s and finally while an explicit retry is loading',
    async (oldOutcome) => {
      const old = deferred();
      const current = deferred();
      vi.mocked(entry.api)
        .mockImplementationOnce((() => old.promise) as never)
        .mockImplementationOnce((() => current.promise) as never);
      const { result } = renderHook(() => entry.hook(), { wrapper });
      const oldSignal = vi.mocked(entry.api).mock.calls[0][1]!;
      act(() => result.current.cancel());
      act(() => result.current.reload());
      expect(entry.api).toHaveBeenCalledTimes(2);
      expect(oldSignal.aborted).toBe(true);
      const newSignal = vi.mocked(entry.api).mock.calls[1][1]!;
      expect(newSignal.aborted).toBe(false);
      expect(entry.state().loading).toBe(true);
      await act(async () => {
        if (oldOutcome === 'success') old.resolve([entry.resource]);
        else old.reject(new Error('Private old error'));
      });
      expect(entry.state().items).toEqual([]);
      expect(entry.state().error).toBeNull();
      expect(entry.state().loading).toBe(true);
      await act(async () => current.resolve([]));
      expect(entry.state().loading).toBe(false);
      expect(entry.state().loaded).toBe(true);
    },
  );

  it('supports manual recovery after a timeout without signing out', async () => {
    vi.mocked(entry.api).mockRejectedValueOnce(new ApiTimeoutError()).mockResolvedValueOnce([]);
    const { result } = renderHook(() => entry.hook(), { wrapper });
    await act(async () => {});
    expect(entry.state().loading).toBe(false);
    expect(entry.state().error).toMatch(/Try again/);
    expect(entry.api).toHaveBeenCalledTimes(1);
    act(() => result.current.reload());
    await act(async () => {});
    expect(entry.api).toHaveBeenCalledTimes(2);
    expect(entry.state().error).toBeNull();
    expect(entry.state().loaded).toBe(true);
    expect(store.getState().auth.token).toBe('current-token');
  });

  it('aborts its read on unmount and suppresses a late result', async () => {
    const pending = deferred();
    vi.mocked(entry.api).mockImplementation((() => pending.promise) as never);
    const { unmount } = renderHook(() => entry.hook(), { wrapper });
    const signal = vi.mocked(entry.api).mock.calls[0][1]!;
    unmount();
    expect(signal.aborted).toBe(true);
    await act(async () => pending.resolve([entry.resource]));
    expect(entry.state().items).toEqual([]);
  });
});
