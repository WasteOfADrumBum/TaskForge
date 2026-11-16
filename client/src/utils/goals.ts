import type { Goal } from '../types/goal';
import { daysUntilDueDate, formatCalendarDate } from './dates';

// The target line in words, so it never depends on color: "Target 12/31/2026", or
// "Past target (12/31/2026)" for an active goal whose date has gone by.
export const goalTargetText = (goal: Goal, now: Date) => {
  if (!goal.targetDate) return null;
  const date = formatCalendarDate(goal.targetDate);
  const days = daysUntilDueDate(goal.targetDate, now);
  if (goal.status === 'active' && days !== null && days < 0) return 'Past target (' + date + ')';
  return 'Target ' + date;
};
