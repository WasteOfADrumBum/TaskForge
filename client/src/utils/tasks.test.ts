import { describe, expect, it, vi } from 'vitest';
import type { Task } from '../types/task';
import { filterAndSortTasks, getTaskSummary, isTaskOverdue } from './tasks';

const tasks: Task[] = [
  {
    _id: '1',
    title: 'High priority task',
    description: 'Important work',
    status: 'todo',
    priority: 'high',
    dueDate: '2026-10-10T00:00:00.000Z',
    createdAt: '2026-09-20T00:00:00.000Z',
  },
  {
    _id: '2',
    title: 'Completed task',
    description: 'Finished',
    status: 'done',
    priority: 'low',
    dueDate: null,
    createdAt: '2026-09-21T00:00:00.000Z',
  },
  {
    _id: '3',
    title: 'Medium task',
    description: 'In progress work',
    status: 'in-progress',
    priority: 'medium',
    dueDate: '2026-10-01T00:00:00.000Z',
    createdAt: '2026-09-22T00:00:00.000Z',
  },
];

describe('task utilities', () => {
  it('filters by search, status, and priority', () => {
    const result = filterAndSortTasks(tasks, {
      search: 'important',
      status: 'todo',
      priority: 'high',
      sort: 'created-desc',
    });
    expect(result.map((task) => task._id)).toEqual(['1']);
  });

  it('sorts by priority', () => {
    const result = filterAndSortTasks(tasks, {
      search: '',
      status: 'all',
      priority: 'all',
      sort: 'priority-desc',
    });
    expect(result.map((task) => task.priority)).toEqual(['high', 'medium', 'low']);
  });

  it('sorts by due date with tasks without due dates last', () => {
    const result = filterAndSortTasks(tasks, {
      search: '',
      status: 'all',
      priority: 'all',
      sort: 'due-asc',
    });
    expect(result.map((task) => task._id)).toEqual(['3', '1', '2']);
  });

  it('counts task summary values', () => {
    const summary = getTaskSummary(tasks);
    expect(summary.total).toBe(3);
    expect(summary.todo).toBe(1);
    expect(summary.inProgress).toBe(1);
    expect(summary.done).toBe(1);
  });

  it('detects overdue unfinished tasks', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-15T12:00:00.000Z'));
    expect(isTaskOverdue(tasks[0])).toBe(true);
    expect(isTaskOverdue(tasks[1])).toBe(false);
    vi.useRealTimers();
  });
});
