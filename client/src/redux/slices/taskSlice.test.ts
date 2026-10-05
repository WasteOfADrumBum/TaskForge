import { describe, expect, it } from 'vitest';
import reducer, {
  addTask,
  clearTasks,
  removeTask,
  replaceTask,
  setTasks,
  setTaskLoading,
  setTaskError,
} from './taskSlice';
import type { Task } from '../../types/task';
import { removeAgent } from './agentSlice';
import { clearAuth, sessionExpired } from './authSlice';

const task: Task = {
  _id: 'task-1',
  title: 'First task',
  description: '',
  status: 'todo',
  priority: 'medium',
  dueDate: null,
};

describe('taskSlice', () => {
  it('distinguishes an unloaded list from a successfully loaded empty list', () => {
    expect(reducer(undefined, { type: 'init' }).loaded).toBe(false);
    const loaded = reducer(undefined, setTasks([]));
    expect(loaded.loaded).toBe(true);
    expect(reducer(loaded, clearTasks()).loaded).toBe(false);
  });
  it('does not mark a failed initial request as successfully loaded', () => {
    let state = reducer(undefined, setTaskLoading(true));
    state = reducer(state, setTaskError('Unavailable'));
    state = reducer(state, setTaskLoading(false));
    expect(state.loaded).toBe(false);
    expect(state.error).toBe('Unavailable');
  });
  it('sets tasks', () => {
    const state = reducer(undefined, setTasks([task]));
    expect(state.items).toEqual([task]);
  });
  it('adds a task', () => {
    const state = reducer(undefined, addTask(task));
    expect(state.items[0]).toEqual(task);
  });
  it('replaces a task', () => {
    const initial = reducer(undefined, setTasks([task]));
    const updated = { ...task, title: 'Updated' };
    const state = reducer(initial, replaceTask(updated));
    expect(state.items[0].title).toBe('Updated');
  });
  it('removes a task', () => {
    const initial = reducer(undefined, setTasks([task]));
    const state = reducer(initial, removeTask('task-1'));
    expect(state.items).toHaveLength(0);
  });
  it('clears all tasks', () => {
    const initial = reducer(undefined, setTasks([task]));
    const state = reducer(initial, clearTasks());
    expect(state.items).toEqual([]);
  });
  it('unassigns, but keeps, the tasks of a deleted agent', () => {
    const assigned = { assigneeType: 'agent', assigneeAgent: 'a1' } as const;
    const initial = reducer(
      undefined,
      setTasks([
        { ...task, _id: 't1', ...assigned },
        { ...task, _id: 't2', assigneeType: 'agent', assigneeAgent: 'a2' },
        { ...task, _id: 't3', assigneeType: 'user' },
      ]),
    );
    const state = reducer(initial, removeAgent('a1'));
    expect(state.items.map((item) => [item._id, item.assigneeType, item.assigneeAgent])).toEqual([
      ['t1', null, null],
      ['t2', 'agent', 'a2'],
      ['t3', 'user', undefined],
    ]);
  });
  it.each([
    ['logout', clearAuth()],
    ['session expiry', sessionExpired()],
  ])('drops assigned tasks on %s', (_label, action) => {
    const initial = reducer(
      undefined,
      setTasks([{ ...task, assigneeType: 'agent', assigneeAgent: 'a1' }]),
    );
    expect(reducer(initial, action).items).toEqual([]);
    expect(reducer(initial, action).loaded).toBe(false);
  });
});
