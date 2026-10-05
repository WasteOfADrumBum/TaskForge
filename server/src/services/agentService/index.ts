import { Agent, AGENT_PERMISSIONS, AGENT_STATUSES } from '../../models/agentModel';
import { Task } from '../../models/taskModel';

export type AgentStatus = (typeof AGENT_STATUSES)[number];
export type AgentPermission = (typeof AGENT_PERMISSIONS)[number];

export interface AgentInput {
  name: string;
  role: string;
  description?: string;
  status?: AgentStatus;
  skills?: string[];
  permissions?: AgentPermission[];
}

export type AgentUpdate = Partial<AgentInput>;

// Every query is scoped to the owner, so one user can never read or change another's agents.

export const createAgent = async (ownerId: string, agentData: AgentInput) => {
  return Agent.create({ ...agentData, owner: ownerId });
};

export const findAgentsByOwner = async (ownerId: string) => {
  return Agent.find({ owner: ownerId }).sort({ updatedAt: -1 });
};

export const findAgentById = async (ownerId: string, agentId: string) => {
  return Agent.findOne({ _id: agentId, owner: ownerId });
};

export const updateAgentById = async (ownerId: string, agentId: string, updates: AgentUpdate) => {
  return Agent.findOneAndUpdate({ _id: agentId, owner: ownerId }, updates, {
    new: true,
    runValidators: true,
  });
};

// The agent's status, or null when the owner has no such agent (missing or another user's).
export const findAgentStatus = async (
  ownerId: string,
  agentId: string,
): Promise<AgentStatus | null> => {
  const agent = await Agent.findOne({ _id: agentId, owner: ownerId }, { status: 1 });
  return agent ? (agent.status as AgentStatus) : null;
};

// Deleting an agent never deletes tasks; the tasks assigned to it become unassigned. Same
// order as deleteProjectById:
// 1. Unassign first: if the delete then fails, the agent still exists with no tasks pointing
//    at it, and the request can simply be retried.
// 2. Delete the agent.
// 3. Unassign again, best-effort, to catch a task the same user assigned to this agent in the
//    moment between steps 1 and 2. Without a transaction this narrows that window rather than
//    closing it. Task writes also recheck agent existence after persisting an assignment; the
//    client treats any unknown agent reference left by failed cleanup as a deleted agent.
export const deleteAgentById = async (ownerId: string, agentId: string) => {
  const agent = await Agent.findOne({ _id: agentId, owner: ownerId });
  if (!agent) return null;
  const unassign = () =>
    Task.updateMany(
      { owner: ownerId, assigneeAgent: agentId },
      { $set: { assigneeType: null, assigneeAgent: null } },
    );
  await unassign();
  await Agent.deleteOne({ _id: agentId, owner: ownerId });
  try {
    await unassign();
  } catch {
    // The agent is already gone; a failed cleanup must not turn a successful delete into an
    // error. The client shows any straggler as assigned to a deleted agent.
  }
  return agent;
};
