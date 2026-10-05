import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getTasks, createTask, updateTask, deleteTask } from './tasks';
import { getProjects, createProject, updateProject, deleteProject } from './projects';
import { getAgents, createAgent, updateAgent, deleteAgent } from './agents';
import { store } from '../redux/store';
import { clearAuth, setToken } from '../redux/slices/authSlice';
import { SessionExpiredError } from '../utils/session';

const operations: [string, (token: string) => Promise<unknown>, boolean][] = [
  ['get tasks', getTasks, true],
  ['create task', (token) => createTask(token, { title: 'Task' }), true],
  ['update task', (token) => updateTask(token, 'task', { title: 'Task' }), true],
  ['delete task', (token) => deleteTask(token, 'task'), false],
  ['get projects', getProjects, true],
  ['create project', (token) => createProject(token, { name: 'Project' }), true],
  ['update project', (token) => updateProject(token, 'project', { name: 'Project' }), true],
  ['delete project', (token) => deleteProject(token, 'project'), false],
  ['get agents', getAgents, true],
  ['create agent', (token) => createAgent(token, { name: 'Agent', role: 'Researcher' }), true],
  ['update agent', (token) => updateAgent(token, 'agent', { name: 'Agent' }), true],
  ['delete agent', (token) => deleteAgent(token, 'agent'), false],
];

beforeEach(() => {
  store.dispatch(clearAuth());
  store.dispatch(setToken('old-token'));
  localStorage.setItem('token', 'old-token');
});
afterEach(() => {
  store.dispatch(clearAuth());
  localStorage.clear();
  vi.unstubAllGlobals();
});

const changeSession = (signInAgain: boolean) => {
  store.dispatch(clearAuth());
  localStorage.removeItem('token');
  if (signInAgain) {
    store.dispatch(setToken('new-token'));
    localStorage.setItem('token', 'new-token');
  }
};

describe.each([false, true])('delayed authenticated response body; new login=%s', (signInAgain) => {
  it.each(operations.filter(([, , hasBody]) => hasBody))(
    '%s discards an old successful JSON body',
    async (_name, action) => {
      let complete!: (value: unknown) => void;
      const json = vi.fn(
        () =>
          new Promise((resolve) => {
            complete = resolve;
          }),
      );
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200, json }));
      const pending = action('old-token');
      const outcome = pending.catch((error: unknown) => error);
      await vi.waitFor(() => expect(json).toHaveBeenCalledTimes(1));
      changeSession(signInAgain);
      complete({
        tasks: [{ id: 'private' }],
        projects: [{ id: 'private' }],
        agents: [{ id: 'private' }],
        task: { id: 'private' },
        project: { id: 'private' },
        agent: { id: 'private' },
      });
      expect(await outcome).toBeInstanceOf(SessionExpiredError);
      expect(store.getState().auth.token).toBe(signInAgain ? 'new-token' : null);
      expect(store.getState().auth.error).toBeNull();
    },
  );

  it.each(operations)(
    '%s discards old error JSON rather than showing it to a new session',
    async (_name, action) => {
      let complete!: (value: unknown) => void;
      const json = vi.fn(
        () =>
          new Promise((resolve) => {
            complete = resolve;
          }),
      );
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500, json }));
      const pending = action('old-token');
      const outcome = pending.catch((error: unknown) => error);
      await vi.waitFor(() => expect(json).toHaveBeenCalledTimes(1));
      changeSession(signInAgain);
      complete({ message: 'Private old session failure' });
      expect(await outcome).toBeInstanceOf(SessionExpiredError);
      expect(store.getState().auth.token).toBe(signInAgain ? 'new-token' : null);
      expect(store.getState().auth.error).toBeNull();
    },
  );

  it.each([
    ['tasks', getTasks],
    ['projects', getProjects],
    ['agents', getAgents],
  ])('%s suppresses JSON parse failures after a session change', async (_name, action) => {
    for (const status of [200, 500]) {
      store.dispatch(setToken('old-token'));
      let fail!: (error: Error) => void;
      const json = vi.fn(
        () =>
          new Promise((_resolve, reject) => {
            fail = reject;
          }),
      );
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ status, ok: status === 200, json }));
      const outcome = action('old-token').catch((error: unknown) => error);
      await vi.waitFor(() => expect(json).toHaveBeenCalledTimes(1));
      changeSession(signInAgain);
      fail(new SyntaxError('Old body failed to parse'));
      expect(await outcome).toBeInstanceOf(SessionExpiredError);
      expect(store.getState().auth.token).toBe(signInAgain ? 'new-token' : null);
      expect(store.getState().auth.error).toBeNull();
    }
  });

  it('suppresses a delayed old network failure after logout or another login', async () => {
    let fail!: (error: Error) => void;
    vi.stubGlobal(
      'fetch',
      vi.fn(
        () =>
          new Promise((_resolve, reject) => {
            fail = reject;
          }),
      ),
    );
    const outcome = getTasks('old-token').catch((error: unknown) => error);
    changeSession(signInAgain);
    fail(new TypeError('Network offline'));
    expect(await outcome).toBeInstanceOf(SessionExpiredError);
    expect(store.getState().auth.token).toBe(signInAgain ? 'new-token' : null);
    expect(store.getState().auth.error).toBeNull();
  });
  it.each([200, 401])(
    'ignores pending old HTTP %s responses without signing out the next session',
    async (status) => {
      let complete!: (response: unknown) => void;
      vi.stubGlobal(
        'fetch',
        vi.fn(
          () =>
            new Promise((resolve) => {
              complete = resolve;
            }),
        ),
      );
      const outcome = getTasks('old-token').catch((error: unknown) => error);
      changeSession(signInAgain);
      complete({ status, ok: status === 200, json: async () => ({ tasks: [{ id: 'private' }] }) });
      expect(await outcome).toBeInstanceOf(SessionExpiredError);
      expect(store.getState().auth.token).toBe(signInAgain ? 'new-token' : null);
      expect(store.getState().auth.error).toBeNull();
    },
  );
});

it('preserves network errors for the current session', async () => {
  const failure = new TypeError('Network offline');
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(failure));
  await expect(getTasks('old-token')).rejects.toBe(failure);
  expect(store.getState().auth.token).toBe('old-token');
});

it.each([200, 500])(
  'discards an old delayed HTTP %s body even when a new login reuses the identical JWT',
  async (status) => {
    let complete!: (value: unknown) => void;
    const json = vi.fn(
      () =>
        new Promise((resolve) => {
          complete = resolve;
        }),
    );
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ status, ok: status === 200, json }));
    const outcome = getTasks('old-token').catch((error: unknown) => error);
    await vi.waitFor(() => expect(json).toHaveBeenCalledTimes(1));
    store.dispatch(clearAuth());
    store.dispatch(setToken('old-token'));
    complete(
      status === 200 ? { tasks: [{ id: 'old-private-task' }] } : { message: 'Old private failure' },
    );
    expect(await outcome).toBeInstanceOf(SessionExpiredError);
    expect(store.getState().auth.token).toBe('old-token');
    expect(store.getState().auth.error).toBeNull();
  },
);

it.each(['401', 'network rejection'])(
  'does not disturb an identical-JWT new session after an old %s',
  async (outcome) => {
    let settle!: () => void;
    vi.stubGlobal(
      'fetch',
      vi.fn(
        () =>
          new Promise((resolve, reject) => {
            settle = () =>
              outcome === '401'
                ? resolve({ status: 401, ok: false })
                : reject(new TypeError('Old network failure'));
          }),
      ),
    );
    const pending = getTasks('old-token').catch((error: unknown) => error);
    store.dispatch(clearAuth());
    store.dispatch(setToken('old-token'));
    localStorage.setItem('token', 'old-token');
    settle();
    expect(await pending).toBeInstanceOf(SessionExpiredError);
    expect(store.getState().auth.token).toBe('old-token');
    expect(store.getState().auth.error).toBeNull();
    expect(localStorage.getItem('token')).toBe('old-token');
  },
);
