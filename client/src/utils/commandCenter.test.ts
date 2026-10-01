import { describe, expect, it } from 'vitest';
import type { Task } from '../types/task';
import {
  daysUntilDue,
  getGreeting,
  getRecentActivity,
  getRecommendations,
  getTodaysPriorities,
} from './commandCenter';

const now = new Date(2026, 9, 15, 10, 0); // Oct 15 2026, 10:00 local
const localDay = (day: number) => new Date(2026, 9, day).toISOString();

const task = (overrides: Partial<Task> & { _id: string }): Task => ({
  title: overrides._id,
  description: '',
  status: 'todo',
  priority: 'medium',
  dueDate: null,
  ...overrides,
});

describe('daysUntilDue', () => {
  it('counts whole local days and ignores tasks without a due date', () => {
    expect(daysUntilDue(task({ _id: 'a', dueDate: localDay(14) }), now)).toBe(-1);
    expect(daysUntilDue(task({ _id: 'b', dueDate: localDay(15) }), now)).toBe(0);
    expect(daysUntilDue(task({ _id: 'c', dueDate: localDay(18) }), now)).toBe(3);
    expect(daysUntilDue(task({ _id: 'd' }), now)).toBeNull();
  });
});

describe('getTodaysPriorities', () => {
  it('orders overdue, due today, high priority, then due soon, and skips other tasks', () => {
    const tasks = [
      task({ _id: 'soon', dueDate: localDay(17) }),
      task({ _id: 'high', priority: 'high' }),
      task({ _id: 'today', dueDate: localDay(15) }),
      task({ _id: 'late', dueDate: localDay(10) }),
      task({ _id: 'later', dueDate: localDay(30) }),
      task({ _id: 'plain' }),
      task({ _id: 'done-late', status: 'done', dueDate: localDay(1) }),
    ];
    expect(getTodaysPriorities(tasks, now).map(({ task: t, reason }) => [t._id, reason])).toEqual([
      ['late', 'overdue'],
      ['today', 'due-today'],
      ['high', 'high-priority'],
      ['soon', 'due-soon'],
    ]);
  });

  it('puts the oldest overdue task first and respects the limit', () => {
    const tasks = [
      task({ _id: 'recent', dueDate: localDay(14) }),
      task({ _id: 'oldest', dueDate: localDay(2) }),
      task({ _id: 'middle', dueDate: localDay(8) }),
    ];
    expect(getTodaysPriorities(tasks, now, 2).map((item) => item.task._id)).toEqual([
      'oldest',
      'middle',
    ]);
  });
});

describe('getRecommendations', () => {
  it('derives rule-based recommendations from task data', () => {
    const tasks = [
      task({ _id: 'late', title: 'File report', dueDate: localDay(12) }),
      task({ _id: 'wip', title: 'Draft plan', status: 'in-progress' }),
      task({ _id: 'big', title: 'Ship release', priority: 'high' }),
    ];
    expect(getRecommendations(tasks, now)).toEqual([
      {
        id: 'overdue',
        title: 'Resolve 1 overdue task',
        reason: '"File report" was due 3 days ago.',
        tone: 'orange',
      },
      {
        id: 'continue',
        title: 'Continue "Draft plan"',
        reason: 'It is already in progress.',
        tone: 'teal',
      },
      {
        id: 'start-high',
        title: 'Start "Ship release"',
        reason: 'High priority and not started yet.',
        tone: 'teal',
      },
    ]);
  });

  it('suggests finishing work when three or more tasks are in progress', () => {
    const tasks = ['a', 'b', 'c'].map((id) => task({ _id: id, status: 'in-progress' }));
    expect(getRecommendations(tasks, now)[0]).toMatchObject({
      id: 'finish-in-progress',
      title: 'Finish work in progress',
    });
  });

  it('flags tasks due soon and returns nothing for an empty or finished workspace', () => {
    expect(
      getRecommendations([task({ _id: 'soon', dueDate: localDay(16) })], now)[0],
    ).toMatchObject({
      id: 'due-soon',
      title: 'Plan for 1 task due soon',
    });
    expect(getRecommendations([], now)).toEqual([]);
    expect(getRecommendations([task({ _id: 'x', status: 'done' })], now)).toEqual([]);
  });
});

describe('getRecentActivity', () => {
  it('lists the newest changes first and labels creations and updates', () => {
    const tasks = [
      task({ _id: 'old', createdAt: '2026-10-01T09:00:00Z', updatedAt: '2026-10-01T09:00:00Z' }),
      task({ _id: 'edited', createdAt: '2026-10-02T09:00:00Z', updatedAt: '2026-10-05T09:00:00Z' }),
      task({ _id: 'untimed' }),
    ];
    expect(getRecentActivity(tasks).map(({ task: t, action }) => [t._id, action])).toEqual([
      ['edited', 'updated'],
      ['old', 'created'],
    ]);
  });
});

describe('getGreeting', () => {
  it('matches the time of day', () => {
    expect(getGreeting(new Date(2026, 9, 15, 8))).toBe('Good morning');
    expect(getGreeting(new Date(2026, 9, 15, 13))).toBe('Good afternoon');
    expect(getGreeting(new Date(2026, 9, 15, 20))).toBe('Good evening');
  });
});
