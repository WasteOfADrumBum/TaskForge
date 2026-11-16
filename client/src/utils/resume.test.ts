import { describe, expect, it } from 'vitest';
import type { SavedJob, Skill } from '../types/career';
import { getResumeSkillCheck, mentionsSkill, RESUME_JOB_SKILL_LIMIT } from './resume';

const skill = (name: string): Skill => ({ _id: name, name, level: 'working' });
const job = (requiredSkills: string[], status: SavedJob['status'] = 'saved'): SavedJob => ({
  _id: requiredSkills.join(),
  title: 'Job',
  company: '',
  url: '',
  requiredSkills,
  status,
  notes: '',
});

describe('mentionsSkill', () => {
  it('matches whole words, case-insensitively, with flexible separators', () => {
    expect(mentionsSkill('Built APIs in Node.js and React.', 'node-js')).toBe(true);
    expect(mentionsSkill('NodeJS services', 'node-js')).toBe(true);
    expect(mentionsSkill('node_js', 'node-js')).toBe(true);
    expect(mentionsSkill('Set up CI/CD pipelines', 'ci-cd')).toBe(true);
    expect(mentionsSkill('REACT', 'react')).toBe(true);
    expect(mentionsSkill('Used Preact', 'react')).toBe(false);
    expect(mentionsSkill('reactive streams', 'react')).toBe(false);
    expect(mentionsSkill('go', 'go')).toBe(true);
    expect(mentionsSkill('google', 'go')).toBe(false);
    expect(mentionsSkill('', 'react')).toBe(false);
  });
});

describe('getResumeSkillCheck', () => {
  it('splits your skills by whether the resume mentions them', () => {
    const check = getResumeSkillCheck(
      'React and TypeScript',
      [skill('typescript'), skill('react'), skill('aws')],
      [],
    );
    expect(check.mentioned).toEqual(['react', 'typescript']);
    expect(check.notMentioned).toEqual(['aws']);
  });

  it('lists what open saved jobs need that the resume does not mention', () => {
    const check = getResumeSkillCheck(
      'React',
      [],
      [
        job(['react', 'graphql', 'aws', 'aws']),
        job(['aws', 'docker'], 'applied'),
        job(['kotlin'], 'rejected'),
      ],
    );
    expect(check.jobNeeds).toEqual([
      { skill: 'aws', jobs: 2 },
      { skill: 'docker', jobs: 1 },
      { skill: 'graphql', jobs: 1 },
    ]);
  });

  it('keeps at most the top job needs', () => {
    const many = Array.from({ length: RESUME_JOB_SKILL_LIMIT + 3 }, (_, index) => 'skill-' + index);
    expect(getResumeSkillCheck('', [], [job(many)]).jobNeeds).toHaveLength(RESUME_JOB_SKILL_LIMIT);
  });
});
