import { describe, expect, it } from 'vitest';
import type { Task } from '../types/task';
import { FOCUS_CANDIDATE_LIMIT, getReviewData, reviewPeriod, weekStart } from './reviews';

// Local dates, so these tests behave the same in every time zone.
const now = new Date(2026, 10, 18, 15); // Wed Nov 18 2026, 3 PM local
const at = (day: number, hour = 12) => new Date(2026, 10, day, hour).toISOString();
const due = (day: number) => '2026-11-' + String(day).padStart(2, '0') + 'T00:00:00.000Z';
const task = (overrides: Partial<Task> & { _id: string }): Task => ({
  title: overrides._id,
  description: '',
  status: 'todo',
  priority: 'medium',
  dueDate: null,
  ...overrides,
});

describe('review periods', () => {
  it('uses the local Monday of the week, including on a Sunday and a Monday', () => {
    expect(weekStart(now)).toBe('2026-11-16');
    expect(weekStart(new Date(2026, 10, 22, 23, 59))).toBe('2026-11-16');
    expect(weekStart(new Date(2026, 10, 23, 0, 1))).toBe('2026-11-23');
    // Across the start of a month and year.
    expect(weekStart(new Date(2027, 0, 2, 12))).toBe('2026-12-28');
  });

  it('reviews today for daily and this week for weekly', () => {
    expect(reviewPeriod('daily', now)).toBe('2026-11-18');
    expect(reviewPeriod('weekly', now)).toBe('2026-11-16');
  });
});

describe('getReviewData', () => {
  const tasks = [
    task({ _id: 'done-today', status: 'done', completedAt: at(18, 9) }),
    task({ _id: 'done-later-today', status: 'done', completedAt: at(18, 14) }),
    task({ _id: 'done-monday', status: 'done', completedAt: at(16, 8) }),
    task({ _id: 'done-last-week', status: 'done', completedAt: at(15, 20) }),
    task({ _id: 'done-legacy', status: 'done', completedAt: null }),
    task({ _id: 'overdue', dueDate: due(17) }),
    task({ _id: 'today', dueDate: due(18), priority: 'high' }),
    task({ _id: 'sunday', dueDate: due(22) }),
    task({ _id: 'next-week', dueDate: due(23) }),
    task({ _id: 'no-date', priority: 'high' }),
    task({ _id: 'no-date-low', priority: 'low' }),
  ];

  it('lists today’s completions newest first and what is overdue or due today', () => {
    const data = getReviewData(tasks, 'daily', now);
    expect(data.period).toBe('2026-11-18');
    expect(data.completed.map((item) => item._id)).toEqual(['done-later-today', 'done-today']);
    expect(data.attention.map((item) => item._id)).toEqual(['overdue', 'today']);
  });

  it('covers Monday to Sunday for the weekly review', () => {
    const data = getReviewData(tasks, 'weekly', now);
    expect(data.completed.map((item) => item._id)).toEqual([
      'done-later-today',
      'done-today',
      'done-monday',
    ]);
    expect(data.attention.map((item) => item._id)).toEqual(['overdue', 'today', 'sunday']);
  });

  it('offers open tasks by due date, then priority, without done tasks', () => {
    const data = getReviewData(tasks, 'daily', now);
    expect(data.candidates.map((item) => item._id)).toEqual([
      'overdue',
      'today',
      'sunday',
      'next-week',
      'no-date',
      'no-date-low',
    ]);
  });

  it('caps the candidates but keeps tasks already chosen', () => {
    const many = Array.from({ length: FOCUS_CANDIDATE_LIMIT + 3 }, (_, index) =>
      task({ _id: 't' + String(index).padStart(2, '0'), dueDate: due(index + 1) }),
    );
    const plain = getReviewData(many, 'daily', now);
    expect(plain.candidates).toHaveLength(FOCUS_CANDIDATE_LIMIT);
    const kept = getReviewData(many, 'daily', now, ['t17']);
    expect(kept.candidates).toHaveLength(FOCUS_CANDIDATE_LIMIT + 1);
    expect(kept.candidates.at(-1)?._id).toBe('t17');
  });
});
