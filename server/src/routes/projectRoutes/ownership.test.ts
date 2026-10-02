import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../../app';

// Two users against the real routes, middleware, and controllers. The services are replaced by
// an in-memory store with the same owner scoping as the real Mongoose queries (which
// projectService/index.test.ts checks query by query), so these tests prove the HTTP layer
// never lets one user reach the other's projects or attach tasks to them.
type Doc = Record<string, unknown> & { _id: string; owner: string };
const mockDb = { projects: new Map<string, Doc>(), tasks: new Map<string, Doc>(), nextId: 1 };
const mockNewId = () => (mockDb.nextId++).toString(16).padStart(24, 'a');

jest.mock('../../services/projectService', () => ({
  createProject: jest.fn(async (owner: string, data: Record<string, unknown>) => {
    const project = { _id: mockNewId(), status: 'active', description: '', ...data, owner };
    mockDb.projects.set(project._id, project);
    return project;
  }),
  findProjectsByOwner: jest.fn(async (owner: string) =>
    [...mockDb.projects.values()].filter((p) => p.owner === owner),
  ),
  findProjectById: jest.fn(async (owner: string, id: string) => {
    const p = mockDb.projects.get(id);
    return p && p.owner === owner ? p : null;
  }),
  ownsProject: jest.fn(
    async (owner: string, id: string) => mockDb.projects.get(id)?.owner === owner,
  ),
  updateProjectById: jest.fn(
    async (owner: string, id: string, updates: Record<string, unknown>) => {
      const p = mockDb.projects.get(id);
      if (!p || p.owner !== owner) return null;
      Object.assign(p, updates);
      return p;
    },
  ),
  deleteProjectById: jest.fn(async (owner: string, id: string) => {
    const p = mockDb.projects.get(id);
    if (!p || p.owner !== owner) return null;
    for (const t of mockDb.tasks.values())
      if (t.owner === owner && t.project === id) t.project = null;
    mockDb.projects.delete(id);
    return p;
  }),
}));

jest.mock('../../services/taskService', () => ({
  createTask: jest.fn(async (owner: string, data: Record<string, unknown>) => {
    const task = { _id: mockNewId(), project: null, ...data, owner };
    mockDb.tasks.set(task._id, task);
    return task;
  }),
  findTasksByOwner: jest.fn(async (owner: string) =>
    [...mockDb.tasks.values()].filter((t) => t.owner === owner),
  ),
  updateTaskById: jest.fn(async (owner: string, id: string, updates: Record<string, unknown>) => {
    const t = mockDb.tasks.get(id);
    if (!t || t.owner !== owner) return null;
    Object.assign(t, updates);
    return t;
  }),
  deleteTaskById: jest.fn(async (owner: string, id: string) => {
    const t = mockDb.tasks.get(id);
    if (!t || t.owner !== owner) return null;
    mockDb.tasks.delete(id);
    return t;
  }),
}));

const auth = (userId: string) => ({
  Authorization: 'Bearer ' + jwt.sign({ id: userId }, 'test-jwt-secret'),
});
const alice = auth('507f1f77bcf86cd799439011');
const bob = auth('507f1f77bcf86cd799439012');

describe('project ownership across two users', () => {
  let aliceProject: string;
  let aliceTask: string;

  beforeEach(async () => {
    mockDb.projects.clear();
    mockDb.tasks.clear();
    aliceProject = (
      await request(app).post('/api/projects').set(alice).send({ name: 'Alice launch' })
    ).body.project._id;
    aliceTask = (
      await request(app)
        .post('/api/tasks')
        .set(alice)
        .send({ title: 'Alice task', project: aliceProject })
    ).body.task._id;
  });

  it('keeps each user’s project list private', async () => {
    const bobs = await request(app).get('/api/projects').set(bob);
    expect(bobs.body.projects).toEqual([]);
    const alices = await request(app).get('/api/projects').set(alice);
    expect(alices.body.projects.map((p: Doc) => p.name)).toEqual(['Alice launch']);
  });

  it('returns 404 when another user reads, updates, or deletes the project', async () => {
    expect(
      (
        await request(app)
          .get('/api/projects/' + aliceProject)
          .set(bob)
      ).status,
    ).toBe(404);
    expect(
      (
        await request(app)
          .patch('/api/projects/' + aliceProject)
          .set(bob)
          .send({ name: 'Mine' })
      ).status,
    ).toBe(404);
    expect(
      (
        await request(app)
          .delete('/api/projects/' + aliceProject)
          .set(bob)
      ).status,
    ).toBe(404);

    const after = await request(app)
      .get('/api/projects/' + aliceProject)
      .set(alice);
    expect(after.body.project).toMatchObject({ name: 'Alice launch' });
  });

  it('rejects attaching a task to another user’s project, on create and on update', async () => {
    const created = await request(app)
      .post('/api/tasks')
      .set(bob)
      .send({ title: 'Bob task', project: aliceProject });
    expect(created.status).toBe(400);
    expect(created.body).toEqual({ message: 'Project not found' });

    const bobTask = (await request(app).post('/api/tasks').set(bob).send({ title: 'Bob task' }))
      .body.task._id;
    const moved = await request(app)
      .patch('/api/tasks/' + bobTask)
      .set(bob)
      .send({ project: aliceProject });
    expect(moved.status).toBe(400);
    expect(mockDb.tasks.get(bobTask)?.project).toBeNull();
  });

  it('gives the same answer for another user’s project and one that does not exist', async () => {
    const foreign = await request(app)
      .post('/api/tasks')
      .set(bob)
      .send({ title: 'x', project: aliceProject });
    const missing = await request(app)
      .post('/api/tasks')
      .set(bob)
      .send({ title: 'x', project: 'b'.repeat(24) });
    expect([foreign.status, foreign.body]).toEqual([missing.status, missing.body]);
  });

  it('does not let another user move or unassign the owner’s task', async () => {
    const response = await request(app)
      .patch('/api/tasks/' + aliceTask)
      .set(bob)
      .send({ project: null });
    expect(response.status).toBe(404);
    expect(mockDb.tasks.get(aliceTask)?.project).toBe(aliceProject);
  });

  it('moves a task between the owner’s projects and back to unassigned', async () => {
    const second = (
      await request(app).post('/api/projects').set(alice).send({ name: 'Alice second' })
    ).body.project._id;

    const moved = await request(app)
      .patch('/api/tasks/' + aliceTask)
      .set(alice)
      .send({ project: second });
    expect(moved.status).toBe(200);
    expect(moved.body.task.project).toBe(second);

    const removed = await request(app)
      .patch('/api/tasks/' + aliceTask)
      .set(alice)
      .send({ project: null });
    expect(removed.status).toBe(200);
    expect(removed.body.task.project).toBeNull();
  });

  it('deleting a project keeps its tasks and leaves them unassigned', async () => {
    const response = await request(app)
      .delete('/api/projects/' + aliceProject)
      .set(alice);
    expect(response.status).toBe(204);

    const tasks = (await request(app).get('/api/tasks').set(alice)).body.tasks;
    expect(tasks).toHaveLength(1);
    expect(tasks[0]).toMatchObject({ _id: aliceTask, title: 'Alice task', project: null });
    expect(
      (
        await request(app)
          .get('/api/projects/' + aliceProject)
          .set(alice)
      ).status,
    ).toBe(404);
  });
});
