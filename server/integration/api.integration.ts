import request from 'supertest';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import app from '../src/app';
import { Task } from '../src/models/taskModel';
import { User } from '../src/models/userModel';
import { Project } from '../src/models/projectModel';
import { Agent } from '../src/models/agentModel';
import { Review } from '../src/models/reviewModel';
import { Goal } from '../src/models/goalModel';
import { LearningItem } from '../src/models/learningModel';
import { Resume } from '../src/models/resumeModel';
import { SavedJob } from '../src/models/jobModel';
import { Skill } from '../src/models/skillModel';

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

it('records when a task is completed and keeps it in the database', async () => {
  const created = await request(app)
    .post('/api/tasks')
    .set(auth(aliceToken))
    .send({ title: 'Completion QA', completedAt: '2020-01-01T00:00:00.000Z' });
  expect(created.status).toBe(201);
  const id = created.body.task._id;
  // Request input never sets the completion time.
  expect(created.body.task.completedAt).toBeNull();

  const done = await request(app).patch(`/api/tasks/${id}`).set(auth(aliceToken)).send({
    status: 'done',
    completedAt: '2020-01-01T00:00:00.000Z',
  });
  expect(done.status).toBe(200);
  const stamped = done.body.task.completedAt;
  expect(Date.parse(stamped)).toBeGreaterThan(Date.parse('2026-01-01T00:00:00.000Z'));

  const resaved = await request(app)
    .patch(`/api/tasks/${id}`)
    .set(auth(aliceToken))
    .send({ title: 'Completion QA renamed', status: 'done' });
  expect(resaved.body.task.completedAt).toBe(stamped);
  expect((await Task.findById(id).lean())?.completedAt?.toISOString()).toBe(stamped);

  const reopened = await request(app)
    .patch(`/api/tasks/${id}`)
    .set(auth(aliceToken))
    .send({ status: 'todo' });
  expect(reopened.body.task.completedAt).toBeNull();
  expect((await Task.findById(id).lean())?.completedAt).toBeNull();

  expect((await request(app).delete(`/api/tasks/${id}`).set(auth(aliceToken))).status).toBe(204);
});

it('saves one owner-scoped review per period and rejects another user’s tasks', async () => {
  const created = await request(app)
    .post('/api/tasks')
    .set(auth(aliceToken))
    .send({ title: 'Review focus QA' });
  expect(created.status).toBe(201);
  const focusId = created.body.task._id;
  const path = '/api/reviews/daily/2026-11-15';

  const foreign = await request(app)
    .put(path)
    .set(auth(bobToken))
    .send({ reflection: 'Not mine', focusTasks: [focusId] });
  expect(foreign.status).toBe(400);
  expect(await Review.countDocuments({ owner: bobId })).toBe(0);

  // Two first saves at once still leave a single review.
  const [first, second] = await Promise.all([
    request(app)
      .put(path)
      .set(auth(aliceToken))
      .send({ reflection: 'First', focusTasks: [focusId] }),
    request(app)
      .put(path)
      .set(auth(aliceToken))
      .send({ reflection: 'Second', focusTasks: [focusId] }),
  ]);
  expect([first.status, second.status]).toEqual([200, 200]);
  expect(await Review.countDocuments({ owner: aliceId, kind: 'daily', period: '2026-11-15' })).toBe(
    1,
  );

  const saved = await request(app)
    .put(path)
    .set(auth(aliceToken))
    .send({ reflection: '  Final  ', focusTasks: [focusId, focusId] });
  expect(saved.status).toBe(200);
  expect(saved.body.review).toMatchObject({
    owner: aliceId,
    kind: 'daily',
    period: '2026-11-15',
    reflection: 'Final',
    focusTasks: [focusId],
  });
  const weekly = await request(app)
    .put('/api/reviews/weekly/2026-11-09')
    .set(auth(aliceToken))
    .send({ reflection: 'Week' });
  expect(weekly.status).toBe(200);

  const mine = await request(app).get('/api/reviews').set(auth(aliceToken));
  expect(mine.body.reviews.map((review: { period: string }) => review.period)).toEqual([
    '2026-11-15',
    '2026-11-09',
  ]);
  const theirs = await request(app).get('/api/reviews').set(auth(bobToken));
  expect(theirs.body.reviews).toEqual([]);
  const indexes = await Review.collection.indexes();
  expect(indexes).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ key: { owner: 1, kind: 1, period: -1 }, unique: true }),
    ]),
  );

  expect((await request(app).delete(`/api/tasks/${focusId}`).set(auth(aliceToken))).status).toBe(
    204,
  );
});

it('keeps goals private to their owner and records when one is achieved', async () => {
  const created = await request(app)
    .post('/api/goals')
    .set(auth(aliceToken))
    .send({ title: 'Goal QA', targetDate: '2028-02-29', owner: bobId, achievedAt: '2020-01-01' });
  expect(created.status).toBe(201);
  const goal = created.body.goal;
  expect(goal).toMatchObject({
    owner: aliceId,
    area: 'general',
    status: 'active',
    achievedAt: null,
    targetDate: '2028-02-29T00:00:00.000Z',
  });

  expect((await request(app).get('/api/goals').set(auth(bobToken))).body.goals).toEqual([]);
  expect(
    (await request(app).patch(`/api/goals/${goal._id}`).set(auth(bobToken)).send({ title: 'X' }))
      .status,
  ).toBe(404);
  expect((await request(app).delete(`/api/goals/${goal._id}`).set(auth(bobToken))).status).toBe(
    404,
  );

  const achieved = await request(app)
    .patch(`/api/goals/${goal._id}`)
    .set(auth(aliceToken))
    .send({ status: 'achieved' });
  const stamped = achieved.body.goal.achievedAt;
  expect(Date.parse(stamped)).toBeGreaterThan(Date.parse('2026-01-01T00:00:00.000Z'));
  const again = await request(app)
    .patch(`/api/goals/${goal._id}`)
    .set(auth(aliceToken))
    .send({ title: 'Goal QA renamed', status: 'achieved' });
  expect(again.body.goal.achievedAt).toBe(stamped);
  const reopened = await request(app)
    .patch(`/api/goals/${goal._id}`)
    .set(auth(aliceToken))
    .send({ status: 'active', targetDate: null, area: 'career' });
  expect(reopened.body.goal).toMatchObject({ achievedAt: null, targetDate: null, area: 'career' });
  expect(
    (await request(app).patch(`/api/goals/${goal._id}`).set(auth(aliceToken)).send({ area: 'x' }))
      .status,
  ).toBe(400);

  expect((await request(app).delete(`/api/goals/${goal._id}`).set(auth(aliceToken))).status).toBe(
    204,
  );
  expect(await Goal.findById(goal._id)).toBeNull();
});

it('keeps learning items private to their owner and records when one is done', async () => {
  const created = await request(app).post('/api/learning').set(auth(aliceToken)).send({
    title: 'Learning QA',
    skill: 'Type Script',
    kind: 'article',
    url: 'https://learn.example.com/a b',
    targetDate: '2028-02-29',
    owner: bobId,
    completedAt: '2020-01-01',
  });
  expect(created.status).toBe(201);
  const item = created.body.item;
  expect(item).toMatchObject({
    owner: aliceId,
    skill: 'type-script',
    kind: 'article',
    url: 'https://learn.example.com/a%20b',
    status: 'planned',
    completedAt: null,
    targetDate: '2028-02-29T00:00:00.000Z',
  });

  expect((await request(app).get('/api/learning').set(auth(bobToken))).body.items).toEqual([]);
  expect(
    (await request(app).patch(`/api/learning/${item._id}`).set(auth(bobToken)).send({ title: 'X' }))
      .status,
  ).toBe(404);
  expect((await request(app).delete(`/api/learning/${item._id}`).set(auth(bobToken))).status).toBe(
    404,
  );

  const done = await request(app)
    .patch(`/api/learning/${item._id}`)
    .set(auth(aliceToken))
    .send({ status: 'done' });
  const stamped = done.body.item.completedAt;
  expect(Date.parse(stamped)).toBeGreaterThan(Date.parse('2026-01-01T00:00:00.000Z'));
  const again = await request(app)
    .patch(`/api/learning/${item._id}`)
    .set(auth(aliceToken))
    .send({ notes: 'Finished', status: 'done' });
  expect(again.body.item).toMatchObject({ completedAt: stamped, notes: 'Finished' });
  const reopened = await request(app)
    .patch(`/api/learning/${item._id}`)
    .set(auth(aliceToken))
    .send({ status: 'in_progress', skill: '', url: '', targetDate: null });
  expect(reopened.body.item).toMatchObject({
    completedAt: null,
    skill: '',
    url: '',
    targetDate: null,
  });
  expect(
    (await request(app).get('/api/learning').set(auth(aliceToken))).body.items.map(
      (entry: { _id: string }) => entry._id,
    ),
  ).toEqual([item._id]);

  expect(
    (await request(app).delete(`/api/learning/${item._id}`).set(auth(aliceToken))).status,
  ).toBe(204);
  expect(await LearningItem.findById(item._id)).toBeNull();
});

it('keeps one private resume per owner', async () => {
  try {
    expect((await request(app).get('/api/resume').set(auth(aliceToken))).body).toEqual({
      resume: null,
    });
    const first = await request(app).put('/api/resume').set(auth(aliceToken)).send({
      headline: ' Developer ',
      summary: 'React and Node.js',
      body: 'Experience',
      owner: bobId,
    });
    expect(first.status).toBe(200);
    expect(first.body.resume).toMatchObject({
      owner: aliceId,
      headline: 'Developer',
      summary: 'React and Node.js',
      body: 'Experience',
    });
    const second = await request(app)
      .put('/api/resume')
      .set(auth(aliceToken))
      .send({ headline: 'Senior developer' });
    expect(second.body.resume).toMatchObject({
      _id: first.body.resume._id,
      headline: 'Senior developer',
      summary: '',
      body: '',
    });
    expect(await Resume.countDocuments({ owner: aliceId })).toBe(1);
    expect((await request(app).get('/api/resume').set(auth(bobToken))).body).toEqual({
      resume: null,
    });
    expect(
      (
        await request(app)
          .put('/api/resume')
          .set(auth(bobToken))
          .send({ body: 'b'.repeat(20001) })
      ).status,
    ).toBe(400);
  } finally {
    await Resume.deleteMany({ owner: { $in: [aliceId, bobId] } });
  }
});

it('keeps skills and saved jobs private, one skill per name, with slug matching', async () => {
  const skill = await request(app)
    .post('/api/skills')
    .set(auth(aliceToken))
    .send({ name: 'Type Script', level: 'strong' });
  expect(skill.status).toBe(201);
  expect(skill.body.skill).toMatchObject({ name: 'type-script', level: 'strong', owner: aliceId });
  const [again, other] = await Promise.all([
    request(app).post('/api/skills').set(auth(aliceToken)).send({ name: 'typescript-' }),
    request(app).post('/api/skills').set(auth(aliceToken)).send({ name: 'type_script' }),
  ]);
  expect(again.status).toBe(400);
  expect(other.status).toBe(409);
  // Another user may hold the same skill name.
  expect(
    (await request(app).post('/api/skills').set(auth(bobToken)).send({ name: 'type-script' }))
      .status,
  ).toBe(201);
  expect(await Skill.countDocuments({ name: 'type-script' })).toBe(2);

  const job = await request(app)
    .post('/api/jobs')
    .set(auth(aliceToken))
    .send({
      title: 'Frontend Engineer',
      company: 'Example Co',
      url: 'https://jobs.example.com/1',
      requiredSkills: ['TypeScript', 'React', 'react'],
    });
  expect(job.status).toBe(201);
  expect(job.body.job).toMatchObject({
    owner: aliceId,
    status: 'saved',
    requiredSkills: ['typescript', 'react'],
  });
  const jobId = job.body.job._id;
  expect(Number.isFinite(Date.parse(job.body.job.statusChangedAt))).toBe(true);
  // Backdate the stamp so a change is measurable. A client value is ignored, and saving the
  // same status or other fields leaves the stamp alone.
  const old = new Date('2020-01-01T00:00:00Z');
  await SavedJob.updateOne({ _id: jobId }, { statusChangedAt: old });
  const notes = await request(app)
    .patch(`/api/jobs/${jobId}`)
    .set(auth(aliceToken))
    .send({ notes: 'Referral', statusChangedAt: '2025-01-01T00:00:00Z', status: 'saved' });
  expect(notes.body.job.statusChangedAt).toBe(old.toISOString());
  expect((await request(app).get('/api/jobs').set(auth(bobToken))).body.jobs).toEqual([]);
  expect(
    (await request(app).patch(`/api/jobs/${jobId}`).set(auth(bobToken)).send({ status: 'applied' }))
      .status,
  ).toBe(404);
  const applied = await request(app)
    .patch(`/api/jobs/${jobId}`)
    .set(auth(aliceToken))
    .send({ status: 'applied' });
  expect(applied.body.job.status).toBe('applied');
  expect(Date.parse(applied.body.job.statusChangedAt)).toBeGreaterThan(old.getTime());

  expect((await request(app).delete(`/api/jobs/${jobId}`).set(auth(aliceToken))).status).toBe(204);
  expect(await SavedJob.findById(jobId)).toBeNull();
  for (const token of [aliceToken, bobToken]) {
    const [mine] = (await request(app).get('/api/skills').set(auth(token))).body.skills;
    expect((await request(app).delete(`/api/skills/${mine._id}`).set(auth(token))).status).toBe(
      204,
    );
  }
  expect(await Skill.countDocuments()).toBe(0);
});
