// KAN-53 synthetic backup/restore drill: export a seeded throwaway MongoDB, then verify the
// archive by restoring it into a second fresh loopback MongoDB. Run: npm run test:backup-drill
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, test } from 'node:test';
import { Double, Int32, Long, MongoClient, ObjectId } from 'mongodb';
import { exportDatabase, verifyArchive } from './backup-tool.mjs';
import { root, startMongo } from './qa-runtime.mjs';

let source;
let uri;
let directory;
const owner = new ObjectId();
const stranger = new ObjectId();
const project = new ObjectId();
const agent = new ObjectId();
const task = new ObjectId();

before(async () => {
  source = await startMongo();
  uri = source.getUri(source.instanceInfo.dbName);
  directory = await mkdtemp(join(tmpdir(), 'taskforge-backup-drill-'));
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db();
  await db.collection('users').insertMany([
    { _id: owner, email: 'drill-owner@example.test', password: 'synthetic-hash' },
    { _id: stranger, email: 'drill-other@example.test', password: 'synthetic-hash' },
  ]);
  await db.collection('projects').insertOne({ _id: project, owner, name: 'Drill project' });
  await db
    .collection('agents')
    .insertOne({ _id: agent, owner, name: 'Drill agent', permissions: ['task.read'] });
  await db.collection('tasks').insertOne({
    _id: task,
    owner,
    title: 'Drill task with unicode 😀 and <b>markup</b>',
    dueDate: new Date('2026-11-20T00:00:00.000Z'),
    project,
    assigneeType: 'agent',
    assigneeAgent: agent,
  });
  await db.collection('runs').insertOne({ owner, task, agent, status: 'queued', version: 1 });
  await db.collection('knowledgesources').insertOne({
    owner,
    title: 'Drill note',
    content: 'Synthetic',
    version: 3,
    deleted: false,
    // Numeric BSON types must survive export and restore unchanged.
    stats: { long: Long.fromNumber(5), double: new Double(2), int: new Int32(7) },
  });
  await client.close();
});
after(async () => {
  await rm(directory, { recursive: true, force: true });
  await source?.stop();
});

test('exports a private archive and restores it into an isolated database with identical data', async () => {
  const out = join(directory, 'backup.jsonl');
  const manifest = await exportDatabase(uri, out, new Date('2026-11-12T00:00:00.000Z'));
  assert.equal(manifest.format, 'taskforge-backup-v1');
  assert.deepEqual(
    Object.fromEntries(Object.entries(manifest.collections).map(([k, v]) => [k, v.count])),
    { agents: 1, knowledgesources: 1, projects: 1, runs: 1, tasks: 1, users: 2 },
  );
  if (process.platform !== 'win32') assert.equal((await stat(out)).mode & 0o777, 0o600);
  const archive = await readFile(out, 'utf8');
  assert.ok(!archive.includes(uri), 'the connection string is never written');
  assert.ok(archive.includes('$numberLong') && archive.includes('$numberDouble'));
  const result = await verifyArchive(out);
  assert.deepEqual(result.problems, []);
  assert.equal(result.verified, true);
  assert.equal(result.collections.tasks, 1);
});

test('restore uses a fresh isolated database and leaves the source untouched', async () => {
  const before = await new MongoClient(uri).connect();
  const count = await before.db().collection('tasks').countDocuments();
  await before.close();
  const out = join(directory, 'isolation.jsonl');
  await exportDatabase(uri, out);
  await verifyArchive(out);
  const after = await new MongoClient(uri).connect();
  assert.equal(await after.db().collection('tasks').countDocuments(), count);
  await after.close();
});

test('a tampered archive fails verification', async () => {
  const out = join(directory, 'tampered.jsonl');
  await exportDatabase(uri, out);
  const text = await readFile(out, 'utf8');
  await writeFile(tampered(out), text.replace('Drill project', 'Changed project'));
  const result = await verifyArchive(tampered(out));
  assert.equal(result.verified, false);
  assert.ok(result.problems.some((problem) => problem.startsWith('projects:')));
});
const tampered = (path) => path.replace('.jsonl', '-edited.jsonl');

test('broken ownership links are reported after restore', async () => {
  const client = await new MongoClient(uri).connect();
  const orphan = await client
    .db()
    .collection('tasks')
    .insertOne({ owner: new ObjectId(), title: 'Orphaned task' });
  await client.close();
  try {
    const out = join(directory, 'orphan.jsonl');
    await exportDatabase(uri, out);
    const result = await verifyArchive(out);
    assert.equal(result.verified, false);
    assert.ok(result.problems.includes('tasks.owner -> users: 1 broken'));
  } finally {
    const cleanup = await new MongoClient(uri).connect();
    await cleanup.db().collection('tasks').deleteOne({ _id: orphan.insertedId });
    await cleanup.close();
  }
});

test('refuses unsafe export targets and missing configuration', async () => {
  await assert.rejects(exportDatabase(undefined, join(directory, 'x.jsonl')), /SOURCE_MONGO_URI/);
  await assert.rejects(exportDatabase(uri, undefined), /--out/);
  await assert.rejects(
    exportDatabase(source.getUri(), join(directory, 'nodb.jsonl')),
    /database name/,
  );
  await assert.rejects(
    exportDatabase(source.getUri('taskforge_empty_drill'), join(directory, 'empty.jsonl')),
    /no collections/,
  );
  await assert.rejects(exportDatabase(uri, join(root, 'backup.jsonl')), /inside the repository/);
  const existing = join(directory, 'existing.jsonl');
  await writeFile(existing, 'keep me');
  await assert.rejects(exportDatabase(uri, existing), /EEXIST/);
  assert.equal(await readFile(existing, 'utf8'), 'keep me');
});

test('rejects files that are not TaskForge archives', async () => {
  const bogus = join(directory, 'bogus.jsonl');
  await writeFile(bogus, '{"format":"other"}\n');
  await assert.rejects(verifyArchive(bogus), /Not a TaskForge backup archive/);
});
