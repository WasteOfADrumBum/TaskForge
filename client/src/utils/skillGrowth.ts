import type { JobStatus, SavedJob, Skill } from '../types/career';
import type { Task } from '../types/task';
import { learningTaskTitle } from './career';
import { localCalendarDate } from './dates';
import { weekStart } from './reviews';

// Rule-based inputs for the weekly review's skill-growth step. Nothing here is AI-generated.

export const OPEN_JOB_STATUSES: JobStatus[] = ['saved', 'applied', 'interviewing'];
export const TOP_GAP_LIMIT = 5;

export interface SkillGap {
  skill: string;
  // How many open saved jobs list this skill and you do not have it.
  jobs: number;
}

export interface SkillGrowth {
  // Skills added to the inventory this week, by name.
  added: Skill[];
  // Older skills updated this week (usually a level change), by name.
  updated: Skill[];
  // Learning tasks made from a saved job's skill gap and finished this week, newest first.
  learned: Task[];
  // The skills most often missing across open saved jobs, most needed first.
  topGaps: SkillGap[];
  // Whether any saved job is still open (saved, applied or interviewing).
  hasOpenJobs: boolean;
}

const localDay = (value?: string | null) => {
  if (!value) return null;
  const time = Date.parse(value);
  return Number.isFinite(time) ? localCalendarDate(new Date(time)) : null;
};

const byName = (a: Skill, b: Skill) => a.name.localeCompare(b.name);

export const getSkillGrowth = (
  skills: Skill[],
  jobs: SavedJob[],
  tasks: Task[],
  now: Date,
): SkillGrowth => {
  const start = weekStart(now);
  const daysSinceMonday = (now.getDay() + 6) % 7;
  const end = localCalendarDate(
    new Date(now.getFullYear(), now.getMonth(), now.getDate() + 6 - daysSinceMonday),
  );
  const inWeek = (value?: string | null) => {
    const day = localDay(value);
    return day !== null && day >= start && day <= end;
  };

  const added = skills.filter((skill) => inWeek(skill.createdAt)).sort(byName);
  // An older skill saved again this week. That is usually a new level, but the record does not
  // keep the previous level, so this says "updated" rather than claiming a change.
  const updated = skills
    .filter(
      (skill) =>
        !inWeek(skill.createdAt) && inWeek(skill.updatedAt) && skill.updatedAt !== skill.createdAt,
    )
    .sort(byName);

  // Matched against current saved jobs, so a learning task drops out if its job is deleted or
  // renamed afterwards.
  const learningTitles = new Set(
    jobs.flatMap((job) => job.requiredSkills.map((skill) => learningTaskTitle(skill, job))),
  );
  const learned = tasks
    .filter(
      (task) =>
        task.status === 'done' && inWeek(task.completedAt) && learningTitles.has(task.title),
    )
    .sort((a, b) => Date.parse(b.completedAt!) - Date.parse(a.completedAt!));

  const held = new Set(skills.map((skill) => skill.name));
  const openJobs = jobs.filter((job) => OPEN_JOB_STATUSES.includes(job.status));
  const counts = new Map<string, number>();
  for (const job of openJobs) {
    for (const skill of new Set(job.requiredSkills)) {
      if (!held.has(skill)) counts.set(skill, (counts.get(skill) ?? 0) + 1);
    }
  }
  const topGaps = [...counts]
    .map(([skill, count]) => ({ skill, jobs: count }))
    .sort((a, b) => b.jobs - a.jobs || a.skill.localeCompare(b.skill))
    .slice(0, TOP_GAP_LIMIT);

  return { added, updated, learned, topGaps, hasOpenJobs: openJobs.length > 0 };
};
