import { getAgentId, type Agent } from '../types/agent';
import type { Task, TaskInput } from '../types/task';

// Pure task-assignment helpers. Everything is derived from the tasks the API already returns;
// an assignment is a record only, and nothing runs an agent.

export type TaskAssignee = { kind: 'none' } | { kind: 'me' } | { kind: 'agent'; agentId: string };

// An 'agent' type with no agent id can't be shown as any agent, so it reads as Unassigned.
export const getTaskAssignee = (task: Task): TaskAssignee => {
  if (task.assigneeType === 'user') return { kind: 'me' };
  if (task.assigneeType === 'agent' && task.assigneeAgent) {
    return { kind: 'agent', agentId: task.assigneeAgent };
  }
  return { kind: 'none' };
};

// The task form's select value for an assignee: '' (Unassigned), 'me', or 'agent:<id>'.
export const assigneeValue = (task: Task) => {
  const assignee = getTaskAssignee(task);
  if (assignee.kind === 'me') return 'me';
  if (assignee.kind === 'agent') return 'agent:' + assignee.agentId;
  return '';
};

export const agentFromValue = (value: string) =>
  value.startsWith('agent:') ? value.slice('agent:'.length) : null;

// The API fields for a select value. Both fields are always sent together.
export const assigneeInput = (
  value: string,
): Required<Pick<TaskInput, 'assigneeType' | 'assigneeAgent'>> => {
  const agentId = agentFromValue(value);
  if (agentId) return { assigneeType: 'agent', assigneeAgent: agentId };
  return { assigneeType: value === 'me' ? 'user' : null, assigneeAgent: null };
};

export type AssigneeFilter = 'all' | 'me' | 'agents' | 'unassigned';

export const matchesAssigneeFilter = (task: Task, filter: AssigneeFilter) => {
  if (filter === 'all') return true;
  const { kind } = getTaskAssignee(task);
  if (filter === 'me') return kind === 'me';
  if (filter === 'agents') return kind === 'agent';
  return kind === 'none';
};

export const getTasksForAgent = (tasks: Task[], agentId: string) =>
  tasks.filter((task) => task.assigneeType === 'agent' && task.assigneeAgent === agentId);

export interface AgentWorkload {
  total: number;
  // Assigned tasks that are not done.
  open: number;
}

// Assigned-task counts for every agent in one pass, keyed by agent id. A count of tasks, not a
// measure of performance: agents don't do any work yet.
export const getAgentWorkloads = (tasks: Task[]): Map<string, AgentWorkload> => {
  const workloads = new Map<string, AgentWorkload>();
  for (const task of tasks) {
    const assignee = getTaskAssignee(task);
    if (assignee.kind !== 'agent') continue;
    const entry = workloads.get(assignee.agentId) ?? { total: 0, open: 0 };
    entry.total += 1;
    if (task.status !== 'done') entry.open += 1;
    workloads.set(assignee.agentId, entry);
  }
  return workloads;
};

export const getWorkloadFor = (workloads: Map<string, AgentWorkload>, agentId: string) =>
  workloads.get(agentId) ?? { total: 0, open: 0 };

export interface AssignmentSummary {
  // Agents (that still exist) with at least one open assigned task.
  agentsWithOpenTasks: number;
  // Open tasks assigned to any agent, including one that was just deleted (see deleteAgentById),
  // so the three task counts always add up to the open tasks.
  openOnAgents: number;
  openOnMe: number;
  openUnassigned: number;
}

// Open-task assignment counts for the Command Center. Fixed rules over task data only.
export const getAssignmentSummary = (tasks: Task[], agents: Agent[]): AssignmentSummary => {
  const workloads = getAgentWorkloads(tasks);
  const summary: AssignmentSummary = {
    agentsWithOpenTasks: 0,
    openOnAgents: 0,
    openOnMe: 0,
    openUnassigned: 0,
  };
  for (const agent of agents) {
    if (getWorkloadFor(workloads, getAgentId(agent)).open) summary.agentsWithOpenTasks += 1;
  }
  for (const task of tasks) {
    if (task.status === 'done') continue;
    const { kind } = getTaskAssignee(task);
    if (kind === 'agent') summary.openOnAgents += 1;
    if (kind === 'me') summary.openOnMe += 1;
    if (kind === 'none') summary.openUnassigned += 1;
  }
  return summary;
};
