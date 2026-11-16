import { Goal, type GoalStatus } from '../../models/goalModel';

export interface GoalInput {
  title: string;
  description?: string;
  status?: GoalStatus;
  targetDate?: string | null;
}

export type GoalUpdate = Partial<GoalInput>;

const options = { new: true, runValidators: true };

// Every query is scoped to the owner, so one user can never read or change another's goals.

export const findGoalsByOwner = async (ownerId: string) =>
  Goal.find({ owner: ownerId }).sort({ createdAt: -1 });

export const createGoal = async (ownerId: string, input: GoalInput) =>
  Goal.create({
    ...input,
    owner: ownerId,
    achievedAt: input.status === 'achieved' ? new Date() : null,
  });

// achievedAt follows status the same way a task's completedAt does: stamped on entering
// achieved, kept while it stays achieved, cleared on leaving it. Each write filters on the
// status it expects, and the pair retries once if a concurrent change lands between them.
export const updateGoalById = async (ownerId: string, goalId: string, updates: GoalUpdate) => {
  const owned = { _id: goalId, owner: ownerId };
  if (updates.status === undefined) return Goal.findOneAndUpdate(owned, updates, options);
  if (updates.status !== 'achieved') {
    return Goal.findOneAndUpdate(owned, { ...updates, achievedAt: null }, options);
  }
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const newly = await Goal.findOneAndUpdate(
      { ...owned, status: { $ne: 'achieved' } },
      { ...updates, achievedAt: new Date() },
      options,
    );
    if (newly) return newly;
    const still = await Goal.findOneAndUpdate({ ...owned, status: 'achieved' }, updates, options);
    if (still) return still;
    if (!(await Goal.exists(owned))) return null;
  }
  return Goal.findOne(owned);
};

export const deleteGoalById = async (ownerId: string, goalId: string) =>
  Goal.findOneAndDelete({ _id: goalId, owner: ownerId });
