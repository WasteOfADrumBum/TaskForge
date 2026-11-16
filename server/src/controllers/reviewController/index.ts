import type { Request, Response } from 'express';
import {
  REVIEW_FOCUS_MAX,
  REVIEW_KINDS,
  REVIEW_REFLECTION_MAX,
  type ReviewKind,
} from '../../models/reviewModel';
import {
  findReviewsByOwner,
  ownsAllTasks,
  ReviewUnavailableError,
  saveReview,
} from '../../services/reviewService';
import { normalizeCalendarDate } from '../../utils/calendarDate';
import { isObjectIdString } from '../../utils/objectId';

type ReviewParams = { kind: string; period: string };

export const REVIEW_LIST_DEFAULT = 14;
export const REVIEW_LIST_MAX = 30;

const getUserId = (req: Request) => req.userId as string;
const isKind = (value: unknown): value is ReviewKind => REVIEW_KINDS.includes(value as never);

// A plain "YYYY-MM-DD" that is a real calendar date (and a Monday for a weekly review).
const isValidPeriod = (kind: ReviewKind, period: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(period)) return false;
  const normalized = normalizeCalendarDate(period);
  if (!normalized) return false;
  return kind === 'daily' || new Date(normalized).getUTCDay() === 1;
};

export const listReviews = async (req: Request, res: Response) => {
  const { kind, limit } = req.query;
  if (kind !== undefined && !isKind(kind)) {
    return res.status(400).json({ message: 'Invalid review kind' });
  }
  let count = REVIEW_LIST_DEFAULT;
  if (limit !== undefined) {
    count = typeof limit === 'string' && /^\d{1,2}$/.test(limit) ? Number(limit) : 0;
    if (count < 1 || count > REVIEW_LIST_MAX) {
      return res.status(400).json({ message: 'Invalid review limit' });
    }
  }
  try {
    const reviews = await findReviewsByOwner(getUserId(req), kind, count);
    return res.json({ reviews });
  } catch {
    return res.status(500).json({ message: 'Server error' });
  }
};

export const saveReviewHandler = async (req: Request<ReviewParams>, res: Response) => {
  const { kind, period } = req.params;
  if (!isKind(kind)) return res.status(400).json({ message: 'Invalid review kind' });
  if (!isValidPeriod(kind, period)) {
    return res.status(400).json({
      message:
        kind === 'weekly' ? 'A weekly review period must be a Monday' : 'Invalid review date',
    });
  }
  const body = (req.body ?? {}) as Record<string, unknown>;
  const { reflection = '', focusTasks = [] } = body;
  if (typeof reflection !== 'string') {
    return res.status(400).json({ message: 'Invalid reflection' });
  }
  if (reflection.trim().length > REVIEW_REFLECTION_MAX) {
    return res.status(400).json({ message: 'Reflection is too long' });
  }
  if (!Array.isArray(focusTasks) || !focusTasks.every(isObjectIdString)) {
    return res.status(400).json({ message: 'Invalid focus tasks' });
  }
  const unique = [...new Set(focusTasks as string[])];
  if (unique.length > REVIEW_FOCUS_MAX[kind]) {
    return res
      .status(400)
      .json({ message: 'Choose at most ' + REVIEW_FOCUS_MAX[kind] + ' focus tasks' });
  }
  try {
    const userId = getUserId(req);
    if (!(await ownsAllTasks(userId, unique))) {
      return res.status(400).json({ message: 'Task not found' });
    }
    const review = await saveReview(userId, kind, period, {
      reflection: reflection.trim(),
      focusTasks: unique,
    });
    return res.json({ review });
  } catch (error) {
    if (error instanceof ReviewUnavailableError) {
      return res.status(503).json({ message: 'Reviews are temporarily unavailable' });
    }
    return res.status(500).json({ message: 'Server error' });
  }
};
