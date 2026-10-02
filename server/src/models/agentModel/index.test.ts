import { Agent } from './index';

// Schema-level checks, a second line of defense behind the controller. validateSync needs no
// database connection.
const owner = '507f1f77bcf86cd799439011';
const errorsFor = (data: Record<string, unknown>) =>
  Object.keys(
    new Agent({ name: 'Scout', role: 'Researcher', owner, ...data }).validateSync()?.errors ?? {},
  );

describe('Agent model', () => {
  it('defaults to an active agent with no skills or permissions', () => {
    const agent = new Agent({ name: 'Scout', role: 'Researcher', owner });
    expect(agent.validateSync()).toBeUndefined();
    expect(agent.status).toBe('active');
    expect(agent.description).toBe('');
    expect([...agent.skills]).toEqual([]);
    expect([...agent.permissions]).toEqual([]);
  });

  it('requires a name, role, and owner', () => {
    const error = new Agent({}).validateSync();
    expect(Object.keys(error?.errors ?? {}).sort()).toEqual(['name', 'owner', 'role']);
  });

  it.each([
    [{ status: 'running' }, 'status'],
    [{ permissions: ['task.delete'] }, 'permissions.0'],
    [{ skills: ['Not A Slug'] }, 'skills.0'],
    [{ skills: Array.from({ length: 21 }, (_, i) => 'skill-' + i) }, 'skills'],
  ])('rejects %j', (data, path) => {
    expect(errorsFor(data)).toContain(path);
  });
});
