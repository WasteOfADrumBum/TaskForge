import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { randomUUID } from 'node:crypto';
import { User } from '../models/userModel';
import { Task } from '../models/taskModel';
import { Agent } from '../models/agentModel';
import { Project } from '../models/projectModel';
import { Run, digestRunResult } from '../models/runModel';
import { AuditEvent } from '../models/auditEventModel';
import { KnowledgeSource } from '../models/knowledgeSourceModel';
import { KnowledgeDenial } from '../models/knowledgeDenialModel';
import { PINNED_EMBEDDING } from '../ai/embedding';
import { resolveConfiguredProvider } from '../ai/provider';
import { createKnowledge } from '../services/knowledgeService';
import { createKnowledgeIndexer } from '../services/knowledgeIndexService';
import { createOwnedRun, reviewRun } from '../services/runService';
import { createRunExecutor } from '../services/runService/execution';
import type { GroundedReport } from '../services/groundedKnowledgeService';
const namespace = process.env.TEST_MONGO_URI;
if (
  process.argv.slice(2).join(' ') !== '--local-only --grounded-only' ||
  process.env.NODE_ENV === 'production' ||
  process.env.AI_PROVIDER !== 'ollama' ||
  process.env.OLLAMA_EMBEDDING_MODEL !== PINNED_EMBEDDING.model ||
  !namespace ||
  !/^mongodb:\/\/(?:127[.]0[.]0[.]1|localhost):[0-9]{1,5}\/taskforge_qa_[a-zA-Z0-9_]{8,}$/.test(
    namespace,
  )
) {
  console.error(
    'Local grounded smoke requires pinned explicit local opt-in and fresh loopback MongoDB.',
  );
  process.exit(1);
}
try {
  await mongoose.connect(namespace, {
    autoCreate: false,
    autoIndex: false,
    serverSelectionTimeoutMS: 5000,
  });
  const db = mongoose.connection.db;
  assert.ok(db);
  assert.equal((await db.listCollections().toArray()).length, 0);
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
  const owner = (
    await User.create({
      email: 'grounded-local-' + randomUUID() + '@example.test',
      password: 'synthetic-only',
    })
  ).id;
  const agent = await Agent.create({
    owner,
    name: 'Synthetic knowledge agent',
    role: 'Research',
    permissions: ['task.read', 'artifact.draft', 'knowledge.read'],
  });
  const task = await Task.create({
    owner,
    title: 'Synthetic release question',
    assigneeType: 'agent',
    assigneeAgent: agent._id,
  });
  const body =
    'Release verification requires matching the client and API build identities. Tests, independent review and CI must pass before release.';
  const source = (
    await createKnowledge(
      owner,
      { title: 'Synthetic release guide', content: body, kind: 'note', project: null },
      randomUUID(),
    )
  ).source!;
  const provider = resolveConfiguredProvider();
  await createKnowledgeIndexer(provider).index({
    owner,
    id: source.id!,
    version: source.version,
    contentDigest: source.contentDigest,
  });
  const { run } = await createOwnedRun(owner, {
    taskId: task.id,
    agentId: agent.id,
    input: 'What does release verification require?',
    idempotencyKey: randomUUID(),
  });
  const drafted = await createRunExecutor({
    providerForMode: () => provider,
    timeoutMs: 60000,
  }).execute(owner, run.id, 'local', undefined, false, 'knowledge');
  assert.equal(drafted.status, 'awaiting-approval');
  const result = drafted.result as { knowledge: GroundedReport; simulation: boolean };
  assert.equal(result.simulation, false);
  assert.equal(result.knowledge.retrieval.excerpts[0].sourceId, source.id);
  assert.equal(result.knowledge.retrieval.excerpts[0].quote, body);
  assert.ok(result.knowledge.answer.citations.includes('K1'));
  const reviewed = await reviewRun(
    owner,
    drafted.id,
    drafted.version,
    'approved',
    digestRunResult(drafted.result)!,
  );
  assert.equal(reviewed?.status, 'approved');
  assert.equal((await Task.findById(task.id))?.title, 'Synthetic release question');
  console.log(
    JSON.stringify({
      status: 'passed',
      actualOllama: true,
      actualMongo: true,
      model: process.env.OLLAMA_MODEL,
      pinnedEmbedding: PINNED_EMBEDDING.model,
      sourceVersion: source.version,
      citations: result.knowledge.answer.citations,
      exactQuote: true,
      humanReview: 'approved',
      taskUnchanged: true,
      productionCalls: 0,
      paidCalls: 0,
    }),
  );
} catch {
  console.error(
    'Local grounded smoke failed; no fallback, replay, production access or reset performed.',
  );
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
