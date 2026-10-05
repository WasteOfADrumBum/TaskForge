import { afterEach, describe, expect, it, vi } from 'vitest';
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

  it('filters by assignee alongside the other filters', () => {
    const assigned: Task[] = [
      { ...tasks[0], assigneeType: 'user' },
      { ...tasks[1], assigneeType: 'agent', assigneeAgent: 'a1' },
      tasks[2],
    ];
    const ids = (assignee: 'all' | 'me' | 'agents' | 'unassigned') =>
      filterAndSortTasks(assigned, {
        search: '',
        status: 'all',
        priority: 'all',
        assignee,
        sort: 'created-asc',
      }).map((task) => task._id);
    expect(ids('all')).toEqual(['1', '2', '3']);
    expect(ids('me')).toEqual(['1']);
    expect(ids('agents')).toEqual(['2']);
    expect(ids('unassigned')).toEqual(['3']);
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

  it.each([
    ['just after midnight', new Date(2026, 9, 15, 0, 5)],
    ['late evening', new Date(2026, 9, 15, 23, 55)],
  ])('treats a due date as a calendar date at %s', (_label, now) => {
    const dueOn = (date: string): Task => ({ ...tasks[0], dueDate: date + 'T00:00:00.000Z' });
    expect(isTaskOverdue(dueOn('2026-10-14'), now)).toBe(true);
    expect(isTaskOverdue(dueOn('2026-10-15'), now)).toBe(false);
    expect(isTaskOverdue(dueOn('2026-10-16'), now)).toBe(false);
    expect(isTaskOverdue({ ...dueOn('2026-10-14'), status: 'done' }, now)).toBe(false);
  });

  describe('with the clock fixed', () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    it('detects overdue unfinished tasks', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-10-15T12:00:00.000Z'));
      expect(isTaskOverdue(tasks[0])).toBe(true);
      expect(isTaskOverdue(tasks[1])).toBe(false);
      // Task 3 (in progress, due Oct 1) is overdue too; the summary must count both.
      expect(getTaskSummary(tasks).overdue).toBe(2);
    });
  });

  it('counts overdue tasks against a given date', () => {
    expect(getTaskSummary(tasks, new Date(2026, 9, 5, 12)).overdue).toBe(1);
    expect(getTaskSummary(tasks, new Date(2026, 8, 30, 12)).overdue).toBe(0);
  });
});
