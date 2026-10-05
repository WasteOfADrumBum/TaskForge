import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../../app';
import { createTask as createTaskService } from '../../services/taskService';

// Two users assigning tasks to agents through the real routes, middleware, and controllers. The
// services are replaced by an in-memory store with the same owner scoping as the real Mongoose
// queries (agentService/index.test.ts and taskService/index.test.ts check those query by
// query), so these tests prove the HTTP layer never lets one user's task point at another
// user's agent.
type Doc = Record<string, unknown> & { _id: string; owner: string };
const mockDb = {
  agents: new Map<string, Doc>(),
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
  findAgentStatus: jest.fn(
    async (owner: string, id: string) => mockScoped(mockDb.agents, owner, id)?.status ?? null,
  ),
  updateAgentById: jest.fn(async (owner: string, id: string, updates: Record<string, unknown>) => {
    const agent = mockScoped(mockDb.agents, owner, id);
    if (agent) Object.assign(agent, updates);
    return agent;
  }),
  // Mirrors the real service: unassign the owner's tasks, then delete the agent.
  deleteAgentById: jest.fn(async (owner: string, id: string) => {
    const agent = mockScoped(mockDb.agents, owner, id);
    if (!agent) return null;
    for (const task of mockDb.tasks.values()) {
      if (task.owner === owner && task.assigneeAgent === id) {
        Object.assign(task, { assigneeType: null, assigneeAgent: null });
      }
    }
    mockDb.agents.delete(id);
    return agent;
  }),
}));

jest.mock('../../services/projectService', () => ({ ownsProject: jest.fn() }));

jest.mock('../../services/taskService', () => ({
  createTask: jest.fn(async (owner: string, data: Record<string, unknown>) => {
    const task = { _id: mockNewId(), assigneeType: null, assigneeAgent: null, ...data, owner };
    mockDb.tasks.set(task._id, task);
    return task;
  }),
  findTasksByOwner: jest.fn(async (owner: string) =>
    [...mockDb.tasks.values()].filter((t) => t.owner === owner),
  ),
  isTaskAssignedToAgent: jest.fn(
    async (owner: string, id: string, agentId: string) =>
      mockScoped(mockDb.tasks, owner, id)?.assigneeAgent === agentId,
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
const bobId = '507f1f77bcf86cd799439012';
const alice = auth(aliceId);
const bob = auth(bobId);

const createAgent = async (user: typeof alice, name: string) =>
  (await request(app).post('/api/agents').set(user).send({ name, role: 'Researcher' })).body.agent
    ._id as string;
const createTask = async (user: typeof alice, body: Record<string, unknown> = {}) =>
  request(app)
    .post('/api/tasks')
    .set(user)
    .send({ title: 'Research', ...body });
const assign = (user: typeof alice, taskId: string, body: Record<string, unknown>) =>
  request(app)
    .patch('/api/tasks/' + taskId)
    .set(user)
    .send(body);

describe('task assignment across two users', () => {
  let aliceAgent: string;
  let bobAgent: string;

  beforeEach(async () => {
    mockDb.agents.clear();
    mockDb.tasks.clear();
    aliceAgent = await createAgent(alice, 'Scout');
    bobAgent = await createAgent(bob, 'Mole');
  });

  it('returns a non-success response if a created task disappears during reconciliation', async () => {
    jest.mocked(createTaskService).mockResolvedValueOnce(null);
    const response = await createTask(alice, {
      assigneeType: 'agent',
      assigneeAgent: aliceAgent,
    });
    expect(response.status).toBe(404);
    expect(response.body).toEqual({ message: 'Task not found' });
    expect(response.body).not.toHaveProperty('task');
  });
  it('never lets a user assign a task to another user’s agent', async () => {
    const missing = 'b'.repeat(24);
    const foreign = await createTask(bob, { assigneeType: 'agent', assigneeAgent: aliceAgent });
    const absent = await createTask(bob, { assigneeType: 'agent', assigneeAgent: missing });
    expect(foreign.status).toBe(400);
    expect([foreign.status, foreign.body]).toEqual([absent.status, absent.body]);

    const task = (await createTask(bob)).body.task._id;
    const moved = await assign(bob, task, { assigneeType: 'agent', assigneeAgent: aliceAgent });
    expect([moved.status, moved.body]).toEqual([absent.status, absent.body]);
    expect(mockDb.tasks.get(task)).toMatchObject({ assigneeType: null, assigneeAgent: null });
  });

  it('assigns only within the user’s own workspace', async () => {
    const aliceTask = (
      await createTask(alice, { assigneeType: 'agent', assigneeAgent: aliceAgent })
    ).body.task._id;
    const bobTask = (await createTask(bob, { assigneeType: 'agent', assigneeAgent: bobAgent })).body
      .task._id;

    // Bob can't reassign Alice's task, even to his own agent.
    const response = await assign(bob, aliceTask, {
      assigneeType: 'agent',
      assigneeAgent: bobAgent,
    });
    expect(response.status).toBe(404);
    expect(mockDb.tasks.get(aliceTask)).toMatchObject({ assigneeAgent: aliceAgent });

    const bobs = (await request(app).get('/api/tasks').set(bob)).body.tasks;
    expect(bobs.map((t: Doc) => t._id)).toEqual([bobTask]);
  });

  it('moves a task through every assignment state', async () => {
    const otherAgent = await createAgent(alice, 'Builder');
    const task = (await createTask(alice)).body.task._id;
    const steps = [
      [{ assigneeType: 'user' }, { assigneeType: 'user', assigneeAgent: null }],
      [
        { assigneeType: 'agent', assigneeAgent: aliceAgent },
        { assigneeType: 'agent', assigneeAgent: aliceAgent },
      ],
      [
        { assigneeType: 'agent', assigneeAgent: otherAgent },
        { assigneeType: 'agent', assigneeAgent: otherAgent },
      ],
      [{ assigneeType: 'user' }, { assigneeType: 'user', assigneeAgent: null }],
      [{ assigneeType: null }, { assigneeType: null, assigneeAgent: null }],
      [
        { assigneeType: 'agent', assigneeAgent: aliceAgent },
        { assigneeType: 'agent', assigneeAgent: aliceAgent },
      ],
      [{ assigneeType: null }, { assigneeType: null, assigneeAgent: null }],
    ] as const;
    for (const [body, expected] of steps) {
      const response = await assign(alice, task, body);
      expect(response.status).toBe(200);
      expect(mockDb.tasks.get(task)).toMatchObject(expected);
    }
  });

  it('keeps a task with its agent after the agent is paused, but takes no new tasks', async () => {
    const kept = (await createTask(alice, { assigneeType: 'agent', assigneeAgent: aliceAgent }))
      .body.task._id;
    await request(app)
      .patch('/api/agents/' + aliceAgent)
      .set(alice)
      .send({ status: 'paused' });

    // Unrelated edits, with or without re-sending the current assignee, keep it.
    expect((await assign(alice, kept, { title: 'Renamed' })).status).toBe(200);
    const resent = await assign(alice, kept, {
      priority: 'high',
      assigneeType: 'agent',
      assigneeAgent: aliceAgent,
    });
    expect(resent.status).toBe(200);
    expect(mockDb.tasks.get(kept)).toMatchObject({
      title: 'Renamed',
      priority: 'high',
      assigneeType: 'agent',
      assigneeAgent: aliceAgent,
    });

    const other = (await createTask(alice)).body.task._id;
    const rejected = await assign(alice, other, {
      assigneeType: 'agent',
      assigneeAgent: aliceAgent,
    });
    expect(rejected.status).toBe(400);
    expect(rejected.body).toEqual({ message: 'Only active agents can take new tasks' });
    expect(
      (await createTask(alice, { assigneeType: 'agent', assigneeAgent: aliceAgent })).status,
    ).toBe(400);
  });

  it('deleting an agent unassigns its tasks and keeps them', async () => {
    const assigned = (await createTask(alice, { assigneeType: 'agent', assigneeAgent: aliceAgent }))
      .body.task._id;
    const mine = (await createTask(alice, { assigneeType: 'user' })).body.task._id;
    const bobsTask = (await createTask(bob, { assigneeType: 'agent', assigneeAgent: bobAgent }))
      .body.task._id;

    // Bob can't delete Alice's agent, so her task keeps it.
    expect(
      (
        await request(app)
          .delete('/api/agents/' + aliceAgent)
          .set(bob)
      ).status,
    ).toBe(404);
    expect(mockDb.tasks.get(assigned)).toMatchObject({ assigneeAgent: aliceAgent });

    expect(
      (
        await request(app)
          .delete('/api/agents/' + aliceAgent)
          .set(alice)
      ).status,
    ).toBe(204);
    const tasks = (await request(app).get('/api/tasks').set(alice)).body.tasks as Doc[];
    expect(tasks).toHaveLength(2);
    expect(tasks.find((t) => t._id === assigned)).toMatchObject({
      assigneeType: null,
      assigneeAgent: null,
    });
    expect(tasks.find((t) => t._id === mine)).toMatchObject({ assigneeType: 'user' });
    expect(mockDb.tasks.get(bobsTask)).toMatchObject({ assigneeAgent: bobAgent });
  });
});
