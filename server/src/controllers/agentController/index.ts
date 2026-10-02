import type { Request, Response } from 'express';
import {
  AGENT_DESCRIPTION_MAX,
  AGENT_NAME_MAX,
  AGENT_PERMISSIONS,
  AGENT_ROLE_MAX,
  AGENT_SKILL_MAX,
  AGENT_SKILL_PATTERN,
  AGENT_SKILLS_MAX,
  AGENT_STATUSES,
} from '../../models/agentModel';
import {
  createAgent,
  deleteAgentById,
  findAgentById,
  findAgentsByOwner,
  updateAgentById,
  type AgentInput,
  type AgentPermission,
  type AgentUpdate,
} from '../../services/agentService';
import { isObjectIdString } from '../../utils/objectId';

type AgentParams = { id: string };
type ParseResult = { value: AgentUpdate } | { error: string };

const getUserId = (req: Request) => req.userId as string;
const notFound = (res: Response) => res.status(404).json({ message: 'Agent not found' });

// "Software Development" and "software_development" both become "software-development".
const normalizeSkill = (skill: string) =>
  skill
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, '-');

const parseSkills = (skills: unknown): string[] | string => {
  if (!Array.isArray(skills)) return 'Skills must be a list';
  const normalized = new Set<string>();
  for (const skill of skills) {
    if (typeof skill !== 'string') return 'Invalid skill';
    const value = normalizeSkill(skill);
    if (!value || value.length > AGENT_SKILL_MAX || !AGENT_SKILL_PATTERN.test(value)) {
      return 'Invalid skill';
    }
    normalized.add(value);
    // Stop early, so an oversized list can't keep the request busy.
    if (normalized.size > AGENT_SKILLS_MAX) return 'Too many skills';
  }
  return [...normalized];
};

const parsePermissions = (permissions: unknown): AgentPermission[] | string => {
  if (!Array.isArray(permissions)) return 'Permissions must be a list';
  const valid: AgentPermission[] = [];
  for (const permission of permissions) {
    if (!AGENT_PERMISSIONS.includes(permission as never)) return 'Invalid agent permission';
    if (!valid.includes(permission)) valid.push(permission);
  }
  return valid;
};

const parseText = (value: unknown, label: string, max: number): string | { error: string } => {
  if (typeof value !== 'string' || !value.trim()) return { error: `Agent ${label} is required` };
  if (value.trim().length > max) return { error: `Agent ${label} is too long` };
  return value.trim();
};

// Validates and normalizes only the client-controlled fields. Anything else in the body,
// including `owner`, is ignored. On create, name and role are required.
const parseAgentFields = (body: Record<string, unknown>, isCreate: boolean): ParseResult => {
  const value: AgentUpdate = {};
  for (const [field, max] of [
    ['name', AGENT_NAME_MAX],
    ['role', AGENT_ROLE_MAX],
  ] as const) {
    if (!isCreate && body[field] === undefined) continue;
    const text = parseText(body[field], field, max);
    if (typeof text !== 'string') return text;
    value[field] = text;
  }
  if (body.description !== undefined) {
    if (typeof body.description !== 'string') return { error: 'Invalid agent description' };
    if (body.description.trim().length > AGENT_DESCRIPTION_MAX) {
      return { error: 'Agent description is too long' };
    }
    value.description = body.description.trim();
  }
  if (body.status !== undefined) {
    if (!AGENT_STATUSES.includes(body.status as never)) return { error: 'Invalid agent status' };
    value.status = body.status as AgentUpdate['status'];
  }
  if (body.skills !== undefined) {
    const skills = parseSkills(body.skills);
    if (typeof skills === 'string') return { error: skills };
    value.skills = skills;
  }
  if (body.permissions !== undefined) {
    const permissions = parsePermissions(body.permissions);
    if (typeof permissions === 'string') return { error: permissions };
    value.permissions = permissions;
  }
  return { value };
};

export const listAgents = async (req: Request, res: Response) => {
  try {
    const agents = await findAgentsByOwner(getUserId(req));
    return res.json({ agents });
  } catch {
    return res.status(500).json({ message: 'Server error' });
  }
};

export const getAgentHandler = async (req: Request<AgentParams>, res: Response) => {
  if (!isObjectIdString(req.params.id)) return notFound(res);
  try {
    const agent = await findAgentById(getUserId(req), req.params.id);
    if (!agent) return notFound(res);
    return res.json({ agent });
  } catch {
    return res.status(500).json({ message: 'Server error' });
  }
};

export const createAgentHandler = async (req: Request, res: Response) => {
  const parsed = parseAgentFields((req.body ?? {}) as Record<string, unknown>, true);
  if ('error' in parsed) return res.status(400).json({ message: parsed.error });

  try {
    const agent = await createAgent(getUserId(req), parsed.value as AgentInput);
    return res.status(201).json({ agent });
  } catch {
    return res.status(500).json({ message: 'Server error' });
  }
};

export const updateAgentHandler = async (req: Request<AgentParams>, res: Response) => {
  if (!isObjectIdString(req.params.id)) return notFound(res);
  const parsed = parseAgentFields((req.body ?? {}) as Record<string, unknown>, false);
  if ('error' in parsed) return res.status(400).json({ message: parsed.error });

  try {
    // An update with no recognized fields changes nothing, so it must not bump `updatedAt`.
    const agent = Object.keys(parsed.value).length
      ? await updateAgentById(getUserId(req), req.params.id, parsed.value)
      : await findAgentById(getUserId(req), req.params.id);
    if (!agent) return notFound(res);
    return res.json({ agent });
  } catch {
    return res.status(500).json({ message: 'Server error' });
  }
};

export const deleteAgentHandler = async (req: Request<AgentParams>, res: Response) => {
  if (!isObjectIdString(req.params.id)) return notFound(res);
  try {
    const agent = await deleteAgentById(getUserId(req), req.params.id);
    if (!agent) return notFound(res);
    return res.status(204).send();
  } catch {
    return res.status(500).json({ message: 'Server error' });
  }
};
