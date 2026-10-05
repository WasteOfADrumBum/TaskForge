import type { ReactNode } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as agents from '../api/agents';
import * as projects from '../api/projects';
import * as tasks from '../api/tasks';
import { useAgentActions } from './useAgentActions';
import { useProjectActions } from './useProjectActions';
import { useAgentLoader } from './useAgentLoader';
import { useProjectLoader } from './useProjectLoader';
import { useTaskLoader } from './useTaskLoader';
import { toaster } from '../components/ui/toaster';
import { store } from '../redux/store';
import { clearAuth, setToken } from '../redux/slices/authSlice';
import { setAgents } from '../redux/slices/agentSlice';
import { setProjects } from '../redux/slices/projectSlice';
import { makeAgent, makeProject, makeTask } from '../test/renderApp';

vi.mock('../api/agents', () => ({
  createAgent: vi.fn(),
  updateAgent: vi.fn(),
  deleteAgent: vi.fn(),
  getAgents: vi.fn(),
}));
vi.mock('../api/projects', () => ({
  createProject: vi.fn(),
  updateProject: vi.fn(),
  deleteProject: vi.fn(),
  getProjects: vi.fn(),
}));
vi.mock('../api/tasks', () => ({ getTasks: vi.fn() }));
vi.mock('../components/ui/toaster', () => ({ toaster: { create: vi.fn() } }));
const wrapper = ({ children }: { children: ReactNode }) => (
  <Provider store={store}>{children}</Provider>
);
const switchSession = () => {
  store.dispatch(clearAuth());
  store.dispatch(setToken('new-token'));
};
beforeEach(() => {
  vi.resetAllMocks();
  store.dispatch(clearAuth());
  store.dispatch(setToken('old-token'));
});
afterEach(() => {
  store.dispatch(clearAuth());
  localStorage.clear();
});

const agent = makeAgent({ _id: 'shared', name: 'Old private agent' });
const project = makeProject({ _id: 'shared', name: 'Old private project' });
const actionCases = [
  {
    name: 'agent',
    hook: useAgentActions,
    apiCreate: agents.createAgent,
    apiUpdate: agents.updateAgent,
    apiDelete: agents.deleteAgent,
    resource: agent,
    input: { name: 'Changed', role: 'Researcher' },
    seed: () =>
      store.dispatch(setAgents([makeAgent({ _id: 'shared', name: 'New session agent' })])),
    state: () => store.getState().agents,
  },
  {
    name: 'project',
    hook: useProjectActions,
    apiCreate: projects.createProject,
    apiUpdate: projects.updateProject,
    apiDelete: projects.deleteProject,
    resource: project,
    input: { name: 'Changed' },
    seed: () =>
      store.dispatch(setProjects([makeProject({ _id: 'shared', name: 'New session project' })])),
    state: () => store.getState().projects,
  },
];

describe.each(actionCases)('$name action consumers reject stale final results', (entry) => {
  it.each(['create', 'update', 'delete'])(
    '%s suppresses successful old resource mutation and feedback',
    async (operation) => {
      const api =
        operation === 'create'
          ? entry.apiCreate
          : operation === 'update'
            ? entry.apiUpdate
            : entry.apiDelete;
      vi.mocked(api).mockImplementation((() =>
        Promise.resolve().then(() => {
          switchSession();
          entry.seed();
          return entry.resource;
        })) as never);
      const { result } = renderHook(() => entry.hook(), { wrapper });
      let outcome: unknown;
      await act(async () => {
        outcome =
          operation === 'delete'
            ? await result.current.remove(entry.resource as never)
            : await result.current.save(
                entry.input as never,
                operation === 'update' ? (entry.resource as never) : undefined,
              );
      });
      expect(outcome).toBe(operation === 'delete' ? false : null);
      expect(entry.state().items).toHaveLength(1);
      expect(entry.state().items[0].name).toMatch(/^New session/);
      expect(result.current.error).toBeNull();
      expect(toaster.create).not.toHaveBeenCalled();
    },
  );

  it.each(['create', 'update', 'delete'])(
    '%s suppresses old failures and error feedback',
    async (operation) => {
      const api =
        operation === 'create'
          ? entry.apiCreate
          : operation === 'update'
            ? entry.apiUpdate
            : entry.apiDelete;
      vi.mocked(api).mockImplementation((() =>
        Promise.resolve().then(() => {
          switchSession();
          entry.seed();
          throw new Error('Old private failure');
        })) as never);
      const { result } = renderHook(() => entry.hook(), { wrapper });
      await act(async () => {
        if (operation === 'delete') await result.current.remove(entry.resource as never);
        else
          await result.current.save(
            entry.input as never,
            operation === 'update' ? (entry.resource as never) : undefined,
          );
      });
      expect(entry.state().items[0].name).toMatch(/^New session/);
      expect(result.current.error).toBeNull();
      expect(toaster.create).not.toHaveBeenCalled();
      expect(store.getState().auth.error).toBeNull();
    },
  );

  it('rejects an old action consumer when logout and re-login reuse the identical JWT', async () => {
    vi.mocked(entry.apiCreate).mockImplementation((() =>
      Promise.resolve().then(() => {
        store.dispatch(clearAuth());
        store.dispatch(setToken('old-token'));
        entry.seed();
        return entry.resource;
      })) as never);
    const { result } = renderHook(() => entry.hook(), { wrapper });
    let outcome: unknown;
    await act(async () => {
      outcome = await result.current.save(entry.input as never);
    });
    expect(outcome).toBeNull();
    expect(entry.state().items).toHaveLength(1);
    expect(entry.state().items[0].name).toMatch(/^New session/);
    expect(toaster.create).not.toHaveBeenCalled();
  });
  it('does not let an old finally clear saving for the new session action', async () => {
    let completeOld!: (value: unknown) => void;
    let completeNew!: (value: unknown) => void;
    vi.mocked(entry.apiCreate)
      .mockImplementationOnce(
        (() =>
          new Promise((resolve) => {
            completeOld = resolve;
          })) as never,
      )
      .mockImplementationOnce(
        (() =>
          new Promise((resolve) => {
            completeNew = resolve;
          })) as never,
      );
    const { result } = renderHook(() => entry.hook(), { wrapper });
    let old!: Promise<unknown>;
    act(() => {
      old = result.current.save(entry.input as never);
    });
    act(() => {
      switchSession();
      entry.seed();
    });
    let current!: Promise<unknown>;
    act(() => {
      current = result.current.save(entry.input as never);
    });
    await act(async () => {
      completeOld(entry.resource);
      await old;
    });
    expect(result.current.saving).toBe(true);
    expect(toaster.create).not.toHaveBeenCalled();
    await act(async () => {
      completeNew({ ...entry.resource, _id: 'new-resource', name: 'Current resource' });
      await current;
    });
    expect(result.current.saving).toBe(false);
    expect(entry.state().items.some((resource) => resource.name === 'Current resource')).toBe(true);
  });
});

const loaderCases = [
  {
    name: 'tasks',
    hook: useTaskLoader,
    api: tasks.getTasks,
    resource: makeTask({ _id: 'private', title: 'Old private task' }),
    state: () => store.getState().tasks,
  },
  {
    name: 'projects',
    hook: useProjectLoader,
    api: projects.getProjects,
    resource: project,
    state: () => store.getState().projects,
  },
  {
    name: 'agents',
    hook: useAgentLoader,
    api: agents.getAgents,
    resource: agent,
    state: () => store.getState().agents,
  },
];
describe.each(loaderCases)('$name loader consumers', (entry) => {
  it.each(['success', 'error'])(
    'an already retired %s load cannot clear the next load indicator',
    async (outcome) => {
      let completeOld!: () => void;
      let completeNew!: (value: unknown) => void;
      vi.mocked(entry.api)
        .mockImplementationOnce(
          (() =>
            new Promise((resolve, reject) => {
              completeOld = () =>
                outcome === 'error'
                  ? reject(new Error('Old private failure'))
                  : resolve([entry.resource]);
            })) as never,
        )
        .mockImplementationOnce(
          (() =>
            new Promise((resolve) => {
              completeNew = resolve;
            })) as never,
        );
      renderHook(() => entry.hook(), { wrapper });
      act(() => switchSession());
      await waitFor(() => expect(entry.api).toHaveBeenCalledTimes(2));
      expect(entry.state().loading).toBe(true);
      await act(async () => completeOld());
      expect(entry.state()).toEqual({ items: [], loaded: false, loading: true, error: null });
      await act(async () => completeNew([]));
      expect(entry.state().loading).toBe(false);
    },
  );
  it.each(['success', 'error'])(
    'ignores old %s and finally while a new-session load is pending',
    async (outcome) => {
      let completeOld!: (value: unknown) => void;
      let completeNew!: (value: unknown) => void;
      vi.mocked(entry.api)
        .mockImplementationOnce((() =>
          new Promise((resolve) => {
            completeOld = resolve;
          }).then(() => {
            switchSession();
            if (outcome === 'error') throw new Error('Old private load failure');
            return [entry.resource];
          })) as never)
        .mockImplementationOnce(
          (() =>
            new Promise((resolve) => {
              completeNew = resolve;
            })) as never,
        );
      renderHook(() => entry.hook(), { wrapper });
      await act(async () => {
        completeOld(undefined);
      });
      await waitFor(() => expect(entry.api).toHaveBeenCalledTimes(2));
      expect(entry.state()).toEqual({ items: [], loaded: false, loading: true, error: null });
      expect(store.getState().auth.token).toBe('new-token');
      await act(async () => {
        completeNew([{ ...entry.resource, _id: 'new-resource' }]);
      });
      expect(entry.state().items).toHaveLength(1);
      expect(entry.state().items[0]._id).toBe('new-resource');
      expect(entry.state().loading).toBe(false);
      expect(entry.state().error).toBeNull();
    },
  );
});
