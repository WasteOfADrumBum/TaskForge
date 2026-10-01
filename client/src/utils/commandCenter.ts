import { type Task } from '../types/task';

// Deterministic, task-derived insights for the Command Center. Nothing here is AI-generated.

const DAY_MS = 24 * 60 * 60 * 1000;
const DUE_SOON_DAYS = 3;
const priorityRank = { low: 1, medium: 2, high: 3 } as const;

const startOfDay = (date: Date) => {
  const day = new Date(date);
  day.setHours(0, 0, 0, 0);
  return day;
};

// Reads dueDate the same way as isTaskOverdue (local time), so every view agrees on what is
// overdue, due today, and due soon.
export const daysUntilDue = (task: Task, now: Date = new Date()): number | null => {
  if (!task.dueDate) return null;
  const due = startOfDay(new Date(task.dueDate)).getTime();
  return Math.round((due - startOfDay(now).getTime()) / DAY_MS);
};

const isOpen = (task: Task) => task.status !== 'done';

export type PriorityReason = 'overdue' | 'due-today' | 'high-priority' | 'due-soon';

export interface PriorityItem {
  task: Task;
  reason: PriorityReason;
}

const reasonOrder: Record<PriorityReason, number> = {
  overdue: 0,
  'due-today': 1,
  'high-priority': 2,
  'due-soon': 3,
};

const getPriorityReason = (task: Task, now: Date): PriorityReason | null => {
  if (!isOpen(task)) return null;
  const days = daysUntilDue(task, now);
  if (days !== null && days < 0) return 'overdue';
  if (days === 0) return 'due-today';
  if (task.priority === 'high') return 'high-priority';
  if (days !== null && days <= DUE_SOON_DAYS) return 'due-soon';
  return null;
};

const dueTime = (task: Task) =>
  task.dueDate ? new Date(task.dueDate).getTime() : Number.POSITIVE_INFINITY;

export const getTodaysPriorities = (
  tasks: Task[],
  now: Date = new Date(),
  limit = 5,
): PriorityItem[] =>
  tasks
    .map((task) => ({ task, reason: getPriorityReason(task, now) }))
    .filter((item): item is PriorityItem => item.reason !== null)
    .sort(
      (a, b) =>
        reasonOrder[a.reason] - reasonOrder[b.reason] ||
        dueTime(a.task) - dueTime(b.task) ||
        priorityRank[b.task.priority] - priorityRank[a.task.priority],
    )
    .slice(0, limit);

export interface Recommendation {
  id: string;
  title: string;
  reason: string;
  tone: 'teal' | 'orange' | 'violet';
}

const plural = (count: number, word: string) => count + ' ' + word + (count === 1 ? '' : 's');

export const getRecommendations = (
  tasks: Task[],
  now: Date = new Date(),
  limit = 3,
): Recommendation[] => {
  const open = tasks.filter(isOpen);
  const overdue = open
    .filter((task) => (daysUntilDue(task, now) ?? 0) < 0)
    .sort((a, b) => dueTime(a) - dueTime(b));
  const inProgress = open.filter((task) => task.status === 'in-progress');
  const highNotStarted = open.filter(
    (task) => task.status === 'todo' && task.priority === 'high' && !overdue.includes(task),
  );
  const dueSoon = open.filter((task) => {
    const days = daysUntilDue(task, now);
    return days !== null && days >= 0 && days <= DUE_SOON_DAYS;
  });
  const recommendations: Recommendation[] = [];

  if (overdue.length) {
    const daysLate = -(daysUntilDue(overdue[0], now) ?? 0);
    recommendations.push({
      id: 'overdue',
      title: 'Resolve ' + plural(overdue.length, 'overdue task'),
      reason: '"' + overdue[0].title + '" was due ' + plural(daysLate, 'day') + ' ago.',
      tone: 'orange',
    });
  }
  if (inProgress.length >= 3) {
    recommendations.push({
      id: 'finish-in-progress',
      title: 'Finish work in progress',
      reason:
        plural(inProgress.length, 'task') +
        ' are in progress. Closing one before starting another keeps focus.',
      tone: 'violet',
    });
  } else if (inProgress.length) {
    recommendations.push({
      id: 'continue',
      title: 'Continue "' + inProgress[0].title + '"',
      reason: 'It is already in progress.',
      tone: 'teal',
    });
  }
  if (highNotStarted.length) {
    recommendations.push({
      id: 'start-high',
      title: 'Start "' + highNotStarted[0].title + '"',
      reason: 'High priority and not started yet.',
      tone: 'teal',
    });
  }
  if (dueSoon.length) {
    recommendations.push({
      id: 'due-soon',
      title: 'Plan for ' + plural(dueSoon.length, 'task') + ' due soon',
      reason: 'Due within the next ' + DUE_SOON_DAYS + ' days.',
      tone: 'violet',
    });
  }
  return recommendations.slice(0, limit);
};

export interface ActivityItem {
  task: Task;
  action: 'created' | 'updated';
  at: string;
}

// Derived from task timestamps only; the API does not keep a change history.
export const getRecentActivity = (tasks: Task[], limit = 6): ActivityItem[] =>
  tasks
    .filter((task) => task.updatedAt || task.createdAt)
    .map((task) => {
      const at = (task.updatedAt ?? task.createdAt) as string;
      const action: ActivityItem['action'] =
        !task.updatedAt || task.updatedAt === task.createdAt ? 'created' : 'updated';
      return { task, action, at };
    })
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .slice(0, limit);

export const getGreeting = (now: Date = new Date()) => {
  const hour = now.getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
};
