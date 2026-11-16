import { LEARNING_NOTES_MAX, LEARNING_TITLE_MAX, LEARNING_URL_MAX, LearningItem } from './index';

// KAN-77: schema-level checks behind the learning controller. validateSync needs no database.
const owner = '507f1f77bcf86cd799439011';
const errorsFor = (data: Record<string, unknown>) =>
  Object.keys(
    new LearningItem({ title: 'Testing Library course', owner, ...data }).validateSync()?.errors ??
      {},
  );

describe('LearningItem model', () => {
  it('defaults to a planned course with no skill, link or target date', () => {
    const item = new LearningItem({ title: '  Testing Library course  ', owner });
    expect(item.validateSync()).toBeUndefined();
    expect(item.title).toBe('Testing Library course');
    expect(item.kind).toBe('course');
    expect(item.status).toBe('planned');
    expect(item.skill).toBe('');
    expect(item.url).toBe('');
    expect(item.targetDate).toBeNull();
    expect(item.completedAt).toBeNull();
  });

  it('requires a title and an owner', () => {
    expect(Object.keys(new LearningItem({}).validateSync()?.errors ?? {}).sort()).toEqual([
      'owner',
      'title',
    ]);
  });

  it('accepts a skill slug and stores a calendar date as UTC midnight', () => {
    const item = new LearningItem({
      title: 'Testing Library course',
      owner,
      skill: 'react-testing',
      targetDate: '2026-12-01',
    });
    expect(item.validateSync()).toBeUndefined();
    expect(item.targetDate?.toISOString()).toBe('2026-12-01T00:00:00.000Z');
  });

  it.each([
    [{ kind: 'podcast' }, 'kind'],
    [{ status: 'started' }, 'status'],
    [{ skill: 'React Testing' }, 'skill'],
    [{ skill: '-react' }, 'skill'],
    [{ title: 'x'.repeat(LEARNING_TITLE_MAX + 1) }, 'title'],
    [{ notes: 'x'.repeat(LEARNING_NOTES_MAX + 1) }, 'notes'],
    [{ url: 'https://example.test/' + 'x'.repeat(LEARNING_URL_MAX) }, 'url'],
    [{ targetDate: '2026-13-01' }, 'targetDate'],
    [{ targetDate: new Date('2026-12-01T09:30:00.000Z') }, 'targetDate'],
  ])('rejects %j on %s', (data, field) => {
    expect(errorsFor(data)).toContain(field);
  });
});
