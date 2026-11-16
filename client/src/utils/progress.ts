import type { Project } from '../types/project';
import { getProjectId } from '../types/project';
import type { Task } from '../types/task';
import { localCalendarDate, toCalendarDate } from './dates';

export type ProgressRange = 7 | 28;
export const PROGRESS_RANGES: ProgressRange[] = [7, 28];
export const TOP_PROJECT_LIMIT = 5;

export interface ProgressBucket {
  // First and last local calendar dates in the bucket, "YYYY-MM-DD", inclusive.
  start: string;
  end: string;
  completed: number;
}

export interface ProjectProgress {
  // null groups tasks that have no project, or whose project is no longer loaded.
  projectId: string | null;
  name: string;
  completed: number;
}

export interface ProgressSummary {
  range: ProgressRange;
  // One bucket per day for 7 days, one per week (oldest first) for 28 days.
  buckets: ProgressBucket[];
  completed: number;
  previousCompleted: number;
  created: number;
  // Completed tasks in range that had a due date, and how many of those finished on or before it.
  withDueDate: number;
  onTime: number;
  // Done tasks with no recorded completion time (finished before TaskForge recorded one).
  unknownCompletion: number;
  byProject: ProjectProgress[];
}

// Local calendar date `offset` days from `now`. Built from local year/month/day so daylight
// saving changes never skip or repeat a day.
const shiftDay = (now: Date, offset: number) =>
  localCalendarDate(new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset));

// The local calendar date of a stored moment, or null if it is missing or invalid.
const localDateOf = (value: string | null | undefined) => {
  if (!value) return null;
  const time = Date.parse(value);
  return Number.isFinite(time) ? localCalendarDate(new Date(time)) : null;
};

// "YYYY-MM-DD" strings compare correctly as text for four-digit years.
const within = (date: string, start: string, end: string) => date >= start && date <= end;

// Rule-based progress figures from the owner's own tasks. Only a recorded completion time
// counts as a completion; nothing is inferred from updatedAt.
export const getProgressSummary = (
  tasks: Task[],
  projects: Project[],
  range: ProgressRange,
  now: Date,
): ProgressSummary => {
  const today = shiftDay(now, 0);
  const start = shiftDay(now, -(range - 1));
  const previousStart = shiftDay(now, -(2 * range - 1));
  const previousEnd = shiftDay(now, -range);
  const bucketDays = range === 7 ? 1 : 7;
  const buckets: ProgressBucket[] = [];
  for (let offset = -(range - 1); offset <= 0; offset += bucketDays) {
    buckets.push({
      start: shiftDay(now, offset),
      end: shiftDay(now, offset + bucketDays - 1),
      completed: 0,
    });
  }
  const projectNames = new Map(projects.map((project) => [getProjectId(project), project.name]));
  const perProject = new Map<string | null, number>();
  const summary: ProgressSummary = {
    range,
    buckets,
    completed: 0,
    previousCompleted: 0,
    created: 0,
    withDueDate: 0,
    onTime: 0,
    unknownCompletion: 0,
    byProject: [],
  };

  for (const task of tasks) {
    const createdOn = localDateOf(task.createdAt);
    if (createdOn && within(createdOn, start, today)) summary.created += 1;
    if (task.status !== 'done') continue;
    const completedOn = localDateOf(task.completedAt);
    if (!completedOn) {
      summary.unknownCompletion += 1;
      continue;
    }
    if (within(completedOn, previousStart, previousEnd)) summary.previousCompleted += 1;
    if (!within(completedOn, start, today)) continue;
    summary.completed += 1;
    buckets.find((bucket) => within(completedOn, bucket.start, bucket.end))!.completed += 1;
    const due = toCalendarDate(task.dueDate);
    if (due) {
      summary.withDueDate += 1;
      if (completedOn <= due) summary.onTime += 1;
    }
    const projectId = task.project && projectNames.has(task.project) ? task.project : null;
    perProject.set(projectId, (perProject.get(projectId) ?? 0) + 1);
  }

  summary.byProject = [...perProject]
    .map(([projectId, completed]) => ({
      projectId,
      name: projectId === null ? 'No project' : projectNames.get(projectId)!,
      completed,
    }))
    // Most completions first; ties by name so the order is stable.
    .sort((a, b) => b.completed - a.completed || a.name.localeCompare(b.name))
    .slice(0, TOP_PROJECT_LIMIT);
  return summary;
};
