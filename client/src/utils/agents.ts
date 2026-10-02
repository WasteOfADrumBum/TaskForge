import type { Agent, AgentInput, AgentStatus, AgentUpdate } from '../types/agent';

// Pure agent-registry helpers. Everything comes from the stored agent definitions; there is no
// run, assignment, or activity data yet.

// Agents sorted for lists: active first, then paused, then disabled, alphabetically within
// each status.
const statusOrder: Record<AgentStatus, number> = { active: 0, paused: 1, disabled: 2 };
export const sortAgents = (agents: Agent[]) =>
  [...agents].sort(
    (a, b) => statusOrder[a.status] - statusOrder[b.status] || a.name.localeCompare(b.name),
  );

export interface AgentSummary {
  total: number;
  active: number;
  paused: number;
  disabled: number;
}

export const getAgentSummary = (agents: Agent[]): AgentSummary => {
  const summary: AgentSummary = { total: agents.length, active: 0, paused: 0, disabled: 0 };
  for (const agent of agents) summary[agent.status] += 1;
  return summary;
};

const sameItems = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && a.every((item) => b.includes(item));

// The fields of `input` that differ from `existing`. Skills and permissions are compared as
// sets, so a reordering alone is not a change.
export const getAgentChanges = (existing: Agent, input: AgentInput): AgentUpdate => {
  const changes: AgentUpdate = {};
  if (input.name !== existing.name) changes.name = input.name;
  if (input.role !== existing.role) changes.role = input.role;
  if ((input.description ?? '') !== existing.description) changes.description = input.description;
  if (input.status && input.status !== existing.status) changes.status = input.status;
  if (input.skills && !sameItems(input.skills, existing.skills)) changes.skills = input.skills;
  if (input.permissions && !sameItems(input.permissions, existing.permissions)) {
    changes.permissions = input.permissions;
  }
  return changes;
};
