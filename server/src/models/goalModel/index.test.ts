import { Goal, GOAL_DESCRIPTION_MAX, GOAL_TITLE_MAX } from './index';

// KAN-77: schema-level checks behind the goal controller. validateSync needs no database.
const owner = '507f1f77bcf86cd799439011';
const errorsFor = (data: Record<string, unknown>) =>
  Object.keys(new Goal({ title: 'Ship v1', owner, ...data }).validateSync()?.errors ?? {});

describe('Goal model', () => {
  it('defaults to an active general goal with no target date', () => {
    const goal = new Goal({ title: '  Ship v1  ', owner });
    expect(goal.validateSync()).toBeUndefined();
    expect(goal.title).toBe('Ship v1');
    expect(goal.status).toBe('active');
    expect(goal.area).toBe('general');
    expect(goal.description).toBe('');
    expect(goal.targetDate).toBeNull();
    expect(goal.achievedAt).toBeNull();
  });

  it('requires a title and an owner', () => {
    expect(Object.keys(new Goal({}).validateSync()?.errors ?? {}).sort()).toEqual([
      'owner',
      'title',
    ]);
  });

  it('stores a calendar date as UTC midnight', () => {
    const goal = new Goal({ title: 'Ship v1', owner, targetDate: '2026-12-31' });
    expect(goal.validateSync()).toBeUndefined();
    expect(goal.targetDate?.toISOString()).toBe('2026-12-31T00:00:00.000Z');
    const kept = new Date('2027-01-15T00:00:00.000Z');
    expect(new Goal({ title: 'Ship v1', owner, targetDate: kept }).targetDate).toEqual(kept);
  });

  it.each([
    [{ status: 'paused' }, 'status'],
    [{ area: 'finance' }, 'area'],
    [{ title: 'x'.repeat(GOAL_TITLE_MAX + 1) }, 'title'],
    [{ description: 'x'.repeat(GOAL_DESCRIPTION_MAX + 1) }, 'description'],
    [{ targetDate: '2026-02-30' }, 'targetDate'],
    [{ targetDate: 'next week' }, 'targetDate'],
    [{ targetDate: new Date('2026-12-31T15:00:00.000Z') }, 'targetDate'],
  ])('rejects %j on %s', (data, field) => {
    expect(errorsFor(data)).toContain(field);
  });

  it.each([
    [{ title: 'x'.repeat(GOAL_TITLE_MAX) }],
    [{ description: 'x'.repeat(GOAL_DESCRIPTION_MAX) }],
  ])('accepts %j at exactly the length limit', (data) => {
    expect(errorsFor(data)).toEqual([]);
  });
});
