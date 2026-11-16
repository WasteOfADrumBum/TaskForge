import type { SavedJob, Skill } from '../types/career';
import type { Task } from '../types/task';

// Mirrors server/src/utils/skillSlug: "Node JS" and "node_js" become "node-js".
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const toSkillSlug = (value: string): string | null => {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, '-');
  return slug && slug.length <= 40 && SLUG.test(slug) ? slug : null;
};

// "React, Type Script, react" becomes ["react", "type-script"], or the first bad entry.
export const parseSkillList = (value: string): { skills: string[] } | { invalid: string } => {
  const skills = new Set<string>();
  for (const part of value.split(',')) {
    if (!part.trim()) continue;
    const slug = toSkillSlug(part);
    if (!slug) return { invalid: part.trim() };
    skills.add(slug);
  }
  return { skills: [...skills] };
};

// Rule-based: a required skill counts as held when your inventory has the same slug.
export const getSkillGap = (job: SavedJob, skills: Skill[]) => {
  const held = new Set(skills.map((skill) => skill.name));
  return {
    have: job.requiredSkills.filter((skill) => held.has(skill)),
    missing: job.requiredSkills.filter((skill) => !held.has(skill)),
  };
};

export const learningTaskTitle = (skill: string, job: SavedJob) =>
  ('Learn ' + skill + ' for ' + job.title).slice(0, 120);

// Whether that learning task is already in the task list (any status).
export const hasLearningTask = (tasks: Task[], skill: string, job: SavedJob) => {
  const title = learningTaskTitle(skill, job);
  return tasks.some((task) => task.title === title);
};

// The link to render for a saved job, or null. The server only stores https links; this keeps
// any other value (for example an old or hand-edited record) out of an href.
export const safeHttpsUrl = (value: string): string | null => {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password ? url.toString() : null;
  } catch {
    return null;
  }
};
