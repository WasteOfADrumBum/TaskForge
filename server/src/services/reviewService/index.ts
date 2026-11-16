import { Review, type ReviewKind } from '../../models/reviewModel';
import { Task } from '../../models/taskModel';
import { createRunIndexGuard, RunInputError } from '../runService';

export class ReviewUnavailableError extends Error {}

// Lazy, single-flight creation of the one-review-per-period index on this new collection; no
// startup writes. Reuses the run index guard, which fails closed after a deadline.
const guard = createRunIndexGuard(() =>
  Review.collection.createIndex(
    { owner: 1, kind: 1, period: -1 },
    { unique: true, maxTimeMS: 5000 },
  ),
);
export const ensureReviewIndex = async () => {
  try {
    await guard();
  } catch (error) {
    if (error instanceof RunInputError) throw new ReviewUnavailableError();
    throw error;
  }
};

export interface ReviewInput {
  reflection: string;
  focusTasks: string[];
}

// Whether every id is one of the owner's own tasks.
export const ownsAllTasks = async (ownerId: string, taskIds: string[]) =>
  taskIds.length === 0 ||
  (await Task.countDocuments({ _id: { $in: taskIds }, owner: ownerId })) === taskIds.length;

const isDuplicateKey = (error: unknown) =>
  typeof error === 'object' && error !== null && (error as { code?: unknown }).code === 11000;

// Create or replace the owner's review for this kind and period. Saving the same review twice
// leaves one document. Two first saves racing each other can both try to insert; the loser hits
// the unique index and retries as an update.
export const saveReview = async (
  ownerId: string,
  kind: ReviewKind,
  period: string,
  input: ReviewInput,
) => {
  await ensureReviewIndex();
  const write = () =>
    Review.findOneAndUpdate(
      { owner: ownerId, kind, period },
      { $set: { reflection: input.reflection, focusTasks: input.focusTasks } },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true },
    );
  try {
    return await write();
  } catch (error) {
    if (!isDuplicateKey(error)) throw error;
    return write();
  }
};

export const findReviewsByOwner = async (
  ownerId: string,
  kind: ReviewKind | undefined,
  limit: number,
) =>
  Review.find(kind ? { owner: ownerId, kind } : { owner: ownerId })
    .sort({ period: -1, kind: 1 })
    .limit(limit);
