import { SKILL_LEVELS, type SavedJob, type Skill } from '../types/career';
import type { LearningItem } from '../types/learning';
import { getOpenJobGaps, OPEN_JOB_STATUSES } from './skillGrowth';

// Rule-based portfolio-project ideas from skill gaps. Nothing here is AI-generated.

export const PORTFOLIO_IDEA_LIMIT = 3;
// How many of the jobs that want a skill an idea's notes name.
const NAMED_JOBS = 3;

export interface PortfolioIdea {
  // The skill the open saved jobs need and you do not have yet.
  skill: string;
  // The skill you have that those same jobs list most often, or null when none of them do.
  pairWith: string | null;
  // How many open saved jobs list the missing skill.
  jobs: number;
  title: string;
  notes: string;
}

export const portfolioIdeaTitle = (skill: string, pairWith: string | null) =>
  'Portfolio project: ' + skill + (pairWith ? ' with ' + pairWith : '');

const jobName = (job: SavedJob) => (job.company ? job.title + ' at ' + job.company : job.title);

// Up to `limit` ideas, one for each of the skills open saved jobs need most. Each pairs the
// missing skill with the skill you have (at working level or above) that those jobs list most
// often, so the project shows
// something you already do alongside what you are learning. Ties go to the higher level, then
// the name.
export const getPortfolioIdeas = (
  skills: Skill[],
  jobs: SavedJob[],
  limit = PORTFOLIO_IDEA_LIMIT,
): PortfolioIdea[] => {
  const { gaps } = getOpenJobGaps(skills, jobs, limit);
  // A skill you are still learning is not one to show off, so only working level and up pair.
  const levels = new Map(
    skills
      .filter((skill) => skill.level !== 'learning')
      .map((skill) => [skill.name, SKILL_LEVELS.indexOf(skill.level)]),
  );
  const openJobs = jobs.filter((job) => OPEN_JOB_STATUSES.includes(job.status));
  return gaps.map((gap) => {
    const wanting = openJobs.filter((job) => job.requiredSkills.includes(gap.skill));
    const counts = new Map<string, number>();
    for (const job of wanting) {
      for (const name of new Set(job.requiredSkills)) {
        if (levels.has(name)) counts.set(name, (counts.get(name) ?? 0) + 1);
      }
    }
    const [pairWith = null] = [...counts]
      .sort(
        ([nameA, countA], [nameB, countB]) =>
          countB - countA || levels.get(nameB)! - levels.get(nameA)! || nameA.localeCompare(nameB),
      )
      .map(([name]) => name);
    const named = wanting.slice(0, NAMED_JOBS).map(jobName);
    const more = wanting.length - named.length;
    const notes =
      'Build a small project that uses ' +
      gap.skill +
      (pairWith ? ' and shows your ' + pairWith : '') +
      '. Wanted by: ' +
      named.join('; ') +
      (more > 0 ? ' and ' + more + ' more' : '') +
      '.';
    return {
      skill: gap.skill,
      pairWith,
      jobs: gap.jobs,
      title: portfolioIdeaTitle(gap.skill, pairWith),
      notes,
    };
  });
};

// Whether the roadmap already has an unfinished project for a skill.
export const hasOpenProject = (items: LearningItem[], skill: string) =>
  items.some((item) => item.kind === 'project' && item.skill === skill && item.status !== 'done');
