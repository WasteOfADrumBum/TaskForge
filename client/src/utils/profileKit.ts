import type { BrandProfile } from '../types/brand';
import { SKILL_LEVELS, type Skill } from '../types/career';
import type { Goal } from '../types/goal';
import type { Resume } from '../types/resume';
import { escapeMarkdown } from './brand';

// Rule-based profile drafts from data the user already saved. Nothing here is AI-generated,
// and nothing is invented: a draft that lacks what it needs says what to add instead.

export const LINKEDIN_HEADLINE_MAX = 220;
export const LINKEDIN_ABOUT_MAX = 2600;
const TOP_SKILLS = 6;
const HEADLINE_SKILLS = 3;

export interface ProfileKitInput {
  brand?: BrandProfile;
  resume: Resume | null;
  skills: Skill[];
  goals: Goal[];
}

export type Draft = { text: string } | { missing: string };

// Skills at working level or above, strongest first, then by name.
export const topSkills = (skills: Skill[], limit = TOP_SKILLS) =>
  skills
    .filter((skill) => skill.level !== 'learning')
    .sort(
      (a, b) =>
        SKILL_LEVELS.indexOf(b.level) - SKILL_LEVELS.indexOf(a.level) ||
        a.name.localeCompare(b.name),
    )
    .slice(0, limit)
    .map((skill) => skill.name);

const careerGoals = (goals: Goal[]) =>
  goals
    .filter((goal) => goal.status === 'active' && goal.area === 'career')
    .map((goal) => goal.title);

// Cuts at a word boundary so the result fits, without a trailing separator.
const fit = (text: string, max: number) => {
  if (text.length <= max) return text;
  const cut = text.slice(0, max + 1);
  const space = cut.lastIndexOf(' ');
  return (space > 0 ? cut.slice(0, space) : text.slice(0, max)).replace(/[\s|·,;:-]+$/, '');
};

export const linkedinHeadline = ({ brand, resume, skills }: ProfileKitInput): Draft => {
  const base = resume?.headline.trim() || brand?.tagline.trim() || '';
  if (!base) {
    return {
      missing:
        'Add a resume headline on the Career page, or a tagline to your personal brand above.',
    };
  }
  const top = topSkills(skills, HEADLINE_SKILLS);
  const withSkills = top.length ? base + ' | ' + top.join(' · ') : base;
  return {
    text:
      withSkills.length <= LINKEDIN_HEADLINE_MAX ? withSkills : fit(base, LINKEDIN_HEADLINE_MAX),
  };
};

export const linkedinAbout = ({ resume, skills, goals }: ProfileKitInput): Draft => {
  const summary = resume?.summary.trim() ?? '';
  if (!summary) return { missing: 'Add a resume summary on the Career page.' };
  const top = topSkills(skills);
  const aims = careerGoals(goals);
  const paragraphs = [
    summary,
    top.length ? 'What I work with: ' + top.join(', ') + '.' : '',
    aims.length ? "What I'm working toward: " + aims.join('; ') + '.' : '',
  ].filter(Boolean);
  // Whole paragraphs are dropped from the end first, so no sentence is cut mid-way unless the
  // summary alone is too long.
  while (paragraphs.length > 1 && paragraphs.join('\n\n').length > LINKEDIN_ABOUT_MAX) {
    paragraphs.pop();
  }
  return { text: fit(paragraphs.join('\n\n'), LINKEDIN_ABOUT_MAX) };
};

export const githubReadme = ({ brand, resume, skills, goals }: ProfileKitInput): Draft => {
  const name = brand?.name.trim() ?? '';
  if (!name) return { missing: 'Save a personal brand with your name above.' };
  const tagline = brand?.tagline.trim() || resume?.headline.trim() || '';
  const summary = resume?.summary.trim() ?? '';
  const top = topSkills(skills);
  const aims = careerGoals(goals);
  const lines = [
    "# Hi, I'm " + escapeMarkdown(name),
    '',
    ...(tagline ? [escapeMarkdown(tagline), ''] : []),
    ...(summary ? [...summary.split('\n').map(escapeMarkdown), ''] : []),
    ...(top.length
      ? ['## What I work with', '', ...top.map((skill) => '- ' + escapeMarkdown(skill)), '']
      : []),
    ...(aims.length
      ? ["## What I'm working toward", '', ...aims.map((aim) => '- ' + escapeMarkdown(aim)), '']
      : []),
  ];
  return { text: lines.join('\n').trimEnd() + '\n' };
};
