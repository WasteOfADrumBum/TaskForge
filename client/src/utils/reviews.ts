import type { ReviewKind } from '../types/review';
import type { Task } from '../types/task';
import { getTaskId } from '../types/task';
import { daysUntilDueDate, localCalendarDate, toCalendarDate } from './dates';

// Rule-based inputs for the guided daily and weekly reviews. Nothing here is AI-generated.

export const FOCUS_CANDIDATE_LIMIT = 15;
const priorityRank = { low: 1, medium: 2, high: 3 } as const;

const dayAt = (now: Date, offset: number) =>
  new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset);

const daysSinceMonday = (now: Date) => (now.getDay() + 6) % 7;

// The Monday of the local week containing `now`, as "YYYY-MM-DD".
export const weekStart = (now: Date) => localCalendarDate(dayAt(now, -daysSinceMonday(now)));

// The period a review of this kind covers today: the local date, or this week's Monday.
export const reviewPeriod = (kind: ReviewKind, now: Date) =>
  kind === 'daily' ? localCalendarDate(now) : weekStart(now);

// Last calendar date of the period ("YYYY-MM-DD").
const periodEnd = (kind: ReviewKind, now: Date) =>
  localCalendarDate(kind === 'daily' ? now : dayAt(now, 6 - daysSinceMonday(now)));

const completedOn = (task: Task) => {
  if (task.status !== 'done' || !task.completedAt) return null;
  const time = Date.parse(task.completedAt);
  return Number.isFinite(time) ? localCalendarDate(new Date(time)) : null;
};

// Earliest due date first, no due date last, then higher priority, then title.
const compareOpen = (a: Task, b: Task) => {
  const dueA = toCalendarDate(a.dueDate) ?? '9999-12-31';
  const dueB = toCalendarDate(b.dueDate) ?? '9999-12-31';
  if (dueA !== dueB) return dueA < dueB ? -1 : 1;
  return priorityRank[b.priority] - priorityRank[a.priority] || a.title.localeCompare(b.title);
};

export interface ReviewData {
  period: string;
  // Tasks completed in the period, most recent first.
  completed: Task[];
  // Open tasks that are overdue or due by the end of the period.
  attention: Task[];
  // Open tasks to choose focus from: earliest due first, capped at FOCUS_CANDIDATE_LIMIT, but
  // always including tasks already chosen in a saved review.
  candidates: Task[];
}

export const getReviewData = (
  tasks: Task[],
  kind: ReviewKind,
  now: Date,
  chosen: string[] = [],
): ReviewData => {
  const period = reviewPeriod(kind, now);
  const end = periodEnd(kind, now);
  const completed = tasks
    .filter((task) => {
      const date = completedOn(task);
      return date !== null && date >= period && date <= end;
    })
    .sort((a, b) => Date.parse(b.completedAt!) - Date.parse(a.completedAt!));
  const open = tasks.filter((task) => task.status !== 'done').sort(compareOpen);
  // Daily: overdue or due today. Weekly: overdue or due by Sunday.
  const horizon = kind === 'daily' ? 0 : 6 - daysSinceMonday(now);
  const attention = open.filter((task) => {
    const days = daysUntilDueDate(task.dueDate, now);
    return days !== null && days <= horizon;
  });
  const chosenSet = new Set(chosen);
  const candidates = open.filter(
    (task, index) => index < FOCUS_CANDIDATE_LIMIT || chosenSet.has(getTaskId(task)),
  );
  return { period, completed, attention, candidates };
};
