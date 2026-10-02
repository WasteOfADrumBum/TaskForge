import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../../app';

// Two users against the real routes, middleware, and controllers. The services are replaced by
// an in-memory store with the same owner scoping as the real Mongoose queries (which
// agentService/index.test.ts checks query by query), so these tests prove the HTTP layer never
// lets one user reach the other's agents.
type Doc = Record<string, unknown> & { _id: string; owner: string };
const mockDb = {
  agents: new Map<string, Doc>(),
  projects: new Map<string, Doc>(),
  tasks: new Map<string, Doc>(),
  nextId: 1,
};
const mockNewId = () => (mockDb.nextId++).toString(16).padStart(24, 'a');
const mockScoped = (store: Map<string, Doc>, owner: string, id: string) => {
  const doc = store.get(id);
  return doc && doc.owner === owner ? doc : null;
};

jest.mock('../../services/agentService', () => ({
  createAgent: jest.fn(async (owner: string, data: Record<string, unknown>) => {
    const agent = { _id: mockNewId(), status: 'active', skills: [], permissions: [], ...data };
    const stored = { ...agent, owner };
    mockDb.agents.set(stored._id, stored);
    return stored;
  }),
  findAgentsByOwner: jest.fn(async (owner: string) =>
    [...mockDb.agents.values()].filter((a) => a.owner === owner),
  ),
  findAgentById: jest.fn(async (owner: string, id: string) => mockScoped(mockDb.agents, owner, id)),
  updateAgentById: jest.fn(async (owner: string, id: string, updates: Record<string, unknown>) => {
    const agent = mockScoped(mockDb.agents, owner, id);
    if (agent) Object.assign(agent, updates);
    return agent;
  }),
  deleteAgentById: jest.fn(async (owner: string, id: string) => {
    const agent = mockScoped(mockDb.agents, owner, id);
    if (agent) mockDb.agents.delete(id);
    return agent;
  }),
}));

jest.mock('../../services/projectService', () => ({
  createProject: jest.fn(async (owner: string, data: Record<string, unknown>) => {
    const project = { _id: mockNewId(), status: 'active', description: '', ...data, owner };
    mockDb.projects.set(project._id, project);
    return project;
  }),
  findProjectsByOwner: jest.fn(async (owner: string) =>
    [...mockDb.projects.values()].filter((p) => p.owner === owner),
  ),
  ownsProject: jest.fn(async (owner: string, id: string) =>
    Boolean(mockScoped(mockDb.projects, owner, id)),
  ),
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
    const task = mockScoped(mockDb.tasks, owner, id);
    if (task) Object.assign(task, updates);
    return task;
  }),
}));

const auth = (userId: string) => ({
  Authorization: 'Bearer ' + jwt.sign({ id: userId }, 'test-jwt-secret'),
});
const aliceId = '507f1f77bcf86cd799439011';
const alice = auth(aliceId);
const bob = auth('507f1f77bcf86cd799439012');

describe('agent ownership across two users', () => {
  let aliceAgent: string;

  beforeEach(async () => {
    mockDb.agents.clear();
    mockDb.projects.clear();
    mockDb.tasks.clear();
    aliceAgent = (
      await request(app)
        .post('/api/agents')
        .set(alice)
        .send({ name: 'Scout', role: 'Researcher', permissions: ['task.read'] })
    ).body.agent._id;
  });

  it('keeps each user’s agent list private', async () => {
    const bobs = await request(app).get('/api/agents').set(bob);
    expect(bobs.status).toBe(200);
    expect(bobs.body.agents).toEqual([]);
    const alices = await request(app).get('/api/agents').set(alice);
    expect(alices.body.agents.map((a: Doc) => a.name)).toEqual(['Scout']);
  });

  it('stores a new agent under the signed-in user, even if the body names another owner', async () => {
    const created = await request(app)
      .post('/api/agents')
      .set(bob)
      .send({ name: 'Mole', role: 'Spy', owner: aliceId });
    expect(created.status).toBe(201);
    expect(mockDb.agents.get(created.body.agent._id)?.owner).toBe('507f1f77bcf86cd799439012');
    const alices = await request(app).get('/api/agents').set(alice);
    expect(alices.body.agents.map((a: Doc) => a.name)).toEqual(['Scout']);
  });

  it('returns the same 404 to another user as for an agent that does not exist', async () => {
    const missing = 'b'.repeat(24);
    for (const [method, body] of [
      ['get', undefined],
      ['patch', { name: 'Mine', owner: '507f1f77bcf86cd799439012' }],
      ['delete', undefined],
    ] as const) {
      const foreign = await request(app)
        [method]('/api/agents/' + aliceAgent)
        .set(bob)
        .send(body);
      const absent = await request(app)
        [method]('/api/agents/' + missing)
        .set(bob)
        .send(body);
      expect(foreign.status).toBe(404);
      expect([foreign.status, foreign.body]).toEqual([absent.status, absent.body]);
    }

    const after = await request(app)
      .get('/api/agents/' + aliceAgent)
      .set(alice);
    expect(after.body.agent).toMatchObject({ name: 'Scout', owner: aliceId });
  });

  it('cannot move an agent to another owner through an update', async () => {
    const response = await request(app)
      .patch('/api/agents/' + aliceAgent)
      .set(alice)
      .send({ owner: '507f1f77bcf86cd799439012', status: 'paused' });
    expect(response.status).toBe(200);
    expect(mockDb.agents.get(aliceAgent)).toMatchObject({ owner: aliceId, status: 'paused' });
  });

  it('cannot attach an agent to a task: unknown task fields are ignored', async () => {
    const created = await request(app)
      .post('/api/tasks')
      .set(bob)
      .send({ title: 'Bob task', agent: aliceAgent, assignee: aliceAgent });
    expect(created.status).toBe(201);
    const stored = mockDb.tasks.get(created.body.task._id);
    expect(stored).not.toHaveProperty('agent');
    expect(stored).not.toHaveProperty('assignee');

    const updated = await request(app)
      .patch('/api/tasks/' + created.body.task._id)
      .set(bob)
      .send({ agent: aliceAgent });
    expect(updated.status).toBe(200);
    expect(mockDb.tasks.get(created.body.task._id)).not.toHaveProperty('agent');
  });

  it('deleting an agent keeps the owner’s tasks and projects', async () => {
    const project = (await request(app).post('/api/projects').set(alice).send({ name: 'Launch' }))
      .body.project._id;
    await request(app).post('/api/tasks').set(alice).send({ title: 'Write notes', project });

    const response = await request(app)
      .delete('/api/agents/' + aliceAgent)
      .set(alice);
    expect(response.status).toBe(204);
    expect(
      (
        await request(app)
          .get('/api/agents/' + aliceAgent)
          .set(alice)
      ).status,
    ).toBe(404);
    expect((await request(app).get('/api/projects').set(alice)).body.projects).toHaveLength(1);
    const tasks = (await request(app).get('/api/tasks').set(alice)).body.tasks;
    expect(tasks).toEqual([expect.objectContaining({ title: 'Write notes', project })]);
  });
});
