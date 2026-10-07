import { Schema, model } from 'mongoose';

// An agent is a persistent, user-owned definition of an AI worker. This is registry metadata
// plus explicitly requested, permission-gated text drafts. Agents never apply task/project changes.

export const AGENT_STATUSES = ['active', 'paused', 'disabled'] as const;

// The permission catalog for draft execution and future actions. Current drafts require task.read
// and artifact.draft; project data additionally requires project.read. Write permissions do not apply changes.
export const AGENT_PERMISSIONS = [
  'task.read',
  'task.update',
  'project.read',
  'project.update',
  'artifact.draft',
] as const;

export const AGENT_NAME_MAX = 80;
export const AGENT_ROLE_MAX = 80;
export const AGENT_DESCRIPTION_MAX = 2000;
export const AGENT_SKILLS_MAX = 20;
export const AGENT_SKILL_MAX = 40;
// Skills are lowercase slugs such as `research` or `software-development`.
export const AGENT_SKILL_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const agentSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: AGENT_NAME_MAX },
    role: { type: String, required: true, trim: true, maxlength: AGENT_ROLE_MAX },
    description: { type: String, default: '', trim: true, maxlength: AGENT_DESCRIPTION_MAX },
    status: { type: String, enum: AGENT_STATUSES, default: 'active' },
    skills: {
      type: [{ type: String, maxlength: AGENT_SKILL_MAX, match: AGENT_SKILL_PATTERN }],
      default: [],
      validate: {
        validator: (skills: string[]) => skills.length <= AGENT_SKILLS_MAX,
        message: 'Too many skills',
      },
    },
    permissions: { type: [{ type: String, enum: AGENT_PERMISSIONS }], default: [] },
    owner: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  },
  { timestamps: true },
);

export const Agent = model('Agent', agentSchema);
