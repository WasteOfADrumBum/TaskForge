// Keep in sync with server/src/models/goalModel.
export type GoalStatus = 'active' | 'achieved' | 'dropped';
export const GOAL_STATUSES: GoalStatus[] = ['active', 'achieved', 'dropped'];
export const GOAL_TITLE_MAX = 120;
export const GOAL_DESCRIPTION_MAX = 2000;
export const goalStatusLabel: Record<GoalStatus, string> = {
  active: 'Active',
  achieved: 'Achieved',
  dropped: 'Dropped',
};

export interface Goal {
  _id?: string;
  id?: string;
  title: string;
  description: string;
  status: GoalStatus;
  // A calendar date as UTC midnight, like task due dates, or null.
  targetDate: string | null;
  // Set by the server when the goal becomes achieved; null otherwise.
  achievedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface GoalInput {
  title: string;
  description?: string;
  targetDate?: string | null;
}

export type GoalUpdate = Partial<GoalInput> & { status?: GoalStatus };

export const getGoalId = (goal: Goal) => goal._id ?? goal.id ?? '';
