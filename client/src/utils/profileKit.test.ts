import { describe, expect, it } from 'vitest';
import type { BrandProfile } from '../types/brand';
import type { Skill } from '../types/career';
import type { Goal } from '../types/goal';
import type { Resume } from '../types/resume';
import {
  githubReadme,
  LINKEDIN_ABOUT_MAX,
  LINKEDIN_HEADLINE_MAX,
  linkedinAbout,
  linkedinHeadline,
  topSkills,
} from './profileKit';

const brand: BrandProfile = {
  kind: 'personal',
  name: 'Joshua',
  tagline: 'Developer who designs',
  colors: [],
  fonts: [],
  logos: [],
  voice: '',
  writingStyle: '',
  imagePrompts: [],
};
const resume: Resume = {
  headline: 'Full-stack developer',
  summary: 'I build accessible apps.',
  body: '',
};
const skills: Skill[] = [
  { name: 'react', level: 'strong' },
  { name: 'aws', level: 'learning' },
  { name: 'node-js', level: 'expert' },
  { name: 'css', level: 'working' },
  { name: 'accessibility', level: 'strong' },
];
const goal = (title: string, overrides: Partial<Goal> = {}): Goal =>
  ({
    title,
    description: '',
    status: 'active',
    area: 'career',
    targetDate: null,
    ...overrides,
  }) as Goal;
const goals = [
  goal('Senior role by June'),
  goal('Run a 10k', { area: 'general' }),
  goal('Old', { status: 'achieved' }),
];

describe('profile kit', () => {
  it('orders skills strongest first and leaves out ones still being learned', () => {
    expect(topSkills(skills)).toEqual(['node-js', 'accessibility', 'react', 'css']);
  });

  it('builds a LinkedIn headline from the resume headline and top skills', () => {
    expect(linkedinHeadline({ brand, resume, skills, goals })).toEqual({
      text: 'Full-stack developer | node-js · accessibility · react',
    });
    expect(linkedinHeadline({ brand, resume: null, skills: [], goals })).toEqual({
      text: 'Developer who designs',
    });
    expect(linkedinHeadline({ resume: null, skills, goals })).toEqual({
      missing:
        'Add a resume headline on the Career page, or a tagline to your personal brand above.',
    });
  });

  it('keeps the headline under the LinkedIn limit at a word boundary', () => {
    const long = { ...resume, headline: 'word '.repeat(60).trim() };
    const draft = linkedinHeadline({ resume: long, skills, goals });
    expect('text' in draft && draft.text.length).toBeLessThanOrEqual(LINKEDIN_HEADLINE_MAX);
    expect('text' in draft && draft.text.endsWith('word')).toBe(true);
  });

  it('builds the About section from the summary, skills and career goals', () => {
    expect(linkedinAbout({ brand, resume, skills, goals })).toEqual({
      text:
        'I build accessible apps.\n\nWhat I work with: node-js, accessibility, react, css.' +
        "\n\nWhat I'm working toward: Senior role by June.",
    });
    expect(linkedinAbout({ resume: null, skills, goals })).toEqual({
      missing: 'Add a resume summary on the Career page.',
    });
    const long = { ...resume, summary: 'a '.repeat(1400).trim() };
    const draft = linkedinAbout({ resume: long, skills, goals });
    expect('text' in draft && draft.text.length).toBeLessThanOrEqual(LINKEDIN_ABOUT_MAX);
  });

  it('builds an escaped GitHub profile README', () => {
    expect(githubReadme({ brand, resume, skills, goals })).toEqual({
      text: [
        "# Hi, I'm Joshua",
        '',
        'Developer who designs',
        '',
        'I build accessible apps.',
        '',
        '## What I work with',
        '',
        '- node-js',
        '- accessibility',
        '- react',
        '- css',
        '',
        "## What I'm working toward",
        '',
        '- Senior role by June',
        '',
      ].join('\n'),
    });
    const tricky = githubReadme({
      brand: { ...brand, name: '<b>[x](y)', tagline: '' },
      resume: null,
      skills: [],
      goals: [],
    });
    expect(tricky).toEqual({ text: "# Hi, I'm \\<b\\>\\[x\\](y)\n" });
    expect(githubReadme({ resume, skills, goals })).toEqual({
      missing: 'Save a personal brand with your name above.',
    });
  });
});
