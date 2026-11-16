// Skill names are slugs, the same rule as agent skills: "Node JS" and "node_js" become
// "node-js". Matching a job's required skills against the user's skills compares these slugs.
export const SKILL_SLUG_MAX = 40;
export const SKILL_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const toSkillSlug = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, '-');
  return slug && slug.length <= SKILL_SLUG_MAX && SKILL_SLUG_PATTERN.test(slug) ? slug : null;
};
