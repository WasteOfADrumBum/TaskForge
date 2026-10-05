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
