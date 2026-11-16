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
    expect(linkedinAbout({ resume, skills: [], goals: [] })).toEqual({
      text: 'I build accessible apps.',
      shortened: false,
    });
    expect(linkedinHeadline({ brand, resume: null, skills: [], goals })).toEqual({
      text: 'Developer who designs',
    });
    expect(linkedinHeadline({ resume: null, skills, goals })).toEqual({
      missing:
        'Add a resume headline on the Career page, or a tagline to your personal brand above.',
    });
  });

  it('keeps the headline under the LinkedIn limit, fewer skills first', () => {
    const text = (draft: ReturnType<typeof linkedinHeadline>) => {
      if (!('text' in draft)) throw new Error('expected a draft');
      return draft;
    };
    const long = text(
      linkedinHeadline({
        resume: { ...resume, headline: 'word '.repeat(60).trim() },
        skills,
        goals,
      }),
    );
    expect(long.text.length).toBeLessThanOrEqual(LINKEDIN_HEADLINE_MAX);
    expect(long.text.endsWith('word')).toBe(true);
    expect(long.shortened).toBe(true);
    // A base with room for one skill but not three keeps the strongest one.
    const base = 'x'.repeat(200);
    expect(
      text(linkedinHeadline({ resume: { ...resume, headline: base }, skills, goals })),
    ).toEqual({
      text: base + ' | node-js',
    });
    const oneWord = text(
      linkedinHeadline({ resume: { ...resume, headline: 'y'.repeat(300) }, skills: [], goals }),
    );
    expect(oneWord.text).toHaveLength(LINKEDIN_HEADLINE_MAX);
  });

  it('breaks ties by name and counts a repeated skill once', () => {
    expect(
      topSkills([
        { name: 'b', level: 'strong' },
        { name: 'a', level: 'strong' },
        { name: 'a', level: 'strong' },
      ]),
    ).toEqual(['a', 'b']);
  });

  it('builds the About section from the summary, skills and career goals', () => {
    expect(linkedinAbout({ brand, resume, skills, goals })).toEqual({
      text:
        'I build accessible apps.\n\nWhat I work with: node-js, accessibility, react, css.' +
        "\n\nWhat I'm working toward: Senior role by June.",
      shortened: false,
    });
    expect(linkedinAbout({ resume: null, skills, goals })).toEqual({
      missing: 'Add a resume summary on the Career page.',
    });
    const long = { ...resume, summary: 'a '.repeat(1400).trim() };
    const draft = linkedinAbout({ resume: long, skills, goals });
    if (!('text' in draft)) throw new Error('expected a draft');
    expect(draft.text.length).toBeLessThanOrEqual(LINKEDIN_ABOUT_MAX);
    expect(draft.shortened).toBe(true);
    // Goals go first when the summary and skills fit but the whole does not.
    const nearly = { ...resume, summary: 'b'.repeat(2500) };
    const dropped = linkedinAbout({ resume: nearly, skills, goals });
    expect(dropped).toEqual({
      text: 'b'.repeat(2500) + '\n\nWhat I work with: node-js, accessibility, react, css.',
      shortened: true,
    });
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
    const lines = githubReadme({
      brand: { ...brand, tagline: '' },
      resume: { ...resume, summary: '- item\n1. one\n    code\n@octocat & ~~x~~' },
      skills: [],
      goals: [],
    });
    expect(lines).toEqual({
      text: "# Hi, I'm Joshua\n\nFull-stack developer\n\n\\- item\n1\\. one\ncode\n\\@octocat \\& \\~\\~x\\~\\~\n",
    });
    expect(githubReadme({ resume, skills, goals })).toEqual({
      missing: 'Save a personal brand with your name above.',
    });
  });
});
