import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTask, deleteTask, getTasks, updateTask } from './tasks';

const fetchMock = vi.fn();
const token = 'jwt-token';

describe('task API', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
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
});
