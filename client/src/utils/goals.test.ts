import { describe, expect, it } from 'vitest';
import type { Goal } from '../types/goal';
import { goalTargetText } from './goals';

const now = new Date(2026, 10, 16, 9); // Nov 16 2026, local morning
const goal = (overrides: Partial<Goal>): Goal => ({
  title: 'Ship',
  description: '',
  status: 'active',
  targetDate: null,
  ...overrides,
});

describe('goalTargetText', () => {
  it('has no line without a target date', () => {
    expect(goalTargetText(goal({}), now)).toBeNull();
  });

  it('names the target, including today, without shifting the day', () => {
    expect(goalTargetText(goal({ targetDate: '2026-11-16T00:00:00.000Z' }), now)).toMatch(
      /^Target .*16/,
    );
  });

  it('says an active goal is past its target, but not an achieved or dropped one', () => {
    const past = '2026-11-15T00:00:00.000Z';
    expect(goalTargetText(goal({ targetDate: past }), now)).toMatch(/^Past target \(/);
    expect(goalTargetText(goal({ targetDate: past, status: 'achieved' }), now)).toMatch(/^Target /);
    expect(goalTargetText(goal({ targetDate: past, status: 'dropped' }), now)).toMatch(/^Target /);
  });
});
