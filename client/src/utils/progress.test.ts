import { describe, expect, it } from 'vitest';
import type { Project } from '../types/project';
import type { Task } from '../types/task';
import { getProgressSummary } from './progress';

// All moments are built from local dates, so these tests behave the same in every time zone.
const now = new Date(2026, 10, 15, 12); // Sun Nov 15 2026, local noon
const at = (month: number, day: number, hour = 12, minute = 0) =>
  new Date(2026, month, day, hour, minute).toISOString();

const task = (overrides: Partial<Task> & { _id: string }): Task => ({
  title: overrides._id,
  description: '',
  status: 'todo',
  priority: 'medium',
  dueDate: null,
  project: null,
  createdAt: at(0, 1),
  ...overrides,
});
const done = (id: string, completedAt: string | null, overrides: Partial<Task> = {}) =>
  task({ _id: id, status: 'done', completedAt, ...overrides });
const project = (id: string, name: string): Project => ({
  _id: id,
  name,
  description: '',
  status: 'active',
});

describe('getProgressSummary', () => {
  it('builds seven daily buckets ending today, oldest first', () => {
    const summary = getProgressSummary([], [], 7, now);
    expect(summary.buckets.map((bucket) => bucket.start)).toEqual([
      '2026-11-09',
      '2026-11-10',
      '2026-11-11',
      '2026-11-12',
      '2026-11-13',
      '2026-11-14',
      '2026-11-15',
    ]);
    expect(summary.buckets.every((bucket) => bucket.start === bucket.end)).toBe(true);
  });

  it('builds four weekly buckets for 28 days that end today', () => {
    const summary = getProgressSummary([], [], 28, now);
    expect(summary.buckets.map((bucket) => [bucket.start, bucket.end])).toEqual([
      ['2026-10-19', '2026-10-25'],
      ['2026-10-26', '2026-11-01'],
      ['2026-11-02', '2026-11-08'],
      ['2026-11-09', '2026-11-15'],
    ]);
  });

  it('keeps whole days across the November daylight-saving change', () => {
    // US clocks fall back on Nov 1 2026; a 25-hour day must still be one bucket.
    const summary = getProgressSummary(
      [done('a', at(10, 1, 23, 30)), done('b', at(10, 2, 0, 15))],
      [],
      28,
      now,
    );
    expect(summary.buckets[1].completed).toBe(1);
    expect(summary.buckets[2].completed).toBe(1);
  });

  it('counts completions by local calendar day, including just before midnight', () => {
    const summary = getProgressSummary(
      [
        done('late', at(10, 14, 23, 59)),
        done('early', at(10, 15, 0, 1)),
        done('first-day', at(10, 9, 0, 0)),
        done('too-old', at(10, 8, 23, 59)),
      ],
      [],
      7,
      now,
    );
    expect(summary.completed).toBe(3);
    expect(summary.buckets.map((bucket) => bucket.completed)).toEqual([1, 0, 0, 0, 0, 1, 1]);
    expect(summary.previousCompleted).toBe(1);
  });

  it('compares with the previous window of the same length', () => {
    const summary = getProgressSummary(
      [done('prev-start', at(10, 2)), done('prev-end', at(10, 8)), done('older', at(10, 1))],
      [],
      7,
      now,
    );
    expect(summary.completed).toBe(0);
    expect(summary.previousCompleted).toBe(2);
  });

  it('never guesses a completion date for done tasks that have none', () => {
    const summary = getProgressSummary(
      [
        done('legacy', null, { updatedAt: at(10, 15) }),
        done('missing', undefined as unknown as null),
        done('invalid', 'not a date'),
      ],
      [],
      7,
      now,
    );
    expect(summary.completed).toBe(0);
    expect(summary.unknownCompletion).toBe(3);
  });

  it('ignores completion times on tasks that are no longer done', () => {
    const summary = getProgressSummary(
      [task({ _id: 'reopened', status: 'todo', completedAt: at(10, 15) })],
      [],
      7,
      now,
    );
    expect(summary.completed).toBe(0);
    expect(summary.unknownCompletion).toBe(0);
  });

  it('counts tasks created in range whatever their status', () => {
    const summary = getProgressSummary(
      [
        task({ _id: 'new', createdAt: at(10, 15, 8) }),
        done('new-done', at(10, 15), { createdAt: at(10, 10) }),
        task({ _id: 'old', createdAt: at(10, 8, 23, 59) }),
        task({ _id: 'no-date', createdAt: undefined }),
      ],
      [],
      7,
      now,
    );
    expect(summary.created).toBe(2);
  });

  it('measures on-time completion only among tasks that had a due date', () => {
    const summary = getProgressSummary(
      [
        done('same-day', at(10, 12, 23), { dueDate: '2026-11-12T00:00:00.000Z' }),
        done('early', at(10, 10), { dueDate: '2026-11-12T00:00:00.000Z' }),
        done('late', at(10, 13, 0, 5), { dueDate: '2026-11-12T00:00:00.000Z' }),
        done('no-due', at(10, 13)),
      ],
      [],
      7,
      now,
    );
    expect(summary.withDueDate).toBe(3);
    expect(summary.onTime).toBe(2);
  });

  it('groups completions by project, most first, and caps the list at five', () => {
    const projects = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6'].map((id) => project(id, 'Project ' + id));
    const tasks = [
      done('a', at(10, 14), { project: 'p2' }),
      done('b', at(10, 14), { project: 'p2' }),
      done('c', at(10, 14), { project: 'p1' }),
      done('d', at(10, 14), { project: 'p3' }),
      done('e', at(10, 14), { project: 'p4' }),
      done('f', at(10, 14), { project: 'p5' }),
      done('g', at(10, 14), { project: 'p6' }),
      done('h', at(10, 14), { project: 'deleted' }),
      done('i', at(10, 14)),
      done('outside', at(9, 1), { project: 'p6' }),
    ];
    const summary = getProgressSummary(tasks, projects, 7, now);
    expect(summary.byProject).toEqual([
      { projectId: null, name: 'No project', completed: 2 },
      { projectId: 'p2', name: 'Project p2', completed: 2 },
      { projectId: 'p1', name: 'Project p1', completed: 1 },
      { projectId: 'p3', name: 'Project p3', completed: 1 },
      { projectId: 'p4', name: 'Project p4', completed: 1 },
    ]);
    expect(summary.projectGroups).toBe(7);
  });
});
