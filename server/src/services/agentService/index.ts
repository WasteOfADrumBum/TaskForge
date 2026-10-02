import { Agent, AGENT_PERMISSIONS, AGENT_STATUSES } from '../../models/agentModel';

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

// Nothing references agents yet (no task assignment or runs), so deleting one touches
// nothing else: the user's tasks and projects are unchanged.
export const deleteAgentById = async (ownerId: string, agentId: string) => {
  return Agent.findOneAndDelete({ _id: agentId, owner: ownerId });
};
