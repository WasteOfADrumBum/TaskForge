import { SavedJob, type JobStatus } from '../../models/jobModel';
import { Skill, type SkillLevel } from '../../models/skillModel';
import { createRunIndexGuard, RunInputError } from '../runService';

// Every query is scoped to the owner, so one user can never read or change another's records.

export class CareerUnavailableError extends Error {}
export class DuplicateSkillError extends Error {}

// One skill per owner and name, enforced by a unique index created lazily on first write.
const guard = createRunIndexGuard(() =>
  Skill.collection.createIndex({ owner: 1, name: 1 }, { unique: true, maxTimeMS: 5000 }),
);
const ensureSkillIndex = async () => {
  try {
    await guard();
  } catch (error) {
    if (error instanceof RunInputError) throw new CareerUnavailableError();
    throw error;
  }
};
const isDuplicateKey = (error: unknown) =>
  typeof error === 'object' && error !== null && (error as { code?: unknown }).code === 11000;

const options = { new: true, runValidators: true };

export interface SkillInput {
  name: string;
  level?: SkillLevel;
}

export const findSkillsByOwner = async (ownerId: string) =>
  Skill.find({ owner: ownerId }).sort({ name: 1 });

export const createSkill = async (ownerId: string, input: SkillInput) => {
  await ensureSkillIndex();
  try {
    return await Skill.create({ ...input, owner: ownerId });
  } catch (error) {
    if (isDuplicateKey(error)) throw new DuplicateSkillError();
    throw error;
  }
};

export const updateSkillById = async (
  ownerId: string,
  skillId: string,
  updates: Partial<SkillInput>,
) => {
  if (updates.name !== undefined) await ensureSkillIndex();
  try {
    return await Skill.findOneAndUpdate({ _id: skillId, owner: ownerId }, updates, options);
  } catch (error) {
    if (isDuplicateKey(error)) throw new DuplicateSkillError();
    throw error;
  }
};

export const deleteSkillById = async (ownerId: string, skillId: string) =>
  Skill.findOneAndDelete({ _id: skillId, owner: ownerId });

export interface JobInput {
  title: string;
  company?: string;
  url?: string;
  requiredSkills?: string[];
  status?: JobStatus;
  notes?: string;
}

export const findJobsByOwner = async (ownerId: string) =>
  SavedJob.find({ owner: ownerId }).sort({ updatedAt: -1 });

export const createJob = async (ownerId: string, input: JobInput) =>
  SavedJob.create({ ...input, owner: ownerId });

export const updateJobById = async (ownerId: string, jobId: string, updates: Partial<JobInput>) =>
  SavedJob.findOneAndUpdate({ _id: jobId, owner: ownerId }, updates, options);

export const deleteJobById = async (ownerId: string, jobId: string) =>
  SavedJob.findOneAndDelete({ _id: jobId, owner: ownerId });
