import mongoose from 'mongoose';
import { randomUUID } from 'node:crypto';
import { User } from '../src/models/userModel';
import { Task } from '../src/models/taskModel';
import { Agent } from '../src/models/agentModel';
import { Project } from '../src/models/projectModel';
import { Run, digestRunResult } from '../src/models/runModel';
import { AuditEvent } from '../src/models/auditEventModel';
import { KnowledgeSource } from '../src/models/knowledgeSourceModel';
import { KnowledgeDenial } from '../src/models/knowledgeDenialModel';
import { createKnowledge, changeKnowledge } from '../src/services/knowledgeService';
import { createKnowledgeIndexer } from '../src/services/knowledgeIndexService';
import { createOwnedRun, reviewRun } from '../src/services/runService';
import { createRunExecutor } from '../src/services/runService/execution';
import { createAIProvider, type ProviderAdapter } from '../src/ai/provider';
import { PINNED_EMBEDDING } from '../src/ai/embedding';
import * as audit from '../src/services/auditService';
const parent = process.env.TEST_MONGO_URI;
if (
  !parent ||
  !/^mongodb:\/\/(?:127[.]0[.]0[.]1|localhost):[0-9]{1,5}\/taskforge_qa_[a-zA-Z0-9_]{8,}$/.test(
    parent,
  )
)
  throw new Error('Grounded QA requires fresh loopback Mongo namespace');
let owner: string;
let stranger: string;
const vector = (coordinate = 0) =>
  Array.from({ length: 384 }, (_, i) => (i === coordinate ? 1 : 0));
const provider = (
  action: (
    messages: readonly { role: string; content: string }[],
  ) => Promise<unknown> = async () => ({
    answer: 'The supplied release note requires build verification.',
    citations: ['K1'],
  }),
) => {
  const embed = jest.fn(async (texts: readonly string[]) => texts.map(() => vector()));
  const structured = jest.fn(action);
  const adapter: ProviderAdapter = {
    id: 'ollama',
    simulation: false,
    label: 'Synthetic local fixture; not real inference',
    chat: async () => 'unused',
    structuredOutput: (messages) => structured(messages),
    embedding: { identity: PINNED_EMBEDDING, embed },
  };
  return { ai: createAIProvider(adapter), embed, structured };
};
const createRun = async (
  owner: string,
  input: { taskId: string; agentId: string; input: string },
  key: string,
) => (await createOwnedRun(owner, { ...input, idempotencyKey: key })).run;
const fixture = async (permission = true, projectScope = false) => {
  const agent = await Agent.create({
    owner,
    name: 'Knowledge reviewer',
    role: 'Research',
    permissions: [
      'task.read',
      'artifact.draft',
      ...(permission ? ['knowledge.read'] : []),
      ...(projectScope ? ['project.read'] : []),
    ],
  });
  const project = projectScope ? await Project.create({ owner, name: 'Grounded project' }) : null;
  const task = await Task.create({
    owner,
    title: 'Release question',
    description: 'Base notes must not be used as uncited knowledge.',
    assigneeType: 'agent',
    assigneeAgent: agent._id,
    project: project?._id ?? null,
  });
  const run = await createRun(
    owner,
    { taskId: task.id, agentId: agent.id, input: 'What does release verification require?' },
    randomUUID(),
  );
  const source = (
    await createKnowledge(
      owner,
      {
        title: 'Release reference',
        content:
          'Release verification requires matching the served client and API build identities.',
        kind: 'note',
        project: project?.id ?? null,
      },
      randomUUID(),
    )
  ).source!;
  const indexing = provider();
  await createKnowledgeIndexer(indexing.ai).index({
    owner,
    id: source.id!,
    version: source.version,
    contentDigest: source.contentDigest,
  });
  return { agent, project, task, run, source };
};
beforeAll(async () => {
  await mongoose.connect(parent + '_grounded', {
    autoCreate: false,
    autoIndex: false,
    serverSelectionTimeoutMS: 5000,
  });
  const db = mongoose.connection.db;
  if (!db || (await db.listCollections().toArray()).length)
    throw new Error('Refusing existing grounded collections');
  for (const model of [
    User,
    Task,
    Agent,
    Project,
    Run,
    AuditEvent,
    KnowledgeSource,
    KnowledgeDenial,
  ]) {
    await model.createCollection();
    await model.createIndexes();
  }
  stranger = (
    await User.create({ email: 'grounded-other@example.test', password: 'synthetic-only' })
  ).id;
});
beforeEach(async () => {
  owner = (
    await User.create({
      email: 'grounded-' + randomUUID() + '@example.test',
      password: 'synthetic-only',
    })
  ).id;
});
afterEach(() => jest.restoreAllMocks());
afterAll(async () => mongoose.disconnect());
it('persists a source-fenced local grounded draft and exact human review without changing tasks', async () => {
  const data = await fixture();
  const local = provider();
  const executor = createRunExecutor({ providerForMode: () => local.ai });
  const result = await executor.execute(owner, data.run.id, 'local', undefined, false, 'knowledge');
  expect(result.status).toBe('awaiting-approval');
  expect(result.workflow).toBe('knowledge');
  expect(local.embed).toHaveBeenCalledTimes(1);
  expect(local.structured).toHaveBeenCalledTimes(1);
  const report = (
    result.result as {
      knowledge: { retrieval: { excerpts: { sourceId: string; quote: string }[] } };
    }
  ).knowledge;
  expect(report.retrieval.excerpts[0]).toMatchObject({
    sourceId: data.source.id,
    quote: data.source.content,
  });
  expect(local.structured.mock.calls[0][0][1].content).not.toContain('Base notes must not');
  const reviewed = await reviewRun(
    owner,
    result.id,
    result.version,
    'approved',
    digestRunResult(result.result)!,
  );
  expect(reviewed?.status).toBe('approved');
  expect((await Task.findById(data.task.id))?.title).toBe('Release question');
});
it('missing knowledge permission blocks before claim or any model call', async () => {
  const data = await fixture(false);
  const local = provider();
  await expect(
    createRunExecutor({ providerForMode: () => local.ai }).execute(
      owner,
      data.run.id,
      'local',
      undefined,
      false,
      'knowledge',
    ),
  ).rejects.toMatchObject({ status: 403 });
  expect(local.embed).not.toHaveBeenCalled();
  expect(local.structured).not.toHaveBeenCalled();
  expect((await Run.findById(data.run.id))?.status).toBe('queued');
});
it('foreign owner cannot read context or invoke models', async () => {
  const data = await fixture();
  const local = provider();
  await expect(
    createRunExecutor({ providerForMode: () => local.ai }).execute(
      stranger,
      data.run.id,
      'local',
      undefined,
      false,
      'knowledge',
    ),
  ).rejects.toMatchObject({ status: 404 });
  expect(local.embed).not.toHaveBeenCalled();
});
it('simulation is explicitly unsupported for semantic knowledge drafts', async () => {
  const data = await fixture();
  const local = provider();
  await expect(
    createRunExecutor({ providerForMode: () => local.ai }).execute(
      owner,
      data.run.id,
      'demo',
      undefined,
      false,
      'knowledge',
    ),
  ).rejects.toMatchObject({ status: 400 });
  expect(local.embed).not.toHaveBeenCalled();
});
it('project knowledge requires explicit project selection and current permission', async () => {
  const data = await fixture(true, true);
  const local = provider();
  await expect(
    createRunExecutor({ providerForMode: () => local.ai }).execute(
      owner,
      data.run.id,
      'local',
      undefined,
      false,
      'knowledge',
    ),
  ).rejects.toMatchObject({ status: 503 });
  expect(local.embed).not.toHaveBeenCalled();
  const next = await createRun(
    owner,
    {
      taskId: data.task.id,
      agentId: data.agent.id,
      input: 'What does release verification require?',
    },
    randomUUID(),
  );
  const result = await createRunExecutor({ providerForMode: () => local.ai }).execute(
    owner,
    next.id,
    'local',
    undefined,
    true,
    'knowledge',
  );
  expect(result.status).toBe('awaiting-approval');
});
it.each(['edit', 'delete', 'permission'] as const)(
  'rejects %s changes during generation without persisting a grounded answer',
  async (change) => {
    const data = await fixture();
    const local = provider(async () => {
      if (change === 'edit')
        await changeKnowledge(owner, data.source.id!, 1, data.source.contentDigest, {
          title: data.source.title,
          content: 'Changed text',
          kind: 'note',
          project: null,
        });
      if (change === 'delete')
        await changeKnowledge(owner, data.source.id!, 1, data.source.contentDigest, null);
      if (change === 'permission')
        await Agent.updateOne(
          { _id: data.agent.id, owner },
          { $set: { permissions: ['task.read', 'artifact.draft'] } },
        );
      return { answer: 'A draft', citations: ['K1'] };
    });
    await expect(
      createRunExecutor({ providerForMode: () => local.ai }).execute(
        owner,
        data.run.id,
        'local',
        undefined,
        false,
        'knowledge',
      ),
    ).rejects.toHaveProperty('status');
    const failed = await Run.findById(data.run.id);
    expect(failed?.status).toBe('failed');
    expect(failed?.result).toBeNull();
  },
);
it('invalid generated citations fail runtime validation rather than inventing source links', async () => {
  const data = await fixture();
  const local = provider(async () => ({ answer: 'A draft', citations: ['foreign'] }));
  await expect(
    createRunExecutor({ providerForMode: () => local.ai }).execute(
      owner,
      data.run.id,
      'local',
      undefined,
      false,
      'knowledge',
    ),
  ).rejects.toMatchObject({ status: 503 });
  expect((await Run.findById(data.run.id))?.result).toBeNull();
});
it.each(['edit', 'delete', 'permission'] as const)(
  'approval fails closed after %s but owner can reject the stale draft',
  async (change) => {
    const data = await fixture();
    const local = provider();
    const result = await createRunExecutor({ providerForMode: () => local.ai }).execute(
      owner,
      data.run.id,
      'local',
      undefined,
      false,
      'knowledge',
    );
    if (change === 'edit')
      await changeKnowledge(owner, data.source.id!, 1, data.source.contentDigest, {
        title: data.source.title,
        content: 'New text',
        kind: 'note',
        project: null,
      });
    if (change === 'delete')
      await changeKnowledge(owner, data.source.id!, 1, data.source.contentDigest, null);
    if (change === 'permission')
      await Agent.updateOne(
        { _id: data.agent.id, owner },
        { $set: { permissions: ['task.read', 'artifact.draft'] } },
      );
    await expect(
      reviewRun(owner, result.id, result.version, 'approved', digestRunResult(result.result)!),
    ).rejects.toMatchObject({ status: 409 });
    expect(
      (
        await reviewRun(
          owner,
          result.id,
          result.version,
          'rejected',
          digestRunResult(result.result)!,
        )
      )?.status,
    ).toBe('rejected');
  },
);

it('permission revocation during query embedding prevents sending source quotes to generation', async () => {
  const data = await fixture();
  const structured = jest.fn(async () => ({ answer: 'Forbidden', citations: ['K1'] }));
  const ai = createAIProvider({
    id: 'ollama',
    simulation: false,
    label: 'Fixture',
    chat: async () => '',
    structuredOutput: structured,
    embedding: {
      identity: PINNED_EMBEDDING,
      embed: async (texts) => {
        await Agent.updateOne(
          { _id: data.agent.id, owner },
          { $set: { permissions: ['task.read', 'artifact.draft'] } },
        );
        return texts.map(() => vector());
      },
    },
  });
  await expect(
    createRunExecutor({ providerForMode: () => ai }).execute(
      owner,
      data.run.id,
      'local',
      undefined,
      false,
      'knowledge',
    ),
  ).rejects.toMatchObject({ status: 403 });
  expect(structured).not.toHaveBeenCalled();
  expect((await Run.findById(data.run.id))?.result).toBeNull();
});
it('source edits during query embedding prevent stale quote generation and record a context denial', async () => {
  const data = await fixture();
  const structured = jest.fn(async () => ({ answer: 'Forbidden', citations: ['K1'] }));
  const ai = createAIProvider({
    id: 'ollama',
    simulation: false,
    label: 'Fixture',
    chat: async () => '',
    structuredOutput: structured,
    embedding: {
      identity: PINNED_EMBEDDING,
      embed: async (texts) => {
        await changeKnowledge(owner, data.source.id!, 1, data.source.contentDigest, {
          title: data.source.title,
          content: 'Replaced before generation',
          kind: 'note',
          project: null,
        });
        return texts.map(() => vector());
      },
    },
  });
  await expect(
    createRunExecutor({ providerForMode: () => ai }).execute(
      owner,
      data.run.id,
      'local',
      undefined,
      false,
      'knowledge',
    ),
  ).rejects.toMatchObject({ status: 503 });
  expect(structured).not.toHaveBeenCalled();
  expect(await AuditEvent.countDocuments({ owner, reason: 'context-source-changed' })).toBe(1);
});
it('revoked project access and changed project scope block approval', async () => {
  const data = await fixture(true, true);
  const local = provider();
  const result = await createRunExecutor({ providerForMode: () => local.ai }).execute(
    owner,
    data.run.id,
    'local',
    undefined,
    true,
    'knowledge',
  );
  const other = await Project.create({ owner, name: 'Different current project' });
  await Task.updateOne({ _id: data.task.id, owner }, { $set: { project: other._id } });
  await expect(
    reviewRun(owner, result.id, result.version, 'approved', digestRunResult(result.result)!),
  ).rejects.toMatchObject({ status: 409 });
});
it('an interrupted query leaves no answer and no automatic generation or replay', async () => {
  const data = await fixture();
  const controller = new AbortController();
  const structured = jest.fn(async () => ({ answer: 'Forbidden', citations: ['K1'] }));
  const ai = createAIProvider({
    id: 'ollama',
    simulation: false,
    label: 'Fixture',
    chat: async () => '',
    structuredOutput: structured,
    embedding: {
      identity: PINNED_EMBEDDING,
      embed: async (texts) => {
        controller.abort();
        return texts.map(() => vector());
      },
    },
  });
  await expect(
    createRunExecutor({ providerForMode: () => ai }).execute(
      owner,
      data.run.id,
      'local',
      controller.signal,
      false,
      'knowledge',
    ),
  ).rejects.toHaveProperty('status');
  expect(structured).not.toHaveBeenCalled();
  expect((await Run.findById(data.run.id))?.result).toBeNull();
});

it('revalidates custom provider output before saving a grounded draft', async () => {
  const data = await fixture();
  const local = provider();
  const malformed = { answer: 'Unsupported', citations: ['K1'], extra: true };
  jest.spyOn(local.ai, 'structuredOutput').mockResolvedValue({
    value: malformed,
    provider: 'ollama',
    simulation: false,
    label: 'Synthetic invalid output',
  } as never);
  await expect(
    createRunExecutor({ providerForMode: () => local.ai }).execute(
      owner,
      data.run.id,
      'local',
      undefined,
      false,
      'knowledge',
    ),
  ).rejects.toMatchObject({ status: 503 });
  const failed = await Run.findById(data.run.id);
  expect(failed?.status).toBe('failed');
  expect(failed?.result).toBeNull();
});
it('fences a claimed run even when an insufficient-context denial audit cannot be recorded', async () => {
  const data = await fixture();
  await changeKnowledge(owner, data.source.id!, data.source.version, data.source.contentDigest, {
    title: data.source.title,
    content: 'Changed unindexed text',
    kind: 'note',
    project: null,
  });
  const local = provider();
  jest.spyOn(audit, 'recordRunDenial').mockRejectedValue(new audit.AuditUnavailableError());
  await expect(
    createRunExecutor({ providerForMode: () => local.ai }).execute(
      owner,
      data.run.id,
      'local',
      undefined,
      false,
      'knowledge',
    ),
  ).rejects.toBeInstanceOf(audit.AuditUnavailableError);
  const failed = await Run.findById(data.run.id);
  expect(failed?.status).toBe('failed');
  expect(failed?.result).toBeNull();
  expect(failed?.auditEvents.at(-1)?.kind).toBe('failed');
  expect(local.embed).not.toHaveBeenCalled();
  expect(local.structured).not.toHaveBeenCalled();
});
