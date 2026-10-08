import { randomUUID } from 'node:crypto';
import {
  KnowledgeSource,
  KNOWLEDGE_VERSION_MAX,
  type KnowledgeSourceDocument,
} from '../../models/knowledgeSourceModel';
import { KnowledgeDenial, KNOWLEDGE_DENIAL_REASONS } from '../../models/knowledgeDenialModel';
import { Project } from '../../models/projectModel';
import { RUN_KEY_PATTERN } from '../../models/runModel';
import { isObjectIdString } from '../../utils/objectId';
import {
  knowledgeDigest,
  normalizeKnowledgeInput,
  matchKnowledgeSources,
  KNOWLEDGE_SOURCE_WINDOW,
  type KnowledgeInput,
} from './primitives';
export class KnowledgeError extends Error {
  constructor(
    public readonly status: 400 | 404 | 409 | 503,
    message: string,
  ) {
    super(message);
  }
}
export type KnowledgeAction = 'create' | 'read' | 'update' | 'delete' | 'search' | 'index';
export const denyKnowledge = async (
  owner: string,
  source: string | null,
  action: KnowledgeAction,
  reason: (typeof KNOWLEDGE_DENIAL_REASONS)[number],
  status: KnowledgeError['status'],
  message: string,
): Promise<never> => {
  try {
    await KnowledgeDenial.create({ owner, source, action, reason });
  } catch {
    throw new KnowledgeError(503, 'Knowledge audit is temporarily unavailable');
  }
  throw new KnowledgeError(status, message);
};
let indexing: Promise<unknown> | undefined;
export const ensureKnowledgeIndexes = async () => {
  if (!indexing) {
    const operation = Promise.allSettled([
      KnowledgeSource.collection.createIndex(
        { owner: 1, slot: 1 },
        { unique: true, partialFilterExpression: { slot: { $type: 'number' } }, maxTimeMS: 5000 },
      ),
      KnowledgeSource.collection.createIndex(
        { owner: 1, idempotencyKey: 1 },
        { unique: true, maxTimeMS: 5000 },
      ),
      KnowledgeSource.collection.createIndex(
        { owner: 1, deleted: 1, slot: 1 },
        { maxTimeMS: 5000 },
      ),
    ]).then((results) => {
      if (results.some((result) => result.status === 'rejected'))
        throw new Error('Knowledge index acknowledgement failed');
    });
    indexing = operation;
    void operation
      .finally(() => {
        if (indexing === operation) indexing = undefined;
      })
      .catch(() => {});
  }
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      indexing,
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => reject(new Error('Index timeout')), 5000);
      }),
    ]);
  } catch {
    throw new KnowledgeError(503, 'Knowledge storage is temporarily unavailable');
  } finally {
    clearTimeout(timer);
  }
};
const event = (
  owner: string,
  kind: 'created' | 'updated' | 'deleted',
  version: number,
  contentDigest: string,
) => ({ id: randomUUID(), at: new Date(), actor: owner, kind, version, contentDigest });
const validateProject = async (
  owner: string,
  project: string | null,
  source: string | null,
  action: KnowledgeAction,
) => {
  if (project && !(await Project.exists({ _id: project, owner }).maxTimeMS(5000)))
    return denyKnowledge(owner, source, action, 'project-not-found', 404, 'Project not found');
};
const dto = (source: KnowledgeSourceDocument | null, content = true) => {
  if (!source) throw new KnowledgeError(404, 'Knowledge source not found');
  return {
    id: source.id,
    title: source.title,
    kind: source.kind,
    project: source.project ? String(source.project) : null,
    version: source.version,
    contentDigest: source.contentDigest,
    createdAt: source.createdAt,
    updatedAt: source.updatedAt,
    ...(content ? { content: source.content } : {}),
  };
};
export const getKnowledge = async (owner: string, id: string) => {
  const source = await KnowledgeSource.findOne({ _id: id, owner, deleted: false }).maxTimeMS(5000);
  return source
    ? dto(source)
    : denyKnowledge(owner, id, 'read', 'source-not-found', 404, 'Knowledge source not found');
};
const activeSources = async (owner: string, project?: string) => {
  const sources = await KnowledgeSource.find({
    owner,
    deleted: false,
    ...(project ? { project } : {}),
  })
    .sort({ slot: 1 })
    .limit(KNOWLEDGE_SOURCE_WINDOW + 1)
    .maxTimeMS(5000);
  if (sources.length > KNOWLEDGE_SOURCE_WINDOW)
    throw new KnowledgeError(503, 'Knowledge workspace exceeds its source bound');
  return sources;
};
export const listKnowledge = async (owner: string, project?: string) => {
  if (project) await validateProject(owner, project, null, 'read');
  return (await activeSources(owner, project)).map((source) => dto(source, false));
};
export const searchKnowledge = async (owner: string, query: string, project?: string) => {
  if (project) await validateProject(owner, project, null, 'search');
  const sources = await activeSources(owner, project);
  try {
    return matchKnowledgeSources(
      owner,
      query,
      sources.map((source) => ({
        id: source.id,
        owner: String(source.owner),
        title: source.title,
        content: source.content,
        kind: source.kind as KnowledgeInput['kind'],
        project: source.project ? String(source.project) : null,
        version: source.version,
        contentDigest: source.contentDigest,
        deleted: source.deleted,
      })),
    );
  } catch {
    throw new KnowledgeError(503, 'Knowledge source integrity is unavailable');
  }
};
export const createKnowledge = async (owner: string, body: unknown, key: string) => {
  const input = normalizeKnowledgeInput(body);
  if (!RUN_KEY_PATTERN.test(key))
    throw new KnowledgeError(400, 'Valid Idempotency-Key is required');
  await ensureKnowledgeIndexes();
  const digest = knowledgeDigest(input);
  const reuse = async (source: KnowledgeSourceDocument) => {
    if (source.deleted || source.requestFingerprint !== digest)
      return denyKnowledge(
        owner,
        source.id,
        'create',
        'state-conflict',
        409,
        'Retry key already used; refresh knowledge',
      );
    // A retry returns current owned state, never resurrects an old source or reveals a foreign project.
    return { source: dto(source), created: false };
  };
  const existing = await KnowledgeSource.findOne({ owner, idempotencyKey: key }).maxTimeMS(5000);
  if (existing) return reuse(existing);
  await validateProject(owner, input.project, null, 'create');
  for (let attempt = 0; attempt < 3; attempt++) {
    const slots = await KnowledgeSource.find({ owner, deleted: false })
      .select('slot')
      .limit(KNOWLEDGE_SOURCE_WINDOW + 1)
      .maxTimeMS(5000);
    const occupied = new Set(slots.map((source) => source.slot));
    const slot = Array.from({ length: KNOWLEDGE_SOURCE_WINDOW }, (_, index) => index + 1).find(
      (slot) => !occupied.has(slot),
    );
    if (slots.length >= KNOWLEDGE_SOURCE_WINDOW || slot === undefined) {
      const concurrent = await KnowledgeSource.findOne({ owner, idempotencyKey: key }).maxTimeMS(
        5000,
      );
      if (concurrent) return reuse(concurrent);
      return denyKnowledge(
        owner,
        null,
        'create',
        'capacity-unavailable',
        409,
        'Knowledge workspace holds at most50 active sources',
      );
    }
    try {
      const source = await KnowledgeSource.create({
        ...input,
        owner,
        slot,
        idempotencyKey: key,
        requestFingerprint: digest,
        version: 1,
        contentDigest: digest,
        deleted: false,
        auditEvents: [event(owner, 'created', 1, digest)],
      });
      return { source: dto(source), created: true };
    } catch (error) {
      if ((error as { code?: number }).code !== 11000) throw error;
      const concurrent = await KnowledgeSource.findOne({ owner, idempotencyKey: key }).maxTimeMS(
        5000,
      );
      if (concurrent) return reuse(concurrent);
    }
  }
  return denyKnowledge(
    owner,
    null,
    'create',
    'state-conflict',
    409,
    'Concurrent knowledge creation; retry the same key',
  );
};
export const changeKnowledge = async (
  owner: string,
  id: string,
  version: number,
  contentDigest: string,
  input: KnowledgeInput | null,
) => {
  const action = input ? 'update' : 'delete';
  const current = await KnowledgeSource.findOne({ _id: id, owner, deleted: false }).maxTimeMS(5000);
  if (!current)
    return denyKnowledge(owner, id, action, 'source-not-found', 404, 'Knowledge source not found');
  if (
    current.version !== version ||
    current.contentDigest !== contentDigest ||
    (input && version >= KNOWLEDGE_VERSION_MAX)
  )
    return denyKnowledge(
      owner,
      id,
      action,
      'state-conflict',
      409,
      'Refresh source; version/digest changed or edit limit reached',
    );
  if (input) await validateProject(owner, input.project, id, action);
  const digest = input ? knowledgeDigest(input) : contentDigest;
  const updated = await KnowledgeSource.findOneAndUpdate(
    { _id: id, owner, deleted: false, version, contentDigest },
    {
      $set: input
        ? { ...input, contentDigest: digest, deleted: false }
        : {
            title: '',
            content: '',
            project: null,
            slot: null,
            deleted: true,
            contentDigest: digest,
          },
      $unset: { embeddingIndex: 1 },
      $inc: { version: 1 },
      $push: { auditEvents: event(owner, input ? 'updated' : 'deleted', version + 1, digest) },
    },
    { new: true, runValidators: true, maxTimeMS: 5000 },
  );
  if (!updated)
    return denyKnowledge(
      owner,
      id,
      action,
      'state-conflict',
      409,
      'Source changed; refresh before retrying',
    );
  return input ? dto(updated) : null;
};
export const knowledgeAudit = async (owner: string, id: string) => {
  const source = await KnowledgeSource.findOne({ _id: id, owner })
    .select('version deleted auditEvents')
    .maxTimeMS(5000);
  if (!source)
    return denyKnowledge(owner, id, 'read', 'source-not-found', 404, 'Knowledge source not found');
  return {
    sourceId: source.id,
    version: source.version,
    deleted: source.deleted,
    events: source.auditEvents,
  };
};
export const knowledgeDenials = (owner: string) =>
  KnowledgeDenial.find({ owner }).sort({ at: -1 }).limit(100).maxTimeMS(5000);
export const validKnowledgeVersion = (version: unknown, digest: unknown) =>
  typeof version === 'number' &&
  Number.isSafeInteger(version) &&
  version >= 1 &&
  version <= KNOWLEDGE_VERSION_MAX &&
  typeof digest === 'string' &&
  /^[a-f0-9]{64}$/.test(digest);
export const validKnowledgeId = (id: unknown) => isObjectIdString(id);
