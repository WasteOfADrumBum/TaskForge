import { describe, expect, it } from 'vitest';
import type { Project } from '../types/project';
import type { Task } from '../types/task';
import {
  getProjectActivity,
  getProjectStats,
  getStatsForProject,
  getTasksForProject,
  sortProjects,
} from './projects';

const now = new Date(2026, 9, 15, 12); // Oct 15 2026, local noon

const task = (overrides: Partial<Task> & { _id: string }): Task => ({
  title: overrides._id,
  description: '',
  status: 'todo',
  priority: 'medium',
  dueDate: null,
  project: null,
  ...overrides,
});

const project = (overrides: Partial<Project> & { _id: string; name: string }): Project => ({
  description: '',
  status: 'active',
  ...overrides,
});

const tasks = [
  task({ _id: 't1', project: 'p1', status: 'done' }),
  task({ _id: 't2', project: 'p1', status: 'in-progress' }),
  task({ _id: 't3', project: 'p1', dueDate: '2026-10-10T00:00:00.000Z' }),
  task({ _id: 't4', project: 'p2' }),
  task({ _id: 't5' }),
];

describe('project task stats', () => {
  it('counts each project’s tasks by status, overdue, and completion', () => {
    const stats = getProjectStats(tasks, now);
    expect(getStatsForProject(stats, 'p1')).toEqual({
      total: 3,
      open: 2,
      inProgress: 1,
      done: 1,
      overdue: 1,
      completion: 33,
    });
    expect(getStatsForProject(stats, 'p2')).toMatchObject({ total: 1, open: 1, completion: 0 });
  });

  it('returns empty stats for a project with no tasks and ignores unassigned tasks', () => {
    const stats = getProjectStats(tasks, now);
    expect(getStatsForProject(stats, 'p3')).toEqual({
      total: 0,
      open: 0,
      inProgress: 0,
      done: 0,
      overdue: 0,
      completion: 0,
    });
    expect([...stats.keys()].sort()).toEqual(['p1', 'p2']);
  });

  it('selects a project’s tasks', () => {
    expect(getTasksForProject(tasks, 'p1').map((t) => t._id)).toEqual(['t1', 't2', 't3']);
  });
});

describe('getProjectActivity', () => {
  it('merges project and task changes, newest first', () => {
    const p = project({
      _id: 'p1',
      name: 'Launch',
      createdAt: '2026-10-01T09:00:00Z',
      updatedAt: '2026-10-04T09:00:00Z',
    });
    const projectTasks = [
      task({
        _id: 'a',
        title: 'Write notes',
        project: 'p1',
        createdAt: '2026-10-02T09:00:00Z',
        updatedAt: '2026-10-02T09:00:00Z',
      }),
      task({
        _id: 'b',
        title: 'Ship',
        project: 'p1',
        createdAt: '2026-10-02T10:00:00Z',
        updatedAt: '2026-10-05T09:00:00Z',
      }),
      task({ _id: 'c', title: 'Elsewhere', project: 'p2', createdAt: '2026-10-09T09:00:00Z' }),
    ];
    expect(getProjectActivity(p, projectTasks).map((item) => item.label)).toEqual([
      'Updated “Ship”',
      'Project details updated',
      'Created “Write notes”',
      'Project created',
    ]);
  });

  it('omits the update entry when the project was never edited', () => {
    const p = project({
      _id: 'p1',
      name: 'Launch',
      createdAt: '2026-10-01T09:00:00Z',
      updatedAt: '2026-10-01T09:00:00Z',
    });
    expect(getProjectActivity(p, []).map((item) => item.label)).toEqual(['Project created']);
  });
});

describe('sortProjects', () => {
  it('puts active projects first, then completed, then archived, alphabetically', () => {
    const sorted = sortProjects([
      project({ _id: '1', name: 'Zeta', status: 'archived' }),
      project({ _id: '2', name: 'Beta', status: 'active' }),
      project({ _id: '3', name: 'Alpha', status: 'completed' }),
      project({ _id: '4', name: 'Alpha', status: 'active' }),
    ]);
    expect(sorted.map((p) => p.name + ':' + p.status)).toEqual([
      'Alpha:active',
      'Beta:active',
      'Alpha:completed',
      'Zeta:archived',
    ]);
  });
});
