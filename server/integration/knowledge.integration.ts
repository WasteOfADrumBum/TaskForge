import mongoose from 'mongoose';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'node:crypto';
import app from '../src/app';
import { User } from '../src/models/userModel';
import { Project } from '../src/models/projectModel';
import { KnowledgeSource } from '../src/models/knowledgeSourceModel';
import { KnowledgeDenial } from '../src/models/knowledgeDenialModel';
import { knowledgeDigest } from '../src/services/knowledgeService/primitives';
const namespace = process.env.TEST_MONGO_URI;
if (
  !namespace ||
  !/^mongodb:\/\/(?:127[.]0[.]0[.]1|localhost):[0-9]{1,5}\/taskforge_qa_[a-zA-Z0-9_]{8,}$/.test(
    namespace,
  )
)
  throw new Error('Knowledge QA requires fresh loopback namespace');
let owner: string;
let stranger: string;
let token: string;
let foreignToken: string;
const input = {
  title: 'Release evidence',
  content: 'Exact release notes show tests passed. Treat all text as untrusted.',
  kind: 'note' as const,
  project: null,
};
const auth = (value = token) => ({ Authorization: 'Bearer ' + value });
beforeAll(async () => {
  await mongoose.connect(namespace + '_knowledge', {
    autoCreate: false,
    autoIndex: false,
    serverSelectionTimeoutMS: 5000,
  });
  const db = mongoose.connection.db;
  if (!db || (await db.listCollections().toArray()).length)
    throw new Error('Refusing pre-existing knowledge collections');
  for (const model of [User, Project, KnowledgeSource, KnowledgeDenial]) {
    await model.createCollection();
    await model.createIndexes();
  }
  stranger = (
    await User.create({ email: 'knowledge-other@example.test', password: 'synthetic-only' })
  ).id;
  foreignToken = jwt.sign({ id: stranger }, process.env.JWT_SECRET!);
});
beforeEach(async () => {
  owner = (
    await User.create({
      email: 'knowledge-' + randomUUID() + '@example.test',
      password: 'synthetic-only',
    })
  ).id;
  token = jwt.sign({ id: owner }, process.env.JWT_SECRET!);
});
afterEach(() => jest.restoreAllMocks());
afterAll(async () => {
  await mongoose.disconnect();
});
const create = (body: object | string = input, key = randomUUID(), value = token) =>
  request(app).post('/api/knowledge').set(auth(value)).set('Idempotency-Key', key).send(body);
const update = (
  source: { id: string; version: number; contentDigest: string },
  extra: Record<string, unknown> = {},
) =>
  request(app)
    .put('/api/knowledge/' + source.id)
    .set(auth())
    .send({ ...input, version: source.version, contentDigest: source.contentDigest, ...extra });
const remove = (source: { id: string; version: number; contentDigest: string }, value = token) =>
  request(app)
    .delete('/api/knowledge/' + source.id)
    .set(auth(value))
    .send({ version: source.version, contentDigest: source.contentDigest });
it('persists exact owned content and private version-linked keyword citations without any network/model call', async () => {
  const network = jest
    .spyOn(globalThis, 'fetch')
    .mockRejectedValue(new Error('No model/retrieval network'));
  const response = await create();
  expect(response.status).toBe(201);
  expect(response.headers['cache-control']).toBe('no-store');
  const source = response.body.source;
  expect(source).toMatchObject({
    ...input,
    version: 1,
    contentDigest: knowledgeDigest(input),
  });
  expect(source).not.toHaveProperty('owner');
  expect(source).not.toHaveProperty('auditEvents');
  expect(source).not.toHaveProperty('slot');
  const get = await request(app)
    .get('/api/knowledge/' + source.id)
    .set(auth());
  expect(get.status).toBe(200);
  expect(get.body.source).toEqual(source);
  const list = await request(app).get('/api/knowledge').set(auth());
  expect(list.body.sources).toHaveLength(1);
  expect(list.body.sources[0]).not.toHaveProperty('content');
  const search = await request(app)
    .get('/api/knowledge/search')
    .query({ q: 'release' })
    .set(auth());
  expect(search.status).toBe(200);
  expect(search.body).toMatchObject({ mode: 'keyword', modelUsed: false });
  const citation = search.body.results[0];
  expect(citation).toMatchObject({
    sourceId: source.id,
    version: source.version,
    contentDigest: source.contentDigest,
  });
  expect(citation.citation.quote).toBe(
    source.content.slice(citation.citation.start, citation.citation.end),
  );
  const audit = await request(app)
    .get('/api/knowledge/' + source.id + '/audit')
    .set(auth());
  expect(audit.body.events.map((event: { kind: string }) => event.kind)).toEqual(['created']);
  expect(JSON.stringify(audit.body)).not.toContain(input.content);
  expect(network).not.toHaveBeenCalled();
});
it('same owner/key/payload is one record and conflicting reuse is denied/audited', async () => {
  const key = randomUUID();
  const first = await create(input, key);
  const repeated = await create(input, key);
  expect(first.status).toBe(201);
  expect(repeated.status).toBe(200);
  expect(repeated.body.source.id).toBe(first.body.source.id);
  expect(await KnowledgeSource.countDocuments({ owner })).toBe(1);
  expect((await create({ ...input, content: 'Different input' }, key)).status).toBe(409);
  expect(await KnowledgeDenial.countDocuments({ owner, reason: 'state-conflict' })).toBe(1);
});
it('concurrent identical creates commit one source and one creation audit with acknowledged uniqueness', async () => {
  const key = randomUUID();
  const responses = await Promise.all(Array.from({ length: 6 }, () => create(input, key)));
  expect(responses.every((response) => [200, 201].includes(response.status))).toBe(true);
  expect(new Set(responses.map((response) => response.body.source.id)).size).toBe(1);
  expect(await KnowledgeSource.countDocuments({ owner })).toBe(1);
  expect((await KnowledgeSource.findOne({ owner }))!.auditEvents).toHaveLength(1);
});
it('updates atomically replace content/version/digest and stale writes cannot overwrite a current source', async () => {
  const source = (await create()).body.source;
  const response = await update(source, {
    title: 'Changed title',
    content: 'New exact audit evidence',
  });
  expect(response.status).toBe(200);
  expect(response.body.source.version).toBe(2);
  expect(response.body.source.contentDigest).not.toBe(source.contentDigest);
  expect((await update(source, { content: 'STALE_PRIVATE_TEXT' })).status).toBe(409);
  const search = await request(app)
    .get('/api/knowledge/search')
    .query({ q: 'release' })
    .set(auth());
  expect(search.body.results).toEqual([]);
  const current = await request(app).get('/api/knowledge/search').query({ q: 'audit' }).set(auth());
  expect(current.body.results[0]).toMatchObject({
    version: 2,
    contentDigest: response.body.source.contentDigest,
  });
  const audit = (
    await request(app)
      .get('/api/knowledge/' + source.id + '/audit')
      .set(auth())
  ).body;
  expect(audit.events.map((event: { kind: string }) => event.kind)).toEqual(['created', 'updated']);
  expect(JSON.stringify(audit)).not.toContain('New exact audit evidence');
});
it('two simultaneous version-bound updates commit exactly one result and one lifecycle audit', async () => {
  const source = (await create()).body.source;
  const responses = await Promise.all([
    update(source, { content: 'Winner A' }),
    update(source, { content: 'Winner B' }),
  ]);
  expect(responses.map((response) => response.status).sort()).toEqual([200, 409]);
  const persisted = await KnowledgeSource.findById(source.id);
  expect(persisted!.version).toBe(2);
  expect(persisted!.auditEvents).toHaveLength(2);
});
it('deletion clears private text, frees capacity and permanently removes current retrieval without resurrecting a retry', async () => {
  const key = randomUUID();
  const source = (await create(input, key)).body.source;
  expect((await remove(source)).status).toBe(204);
  expect(
    (
      await request(app)
        .get('/api/knowledge/' + source.id)
        .set(auth())
    ).status,
  ).toBe(404);
  expect(
    (await request(app).get('/api/knowledge/search').query({ q: 'release' }).set(auth())).body
      .results,
  ).toEqual([]);
  const tombstone = await KnowledgeSource.findById(source.id);
  expect(tombstone).toMatchObject({
    deleted: true,
    title: '',
    content: '',
    project: null,
    slot: null,
    version: 2,
  });
  expect(tombstone!.auditEvents.map((event) => event.kind)).toEqual(['created', 'deleted']);
  expect((await create(input, key)).status).toBe(409);
  expect((await create()).status).toBe(201);
  const audit = await request(app)
    .get('/api/knowledge/' + source.id + '/audit')
    .set(auth());
  expect(audit.status).toBe(200);
  expect(audit.body.deleted).toBe(true);
});
it('cross-owner get/update/delete/audit are indistinguishable from missing sources, and search/list exclude them', async () => {
  const source = (await create()).body.source;
  for (const path of ['/api/knowledge/' + source.id, '/api/knowledge/' + source.id + '/audit'])
    expect((await request(app).get(path).set(auth(foreignToken))).status).toBe(404);
  expect(
    (
      await request(app)
        .put('/api/knowledge/' + source.id)
        .set(auth(foreignToken))
        .send({ ...input, version: source.version, contentDigest: source.contentDigest })
    ).status,
  ).toBe(404);
  expect((await remove(source, foreignToken)).status).toBe(404);
  const list = await request(app).get('/api/knowledge').set(auth(foreignToken));
  expect(list.body.sources).toEqual([]);
  const search = await request(app)
    .get('/api/knowledge/search')
    .query({ q: 'release' })
    .set(auth(foreignToken));
  expect(search.body.results).toEqual([]);
  expect((await KnowledgeSource.findById(source.id))!.deleted).toBe(false);
  const ownDenials = await request(app).get('/api/knowledge/audit/denials').set(auth());
  expect(ownDenials.body.events).toEqual([]);
});
it('project association is owned; foreign/missing project filtering never leaks source existence', async () => {
  const project = await Project.create({ owner, name: 'Owned project' });
  const foreign = await Project.create({ owner: stranger, name: 'Foreign project' });
  const source = (await create({ ...input, project: project.id })).body.source;
  expect(source.project).toBe(project.id);
  expect((await create({ ...input, project: foreign.id })).status).toBe(404);
  expect((await update(source, { project: foreign.id })).status).toBe(404);
  for (const path of ['/api/knowledge', '/api/knowledge/search'])
    expect(
      (
        await request(app)
          .get(path)
          .query({ project: foreign.id, ...(path.endsWith('search') ? { q: 'release' } : {}) })
          .set(auth())
      ).status,
    ).toBe(404);
  expect(
    (
      await request(app)
        .get('/api/knowledge/search')
        .query({ project: project.id, q: 'release' })
        .set(auth())
    ).body.results,
  ).toHaveLength(1);
});
it.each([
  { ...input, owner: 'foreign' },
  { ...input, auditEvents: [] },
  { ...input, slot: 1 },
  { ...input, content: '😀'.repeat(5001) },
  { ...input, project: { $ne: null } },
  { ...input, kind: 'pdf' },
])(
  'malformed or oversized inputs fail before mutation and omit private payload from denial %#',
  async (body) => {
    expect((await create(body)).status).toBe(400);
    expect(await KnowledgeSource.countDocuments({ owner })).toBe(0);
    expect(await KnowledgeDenial.countDocuments({ owner, reason: 'invalid-input' })).toBe(1);
    expect(JSON.stringify(await KnowledgeDenial.find({ owner }))).not.toContain(input.content);
  },
);
it('rejects malformed/operator-bearing queries and handles literal regex/hostile source text as data', async () => {
  const source = (
    await create({ ...input, content: 'literal .* <script>fetch("https://example.test")</script>' })
  ).body.source;
  for (const query of [
    { q: { $ne: '' } },
    { q: 'x'.repeat(121) },
    { q: 'release', owner: stranger },
    { q: 'a b c d e f g h i' },
  ])
    expect((await request(app).get('/api/knowledge/search').query(query).set(auth())).status).toBe(
      400,
    );
  const result = await request(app).get('/api/knowledge/search').query({ q: '.*' }).set(auth());
  expect(result.status).toBe(200);
  expect(result.body.results[0].sourceId).toBe(source.id);
  expect(result.body.results[0].citation.quote).toContain('<script>');
});
it('JWT auth fails before source/audit access and all private responses are no-store', async () => {
  const before = await KnowledgeDenial.countDocuments({});
  for (const endpoint of ['', '/search?q=release', '/audit/denials']) {
    const response = await request(app).get('/api/knowledge' + endpoint);
    expect(response.status).toBe(401);
    expect(response.headers['cache-control']).toBe('no-store');
  }
  expect(
    (await request(app).post('/api/knowledge').set('Idempotency-Key', randomUUID()).send(input))
      .status,
  ).toBe(401);
  expect(await KnowledgeDenial.countDocuments({})).toBe(before);
});
it('audit persistence failure rejects denied requests safely without proceeding to a source mutation', async () => {
  jest.spyOn(KnowledgeDenial, 'create').mockRejectedValueOnce(new Error('PRIVATE_DB_FAILURE'));
  const response = await create({ ...input, owner: 'PRIVATE_INPUT' });
  expect(response.status).toBe(503);
  expect(response.body.message).not.toContain('PRIVATE');
  expect(await KnowledgeSource.countDocuments({ owner })).toBe(0);
});
it('unaudited writes, content-digest corruption and audit replacement are rejected by application model guards', async () => {
  const source = (await create()).body.source;
  await expect(
    KnowledgeSource.updateOne({ _id: source.id }, { $set: { content: 'Bypass' } }),
  ).rejects.toThrow('audited atomic');
  await expect(
    KnowledgeSource.findOneAndUpdate(
      { _id: source.id, owner, deleted: false, version: 1, contentDigest: source.contentDigest },
      {
        $set: { ...input, deleted: false, contentDigest: 'a'.repeat(64) },
        $unset: { embeddingIndex: 1 },
        $inc: { version: 1 },
        $push: {
          auditEvents: {
            id: randomUUID(),
            at: new Date(),
            actor: owner,
            kind: 'updated',
            version: 2,
            contentDigest: 'a'.repeat(64),
          },
        },
      },
    ),
  ).rejects.toThrow('matching digest');
  await expect(KnowledgeSource.deleteOne({ _id: source.id, owner })).rejects.toThrow(
    'audited atomic',
  );
  const denial = await KnowledgeDenial.create({
    owner,
    source: source.id,
    action: 'read',
    reason: 'source-not-found',
  });
  await expect(
    KnowledgeDenial.updateOne({ _id: denial.id }, { $set: { reason: 'state-conflict' } }),
  ).rejects.toThrow('append-only');
});
it('source capacity is atomic across competing creations, includes only active sources and bounds retrieval results', async () => {
  for (let index = 0; index < 49; index++) {
    const response = await create({ ...input, title: 'Release source ' + index });
    expect(response.status).toBe(201);
  }
  const responses = await Promise.all([
    create({ ...input, title: 'Release final A' }),
    create({ ...input, title: 'Release final B' }),
  ]);
  expect(responses.map((response) => response.status).sort()).toEqual([201, 409]);
  expect(await KnowledgeSource.countDocuments({ owner, deleted: false })).toBe(50);
  expect((await create()).status).toBe(409);
  const list = await request(app).get('/api/knowledge').set(auth());
  expect(list.body.sources).toHaveLength(50);
  const search = await request(app)
    .get('/api/knowledge/search')
    .query({ q: 'release' })
    .set(auth());
  expect(search.body.results).toHaveLength(10);
  const source = (
    await request(app)
      .get('/api/knowledge/' + list.body.sources[0].id)
      .set(auth())
  ).body.source;
  expect((await remove(source)).status).toBe(204);
  expect((await create({ ...input, title: 'Replacement' })).status).toBe(201);
  expect(await KnowledgeSource.countDocuments({ owner, deleted: false })).toBe(50);
});

it('edit history is bounded without preventing audited deletion at its limit', async () => {
  let source = (await create()).body.source;
  for (let version = 1; version < 100; version++) {
    const response = await update(source, { content: 'Revision ' + version });
    expect(response.status).toBe(200);
    source = response.body.source;
  }
  expect(source.version).toBe(100);
  expect((await update(source)).status).toBe(409);
  expect((await remove(source)).status).toBe(204);
  const tombstone = await KnowledgeSource.findById(source.id);
  expect(tombstone!.version).toBe(101);
  expect(tombstone!.auditEvents).toHaveLength(101);
  expect(tombstone!.content).toBe('');
});
it('atomic edit/delete races have one winning mutation and no stale retrieval or ghost audit', async () => {
  const source = (await create()).body.source;
  const responses = await Promise.all([
    update(source, { content: 'Changed race content' }),
    remove(source),
  ]);
  expect(responses.filter((response) => [200, 204].includes(response.status))).toHaveLength(1);
  expect(responses.filter((response) => response.status === 409)).toHaveLength(1);
  const record = await KnowledgeSource.findById(source.id);
  expect(record!.version).toBe(2);
  expect(record!.auditEvents).toHaveLength(2);
  const search = await request(app)
    .get('/api/knowledge/search')
    .query({ q: 'Exact release notes' })
    .set(auth());
  if (record!.deleted) expect(search.body.results).toEqual([]);
  else
    expect(search.body.results.every((result: { version: number }) => result.version === 2)).toBe(
      true,
    );
});
it('missing retry key, malformed mutation versions/digests and injected metadata are safely denied', async () => {
  expect((await request(app).post('/api/knowledge').set(auth()).send(input)).status).toBe(400);
  const source = (await create()).body.source;
  for (const extra of [
    { version: 0 },
    { version: 1.5 },
    { contentDigest: 'bad' },
    { auditEvents: [] },
    { owner: stranger },
  ])
    expect((await update(source, extra)).status).toBe(400);
  const denied = await request(app)
    .delete('/api/knowledge/' + source.id)
    .set(auth())
    .send({ version: 1, contentDigest: source.contentDigest, content: 'Injected' });
  expect(denied.status).toBe(400);
  expect((await KnowledgeSource.findById(source.id))!.version).toBe(1);
  expect((await request(app).get('/api/knowledge/not-an-id').set(auth())).status).toBe(404);
});
it('expired project association is not treated as current project authority or queried as a foreign source', async () => {
  const project = await Project.create({ owner, name: 'Disposable owned project' });
  const source = (await create({ ...input, project: project.id })).body.source;
  await Project.deleteOne({ _id: project.id, owner });
  expect(
    (
      await request(app)
        .get('/api/knowledge/search')
        .query({ project: project.id, q: 'release' })
        .set(auth())
    ).status,
  ).toBe(404);
  expect(
    (
      await request(app)
        .get('/api/knowledge/' + source.id)
        .set(auth())
    ).status,
  ).toBe(200);
  expect((await update(source, { project: null })).status).toBe(200);
});
it('index acknowledgement failure prevents source creation before quota/idempotency guarantees exist', async () => {
  jest
    .spyOn(KnowledgeSource.collection, 'createIndex')
    .mockRejectedValueOnce(new Error('PRIVATE_INDEX_FAILURE'));
  const response = await create();
  expect(response.status).toBe(503);
  expect(response.body.message).not.toContain('PRIVATE');
  expect(await KnowledgeSource.countDocuments({ owner })).toBe(0);
});
it('missing/stale content digests in stored source data fail keyword integrity checks closed', async () => {
  const source = (await create()).body.source;
  // Synthetic QA-only raw write models administrator corruption; application model guards disallow it.
  await KnowledgeSource.collection.updateOne(
    { _id: new mongoose.Types.ObjectId(source.id) },
    { $set: { contentDigest: 'a'.repeat(64) } },
  );
  const response = await request(app)
    .get('/api/knowledge/search')
    .query({ q: 'release' })
    .set(auth());
  expect(response.status).toBe(503);
  expect(response.body.results).toBeUndefined();
});

it('identical competing creates at the final slot recheck the retry identity before reporting capacity', async () => {
  for (let index = 0; index < 49; index++)
    expect((await create({ ...input, title: 'Occupied ' + index })).status).toBe(201);
  const key = randomUUID();
  let misses = 0;
  let release!: () => void;
  const bothMissed = new Promise<void>((resolve) => {
    release = resolve;
  });
  const originalOne = KnowledgeSource.findOne.bind(KnowledgeSource);
  jest.spyOn(KnowledgeSource, 'findOne').mockImplementation((filter) => {
    const query = originalOne(filter);
    const execute = query.exec.bind(query);
    if ((filter as Record<string, unknown> | undefined)?.idempotencyKey === key) {
      query.exec = async () => {
        const result = await execute();
        if (++misses <= 2) {
          if (misses === 2) release();
          await bothMissed;
        }
        return result;
      };
    }
    return query;
  });
  let allocations = 0;
  const originalFind = KnowledgeSource.find.bind(KnowledgeSource);
  jest.spyOn(KnowledgeSource, 'find').mockImplementation(((filter?: Record<string, unknown>) => {
    const query = originalFind(filter ?? {});
    const execute = query.exec.bind(query);
    if (filter?.owner === owner && filter?.deleted === false) {
      const allocation = ++allocations;
      query.exec = async () => {
        if (allocation === 2) {
          const deadline = Date.now() + 3000;
          while (!(await KnowledgeSource.exists({ owner, idempotencyKey: key }))) {
            if (Date.now() > deadline) throw new Error('First insert did not settle');
            await new Promise((resolve) => setTimeout(resolve, 5));
          }
        }
        return execute();
      };
    }
    return query;
  }) as never);
  const responses = await Promise.all([create(input, key), create(input, key)]);
  expect(responses.map((response) => response.status).sort()).toEqual([200, 201]);
  expect(allocations).toBe(2);
  expect(responses[0].body.source.id).toBe(responses[1].body.source.id);
  expect(await KnowledgeSource.countDocuments({ owner, deleted: false })).toBe(50);
});

it('rejects lone UTF16 surrogates before BSON can alter source text and invalidate provenance', async () => {
  const response = await create({ ...input, content: 'Lone surrogate \ud800 text' });
  expect(response.status).toBe(400);
  expect(await KnowledgeSource.countDocuments({ owner })).toBe(0);
});
