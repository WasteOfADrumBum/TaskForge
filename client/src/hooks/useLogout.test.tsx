import type { ReactNode } from 'react';
import { act, renderHook } from '@testing-library/react';
import { Provider } from 'react-redux';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useLogout } from './useLogout';
import { logout } from '../api/auth';
import { store } from '../redux/store';
import { clearAuth, setToken } from '../redux/slices/authSlice';
import { setTasks, setTaskError, setTaskLoading } from '../redux/slices/taskSlice';
import { setProjects, setProjectError, setProjectLoading } from '../redux/slices/projectSlice';
import { setAgents, setAgentError, setAgentLoading } from '../redux/slices/agentSlice';
import { makeTask, makeProject, makeAgent } from '../test/renderApp';

const navigate = vi.hoisted(() => vi.fn());
vi.mock('react-router-dom', async (original) => ({
  ...(await original<typeof import('react-router-dom')>()),
  useNavigate: () => navigate,
}));
vi.mock('../api/auth', () => ({ logout: vi.fn() }));
const wrapper = ({ children }: { children: ReactNode }) => (
  <Provider store={store}>{children}</Provider>
);
beforeEach(() => {
  vi.clearAllMocks();
  store.dispatch(clearAuth());
  store.dispatch(setToken('private-token'));
  localStorage.setItem('token', 'private-token');
  store.dispatch(setTasks([makeTask({ _id: 'task', title: 'Private task' })]));
  store.dispatch(setProjects([makeProject({ _id: 'project', name: 'Private project' })]));
  store.dispatch(setAgents([makeAgent({ _id: 'agent', name: 'Private agent' })]));
  store.dispatch(setTaskError('private task error'));
  store.dispatch(setProjectError('private project error'));
  store.dispatch(setAgentError('private agent error'));
  store.dispatch(setTaskLoading(true));
  store.dispatch(setProjectLoading(true));
  store.dispatch(setAgentLoading(true));
});
afterEach(() => {
  store.dispatch(clearAuth());
  localStorage.clear();
});
const assertCleared = () => {
  expect(store.getState().auth.token).toBeNull();
  expect(store.getState().auth.error).toBeNull();
  expect(localStorage.getItem('token')).toBeNull();
  const empty = { items: [], loaded: false, loading: false, error: null };
  expect(store.getState().tasks).toEqual(empty);
  expect(store.getState().projects).toEqual(empty);
  expect(store.getState().agents).toEqual(empty);
  expect(navigate).toHaveBeenLastCalledWith('/login', { replace: true });
  expect(logout).not.toHaveBeenCalled();
};

describe('immediate local logout', () => {
  it.each(['acknowledged', 'rejected', 'stalled', 'offline'])(
    'clears auth and all private state immediately without requesting a %s server acknowledgement',
    (mode) => {
      vi.mocked(logout).mockImplementation(() => {
        if (mode === 'acknowledged') return Promise.resolve();
        if (mode === 'stalled') return new Promise(() => {});
        return Promise.reject(new Error(mode));
      });
      const { result } = renderHook(useLogout, { wrapper });
      act(() => expect(result.current()).toBeUndefined());
      assertCleared();
    },
  );
  it('allows repeated logout without restoring state or throwing', () => {
    const { result } = renderHook(useLogout, { wrapper });
    act(() => {
      result.current();
      result.current();
    });
    assertCleared();
    expect(navigate).toHaveBeenCalledTimes(2);
  });
});
