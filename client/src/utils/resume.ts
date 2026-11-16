import type { SavedJob, Skill } from '../types/career';
import { OPEN_JOB_STATUSES } from './skillGrowth';

// Rule-based resume checks against skill names. Nothing here is AI-generated.

export const RESUME_JOB_SKILL_LIMIT = 10;

const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Whether the text mentions a skill slug as a whole word. A hyphen in the slug can match a
// space, dot, underscore or hyphen, or nothing, so "node-js" matches "Node.js" and "NodeJS".
export const mentionsSkill = (text: string, slug: string) => {
  const pattern = slug.split('-').map(escape).join('[\\s._-]?');
  return new RegExp('(^|[^a-z0-9])' + pattern + '($|[^a-z0-9])', 'i').test(text);
};

export interface ResumeSkillCheck {
  // Skills in your inventory that the resume mentions, by name.
  mentioned: string[];
  // Skills in your inventory that the resume does not mention, by name.
  notMentioned: string[];
  // Skills open saved jobs need that the resume does not mention, most needed first.
  jobNeeds: Array<{ skill: string; jobs: number }>;
}

export const getResumeSkillCheck = (
  text: string,
  skills: Skill[],
  jobs: SavedJob[],
): ResumeSkillCheck => {
  const names = [...new Set(skills.map((skill) => skill.name))].sort();
  const mentioned = names.filter((name) => mentionsSkill(text, name));
  const notMentioned = names.filter((name) => !mentioned.includes(name));
  const counts = new Map<string, number>();
  for (const job of jobs.filter((entry) => OPEN_JOB_STATUSES.includes(entry.status))) {
    for (const skill of new Set(job.requiredSkills)) {
      if (!mentionsSkill(text, skill)) counts.set(skill, (counts.get(skill) ?? 0) + 1);
    }
  }
  const jobNeeds = [...counts]
    .map(([skill, count]) => ({ skill, jobs: count }))
    .sort((a, b) => b.jobs - a.jobs || a.skill.localeCompare(b.skill))
    .slice(0, RESUME_JOB_SKILL_LIMIT);
  return { mentioned, notMentioned, jobNeeds };
};
