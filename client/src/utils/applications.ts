import type { JobStatus, SavedJob } from '../types/career';
import type { Task } from '../types/task';
import { daysUntilDueDate, formatCalendarDate, localCalendarDate } from './dates';

// Rule-based application tracking from saved jobs. Nothing here is AI-generated.

export type ApplicationStatus = Extract<JobStatus, 'applied' | 'interviewing' | 'offer'>;
export const APPLICATION_STATUSES: ApplicationStatus[] = ['applied', 'interviewing', 'offer'];
// An application still "applied" this many days after it was sent is due a follow-up.
export const FOLLOW_UP_DAYS = 14;

export interface Application {
  job: SavedJob;
  status: ApplicationStatus;
  // The local calendar date the status last changed, as YYYY-MM-DD, or null when unknown.
  since: string | null;
  // Whole local days since then, or null when unknown.
  days: number | null;
  needsFollowUp: boolean;
}

const sinceDate = (value?: string | null) => {
  if (!value) return null;
  const time = Date.parse(value);
  return Number.isFinite(time) ? localCalendarDate(new Date(time)) : null;
};

const isApplication = (job: SavedJob): job is SavedJob & { status: ApplicationStatus } =>
  APPLICATION_STATUSES.includes(job.status as ApplicationStatus);

// Counts by status and the active applications, longest unchanged first; ones with no known date
// come last, then by title.
export const getApplications = (jobs: SavedJob[], now: Date) => {
  const counts: Record<ApplicationStatus, number> = { applied: 0, interviewing: 0, offer: 0 };
  const active: Application[] = jobs.filter(isApplication).map((job) => {
    counts[job.status] += 1;
    const since = sinceDate(job.statusChangedAt);
    const until = since === null ? null : daysUntilDueDate(since, now);
    const days = until === null ? null : Math.max(0, -until);
    return {
      job,
      status: job.status,
      since,
      days,
      needsFollowUp: job.status === 'applied' && days !== null && days >= FOLLOW_UP_DAYS,
    };
  });
  active.sort((a, b) => {
    if (a.since !== b.since) {
      if (a.since === null) return 1;
      if (b.since === null) return -1;
      return a.since < b.since ? -1 : 1;
    }
    return a.job.title.localeCompare(b.job.title);
  });
  return { counts, active };
};

// "Since 11/2/2026 (14 days)", "Since 11/16/2026 (today)", or null when the date is unknown.
export const applicationSinceText = (application: Application) => {
  if (application.since === null || application.days === null) return null;
  const date = formatCalendarDate(application.since);
  const ago =
    application.days === 0
      ? 'today'
      : application.days === 1
        ? '1 day'
        : application.days + ' days';
  return 'Since ' + date + ' (' + ago + ')';
};

export const followUpTaskTitle = (job: SavedJob) =>
  ('Follow up on ' + job.title + (job.company ? ' at ' + job.company : '')).slice(0, 120);

// Whether that follow-up task is already in the task list (any status).
export const hasFollowUpTask = (tasks: Task[], job: SavedJob) => {
  const title = followUpTaskTitle(job);
  return tasks.some((task) => task.title === title);
};
