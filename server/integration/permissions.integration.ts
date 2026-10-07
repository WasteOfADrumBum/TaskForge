import mongoose from 'mongoose';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'node:crypto';
import http from 'node:http';
import app from '../src/app';
import { User } from '../src/models/userModel';
import { Task } from '../src/models/taskModel';
import { Agent } from '../src/models/agentModel';
import { Project } from '../src/models/projectModel';
import { Run } from '../src/models/runModel';
import { AuditEvent } from '../src/models/auditEventModel';
import { createRunExecutor, runExecutor } from '../src/services/runService/execution';
import { authorizeRunDraft } from '../src/services/permissionService';
import type { AIProvider } from '../src/ai/provider';
import * as providers from '../src/ai/provider';

const parent = process.env.TEST_MONGO_URI;
if (
  !parent ||
  parent !== parent.trim() ||
  !/^mongodb:\/\/(?:127\.0\.0\.1|localhost):\d{1,5}\/taskforge_qa_[a-zA-Z0-9_]{8,}$/.test(parent)
)
  throw new Error('Permissions integration requires a fresh loopback taskforge_qa_ namespace');
let owner: string;
let other: string;
let task: string;
let agent: string;
let project: string;
let token: string;
let otherToken: string;
const auth = (value = token) => ({ Authorization: `Bearer ${value}` });
const environment = { ...process.env };
const input = 'Synthetic PRIVATE_PROMPT_MARKER for draft-only testing';
const create = async () => {
  const response = await request(app)
    .post('/api/runs')
    .set(auth())
    .set('Idempotency-Key', randomUUID())
    .send({ taskId: task, agentId: agent, input });
  expect(response.status).toBe(201);
  return response.body.run._id as string;
};
const execute = (id: string, body: Record<string, unknown> = { mode: 'demo' }, value = token) =>
  request(app).post(`/api/runs/${id}/execute`).set(auth(value)).send(body);
const pendingProvider = () => {
  let enter!: () => void;
  const entered = new Promise<void>((resolve) => {
    enter = resolve;
  });
  let finish!: (value: Awaited<ReturnType<AIProvider['chat']>>) => void;
  let providerSignal!: AbortSignal;
  const chat = jest.fn<ReturnType<AIProvider['chat']>, Parameters<AIProvider['chat']>>(
    (_messages, options) =>
      new Promise((resolve, reject) => {
        finish = resolve;
        providerSignal = options!.signal!;
        providerSignal.addEventListener('abort', () => reject(new Error('expected owned abort')), {
          once: true,
        });
        enter();
      }),
  );
  const provider: AIProvider = {
    id: 'demo',
    capabilities: { chat: true, structuredOutput: true, embeddings: false },
    chat,
    structuredOutput: jest.fn(),
    embed: jest.fn(),
  };
  const executor = createRunExecutor({ providerForMode: () => provider });
  jest.spyOn(runExecutor, 'execute').mockImplementation(executor.execute);
  jest.spyOn(runExecutor, 'cancel').mockImplementation(executor.cancel);
  return {
    entered,
    finish: () =>
      finish({
        value: 'Synthetic simulated result',
        provider: 'demo',
        simulation: true,
        label: 'Simulation: protocol fixture, no model',
      }),
    chat,
    signal: () => providerSignal,
    executor,
  };
};
beforeAll(async () => {
  await mongoose.connect(parent + '_permissions', {
    serverSelectionTimeoutMS: 5000,
    autoCreate: false,
    autoIndex: false,
  });
  const db = mongoose.connection.db;
  if (!db || (await db.listCollections().toArray()).length)
    throw new Error('Refusing existing permission-test collections');
  for (const model of [User, Task, Agent, Project, Run, AuditEvent]) {
    await model.createCollection();
    await model.createIndexes();
  }
  const user = await User.create({
    email: 'permissions-owner@taskforge-qa.example',
    password: 'unused-synthetic',
  });
  owner = user.id;
  const stranger = await User.create({
    email: 'permissions-other@taskforge-qa.example',
    password: 'unused-synthetic',
  });
  other = stranger.id;
  token = jwt.sign({ id: owner }, process.env.JWT_SECRET!);
  otherToken = jwt.sign({ id: other }, process.env.JWT_SECRET!);
  const agentRecord = await Agent.create({
    owner,
    name: 'Synthetic draft agent',
    role: 'Text draft',
    permissions: ['task.read', 'artifact.draft'],
  });
  agent = agentRecord.id;
  const projectRecord = await Project.create({
    owner,
    name: 'Synthetic private project',
    description: 'PROJECT_PRIVATE_MARKER',
  });
  project = projectRecord.id;
  const taskRecord = await Task.create({
    owner,
    title: 'Synthetic assigned task',
    project,
    assigneeType: 'agent',
    assigneeAgent: agent,
  });
  task = taskRecord.id;
});
afterEach(async () => {
  jest.restoreAllMocks();
  for (const name of ['NODE_ENV', 'AI_PROVIDER']) {
    if (environment[name] === undefined) delete process.env[name];
    else process.env[name] = environment[name];
  }
  await Agent.updateOne(
    { _id: agent, owner },
    { $set: { status: 'active', permissions: ['task.read', 'artifact.draft'] } },
  );
  await Task.updateOne(
    { _id: task, owner },
    { $set: { assigneeType: 'agent', assigneeAgent: agent } },
  );
});
afterAll(async () => {
  await mongoose.disconnect();
});

it('executes only explicit labelled simulation and atomically records lifecycle metadata without task writes', async () => {
  const id = await create();
  const taskBefore = (await Task.findById(task))!.toObject();
  const response = await execute(id, {
    mode: 'demo',
    owner: other,
    permissions: ['shell.execute'],
    context: 'injected',
    capability: 'task.update',
  });
  expect(response.status).toBe(200);
  expect(response.body.run.status).toBe('awaiting-approval');
  expect(response.body.run.result).toMatchObject({
    provider: 'demo',
    simulation: true,
    label: expect.stringContaining('Simulation'),
  });
  const run = (await Run.findById(id))!;
  expect(run.auditEvents.map((event) => event.kind)).toEqual(['created', 'claimed', 'drafted']);
  expect(run.auditEvents.map((event) => event.version)).toEqual([0, 1, 2]);
  expect((await Task.findById(task))!.toObject()).toEqual(taskBefore);
  const audit = await request(app).get(`/api/runs/${id}/audit`).set(auth());
  expect(audit.status).toBe(200);
  expect(audit.headers['cache-control']).toBe('no-store');
  expect(JSON.stringify(audit.body)).not.toContain('PRIVATE_PROMPT_MARKER');
  expect(JSON.stringify(audit.body)).not.toContain('PROJECT_PRIVATE_MARKER');
  expect(audit.body).not.toHaveProperty('result');
});
it('does not replay a completed run', async () => {
  const id = await create();
  expect((await execute(id)).status).toBe(200);
  expect((await execute(id)).status).toBe(409);
  expect((await Run.findById(id))!.version).toBe(2);
});
it('logs missing and foreign targets privately without revealing another owner data', async () => {
  const id = await create();
  expect((await execute(id, { mode: 'demo' }, otherToken)).status).toBe(404);
  expect((await execute(new mongoose.Types.ObjectId().toString())).status).toBe(404);
  expect((await request(app).get(`/api/runs/${id}/audit`).set(auth(otherToken))).status).toBe(404);
  const foreignLog = await request(app).get('/api/runs/audit/denials').set(auth(otherToken));
  expect(foreignLog.body.events).toEqual([
    expect.objectContaining({ owner: other, attemptedRun: id, reason: 'run-not-found' }),
  ]);
  expect((await Run.findById(id))!.version).toBe(0);
  expect((await Run.findById(id))!.auditEvents).toHaveLength(1);
});
it('requires persisted least privilege and ignores caller-supplied authority', async () => {
  const id = await create();
  await Agent.updateOne({ _id: agent, owner }, { $set: { permissions: [] } });
  expect(
    (await execute(id, { mode: 'demo', permissions: ['task.read', 'artifact.draft'] })).status,
  ).toBe(403);
  expect((await Run.findById(id))!.status).toBe('queued');
  expect((await Run.findById(id))!.version).toBe(0);
});
it('does not include or query project data without project.read', async () => {
  const id = await create();
  const lookup = jest.spyOn(Project, 'findOne');
  expect((await authorizeRunDraft(owner, id)).allowed).toBe(true);
  expect(lookup).not.toHaveBeenCalled();
  expect(await authorizeRunDraft(owner, id, true)).toMatchObject({
    allowed: false,
    reason: 'missing-permission',
  });
  expect(lookup).not.toHaveBeenCalled();
  await Agent.updateOne(
    { _id: agent, owner },
    { $set: { permissions: ['task.read', 'artifact.draft', 'project.read'] } },
  );
  expect((await authorizeRunDraft(owner, id, true)).allowed).toBe(true);
  expect(lookup).toHaveBeenCalledWith({ _id: expect.anything(), owner });
});
it('fails closed on denial-audit errors without accepting execution', async () => {
  const id = await create();
  await Agent.updateOne({ _id: agent, owner }, { $set: { permissions: [] } });
  jest.spyOn(AuditEvent, 'create').mockRejectedValue(new Error('Expected audit outage') as never);
  expect((await execute(id)).status).toBe(503);
  expect((await Run.findById(id))!.status).toBe('queued');
});
it('fails closed before provider invocation on a claim/audit persistence failure', async () => {
  const id = await create();
  const f = pendingProvider();
  jest
    .spyOn(Run, 'findOneAndUpdate')
    .mockRejectedValueOnce(new Error('Expected audit-CAS failure') as never);
  expect((await execute(id)).status).toBe(503);
  expect(f.chat).not.toHaveBeenCalled();
  expect((await Run.findById(id))!.status).toBe('queued');
});
it('rejects revocation before persistence without accepting a draft', async () => {
  const id = await create();
  const f = pendingProvider();
  const response = execute(id).then((value) => value);
  await f.entered;
  await Agent.updateOne({ _id: agent, owner }, { $set: { permissions: [] } });
  f.finish();
  expect((await response).status).toBe(403);
  const run = (await Run.findById(id))!;
  expect(run.status).toBe('failed');
  expect(run.result).toBeNull();
  expect(run.failureReason).toBe('permission-denied');
  expect(run.auditEvents.map((event) => event.kind)).toEqual(['created', 'claimed', 'failed']);
});
it('repeated denied calls do not alter or abort an in-flight attempt', async () => {
  const id = await create();
  const f = pendingProvider();
  const pending = execute(id).then((value) => value);
  await f.entered;
  const running = (await Run.findById(id))!;
  expect((await execute(id)).status).toBe(409);
  expect((await execute(id)).status).toBe(409);
  const stillRunning = (await Run.findById(id))!;
  expect(stillRunning.version).toBe(running.version);
  expect(stillRunning.attemptId).toBe(running.attemptId);
  expect(stillRunning.auditEvents).toHaveLength(2);
  expect(f.signal().aborted).toBe(false);
  f.finish();
  expect((await pending).status).toBe(200);
});
it('accepted cancellation fences and audits failure before late output can persist', async () => {
  const id = await create();
  const f = pendingProvider();
  const pending = execute(id).then((value) => value);
  await f.entered;
  const response = await request(app).post(`/api/runs/${id}/cancel`).set(auth());
  expect(response.status).toBe(200);
  expect(f.signal().aborted).toBe(true);
  expect((await pending).status).toBe(503);
  const run = (await Run.findById(id))!;
  expect(run.status).toBe('failed');
  expect(run.failureReason).toBe('cancelled');
  expect(run.result).toBeNull();
  expect(run.auditEvents.map((event) => event.kind)).toEqual(['created', 'claimed', 'failed']);
});
it('blocks audit mutation/deletion/bulk bypasses against real persisted records', async () => {
  const id = await create();
  await Agent.updateOne({ _id: agent, owner }, { $set: { permissions: [] } });
  await execute(id);
  const event = (await AuditEvent.findOne({ owner, attemptedRun: id }))!;
  await expect(
    AuditEvent.updateOne({ _id: event._id }, { $set: { reason: 'state-conflict' } }),
  ).rejects.toThrow('append-only');
  await expect(AuditEvent.deleteOne({ _id: event._id })).rejects.toThrow('append-only');
  await expect(
    AuditEvent.bulkWrite([{ deleteOne: { filter: { _id: event._id } } }]),
  ).rejects.toThrow('append-only');
  event.reason = 'state-conflict';
  await expect(event.save()).rejects.toThrow('immutable');
  const unchanged = (await AuditEvent.findById(event._id))!;
  await expect(unchanged.save()).rejects.toThrow('append-only');
  expect((await AuditEvent.findById(event._id))!.reason).toBe('missing-permission');
});
it('blocks ordinary run audit replacement, unaudited state updates and bulk deletion', async () => {
  const id = await create();
  await expect(Run.updateOne({ _id: id, owner }, { $set: { auditEvents: [] } })).rejects.toThrow(
    'audited',
  );
  await expect(
    Run.findOneAndUpdate(
      { _id: id, owner, status: 'queued', version: 0 },
      { $set: { status: 'running' }, $inc: { version: 1 } },
    ),
  ).rejects.toThrow('audited');
  await expect(Run.bulkWrite([{ deleteOne: { filter: { _id: id } } }])).rejects.toThrow('audited');
  expect((await Run.findById(id))!.auditEvents).toHaveLength(1);
});
it('handles HTTP disconnect with audited interruption and no late response/result', async () => {
  const id = await create();
  const f = pendingProvider();
  let signalFinished!: () => void;
  const finished = new Promise<void>((resolve) => {
    signalFinished = resolve;
  });
  jest.spyOn(runExecutor, 'execute').mockImplementation(async (...args) => {
    try {
      return await f.executor.execute(...args);
    } finally {
      signalFinished();
    }
  });
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Owned listener unavailable');
  const client = http.request({
    host: '127.0.0.1',
    port: address.port,
    path: `/api/runs/${id}/execute`,
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  });
  client.on('error', () => {});
  client.end(JSON.stringify({ mode: 'demo' }));
  try {
    await f.entered;
    client.destroy();
    await finished;
    const run = (await Run.findById(id))!;
    expect(f.signal().aborted).toBe(true);
    expect(run.status).toBe('failed');
    expect(run.failureReason).toBe('interrupted');
    expect(run.result).toBeNull();
    expect(run.auditEvents.at(-1)?.reason).toBe('interrupted');
  } finally {
    client.destroy();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

it('allows explicit simulation but blocks all local model requests in production', async () => {
  const id = await create();
  process.env.NODE_ENV = 'production';
  process.env.AI_PROVIDER = 'disabled';
  const fresh = createRunExecutor();
  jest.spyOn(runExecutor, 'execute').mockImplementation(fresh.execute);
  const network = jest
    .spyOn(globalThis, 'fetch')
    .mockRejectedValue(new Error('No production model requests allowed'));
  expect((await execute(id, { mode: 'local' })).status).toBe(503);
  expect((await Run.findById(id))!.status).toBe('queued');
  const simulated = await execute(id, { mode: 'demo' });
  expect(simulated.status).toBe(200);
  expect(simulated.body.run.result.simulation).toBe(true);
  expect(network).not.toHaveBeenCalled();
});

it('denies changed assignment while draft generation is pending', async () => {
  const id = await create();
  const f = pendingProvider();
  const pending = execute(id).then((value) => value);
  await f.entered;
  await Task.updateOne(
    { _id: task, owner },
    { $set: { assigneeType: 'user', assigneeAgent: null } },
  );
  f.finish();
  expect((await pending).status).toBe(403);
  expect((await Run.findById(id))!.result).toBeNull();
  expect((await Run.findById(id))!.failureReason).toBe('permission-denied');
});

it('reuses the same provider instance across distinct explicitly requested drafts', async () => {
  const first = await create();
  const second = await create();
  const fresh = createRunExecutor();
  jest.spyOn(runExecutor, 'execute').mockImplementation(fresh.execute);
  const resolver = jest.spyOn(providers, 'resolveConfiguredProvider');
  expect((await execute(first)).status).toBe(200);
  expect((await execute(second)).status).toBe(200);
  expect(resolver).toHaveBeenCalledTimes(1);
});

it('bounds per-mode capacity without claiming or cancelling another queued run', async () => {
  const first = await create();
  const second = await create();
  const f = pendingProvider();
  const pending = execute(first).then((value) => value);
  await f.entered;
  expect((await execute(second)).status).toBe(409);
  expect(f.chat).toHaveBeenCalledTimes(1);
  expect(f.signal().aborted).toBe(false);
  const blocked = (await Run.findById(second))!;
  expect(blocked.status).toBe('queued');
  expect(blocked.version).toBe(0);
  expect(blocked.auditEvents).toHaveLength(1);
  f.finish();
  expect((await pending).status).toBe(200);
});
