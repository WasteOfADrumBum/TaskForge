import type { LearningItem, LearningStatus } from '../types/learning';
import { daysUntilDueDate, formatCalendarDate } from './dates';

// Rule-based helpers for the learning roadmap. Nothing here is AI-generated.

export const getLearningId = (item: LearningItem) => item._id ?? item.id ?? '';

// Items in one status: in progress and planned by target date (none last), then title; done
// items newest finished first.
export const learningInStatus = (items: LearningItem[], status: LearningStatus) => {
  const list = items.filter((item) => item.status === status);
  if (status === 'done') {
    // An item missing its completion time sorts last rather than breaking the order.
    const finished = (item: LearningItem) => {
      const time = Date.parse(item.completedAt ?? '');
      return Number.isFinite(time) ? time : -Infinity;
    };
    return list.sort((a, b) => {
      const diff = finished(b) - finished(a);
      return Number.isNaN(diff) ? 0 : diff;
    });
  }
  return list.sort((a, b) => {
    const dateA = a.targetDate ?? '9999';
    const dateB = b.targetDate ?? '9999';
    if (dateA !== dateB) return dateA < dateB ? -1 : 1;
    return a.title.localeCompare(b.title);
  });
};

// The target line in words, so it never depends on color: "Target 12/31/2026", or
// "Past target (12/31/2026)" for an unfinished item whose date has gone by.
export const learningTargetText = (item: LearningItem, now: Date) => {
  if (!item.targetDate) return null;
  const date = formatCalendarDate(item.targetDate);
  const days = daysUntilDueDate(item.targetDate, now);
  if (item.status !== 'done' && days !== null && days < 0) return 'Past target (' + date + ')';
  return 'Target ' + date;
};

// The roadmap title the skill-gap shortcut uses.
export const gapItemTitle = (skill: string) => 'Learn ' + skill;

// Whether the roadmap already has unfinished work for a skill.
export const hasOpenLearning = (items: LearningItem[], skill: string) =>
  items.some((item) => item.skill === skill && item.status !== 'done');
