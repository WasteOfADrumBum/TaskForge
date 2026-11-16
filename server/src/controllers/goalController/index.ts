import type { Request, Response } from 'express';
import {
  GOAL_AREAS,
  GOAL_DESCRIPTION_MAX,
  GOAL_STATUSES,
  GOAL_TITLE_MAX,
} from '../../models/goalModel';
import {
  createGoal,
  deleteGoalById,
  findGoalsByOwner,
  updateGoalById,
  type GoalUpdate,
} from '../../services/goalService';
import { normalizeCalendarDate } from '../../utils/calendarDate';
import { isObjectIdString } from '../../utils/objectId';

type GoalParams = { id: string };

const getUserId = (req: Request) => req.userId as string;
const notFound = (res: Response) => res.status(404).json({ message: 'Goal not found' });

// Validated, normalized fields from the body: only the fields that are present, or an error.
// owner, _id, achievedAt and timestamps are never read from the body.
const readGoalFields = (
  body: Record<string, unknown>,
  requireTitle: boolean,
): { value: GoalUpdate } | { error: string } => {
  const { title, description, status, area, targetDate } = body;
  const value: GoalUpdate = {};
  if (requireTitle || title !== undefined) {
    if (typeof title !== 'string' || !title.trim()) return { error: 'Goal title is required' };
    if (title.trim().length > GOAL_TITLE_MAX) return { error: 'Goal title is too long' };
    value.title = title.trim();
  }
  if (description !== undefined) {
    if (typeof description !== 'string') return { error: 'Invalid goal description' };
    if (description.trim().length > GOAL_DESCRIPTION_MAX) {
      return { error: 'Goal description is too long' };
    }
    value.description = description;
  }
  if (status !== undefined) {
    if (!GOAL_STATUSES.includes(status as never)) return { error: 'Invalid goal status' };
    value.status = status as GoalUpdate['status'];
  }
  if (area !== undefined) {
    if (!GOAL_AREAS.includes(area as never)) return { error: 'Invalid goal area' };
    value.area = area as GoalUpdate['area'];
  }
  if (targetDate !== undefined) {
    if (targetDate === null || targetDate === '') value.targetDate = null;
    else {
      const normalized = normalizeCalendarDate(targetDate);
      if (normalized === null) return { error: 'Invalid target date' };
      value.targetDate = normalized;
    }
  }
  return { value };
};

export const listGoals = async (req: Request, res: Response) => {
  try {
    return res.json({ goals: await findGoalsByOwner(getUserId(req)) });
  } catch {
    return res.status(500).json({ message: 'Server error' });
  }
};

export const createGoalHandler = async (req: Request, res: Response) => {
  const fields = readGoalFields((req.body ?? {}) as Record<string, unknown>, true);
  if ('error' in fields) return res.status(400).json({ message: fields.error });
  try {
    const goal = await createGoal(getUserId(req), {
      ...fields.value,
      title: fields.value.title as string,
    });
    return res.status(201).json({ goal });
  } catch {
    return res.status(500).json({ message: 'Server error' });
  }
};

export const updateGoalHandler = async (req: Request<GoalParams>, res: Response) => {
  if (!isObjectIdString(req.params.id)) return notFound(res);
  const fields = readGoalFields((req.body ?? {}) as Record<string, unknown>, false);
  if ('error' in fields) return res.status(400).json({ message: fields.error });
  try {
    const goal = await updateGoalById(getUserId(req), req.params.id, fields.value);
    if (!goal) return notFound(res);
    return res.json({ goal });
  } catch {
    return res.status(500).json({ message: 'Server error' });
  }
};

export const deleteGoalHandler = async (req: Request<GoalParams>, res: Response) => {
  if (!isObjectIdString(req.params.id)) return notFound(res);
  try {
    const goal = await deleteGoalById(getUserId(req), req.params.id);
    if (!goal) return notFound(res);
    return res.status(204).send();
  } catch {
    return res.status(500).json({ message: 'Server error' });
  }
};
