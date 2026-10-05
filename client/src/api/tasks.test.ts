import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTask, deleteTask, getTasks, updateTask } from './tasks';
import { store } from '../redux/store';
import { clearAuth, setToken } from '../redux/slices/authSlice';
import { setTasks, setTaskLoading, setTaskError } from '../redux/slices/taskSlice';
import { SESSION_EXPIRED_MESSAGE } from '../utils/session';

const fetchMock = vi.fn();
const token = 'jwt-token';

describe('task API', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    store.dispatch(setToken(token));
    localStorage.setItem('token', token);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    store.dispatch(clearAuth());
    localStorage.clear();
  });

  it('loads authenticated tasks', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        tasks: [
          {
            _id: 'task-1',
            title: 'Test',
            description: '',
            status: 'todo',
            priority: 'medium',
            dueDate: null,
          },
        ],
      }),
    } as unknown as Response);
    const tasks = await getTasks(token);
    expect(fetchMock).toHaveBeenCalledWith('http://localhost:5000/api/tasks', {
      headers: { Authorization: 'Bearer jwt-token', 'Content-Type': 'application/json' },
    });
    expect(tasks).toHaveLength(1);
  });

  it('creates a task', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ task: { _id: 'task-1', title: 'New task' } }),
    } as unknown as Response);
    const task = await createTask(token, { title: 'New task' });
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:5000/api/tasks',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(task.title).toBe('New task');
  });

  it('updates a task', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ task: { _id: 'task-1', title: 'Updated task' } }),
    } as unknown as Response);
    const task = await updateTask(token, 'task-1', { title: 'Updated task' });
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:5000/api/tasks/task-1',
      expect.objectContaining({ method: 'PATCH' }),
    );
    expect(task.title).toBe('Updated task');
  });

  it('deletes a task', async () => {
    fetchMock.mockResolvedValue({ ok: true } as Response);
    await deleteTask(token, 'task-1');
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:5000/api/tasks/task-1',
      expect.objectContaining({ method: 'DELETE' }),
    );
  });

  it.each([
    () => getTasks(token),
    () => createTask(token, { title: 'Test' }),
    () => updateTask(token, 'task-1', { title: 'Test' }),
    () => deleteTask(token, 'task-1'),
  ])('expires the session on every authenticated endpoint returning 401', async (request) => {
    store.dispatch(setTasks([{ _id: 'task-1', title: 'Private task' }] as never));
    store.dispatch(setTaskLoading(true));
    store.dispatch(setTaskError('Previous error'));
    const sessionVersion = store.getState().auth.sessionVersion;
    fetchMock.mockResolvedValue({ status: 401, ok: false } as Response);
    await expect(request()).rejects.toThrow(SESSION_EXPIRED_MESSAGE);
    expect(localStorage.getItem('token')).toBeNull();
    expect(store.getState().auth).toEqual({
      token: null,
      loading: false,
      error: SESSION_EXPIRED_MESSAGE,
      sessionVersion: sessionVersion + 1,
    });
    expect(store.getState().tasks).toEqual({
      items: [],
      loading: false,
      error: null,
      loaded: false,
    });
  });

  it.each([403, 500])('keeps the session on HTTP %s', async (status) => {
    fetchMock.mockResolvedValue({
      status,
      ok: false,
      json: async () => ({ message: 'Request failed' }),
    });
    await expect(getTasks(token)).rejects.toThrow('Request failed');
    expect(store.getState().auth.token).toBe(token);
    expect(localStorage.getItem('token')).toBe(token);
  });

  it('does not expire a new session when an old request returns 401', async () => {
    let resolve!: (response: Response) => void;
    fetchMock.mockReturnValue(
      new Promise<Response>((done) => {
        resolve = done;
      }),
    );
    const pending = getTasks(token);
    store.dispatch(setToken('new-token'));
    localStorage.setItem('token', 'new-token');
    resolve({ status: 401, ok: false } as Response);
    await expect(pending).rejects.toThrow(SESSION_EXPIRED_MESSAGE);
    expect(store.getState().auth.token).toBe('new-token');
    expect(localStorage.getItem('token')).toBe('new-token');
  });

  it.each([
    ['a different token', 'stale-token'],
    ['no token', ''],
  ])('does not send a request with %s', async (_label, requestToken) => {
    await expect(getTasks(requestToken)).rejects.toThrow(SESSION_EXPIRED_MESSAGE);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(store.getState().auth.token).toBe(token);
  });

  it('discards a successful task response after logout', async () => {
    let resolve!: (response: Response) => void;
    fetchMock.mockReturnValue(
      new Promise<Response>((done) => {
        resolve = done;
      }),
    );
    const pending = getTasks(token);
    store.dispatch(clearAuth());
    resolve({ status: 200, ok: true } as Response);
    await expect(pending).rejects.toThrow(SESSION_EXPIRED_MESSAGE);
    expect(store.getState().tasks.items).toEqual([]);
    expect(store.getState().auth.error).toBeNull();
  });
});
