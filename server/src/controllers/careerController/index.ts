import type { Request, Response } from 'express';
import {
  JOB_COMPANY_MAX,
  JOB_NOTES_MAX,
  JOB_SKILLS_MAX,
  JOB_STATUSES,
  JOB_TITLE_MAX,
  JOB_URL_MAX,
} from '../../models/jobModel';
import { SKILL_LEVELS } from '../../models/skillModel';
import {
  CareerUnavailableError,
  createJob,
  createSkill,
  deleteJobById,
  deleteSkillById,
  DuplicateSkillError,
  findJobsByOwner,
  findSkillsByOwner,
  updateJobById,
  updateSkillById,
  type JobInput,
  type SkillInput,
} from '../../services/careerService';
import { isObjectIdString } from '../../utils/objectId';
import { toSkillSlug } from '../../utils/skillSlug';

type IdParams = { id: string };
type Fields<T> = { value: T } | { error: string };

const getUserId = (req: Request) => req.userId as string;
const bodyOf = (req: Request) => (req.body ?? {}) as Record<string, unknown>;

// owner, _id and timestamps are never read from a body; only the fields below.

const readSkill = (body: Record<string, unknown>, create: boolean): Fields<Partial<SkillInput>> => {
  const value: Partial<SkillInput> = {};
  if (create || body.name !== undefined) {
    const slug = toSkillSlug(body.name);
    if (!slug) return { error: 'Invalid skill name' };
    value.name = slug;
  }
  if (body.level !== undefined) {
    if (!SKILL_LEVELS.includes(body.level as never)) return { error: 'Invalid skill level' };
    value.level = body.level as SkillInput['level'];
  }
  return { value };
};

const text = (value: unknown, max: number, label: string): Fields<string> => {
  if (typeof value !== 'string') return { error: 'Invalid ' + label };
  if (value.trim().length > max)
    return { error: label[0].toUpperCase() + label.slice(1) + ' is too long' };
  return { value: value.trim() };
};

// Only https links are kept; TaskForge never fetches them.
const readUrl = (value: unknown): Fields<string> => {
  if (value === '' || value === null) return { value: '' };
  if (typeof value !== 'string' || value.length > JOB_URL_MAX) return { error: 'Invalid job link' };
  try {
    const url = new URL(value.trim());
    if (url.protocol !== 'https:' || url.username || url.password) {
      return { error: 'Job link must be an https address' };
    }
    return { value: url.toString() };
  } catch {
    return { error: 'Invalid job link' };
  }
};

const readJob = (body: Record<string, unknown>, create: boolean): Fields<Partial<JobInput>> => {
  const value: Partial<JobInput> = {};
  if (create || body.title !== undefined) {
    const title = text(body.title, JOB_TITLE_MAX, 'job title');
    if ('error' in title) return title;
    if (!title.value) return { error: 'Job title is required' };
    value.title = title.value;
  }
  if (body.company !== undefined) {
    const company = text(body.company, JOB_COMPANY_MAX, 'company');
    if ('error' in company) return company;
    value.company = company.value;
  }
  if (body.notes !== undefined) {
    const notes = text(body.notes, JOB_NOTES_MAX, 'notes');
    if ('error' in notes) return notes;
    value.notes = notes.value;
  }
  if (body.url !== undefined) {
    const url = readUrl(body.url);
    if ('error' in url) return url;
    value.url = url.value;
  }
  if (body.status !== undefined) {
    if (!JOB_STATUSES.includes(body.status as never)) return { error: 'Invalid job status' };
    value.status = body.status as JobInput['status'];
  }
  if (body.requiredSkills !== undefined) {
    if (!Array.isArray(body.requiredSkills)) return { error: 'Skills must be a list' };
    const skills = new Set<string>();
    for (const item of body.requiredSkills) {
      const slug = toSkillSlug(item);
      if (!slug) return { error: 'Invalid skill name' };
      skills.add(slug);
      if (skills.size > JOB_SKILLS_MAX) return { error: 'Too many skills' };
    }
    value.requiredSkills = [...skills];
  }
  return { value };
};

const serverError = (res: Response, error: unknown) => {
  if (error instanceof DuplicateSkillError) {
    return res.status(409).json({ message: 'That skill is already in your list' });
  }
  if (error instanceof CareerUnavailableError) {
    return res.status(503).json({ message: 'Skills are temporarily unavailable' });
  }
  return res.status(500).json({ message: 'Server error' });
};

export const listSkills = async (req: Request, res: Response) => {
  try {
    return res.json({ skills: await findSkillsByOwner(getUserId(req)) });
  } catch (error) {
    return serverError(res, error);
  }
};

export const createSkillHandler = async (req: Request, res: Response) => {
  const fields = readSkill(bodyOf(req), true);
  if ('error' in fields) return res.status(400).json({ message: fields.error });
  try {
    const skill = await createSkill(getUserId(req), fields.value as SkillInput);
    return res.status(201).json({ skill });
  } catch (error) {
    return serverError(res, error);
  }
};

export const updateSkillHandler = async (req: Request<IdParams>, res: Response) => {
  if (!isObjectIdString(req.params.id)) return res.status(404).json({ message: 'Skill not found' });
  const fields = readSkill(bodyOf(req), false);
  if ('error' in fields) return res.status(400).json({ message: fields.error });
  try {
    const skill = await updateSkillById(getUserId(req), req.params.id, fields.value);
    if (!skill) return res.status(404).json({ message: 'Skill not found' });
    return res.json({ skill });
  } catch (error) {
    return serverError(res, error);
  }
};

export const deleteSkillHandler = async (req: Request<IdParams>, res: Response) => {
  if (!isObjectIdString(req.params.id)) return res.status(404).json({ message: 'Skill not found' });
  try {
    const skill = await deleteSkillById(getUserId(req), req.params.id);
    if (!skill) return res.status(404).json({ message: 'Skill not found' });
    return res.status(204).send();
  } catch (error) {
    return serverError(res, error);
  }
};

export const listJobs = async (req: Request, res: Response) => {
  try {
    return res.json({ jobs: await findJobsByOwner(getUserId(req)) });
  } catch (error) {
    return serverError(res, error);
  }
};

export const createJobHandler = async (req: Request, res: Response) => {
  const fields = readJob(bodyOf(req), true);
  if ('error' in fields) return res.status(400).json({ message: fields.error });
  try {
    const job = await createJob(getUserId(req), fields.value as JobInput);
    return res.status(201).json({ job });
  } catch (error) {
    return serverError(res, error);
  }
};

export const updateJobHandler = async (req: Request<IdParams>, res: Response) => {
  if (!isObjectIdString(req.params.id)) return res.status(404).json({ message: 'Job not found' });
  const fields = readJob(bodyOf(req), false);
  if ('error' in fields) return res.status(400).json({ message: fields.error });
  try {
    const job = await updateJobById(getUserId(req), req.params.id, fields.value);
    if (!job) return res.status(404).json({ message: 'Job not found' });
    return res.json({ job });
  } catch (error) {
    return serverError(res, error);
  }
};

export const deleteJobHandler = async (req: Request<IdParams>, res: Response) => {
  if (!isObjectIdString(req.params.id)) return res.status(404).json({ message: 'Job not found' });
  try {
    const job = await deleteJobById(getUserId(req), req.params.id);
    if (!job) return res.status(404).json({ message: 'Job not found' });
    return res.status(204).send();
  } catch (error) {
    return serverError(res, error);
  }
};
