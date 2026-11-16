import { describe, expect, it } from 'vitest';
import type { SavedJob, Skill } from '../types/career';
import type { Task } from '../types/task';
import {
  getSkillGap,
  hasLearningTask,
  learningTaskTitle,
  parseSkillList,
  toSkillSlug,
} from './career';

const job = (overrides: Partial<SavedJob> = {}): SavedJob => ({
  _id: 'j1',
  title: 'Frontend Engineer',
  company: '',
  url: '',
  requiredSkills: ['react', 'typescript', 'graphql'],
  status: 'saved',
  notes: '',
  ...overrides,
});
const skill = (name: string): Skill => ({ _id: name, name, level: 'working' });

describe('career utilities', () => {
  it('turns names into the same slugs as the server', () => {
    expect(toSkillSlug('  Node JS ')).toBe('node-js');
    expect(toSkillSlug('node_js')).toBe('node-js');
    expect(toSkillSlug('C++')).toBeNull();
    expect(toSkillSlug('trailing-')).toBeNull();
    expect(toSkillSlug('x'.repeat(41))).toBeNull();
  });

  it('parses a comma list into unique slugs, skipping blanks, or names the bad entry', () => {
    expect(parseSkillList('React, Type Script, react, , ')).toEqual({
      skills: ['react', 'type-script'],
    });
    expect(parseSkillList('react, C#')).toEqual({ invalid: 'C#' });
    expect(parseSkillList('')).toEqual({ skills: [] });
  });

  it('splits a job’s required skills into those you have and those you are missing', () => {
    expect(getSkillGap(job(), [skill('react'), skill('docker')])).toEqual({
      have: ['react'],
      missing: ['typescript', 'graphql'],
    });
    expect(getSkillGap(job({ requiredSkills: [] }), [])).toEqual({ have: [], missing: [] });
  });

  it('names learning tasks consistently and spots one that already exists', () => {
    expect(learningTaskTitle('graphql', job())).toBe('Learn graphql for Frontend Engineer');
    expect(learningTaskTitle('graphql', job({ title: 't'.repeat(200) }))).toHaveLength(120);
    const tasks = [
      { _id: 't1', title: 'Learn graphql for Frontend Engineer', status: 'done' } as Task,
    ];
    expect(hasLearningTask(tasks, 'graphql', job())).toBe(true);
    expect(hasLearningTask(tasks, 'typescript', job())).toBe(false);
  });
});
