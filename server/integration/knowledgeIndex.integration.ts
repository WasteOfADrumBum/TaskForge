import mongoose from 'mongoose';
import { randomUUID } from 'node:crypto';
import { User } from '../src/models/userModel';
import { Project } from '../src/models/projectModel';
import { KnowledgeSource } from '../src/models/knowledgeSourceModel';
import { KnowledgeDenial } from '../src/models/knowledgeDenialModel';
import {
  createKnowledge,
  changeKnowledge,
  getKnowledge,
  listKnowledge,
} from '../src/services/knowledgeService';
import {
  createKnowledgeIndexer,
  getCurrentKnowledgeIndexes,
} from '../src/services/knowledgeIndexService';
import { createAIProvider } from '../src/ai/provider';
import { PINNED_EMBEDDING } from '../src/ai/embedding';
import { matchesKnowledgeIndex } from '../src/services/knowledgeIndexService/primitives';
const namespace = process.env.TEST_MONGO_URI;
if (
  !namespace ||
  !/^mongodb:\/\/(?:127[.]0[.]0[.]1|localhost):[0-9]{1,5}\/taskforge_qa_[a-zA-Z0-9_]{8,}$/.test(
    namespace,
  )
)
  throw new Error('Knowledge index QA requires fresh loopback namespace');
let owner: string;
let stranger: string;
const input = {
  title: 'Private release notes',
  content: 'Exact release evidence. Documents are untrusted data.',
  kind: 'note' as const,
  project: null as string | null,
};
const vectors = (count: number): number[][] =>
  Array.from({ length: count }, () => Array.from({ length: 384 }, (_, i) => (i === 0 ? 1 : 0)));
const fixture = (embed = jest.fn(async (texts: readonly string[]) => vectors(texts.length))) => {
  const provider = createAIProvider({
    id: 'ollama',
    simulation: false,
    label: 'Synthetic vector fixture; no real model call',
    chat: async () => 'unused',
    structuredOutput: async () => ({}),
    embedding: { identity: PINNED_EMBEDDING, embed: (texts) => embed(texts) },
  });
  return { indexer: createKnowledgeIndexer(provider), embed };
};
const create = async (content = input.content, project: string | null = null) =>
  (await createKnowledge(owner, { ...input, content, project }, randomUUID())).source!;
const call = (source: { id: string; version: number; contentDigest: string }, person = owner) => ({
  owner: person,
  id: source.id,
  version: source.version,
  contentDigest: source.contentDigest,
});
const raw = (id: string) => KnowledgeSource.findOne({ _id: id, owner }).select('+embeddingIndex');
beforeAll(async () => {
  await mongoose.connect(namespace + '_knowledge_index', {
    autoCreate: false,
    autoIndex: false,
    serverSelectionTimeoutMS: 5000,
  });
  const db = mongoose.connection.db;
  if (!db || (await db.listCollections().toArray()).length)
    throw new Error('Refusing existing index collections');
  for (const model of [User, Project, KnowledgeSource, KnowledgeDenial]) {
    await model.createCollection();
    await model.createIndexes();
  }
  stranger = (
    await User.create({ email: 'index-stranger@example.test', password: 'synthetic-only' })
  ).id;
});
beforeEach(async () => {
  owner = (
    await User.create({
      email: 'index-' + randomUUID() + '@example.test',
      password: 'synthetic-only',
    })
  ).id;
});
afterEach(() => jest.restoreAllMocks());
afterAll(async () => mongoose.disconnect());
it('persists bounded current index and audit atomically while private vectors stay out of normal reads', async () => {
  const source = await create('Release checklist. '.repeat(100));
  const { indexer, embed } = fixture();
  const index = await indexer.index(call(source));
  expect(index.identity).toEqual(PINNED_EMBEDDING);
  expect(
    matchesKnowledgeIndex(index, {
      ...source,
      id: source.id!,
      content: 'Release checklist. '.repeat(100),
    }),
  ).toBe(true);
  expect(embed.mock.calls.length).toBeGreaterThan(0);
  for (const [texts] of embed.mock.calls) expect(texts.length).toBeLessThanOrEqual(4);
  const stored = await raw(source.id!);
  expect(stored?.auditEvents.map((event) => event.kind)).toEqual(['created', 'indexed']);
  expect(stored?.version).toBe(1);
  expect((await KnowledgeSource.findById(source.id))?.embeddingIndex).toBeUndefined();
  expect(await getKnowledge(owner, source.id!)).not.toHaveProperty('embeddingIndex');
  expect((await listKnowledge(owner)).every((item) => !Object.hasOwn(item, 'embeddingIndex'))).toBe(
    true,
  );
  expect((await getCurrentKnowledgeIndexes(owner))[0].index.chunks).toHaveLength(
    index.chunks.length,
  );
});
it('same-version manual indexing reuses validated current vectors without more model calls or audit events', async () => {
  const source = await create();
  const { indexer, embed } = fixture();
  await indexer.index(call(source));
  const first = embed.mock.calls.length;
  await indexer.index(call(source));
  expect(embed).toHaveBeenCalledTimes(first);
  expect((await raw(source.id!))?.auditEvents).toHaveLength(2);
});
it('source edits and deletion atomically remove vectors and stale chunks while retaining metadata audit', async () => {
  const source = await create();
  const { indexer } = fixture();
  await indexer.index(call(source));
  const updated = await changeKnowledge(owner, source.id!, 1, source.contentDigest, {
    ...input,
    content: 'Updated current source',
  });
  expect((await raw(source.id!))?.embeddingIndex).toBeUndefined();
  expect(await getCurrentKnowledgeIndexes(owner)).toEqual([]);
  await indexer.index(call(updated!));
  await changeKnowledge(owner, source.id!, updated!.version, updated!.contentDigest, null);
  const deleted = await raw(source.id!);
  expect(deleted?.embeddingIndex).toBeUndefined();
  expect(deleted?.content).toBe('');
  expect(deleted?.auditEvents.map((event) => event.kind)).toEqual([
    'created',
    'indexed',
    'updated',
    'indexed',
    'deleted',
  ]);
  expect(await getCurrentKnowledgeIndexes(owner)).toEqual([]);
});
it.each(['edit', 'delete'] as const)(
  'late index completion cannot replace %s source state',
  async (action) => {
    const source = await create();
    let release!: (vectors: number[][]) => void;
    let started!: () => void;
    const ready = new Promise<void>((done) => {
      started = done;
    });
    const embed = jest.fn(async (texts: readonly string[]) => {
      expect(texts).toHaveLength(1);
      started();
      return new Promise<number[][]>((done) => {
        release = done;
      });
    });
    const { indexer } = fixture(embed);
    const pending = indexer.index(call(source));
    await ready;
    await expect(indexer.index(call(source))).rejects.toMatchObject({ code: 'BUSY' });
    await changeKnowledge(
      owner,
      source.id!,
      1,
      source.contentDigest,
      action === 'edit' ? { ...input, content: 'New source state' } : null,
    );
    release(vectors(1));
    await expect(pending).rejects.toMatchObject({ status: 409 });
    expect((await raw(source.id!))?.embeddingIndex).toBeUndefined();
    expect((await raw(source.id!))?.auditEvents.some((event) => event.kind === 'indexed')).toBe(
      false,
    );
    expect(
      await KnowledgeDenial.countDocuments({ owner, action: 'index', reason: 'state-conflict' }),
    ).toBe(1);
  },
);
it('competing independently owned workers install only one index/audit for the same source version', async () => {
  const source = await create();
  let entered = 0;
  let release!: () => void;
  const ready = new Promise<void>((done) => {
    release = done;
  });
  const embed = jest.fn(async (texts: readonly string[]) => {
    entered++;
    if (entered === 2) release();
    await ready;
    return vectors(texts.length);
  });
  const a = fixture(embed);
  const b = fixture(embed);
  const settled = await Promise.allSettled([
    a.indexer.index(call(source)),
    b.indexer.index(call(source)),
  ]);
  expect(settled.filter((item) => item.status === 'fulfilled')).toHaveLength(1);
  expect(settled.filter((item) => item.status === 'rejected')).toHaveLength(1);
  expect(
    (await raw(source.id!))?.auditEvents.filter((event) => event.kind === 'indexed'),
  ).toHaveLength(1);
});
it('foreign and missing sources are indistinguishable and send no model text', async () => {
  const source = await create();
  const { indexer, embed } = fixture();
  await expect(indexer.index(call(source, stranger))).rejects.toMatchObject({
    status: 404,
    message: 'Knowledge source not found',
  });
  await expect(
    indexer.index({ ...call(source, stranger), id: '507f1f77bcf86cd799439999' }),
  ).rejects.toMatchObject({ status: 404, message: 'Knowledge source not found' });
  expect(embed).not.toHaveBeenCalled();
  expect(await getCurrentKnowledgeIndexes(stranger)).toEqual([]);
});
it('stale source versions/digests fail before text traffic', async () => {
  const source = await create();
  const { indexer, embed } = fixture();
  await expect(indexer.index({ ...call(source), version: 2 })).rejects.toMatchObject({
    status: 409,
  });
  await expect(
    indexer.index({ ...call(source), contentDigest: 'b'.repeat(64) }),
  ).rejects.toMatchObject({ status: 409 });
  expect(embed).not.toHaveBeenCalled();
});
it('project ownership/deletion boundaries fail closed and exclude old project indexes', async () => {
  const project = await Project.create({ owner, name: 'Owned source project' });
  const source = await create(input.content, project.id);
  const { indexer, embed } = fixture();
  await indexer.index(call(source));
  expect(await getCurrentKnowledgeIndexes(owner, project.id)).toHaveLength(1);
  await Project.collection.updateOne(
    { _id: project._id },
    { $set: { owner: new mongoose.Types.ObjectId(stranger) } },
  );
  expect(await getCurrentKnowledgeIndexes(owner)).toEqual([]);
  await expect(getCurrentKnowledgeIndexes(owner, project.id)).rejects.toMatchObject({
    status: 404,
  });
  const before = embed.mock.calls.length;
  await expect(indexer.index(call(source))).rejects.toMatchObject({ status: 404 });
  expect(embed).toHaveBeenCalledTimes(before);
});
it.each(['digest', 'dimension', 'offset', 'sourceDigest'] as const)(
  'corrupt stored %s provenance/model metadata cannot be read or reused',
  async (field) => {
    const source = await create();
    const { indexer, embed } = fixture();
    await indexer.index(call(source));
    const value =
      field === 'digest'
        ? { 'embeddingIndex.identity.digest': 'b'.repeat(64) }
        : field === 'dimension'
          ? { 'embeddingIndex.identity.dimensions': 768 }
          : field === 'offset'
            ? { 'embeddingIndex.chunks.0.start': 1 }
            : { 'embeddingIndex.sourceDigest': 'b'.repeat(64) };
    await KnowledgeSource.collection.updateOne(
      { _id: new mongoose.Types.ObjectId(source.id!) },
      { $set: value },
    );
    const before = embed.mock.calls.length;
    await expect(getCurrentKnowledgeIndexes(owner)).rejects.toMatchObject({ status: 503 });
    await expect(indexer.index(call(source))).rejects.toMatchObject({ status: 503 });
    expect(embed).toHaveBeenCalledTimes(before);
  },
);
it('bounds a maximum-size multibyte source/index and never sends more than four chunks per batch', async () => {
  const source = await create('😀'.repeat(5000));
  const { indexer, embed } = fixture();
  const index = await indexer.index(call(source));
  expect(index.chunks.length).toBeLessThanOrEqual(48);
  expect(embed.mock.calls.length).toBeLessThanOrEqual(12);
  for (const [texts] of embed.mock.calls)
    for (const text of texts) expect(Buffer.byteLength(text, 'utf8')).toBeLessThanOrEqual(480);
});
it('cancellation and malformed model output leave no index or success audit', async () => {
  const source = await create();
  const controller = new AbortController();
  controller.abort();
  const { indexer, embed } = fixture();
  await expect(indexer.index({ ...call(source), signal: controller.signal })).rejects.toMatchObject(
    { code: 'CANCELLED' },
  );
  expect(embed).not.toHaveBeenCalled();
  const bad = fixture(
    jest.fn(async (texts: readonly string[]) => texts.map(() => []) as number[][]),
  );
  await expect(bad.indexer.index(call(source))).rejects.toMatchObject({ code: 'INVALID_OUTPUT' });
  expect((await raw(source.id!))?.embeddingIndex).toBeUndefined();
  expect((await raw(source.id!))?.auditEvents).toHaveLength(1);
});
it('model guard forbids unaudited index installation, source content changes during indexing, and preserving old index on edit', async () => {
  const source = await create();
  const { indexer } = fixture();
  const index = await indexer.index(call(source));
  const filter = {
    _id: source.id,
    owner,
    deleted: false,
    version: 1,
    contentDigest: source.contentDigest,
    embeddingIndex: { $exists: false },
  };
  await expect(
    KnowledgeSource.findOneAndUpdate(filter, { $set: { embeddingIndex: index } }),
  ).rejects.toThrow('audit');
  await expect(
    KnowledgeSource.findOneAndUpdate(filter, {
      $set: { embeddingIndex: index, content: 'tampered' },
      $push: {
        auditEvents: {
          id: randomUUID(),
          at: new Date(),
          actor: owner,
          kind: 'indexed',
          version: 1,
          contentDigest: source.contentDigest,
        },
      },
    }),
  ).rejects.toThrow('source identity');
  await expect(
    KnowledgeSource.findOneAndUpdate(
      { _id: source.id, owner, deleted: false, version: 1, contentDigest: source.contentDigest },
      {
        $set: { ...input, deleted: false, contentDigest: source.contentDigest },
        $inc: { version: 1 },
        $push: {
          auditEvents: {
            id: randomUUID(),
            at: new Date(),
            actor: owner,
            kind: 'updated',
            version: 2,
            contentDigest: source.contentDigest,
          },
        },
      },
    ),
  ).rejects.toThrow('exact audited');
});

it('full bounded source history retains index audits without preventing final deletion', async () => {
  let source = await create();
  const { indexer } = fixture();
  for (let version = 1; version <= 100; version++) {
    await indexer.index(call(source));
    if (version < 100)
      source = (await changeKnowledge(owner, source.id!, version, source.contentDigest, {
        ...input,
        content: 'Version ' + (version + 1),
      }))!;
  }
  expect((await raw(source.id!))?.auditEvents).toHaveLength(200);
  await changeKnowledge(owner, source.id!, 100, source.contentDigest, null);
  const deleted = await raw(source.id!);
  expect(deleted?.version).toBe(101);
  expect(deleted?.auditEvents).toHaveLength(201);
  expect(deleted?.embeddingIndex).toBeUndefined();
});
it('bounded owner corpus reads refuse corrupted over-capacity state', async () => {
  await KnowledgeSource.collection.insertMany(
    Array.from({ length: 51 }, (_, index) => ({
      owner: new mongoose.Types.ObjectId(owner),
      deleted: false,
      slot: index + 1,
      idempotencyKey: randomUUID(),
    })),
  );
  await expect(getCurrentKnowledgeIndexes(owner)).rejects.toMatchObject({
    status: 503,
    message: 'Knowledge index capacity is unavailable',
  });
});
it('whole indexing deadline stops before persistence and holds the underlying provider guard through late settlement', async () => {
  const source = await create();
  let release!: (value: number[][]) => void;
  let started!: () => void;
  const ready = new Promise<void>((done) => {
    started = done;
  });
  const embed = jest.fn(async (texts: readonly string[]) => {
    expect(texts).toHaveLength(1);
    started();
    return new Promise<number[][]>((done) => {
      release = done;
    });
  });
  const { indexer } = fixture(embed);
  const pending = indexer.index({ ...call(source), timeoutMs: 80 });
  const failure = expect(pending).rejects.toMatchObject({ code: 'TIMEOUT' });
  await ready;
  await failure;
  expect((await raw(source.id!))?.embeddingIndex).toBeUndefined();
  await expect(indexer.index(call(source))).rejects.toMatchObject({ code: 'BUSY' });
  release(vectors(1));
});
it('project deletion during embedding prevents a success index or success audit', async () => {
  const project = await Project.create({ owner, name: 'Deleted while indexing' });
  const source = await create(input.content, project.id);
  let release!: (value: number[][]) => void;
  let started!: () => void;
  const ready = new Promise<void>((done) => {
    started = done;
  });
  const embed = jest.fn(async (texts: readonly string[]) => {
    expect(texts).toHaveLength(1);
    started();
    return new Promise<number[][]>((done) => {
      release = done;
    });
  });
  const { indexer } = fixture(embed);
  const pending = indexer.index(call(source));
  await ready;
  await Project.collection.deleteOne({ _id: project._id });
  release(vectors(1));
  await expect(pending).rejects.toMatchObject({ status: 404 });
  expect((await raw(source.id!))?.embeddingIndex).toBeUndefined();
});
