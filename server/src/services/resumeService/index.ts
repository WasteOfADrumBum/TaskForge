import { Resume } from '../../models/resumeModel';
import { createRunIndexGuard, RunInputError } from '../runService';

export class ResumeUnavailableError extends Error {}

// Lazy, single-flight creation of the one-resume-per-owner index; no startup writes. Reuses the
// run index guard, which fails closed after a deadline.
const guard = createRunIndexGuard(() =>
  Resume.collection.createIndex({ owner: 1 }, { unique: true, maxTimeMS: 5000 }),
);
export const ensureResumeIndex = async () => {
  try {
    await guard();
  } catch (error) {
    if (error instanceof RunInputError) throw new ResumeUnavailableError();
    throw error;
  }
};

export interface ResumeInput {
  headline: string;
  summary: string;
  body: string;
}

const isDuplicateKey = (error: unknown) =>
  typeof error === 'object' && error !== null && (error as { code?: unknown }).code === 11000;

export const findResumeByOwner = async (ownerId: string) => Resume.findOne({ owner: ownerId });

// Create or replace the owner's resume. Two first saves racing each other can both try to
// insert; the loser hits the unique index and retries as an update.
export const saveResume = async (ownerId: string, input: ResumeInput) => {
  await ensureResumeIndex();
  const write = () =>
    Resume.findOneAndUpdate(
      { owner: ownerId },
      { $set: { headline: input.headline, summary: input.summary, body: input.body } },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true },
    );
  try {
    return await write();
  } catch (error) {
    if (!isDuplicateKey(error)) throw error;
    return write();
  }
};
