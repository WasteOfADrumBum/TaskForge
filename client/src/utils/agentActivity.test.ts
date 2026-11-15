import { describe, expect, it } from 'vitest';
import type { Agent } from '../types/agent';
import type { AgentRun } from '../types/run';
import type { Task } from '../types/task';
import { getAgentActivity } from './agentActivity';

const now = new Date('2026-11-15T12:00:00.000Z');
const run = (id: string, extra: Partial<AgentRun> = {}): AgentRun => ({
  _id: id,
  task: 'task-1',
  agent: 'agent-1',
  input: 'Synthetic input',
  result: null,
  resultDigest: null,
  status: 'queued',
  version: 1,
  executionMode: null,
  createdAt: '2026-11-15T10:00:00.000Z',
  ...extra,
});
const agents = [{ _id: 'agent-1', name: 'Research agent' }] as Agent[];
const tasks = [{ _id: 'task-1', title: 'Draft the launch note' }] as Task[];

describe('getAgentActivity', () => {
  it('counts review, in-progress and recent failures', () => {
    const activity = getAgentActivity(
      [
        run('a', { status: 'awaiting-approval' }),
        run('b', { status: 'awaiting-approval' }),
        run('c', { status: 'queued' }),
        run('d', { status: 'running' }),
        run('e', { status: 'failed', createdAt: '2026-11-14T00:00:00.000Z' }),
        run('f', { status: 'failed', createdAt: '2026-11-01T00:00:00.000Z' }),
        run('g', { status: 'approved' }),
      ],
      agents,
      tasks,
      now,
    );
    expect(activity).toMatchObject({
      awaitingReview: 2,
      inProgress: 2,
      recentFailures: 1,
      total: 7,
    });
  });

  it('uses the last update for recency and failure age', () => {
    const activity = getAgentActivity(
      [
        run('old-but-updated', {
          status: 'failed',
          createdAt: '2026-10-01T00:00:00.000Z',
          updatedAt: '2026-11-15T11:00:00.000Z',
        }),
        run('newer', { createdAt: '2026-11-15T10:30:00.000Z' }),
      ],
      agents,
      tasks,
      now,
    );
    expect(activity.recentFailures).toBe(1);
    expect(activity.recent.map((item) => item.id)).toEqual(['old-but-updated', 'newer']);
  });

  it('lists at most five runs, newest first, with names and fallbacks', () => {
    const runs = Array.from({ length: 7 }, (_, index) =>
      run('run-' + index, { createdAt: '2026-11-15T0' + index + ':00:00.000Z' }),
    );
    runs.push(
      run('orphan', { agent: 'gone', task: 'gone', createdAt: '2026-11-15T11:30:00.000Z' }),
    );
    const { recent } = getAgentActivity(runs, agents, tasks, now);
    expect(recent).toHaveLength(5);
    expect(recent[0]).toMatchObject({
      id: 'orphan',
      agentName: 'Unknown agent',
      taskTitle: 'Task not loaded',
    });
    expect(recent[1]).toMatchObject({
      id: 'run-6',
      agentName: 'Research agent',
      taskTitle: 'Draft the launch note',
    });
  });

  it('skips runs without an id or a readable date', () => {
    const activity = getAgentActivity(
      [run(''), run('bad-date', { createdAt: 'not a date' }), run('ok')],
      agents,
      tasks,
      now,
    );
    expect(activity.total).toBe(1);
    expect(activity.recent.map((item) => item.id)).toEqual(['ok']);
  });
});
