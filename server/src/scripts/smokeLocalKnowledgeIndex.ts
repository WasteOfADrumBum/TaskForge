import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import mongoose from 'mongoose';
import { PINNED_EMBEDDING } from '../ai/embedding';
import { resolveConfiguredProvider } from '../ai/provider';
import { User } from '../models/userModel';
import { Project } from '../models/projectModel';
import { KnowledgeSource } from '../models/knowledgeSourceModel';
import { KnowledgeDenial } from '../models/knowledgeDenialModel';
import { createKnowledge, changeKnowledge, getKnowledge } from '../services/knowledgeService';
import {
  createKnowledgeIndexer,
  getCurrentKnowledgeIndexes,
} from '../services/knowledgeIndexService';
import { matchesKnowledgeIndex } from '../services/knowledgeIndexService/primitives';
const namespace = process.env.TEST_MONGO_URI;
if (
  process.argv.slice(2).join(' ') !== '--local-only --index-only' ||
  process.env.NODE_ENV === 'production' ||
  process.env.AI_PROVIDER !== 'ollama' ||
  process.env.OLLAMA_EMBEDDING_MODEL !== PINNED_EMBEDDING.model ||
  !namespace ||
  !/^mongodb:\/\/(?:127[.]0[.]0[.]1|localhost):[0-9]{1,5}\/taskforge_qa_[a-zA-Z0-9_]{8,}$/.test(
    namespace,
  )
) {
  console.error(
    'Local index smoke requires pinned explicit local opt-in and fresh loopback MongoDB.',
  );
  process.exit(1);
}
// Never read MONGO_URI/dotenv or reset existing records. The harness owns this synthetic namespace.
try {
  await mongoose.connect(namespace, {
    autoCreate: false,
    autoIndex: false,
    serverSelectionTimeoutMS: 5000,
  });
  const db = mongoose.connection.db;
  assert.ok(db);
  assert.equal((await db.listCollections().toArray()).length, 0);
  for (const model of [User, Project, KnowledgeSource, KnowledgeDenial]) {
    await model.createCollection();
    await model.createIndexes();
  }
  const owner = (
    await User.create({
      email: 'local-index-' + randomUUID() + '@example.test',
      password: 'synthetic-only',
    })
  ).id;
  const stranger = (
    await User.create({
      email: 'local-stranger-' + randomUUID() + '@example.test',
      password: 'synthetic-only',
    })
  ).id;
  const input = {
    title: 'Synthetic release knowledge',
    content:
      'Release verification requires matching API and client identities. '.repeat(10) +
      '😀 exact Unicode quote.',
    kind: 'text' as const,
    project: null,
  };
  const source = (await createKnowledge(owner, input, randomUUID())).source!;
  const realProvider = resolveConfiguredProvider();
  let modelCalls = 0;
  const indexer = createKnowledgeIndexer({
    ...realProvider,
    embed: (texts, options) => {
      modelCalls++;
      return realProvider.embed(texts, options);
    },
  });
  const call = {
    owner,
    id: source.id!,
    version: source.version,
    contentDigest: source.contentDigest,
  };
  const index = await indexer.index(call);
  assert.deepEqual(index.identity, PINNED_EMBEDDING);
  assert.ok(index.chunks.length > 1);
  assert.ok(matchesKnowledgeIndex(index, { ...source, id: source.id!, content: input.content }));
  const current = await getCurrentKnowledgeIndexes(owner);
  assert.equal(current.length, 1);
  assert.equal(current[0].index.chunks.length, index.chunks.length);
  assert.equal(Object.hasOwn(await getKnowledge(owner, source.id!), 'embeddingIndex'), false);
  const callsBefore = modelCalls;
  await indexer.index(call);
  assert.equal(modelCalls, callsBefore);
  await assert.rejects(indexer.index({ ...call, owner: stranger }), { status: 404 });
  assert.equal(modelCalls, callsBefore);
  assert.equal((await getCurrentKnowledgeIndexes(stranger)).length, 0);
  const changed = (await changeKnowledge(owner, source.id!, source.version, source.contentDigest, {
    ...input,
    content: 'Updated synthetic source text.',
  }))!;
  assert.equal((await getCurrentKnowledgeIndexes(owner)).length, 0);
  await assert.rejects(indexer.index(call), { status: 409 });
  assert.equal(modelCalls, callsBefore);
  await indexer.index({ ...call, version: changed.version, contentDigest: changed.contentDigest });
  await changeKnowledge(owner, source.id!, changed.version, changed.contentDigest, null);
  assert.equal((await getCurrentKnowledgeIndexes(owner)).length, 0);
  const deleted = await KnowledgeSource.findById(source.id).select('+embeddingIndex');
  assert.equal(deleted?.content, '');
  assert.equal(deleted?.embeddingIndex, undefined);
  assert.deepEqual(
    deleted?.auditEvents.map((event) => event.kind),
    ['created', 'indexed', 'updated', 'indexed', 'deleted'],
  );
  console.log(
    JSON.stringify({
      status: 'passed',
      actualOllama: true,
      actualMongo: true,
      identity: index.identity,
      chunks: index.chunks.length,
      modelCalls,
      ownershipIsolation: true,
      editDeleteInvalidation: true,
      productionCalls: 0,
      paidCalls: 0,
    }),
  );
} catch {
  console.error('Local index smoke failed; no fallback, production access or reset performed.');
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
