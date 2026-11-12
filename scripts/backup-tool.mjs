// Private logical backup and isolated restore verification for TaskForge's MongoDB.
//
//   node scripts/backup-tool.mjs export --out <file outside the repo>
//     Reads every collection from the database in SOURCE_MONGO_URI (read only) and writes a
//     private canonical-EJSON archive with per-collection counts and SHA-256 digests.
//   node scripts/backup-tool.mjs verify --in <archive>
//     Restores the archive into a fresh loopback MongoDB that this tool starts and stops, then
//     checks counts, digests and ownership links. It never accepts a destination URI, so it
//     cannot write to production or any existing database.
//
// The connection string is read from the environment only and is never printed or stored.
import { createHash } from 'node:crypto';
import { open, readFile } from 'node:fs/promises';
import { isAbsolute, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { EJSON } from 'bson';
import { MongoClient } from 'mongodb';
import { root, startMongo } from './qa-runtime.mjs';

export const BACKUP_FORMAT = 'taskforge-backup-v1';
const line = (value) => EJSON.stringify(value, { relaxed: false });
const digest = (lines) => {
  const hash = createHash('sha256');
  for (const item of lines) hash.update(item + '\n');
  return hash.digest('hex');
};
const insideRepo = (path) => {
  const rel = relative(root, resolve(path));
  return !rel.startsWith('..') && !isAbsolute(rel);
};

// Canonical, _id-ordered documents per collection; system collections are skipped.
export const snapshot = async (db) => {
  const names = (await db.listCollections({}, { nameOnly: true }).toArray())
    .map((item) => item.name)
    .filter((name) => !name.startsWith('system.'))
    .sort();
  const collections = {};
  for (const name of names) {
    const documents = await db.collection(name).find({}).sort({ _id: 1 }).toArray();
    const lines = documents.map(line);
    collections[name] = { count: lines.length, sha256: digest(lines), lines };
  }
  return collections;
};

export const exportDatabase = async (uri, out, now = new Date()) => {
  if (!uri) throw new Error('Set SOURCE_MONGO_URI to the database to back up.');
  if (!out) throw new Error('Pass --out with a private path outside the repository.');
  if (insideRepo(out)) throw new Error('Refusing to write a backup inside the repository.');
  const client = new MongoClient(uri, {
    serverSelectionTimeoutMS: 15000,
    readPreference: 'primaryPreferred',
  });
  try {
    await client.connect();
    const db = client.db();
    const collections = await snapshot(db);
    const manifest = {
      format: BACKUP_FORMAT,
      createdAt: now.toISOString(),
      database: db.databaseName,
      collections: Object.fromEntries(
        Object.entries(collections).map(([name, value]) => [
          name,
          { count: value.count, sha256: value.sha256 },
        ]),
      ),
    };
    // wx refuses to overwrite; 0600 keeps the archive private to the owner's account.
    const file = await open(out, 'wx', 0o600);
    try {
      await file.write(JSON.stringify(manifest) + '\n');
      for (const [name, value] of Object.entries(collections))
        for (const item of value.lines)
          await file.write(JSON.stringify({ c: name, d: item }) + '\n');
    } finally {
      await file.close();
    }
    return manifest;
  } finally {
    await client.close();
  }
};

export const readArchive = async (path) => {
  const [head, ...rest] = (await readFile(path, 'utf8')).split('\n').filter(Boolean);
  const manifest = JSON.parse(head ?? 'null');
  if (manifest?.format !== BACKUP_FORMAT || typeof manifest.collections !== 'object')
    throw new Error('Not a TaskForge backup archive.');
  const documents = {};
  for (const entry of rest) {
    const { c, d } = JSON.parse(entry);
    if (typeof c !== 'string' || typeof d !== 'string' || !(c in manifest.collections))
      throw new Error('Archive contains an unexpected record.');
    (documents[c] ??= []).push(d);
  }
  return { manifest, documents };
};

// Ownership links that must survive a restore. Missing collections are skipped.
const LINKS = [
  ['tasks', 'owner', 'users'],
  ['projects', 'owner', 'users'],
  ['agents', 'owner', 'users'],
  ['runs', 'owner', 'users'],
  ['knowledgesources', 'owner', 'users'],
  ['tasks', 'project', 'projects'],
  ['tasks', 'assigneeAgent', 'agents'],
  ['runs', 'task', 'tasks'],
  ['runs', 'agent', 'agents'],
];
const ownershipProblems = async (db, present) => {
  const problems = [];
  for (const [from, field, to] of LINKS) {
    if (!present.has(from) || !present.has(to)) continue;
    const ids = new Set(
      (
        await db
          .collection(to)
          .find({}, { projection: { _id: 1 } })
          .toArray()
      ).map((item) => String(item._id)),
    );
    const broken = await db
      .collection(from)
      .find({ [field]: { $ne: null, $exists: true } }, { projection: { [field]: 1 } })
      .toArray();
    const count = broken.filter((item) => !ids.has(String(item[field]))).length;
    if (count) problems.push(from + '.' + field + ' -> ' + to + ': ' + count + ' broken');
  }
  return problems;
};

export const verifyArchive = async (path, startIsolated = startMongo) => {
  const { manifest, documents } = await readArchive(path);
  const mongo = await startIsolated();
  const client = new MongoClient(mongo.getUri(), { serverSelectionTimeoutMS: 15000 });
  try {
    await client.connect();
    const db = client.db(mongo.instanceInfo.dbName + '_restore');
    if ((await db.listCollections().toArray()).length)
      throw new Error('Refusing to restore into a database that already has collections.');
    const problems = [];
    for (const [name, expected] of Object.entries(manifest.collections)) {
      const lines = documents[name] ?? [];
      if (lines.length !== expected.count || digest(lines) !== expected.sha256)
        problems.push(name + ': archive does not match its manifest');
      await db.createCollection(name);
      if (lines.length)
        await db
          .collection(name)
          .insertMany(lines.map((item) => EJSON.parse(item, { relaxed: false })));
    }
    const restored = await snapshot(db);
    for (const [name, expected] of Object.entries(manifest.collections))
      if (restored[name]?.count !== expected.count || restored[name]?.sha256 !== expected.sha256)
        problems.push(name + ': restored data does not match the backup');
    problems.push(...(await ownershipProblems(db, new Set(Object.keys(restored)))));
    return {
      verified: problems.length === 0,
      createdAt: manifest.createdAt,
      collections: Object.fromEntries(
        Object.entries(manifest.collections).map(([name, value]) => [name, value.count]),
      ),
      problems,
    };
  } finally {
    await client.close();
    await mongo.stop();
  }
};

const argument = (name) => {
  const index = process.argv.indexOf(name);
  return index > 0 ? process.argv[index + 1] : undefined;
};
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const command = process.argv[2];
  try {
    if (command === 'export') {
      const manifest = await exportDatabase(process.env.SOURCE_MONGO_URI, argument('--out'));
      console.log(
        JSON.stringify({
          exported: true,
          createdAt: manifest.createdAt,
          collections: Object.fromEntries(
            Object.entries(manifest.collections).map(([name, value]) => [name, value.count]),
          ),
        }),
      );
    } else if (command === 'verify') {
      const input = argument('--in');
      if (!input) throw new Error('Pass --in with the archive path.');
      const result = await verifyArchive(input);
      console.log(JSON.stringify(result));
      if (!result.verified) process.exitCode = 1;
    } else {
      console.error('Usage: backup-tool.mjs export --out <file> | verify --in <file>');
      process.exitCode = 1;
    }
  } catch (error) {
    // Messages are this tool's own; driver errors can echo connection details, so they are not printed.
    console.error(
      error instanceof Error && !/mongodb(\+srv)?:\/\//u.test(error.message)
        ? error.message
        : 'Backup operation failed.',
    );
    process.exitCode = 1;
  }
}
