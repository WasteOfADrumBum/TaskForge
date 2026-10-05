import { Task } from './index';

// Schema-level checks for the assignee fields, a second line of defense behind the controller.
// validateSync needs no database connection.
const owner = '507f1f77bcf86cd799439011';
const agentId = '507f1f77bcf86cd799439031';
const errorsFor = (data: Record<string, unknown>) =>
  Object.keys(new Task({ title: 'Write notes', owner, ...data }).validateSync()?.errors ?? {});

describe('Task model assignee', () => {
  it('defaults to an unassigned task', () => {
    const task = new Task({ title: 'Write notes', owner });
    expect(task.validateSync()).toBeUndefined();
    expect(task.assigneeType).toBeNull();
    expect(task.assigneeAgent).toBeNull();
  });

  it.each([
    [{ assigneeType: null, assigneeAgent: null }],
    [{ assigneeType: 'user', assigneeAgent: null }],
    [{ assigneeType: 'agent', assigneeAgent: agentId }],
  ])('accepts %j', (data) => {
    expect(errorsFor(data)).toEqual([]);
  });

  it.each([
    [{ assigneeType: 'team' }, 'assigneeType'],
    [{ assigneeAgent: 'not-an-id' }, 'assigneeAgent'],
  ])('rejects %j', (data, path) => {
    expect(errorsFor(data)).toContain(path);
  });
});

describe('Task model content and calendar validation', () => {
  it.each([
    [{ title: 't'.repeat(121) }, 'title'],
    [{ description: 'd'.repeat(2001) }, 'description'],
  ])('rejects content beyond the schema limit', (data, path) => {
    expect(errorsFor(data)).toContain(path);
  });

  it.each([
    '1900-02-29',
    '2025-02-29',
    '2024-02-30',
    '2026-04-31',
    '2026-10-05T12:00:00.000Z',
    '2026-10-05T00:00:00.000+00:00',
    '',
    '0000-01-01',
    false,
    0,
    {},
    [],
  ])('rejects raw invalid date %j without rollover casting', (dueDate) => {
    expect(errorsFor({ dueDate })).toContain('dueDate');
  });

  it.each(['2024-02-29', '2000-02-29', '0001-01-01', '0099-12-31', '2026-10-05T00:00:00.000Z'])(
    'accepts valid raw calendar %s and preserves its year',
    (dueDate) => {
      const task = new Task({ title: 'Task', owner, dueDate });
      expect(task.validateSync()).toBeUndefined();
      expect(task.dueDate?.toISOString()).toBe(
        dueDate.length === 10 ? dueDate + 'T00:00:00.000Z' : dueDate,
      );
    },
  );

  it('allows null and UTC-midnight Date instances used by the demo seed', () => {
    expect(errorsFor({ dueDate: null })).toEqual([]);
    expect(errorsFor({ dueDate: new Date('2026-10-05T00:00:00.000Z') })).toEqual([]);
    expect(errorsFor({ dueDate: new Date('2026-10-05T12:00:00.000Z') })).toContain('dueDate');
    expect(errorsFor({ dueDate: new Date(NaN) })).toContain('dueDate');
  });
});
