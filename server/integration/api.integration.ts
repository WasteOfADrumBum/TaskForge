import request from 'supertest';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import app from '../src/app';
import { Task } from '../src/models/taskModel';
import { User } from '../src/models/userModel';
import { Project } from '../src/models/projectModel';
import { Agent } from '../src/models/agentModel';

// No credentials, remote hosts, options, or application database names are permitted.
const uri = process.env.TEST_MONGO_URI;
if (
  !uri ||
  !/^mongodb:\/\/(?:127\.0\.0\.1|localhost):\d{1,5}\/taskforge_qa_[a-zA-Z0-9_]{8,}$/.test(uri)
) {
  throw new Error('TEST_MONGO_URI must name a fresh taskforge_qa_ database on loopback MongoDB');
}
const password = 'Synthetic QA password 2026!';
let aliceToken: string;
let bobToken: string;
let aliceId: string;
let bobId: string;
let projectId: string;
let agentId: string;
let taskId: string;
const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

beforeAll(async () => {
  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 5000,
    autoCreate: false,
    autoIndex: false,
  });
  const db = mongoose.connection.db;
  if (!db || (await db.listCollections().toArray()).length !== 0) {
    throw new Error('Integration database must be fresh; refusing to reuse existing collections');
  }
  for (const model of [User, Task, Project, Agent]) {
    await model.createCollection();
    await model.createIndexes();
  }
  for (const name of ['alice', 'bob']) {
    const email = `${name}@taskforge-qa.example`;
    const registration = await request(app).post('/api/auth/register').send({ email, password });
    expect(registration.status).toBe(201);
    const login = await request(app).post('/api/auth/login').send({ email, password });
    expect(login.status).toBe(200);
    if (name === 'alice') {
      aliceId = registration.body.user.id;
      aliceToken = login.body.token;
    } else {
      bobId = registration.body.user.id;
      bobToken = login.body.token;
    }
  }
  const project = await request(app)
    .post('/api/projects')
    .set(auth(aliceToken))
    .send({ name: 'QA project' });
  expect(project.status).toBe(201);
  projectId = project.body.project._id;
  const agent = await request(app)
    .post('/api/agents')
    .set(auth(aliceToken))
    .send({
      name: 'QA agent',
      role: 'Research assistant',
      skills: ['research'],
      permissions: ['task.read'],
    });
  expect(agent.status).toBe(201);
  agentId = agent.body.agent._id;
  const task = await request(app).post('/api/tasks').set(auth(aliceToken)).send({
    title: 'QA task',
    project: projectId,
    assigneeType: 'agent',
    assigneeAgent: agentId,
    dueDate: '2028-02-29',
    owner: bobId,
  });
  expect(task.status).toBe(201);
  taskId = task.body.task._id;
});

afterAll(async () => {
  // Disconnect only. The disposable database owns lifecycle; never drop or reset data.
  await mongoose.disconnect();
});

it('persists hashed passwords and returns valid user-scoped JWTs', async () => {
  const user = await User.findById(aliceId).lean();
  expect(user?.email).toBe('alice@taskforge-qa.example');
  expect(user?.password).not.toBe(password);
  expect(await bcrypt.compare(password, user!.password)).toBe(true);
  expect(jwt.verify(aliceToken, process.env.JWT_SECRET!)).toMatchObject({ id: aliceId });
  expect(jwt.verify(bobToken, process.env.JWT_SECRET!)).toMatchObject({ id: bobId });
});

it('rejects duplicate registration and incorrect passwords using real services', async () => {
  expect(
    (
      await request(app)
        .post('/api/auth/register')
        .send({ email: ' ALICE@TASKFORGE-QA.EXAMPLE ', password })
    ).status,
  ).toBe(409);
  expect(
    (
      await request(app)
        .post('/api/auth/login')
        .send({ email: 'alice@taskforge-qa.example', password: 'incorrect password' })
    ).status,
  ).toBe(401);
});

it('persists task assignment, calendar date, and authenticated ownership', async () => {
  const task = await Task.findById(taskId).lean();
  expect(task?.owner.toString()).toBe(aliceId);
  expect(task?.project?.toString()).toBe(projectId);
  expect(task?.assigneeAgent?.toString()).toBe(agentId);
  expect(task?.assigneeType).toBe('agent');
  expect(task?.dueDate?.toISOString()).toBe('2028-02-29T00:00:00.000Z');
  const list = await request(app).get('/api/tasks').set(auth(aliceToken));
  expect(list.status).toBe(200);
  expect(list.body.tasks).toEqual([
    expect.objectContaining({ _id: taskId, owner: aliceId, dueDate: '2028-02-29T00:00:00.000Z' }),
  ]);
});

it.each(['tasks', 'projects', 'agents'])(
  'isolates %s lists between two real users',
  async (resource) => {
    const list = await request(app).get(`/api/${resource}`).set(auth(bobToken));
    expect(list.status).toBe(200);
    expect(list.body[resource]).toEqual([]);
  },
);

it.each(['projects', 'agents'])('hides cross-owner %s details', async (resource) => {
  const id = resource === 'projects' ? projectId : agentId;
  expect((await request(app).get(`/api/${resource}/${id}`).set(auth(bobToken))).status).toBe(404);
});

it.each(['tasks', 'projects', 'agents'])(
  'prevents cross-owner updates and deletes of %s',
  async (resource) => {
    const id = resource === 'tasks' ? taskId : resource === 'projects' ? projectId : agentId;
    const body =
      resource === 'tasks' ? { title: 'Unauthorized edit' } : { name: 'Unauthorized edit' };
    expect(
      (await request(app).patch(`/api/${resource}/${id}`).set(auth(bobToken)).send(body)).status,
    ).toBe(404);
    expect((await request(app).delete(`/api/${resource}/${id}`).set(auth(bobToken))).status).toBe(
      404,
    );
  },
);

it('rejects cross-owner project and agent references without persisting tasks', async () => {
  const count = await Task.countDocuments();
  for (const reference of [
    { project: projectId },
    { assigneeType: 'agent', assigneeAgent: agentId },
  ]) {
    const response = await request(app)
      .post('/api/tasks')
      .set(auth(bobToken))
      .send({ title: 'Rejected task', ...reference });
    expect(response.status).toBe(400);
  }
  expect(await Task.countDocuments()).toBe(count);
});

it('updates all resource types and preserves existing paused assignments', async () => {
  const task = await request(app).patch(`/api/tasks/${taskId}`).set(auth(aliceToken)).send({
    title: 'Updated QA task',
    description: ' Persisted description ',
    status: 'in-progress',
    priority: 'high',
    dueDate: null,
  });
  expect(task.status).toBe(200);
  expect(await Task.findById(taskId).lean()).toMatchObject({
    title: 'Updated QA task',
    description: 'Persisted description',
    status: 'in-progress',
    priority: 'high',
    dueDate: null,
  });
  expect(
    (
      await request(app)
        .patch(`/api/projects/${projectId}`)
        .set(auth(aliceToken))
        .send({ name: 'Updated QA project', status: 'completed' })
    ).status,
  ).toBe(200);
  expect(await Project.findById(projectId).lean()).toMatchObject({
    name: 'Updated QA project',
    status: 'completed',
  });
  expect(
    (
      await request(app)
        .patch(`/api/agents/${agentId}`)
        .set(auth(aliceToken))
        .send({ name: 'Updated QA agent', status: 'paused' })
    ).status,
  ).toBe(200);
  expect(await Agent.findById(agentId).lean()).toMatchObject({
    name: 'Updated QA agent',
    status: 'paused',
  });
  expect(
    (
      await request(app)
        .patch(`/api/tasks/${taskId}`)
        .set(auth(aliceToken))
        .send({ assigneeType: 'agent', assigneeAgent: agentId })
    ).status,
  ).toBe(200);
  expect(
    (
      await request(app)
        .post('/api/tasks')
        .set(auth(aliceToken))
        .send({ title: 'Blocked assignment', assigneeType: 'agent', assigneeAgent: agentId })
    ).status,
  ).toBe(400);
});

it('deletes an agent while preserving and unassigning its persisted tasks', async () => {
  expect((await request(app).delete(`/api/agents/${agentId}`).set(auth(aliceToken))).status).toBe(
    204,
  );
  expect(await Agent.findById(agentId)).toBeNull();
  expect(await Task.findById(taskId).lean()).toMatchObject({
    assigneeType: null,
    assigneeAgent: null,
  });
});

it('deletes a project while preserving and unassigning its persisted tasks', async () => {
  expect(
    (await request(app).delete(`/api/projects/${projectId}`).set(auth(aliceToken))).status,
  ).toBe(204);
  expect(await Project.findById(projectId)).toBeNull();
  expect(await Task.findById(taskId).lean()).toMatchObject({ project: null });
});

it('deletes the owner task and confirms its persisted removal', async () => {
  expect((await request(app).delete(`/api/tasks/${taskId}`).set(auth(aliceToken))).status).toBe(
    204,
  );
  expect(await Task.findById(taskId)).toBeNull();
  expect(await User.countDocuments()).toBe(2);
});
