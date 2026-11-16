import { describe, expect, it } from 'vitest';
import type { LearningItem } from '../types/learning';
import { gapItemTitle, hasOpenLearning, learningInStatus, learningTargetText } from './learning';

const now = new Date(2026, 10, 18, 15); // Wed Nov 18 2026, local
const item = (overrides: Partial<LearningItem> & { title: string }): LearningItem => ({
  _id: overrides.title,
  skill: '',
  kind: 'course',
  url: '',
  status: 'planned',
  targetDate: null,
  notes: '',
  ...overrides,
});

describe('learning helpers', () => {
  it('orders unfinished items by target date, undated last, then title', () => {
    const items = [
      item({ title: 'No date B' }),
      item({ title: 'Late', targetDate: '2026-12-31T00:00:00.000Z' }),
      item({ title: 'No date A' }),
      item({ title: 'Soon', targetDate: '2026-11-20T00:00:00.000Z' }),
      item({ title: 'Started', status: 'in_progress' }),
    ];
    expect(learningInStatus(items, 'planned').map((entry) => entry.title)).toEqual([
      'Soon',
      'Late',
      'No date A',
      'No date B',
    ]);
    expect(learningInStatus(items, 'in_progress').map((entry) => entry.title)).toEqual(['Started']);
  });

  it('orders done items newest finished first', () => {
    const items = [
      item({ title: 'Old', status: 'done', completedAt: '2026-10-01T10:00:00.000Z' }),
      item({ title: 'Legacy', status: 'done', completedAt: null }),
      item({ title: 'New', status: 'done', completedAt: '2026-11-17T10:00:00.000Z' }),
    ];
    expect(learningInStatus(items, 'done').map((entry) => entry.title)).toEqual([
      'New',
      'Old',
      'Legacy',
    ]);
  });

  it('says in words when an unfinished item is past its target', () => {
    const past = '2026-11-10T00:00:00.000Z';
    expect(learningTargetText(item({ title: 'A' }), now)).toBeNull();
    expect(learningTargetText(item({ title: 'A', targetDate: past }), now)).toMatch(
      /^Past target \(/,
    );
    expect(learningTargetText(item({ title: 'A', targetDate: past, status: 'done' }), now)).toMatch(
      /^Target /,
    );
    expect(
      learningTargetText(item({ title: 'A', targetDate: '2026-11-18T00:00:00.000Z' }), now),
    ).toMatch(/^Target /);
  });

  it('knows which skills already have unfinished roadmap work', () => {
    const items = [
      item({ title: 'A', skill: 'graphql' }),
      item({ title: 'B', skill: 'aws', status: 'done' }),
    ];
    expect(hasOpenLearning(items, 'graphql')).toBe(true);
    expect(hasOpenLearning(items, 'aws')).toBe(false);
    expect(gapItemTitle('aws')).toBe('Learn aws');
  });
});
