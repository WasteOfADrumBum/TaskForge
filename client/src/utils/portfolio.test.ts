import { describe, expect, it } from 'vitest';
import type { SavedJob, Skill, SkillLevel } from '../types/career';
import type { LearningItem } from '../types/learning';
import { getPortfolioIdeas, hasOpenProject, portfolioIdeaTitle } from './portfolio';

const skill = (name: string, level: SkillLevel = 'working'): Skill => ({ name, level });
const job = (
  title: string,
  requiredSkills: string[],
  status: SavedJob['status'] = 'saved',
  company = '',
): SavedJob => ({ title, company, url: '', requiredSkills, status, notes: '' });

describe('portfolio ideas', () => {
  it('pairs each top gap with the held skill its jobs list most', () => {
    const ideas = getPortfolioIdeas(
      [skill('react'), skill('node-js', 'strong')],
      [
        job('Frontend', ['react', 'graphql'], 'saved', 'Acme'),
        job('Fullstack', ['react', 'node-js', 'graphql'], 'applied'),
        job('Backend', ['node-js', 'docker'], 'interviewing'),
        job('Old', ['kotlin', 'react'], 'closed'),
      ],
    );
    expect(ideas).toEqual([
      {
        skill: 'graphql',
        pairWith: 'react',
        jobs: 2,
        title: 'Portfolio project: graphql with react',
        notes:
          'Build a small project that uses graphql and shows your react. Wanted by: Frontend at Acme; Fullstack.',
      },
      {
        skill: 'docker',
        pairWith: 'node-js',
        jobs: 1,
        title: 'Portfolio project: docker with node-js',
        notes: 'Build a small project that uses docker and shows your node-js. Wanted by: Backend.',
      },
    ]);
  });

  it('breaks pairing ties by level, then name, and works with no held skill', () => {
    const [tied] = getPortfolioIdeas(
      [skill('css'), skill('vue', 'expert'), skill('html', 'expert')],
      [job('Web', ['rust', 'css', 'vue', 'html'])],
    );
    expect(tied.pairWith).toBe('html');
    const [alone] = getPortfolioIdeas([skill('css')], [job('Systems', ['rust'])]);
    expect(alone).toMatchObject({ pairWith: null, title: 'Portfolio project: rust' });
    expect(alone.notes).toBe('Build a small project that uses rust. Wanted by: Systems.');
  });

  it('names three jobs, counts the rest and keeps to the limit', () => {
    const jobs = ['A', 'B', 'C', 'D', 'E'].map((title) => job(title, ['go', 'a' + title]));
    const ideas = getPortfolioIdeas([], jobs, 2);
    expect(ideas).toHaveLength(2);
    expect(ideas[0].notes).toBe(
      'Build a small project that uses go. Wanted by: A; B; C and 2 more.',
    );
    expect(getPortfolioIdeas([], [job('Closed', ['go'], 'rejected')])).toEqual([]);
  });

  it('builds titles and finds open projects for a skill', () => {
    expect(portfolioIdeaTitle('go', null)).toBe('Portfolio project: go');
    const base: LearningItem = {
      title: 'x',
      skill: 'go',
      kind: 'project',
      url: '',
      status: 'planned',
      targetDate: null,
      notes: '',
    };
    expect(hasOpenProject([base], 'go')).toBe(true);
    expect(hasOpenProject([{ ...base, status: 'done' }], 'go')).toBe(false);
    expect(hasOpenProject([{ ...base, kind: 'course' }], 'go')).toBe(false);
    expect(hasOpenProject([base], 'rust')).toBe(false);
  });
});
