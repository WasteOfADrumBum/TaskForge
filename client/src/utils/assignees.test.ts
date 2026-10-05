import { describe, expect, it } from 'vitest';
import { makeAgent, makeTask } from '../test/renderApp';
import {
  agentFromValue,
  assigneeInput,
  assigneeValue,
  getAgentWorkloads,
  getAssignmentSummary,
  getTaskAssignee,
  getTasksForAgent,
  getWorkloadFor,
  matchesAssigneeFilter,
} from './assignees';

const unassigned = makeTask({ _id: 't1', title: 'Loose' });
const mine = makeTask({ _id: 't2', title: 'Mine', assigneeType: 'user' });
const scouting = makeTask({
  _id: 't3',
  title: 'Scouting',
  assigneeType: 'agent',
  assigneeAgent: 'a1',
});
const scoutDone = makeTask({
  _id: 't4',
  title: 'Scouted',
  status: 'done',
  assigneeType: 'agent',
  assigneeAgent: 'a1',
});
const building = makeTask({
  _id: 't5',
  title: 'Building',
  status: 'in-progress',
  assigneeType: 'agent',
  assigneeAgent: 'a2',
});
const tasks = [unassigned, mine, scouting, scoutDone, building];

describe('assignee helpers', () => {
  it('reads each assignee kind, treating a broken agent assignment as unassigned', () => {
    expect(getTaskAssignee(unassigned)).toEqual({ kind: 'none' });
    expect(getTaskAssignee(mine)).toEqual({ kind: 'me' });
    expect(getTaskAssignee(scouting)).toEqual({ kind: 'agent', agentId: 'a1' });
    expect(getTaskAssignee({ ...unassigned, assigneeType: 'agent', assigneeAgent: null })).toEqual({
      kind: 'none',
    });
  });

  it('round-trips form values to API fields', () => {
    expect([unassigned, mine, scouting].map(assigneeValue)).toEqual(['', 'me', 'agent:a1']);
    expect(assigneeInput('')).toEqual({ assigneeType: null, assigneeAgent: null });
    expect(assigneeInput('me')).toEqual({ assigneeType: 'user', assigneeAgent: null });
    expect(assigneeInput('agent:a1')).toEqual({ assigneeType: 'agent', assigneeAgent: 'a1' });
    expect(agentFromValue('agent:a1')).toBe('a1');
    expect(agentFromValue('me')).toBeNull();
  });

  it('filters by assignee', () => {
    const titles = (filter: Parameters<typeof matchesAssigneeFilter>[1]) =>
      tasks.filter((task) => matchesAssigneeFilter(task, filter)).map((task) => task.title);
    expect(titles('all')).toHaveLength(5);
    expect(titles('me')).toEqual(['Mine']);
    expect(titles('agents')).toEqual(['Scouting', 'Scouted', 'Building']);
    expect(titles('unassigned')).toEqual(['Loose']);
  });

  it('lists an agent’s tasks and counts total and open work per agent', () => {
    expect(getTasksForAgent(tasks, 'a1').map((task) => task.title)).toEqual([
      'Scouting',
      'Scouted',
    ]);
    const workloads = getAgentWorkloads(tasks);
    expect(getWorkloadFor(workloads, 'a1')).toEqual({ total: 2, open: 1 });
    expect(getWorkloadFor(workloads, 'a2')).toEqual({ total: 1, open: 1 });
    expect(getWorkloadFor(workloads, 'a9')).toEqual({ total: 0, open: 0 });
  });

  it('summarizes open assignments, counting a task on a deleted agent as on agents', () => {
    const agents = [
      makeAgent({ _id: 'a1', name: 'Scout' }),
      makeAgent({ _id: 'a2', name: 'Builder' }),
      makeAgent({ _id: 'a3', name: 'Idle' }),
    ];
    const orphan = makeTask({
      _id: 't6',
      title: 'Orphan',
      assigneeType: 'agent',
      assigneeAgent: 'gone',
    });
    expect(getAssignmentSummary([...tasks, orphan], agents)).toEqual({
      agentsWithOpenTasks: 2,
      openOnAgents: 3,
      openOnMe: 1,
      openUnassigned: 1,
    });
    expect(getAssignmentSummary([], agents)).toEqual({
      agentsWithOpenTasks: 0,
      openOnAgents: 0,
      openOnMe: 0,
      openUnassigned: 0,
    });
  });
});
