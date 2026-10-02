export type AgentStatus = 'active' | 'paused' | 'disabled';

export const AGENT_STATUSES: AgentStatus[] = ['active', 'paused', 'disabled'];

export const agentStatusLabel: Record<AgentStatus, string> = {
  active: 'Active',
  paused: 'Paused',
  disabled: 'Disabled',
};

export type AgentPermission =
  'task.read' | 'task.update' | 'project.read' | 'project.update' | 'artifact.draft';

// The permission catalog, in display order. Registry metadata only: nothing runs an agent or
// enforces these yet.
export const AGENT_PERMISSIONS: { id: AgentPermission; label: string; description: string }[] = [
  { id: 'task.read', label: 'Read tasks', description: 'See your tasks and their details.' },
  { id: 'task.update', label: 'Update tasks', description: 'Change task status and details.' },
  { id: 'project.read', label: 'Read projects', description: 'See your projects.' },
  { id: 'project.update', label: 'Update projects', description: 'Change project details.' },
  {
    id: 'artifact.draft',
    label: 'Draft artifacts',
    description: 'Write drafts for you to review.',
  },
];

export const permissionLabel = (permission: AgentPermission) =>
  AGENT_PERMISSIONS.find((item) => item.id === permission)?.label ?? permission;

export const SUGGESTED_SKILLS = [
  'research',
  'software-development',
  'documentation',
  'project-management',
  'analysis',
];

// Limits mirror server/src/models/agentModel. Keep both sides in sync.
export const AGENT_NAME_MAX = 80;
export const AGENT_ROLE_MAX = 80;
export const AGENT_DESCRIPTION_MAX = 2000;
export const AGENT_SKILLS_MAX = 20;
export const AGENT_SKILL_MAX = 40;
const AGENT_SKILL_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

// Same normalization as the server: "Software Development" becomes "software-development".
export const normalizeSkill = (skill: string) =>
  skill
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, '-');

export const isValidSkill = (skill: string) =>
  skill.length <= AGENT_SKILL_MAX && AGENT_SKILL_PATTERN.test(skill);

// Matches server/src/models/agentModel. Keep both sides in sync.
export interface Agent {
  _id?: string;
  id?: string;
  name: string;
  role: string;
  description: string;
  status: AgentStatus;
  skills: string[];
  permissions: AgentPermission[];
  createdAt?: string;
  updatedAt?: string;
}

export interface AgentInput {
  name: string;
  role: string;
  description?: string;
  status?: AgentStatus;
  skills?: string[];
  permissions?: AgentPermission[];
}

export type AgentUpdate = Partial<AgentInput>;

export const getAgentId = (agent: Agent) => agent._id ?? agent.id ?? '';
