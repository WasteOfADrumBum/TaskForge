import { LearningItem, type LearningKind, type LearningStatus } from '../../models/learningModel';

export interface LearningInput {
  title: string;
  skill?: string;
  kind?: LearningKind;
  url?: string;
  status?: LearningStatus;
  targetDate?: string | null;
  notes?: string;
}

export type LearningUpdate = Partial<LearningInput>;

const options = { new: true, runValidators: true };

// Every query is scoped to the owner, so one user can never read or change another's items.

export const findLearningByOwner = async (ownerId: string) =>
  LearningItem.find({ owner: ownerId }).sort({ createdAt: -1 });

export const createLearningItem = async (ownerId: string, input: LearningInput) =>
  LearningItem.create({
    ...input,
    owner: ownerId,
    completedAt: input.status === 'done' ? new Date() : null,
  });

// completedAt follows status the same way a task's does: stamped on entering done, kept while
// it stays done, cleared on leaving it. Each write filters on the status it expects, and the
// pair retries once if a concurrent change lands between them.
export const updateLearningItemById = async (
  ownerId: string,
  itemId: string,
  updates: LearningUpdate,
) => {
  const owned = { _id: itemId, owner: ownerId };
  if (updates.status === undefined) return LearningItem.findOneAndUpdate(owned, updates, options);
  if (updates.status !== 'done') {
    return LearningItem.findOneAndUpdate(owned, { ...updates, completedAt: null }, options);
  }
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const newly = await LearningItem.findOneAndUpdate(
      { ...owned, status: { $ne: 'done' } },
      { ...updates, completedAt: new Date() },
      options,
    );
    if (newly) return newly;
    const still = await LearningItem.findOneAndUpdate(
      { ...owned, status: 'done' },
      updates,
      options,
    );
    if (still) return still;
    if (!(await LearningItem.exists(owned))) return null;
  }
  return LearningItem.findOne(owned);
};

export const deleteLearningItemById = async (ownerId: string, itemId: string) =>
  LearningItem.findOneAndDelete({ _id: itemId, owner: ownerId });
