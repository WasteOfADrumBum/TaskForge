import { describe, expect, it } from 'vitest';
import reducer, { addTask, clearTasks, removeTask, replaceTask, setTasks } from './taskSlice';
import type { Task } from '../../types/task';

const task: Task = {
  _id: 'task-1',
  title: 'First task',
  description: '',
  status: 'todo',
  priority: 'medium',
  dueDate: null,
};

describe('taskSlice', () => {
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
});
