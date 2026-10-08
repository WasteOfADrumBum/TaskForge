import { validKnowledgeIndex } from '../../services/knowledgeIndexService/primitives';
import { isObjectIdString } from '../../utils/objectId';
import { Schema, model, type HydratedDocument, type InferSchemaType } from 'mongoose';
import {
  KNOWLEDGE_CONTENT_MAX_BYTES,
  KNOWLEDGE_SOURCE_WINDOW,
  knowledgeDigest,
  normalizeKnowledgeInput,
} from '../../services/knowledgeService/primitives';
export const KNOWLEDGE_VERSION_MAX = 100;
export const KNOWLEDGE_AUDIT_MAX = 201;
const eventSchema = new Schema(
  {
    id: { type: String, required: true },
    at: { type: Date, required: true },
    actor: { type: Schema.Types.ObjectId, required: true },
    kind: { type: String, enum: ['created', 'updated', 'deleted', 'indexed'], required: true },
    version: { type: Number, required: true, min: 1, max: 101 },
    contentDigest: { type: String, required: true, match: /^[a-f0-9]{64}$/ },
  },
  { _id: false, strict: 'throw' },
);
const schema = new Schema(
  {
    owner: { type: Schema.Types.ObjectId, ref: 'User', required: true, immutable: true },
    slot: { type: Number, default: null, min: 1, max: KNOWLEDGE_SOURCE_WINDOW },
    idempotencyKey: { type: String, required: true, immutable: true },
    requestFingerprint: { type: String, required: true, immutable: true, match: /^[a-f0-9]{64}$/ },
    title: { type: String, default: '', maxlength: 120 },
    content: {
      type: String,
      default: '',
      validate: (value: string) => Buffer.byteLength(value, 'utf8') <= KNOWLEDGE_CONTENT_MAX_BYTES,
    },
    kind: { type: String, enum: ['note', 'text'], required: true },
    project: { type: Schema.Types.ObjectId, ref: 'Project', default: null },
    version: { type: Number, required: true, min: 1, max: 101, validate: Number.isSafeInteger },
    contentDigest: { type: String, required: true, match: /^[a-f0-9]{64}$/ },
    deleted: { type: Boolean, required: true, default: false },
    // Native atomic co-location; private vectors are excluded from ordinary CRUD/keyword queries.
    embeddingIndex: { type: Schema.Types.Mixed, select: false, validate: validKnowledgeIndex },
    auditEvents: {
      type: [eventSchema],
      required: true,
      validate: (events: unknown[]) => events.length >= 1 && events.length <= KNOWLEDGE_AUDIT_MAX,
    },
  },
  { timestamps: true, strict: 'throw' },
);
schema.pre('validate', function () {
  if (!this.isNew) throw new Error('Knowledge sources require audited atomic updates');
  const input = normalizeKnowledgeInput({
    title: this.title,
    content: this.content,
    kind: this.kind,
    project: this.project ? String(this.project) : null,
  });
  const event = this.auditEvents[0];
  if (
    this.embeddingIndex !== undefined ||
    this.version !== 1 ||
    this.deleted ||
    !Number.isInteger(this.slot) ||
    this.auditEvents.length !== 1 ||
    !event ||
    event.kind !== 'created' ||
    event.version !== 1 ||
    String(event.actor) !== String(this.owner) ||
    event.contentDigest !== this.contentDigest ||
    knowledgeDigest(input) !== this.contentDigest ||
    this.requestFingerprint !== this.contentDigest
  )
    throw new Error('Knowledge creation requires matching audit and digest');
});
schema.pre('findOneAndUpdate', function () {
  const filter = this.getFilter();
  const update = this.getUpdate() as Record<string, Record<string, unknown>> | null;
  const event = update?.$push?.auditEvents as Record<string, unknown> | undefined;
  const set = update?.$set;
  const version = filter.version;
  const indexing = set && Object.hasOwn(set, 'embeddingIndex');
  if (indexing) {
    const index = set.embeddingIndex;
    if (
      !validKnowledgeIndex(index) ||
      !isObjectIdString(String(filter.owner)) ||
      !isObjectIdString(String(filter._id)) ||
      filter.deleted !== false ||
      index.sourceId !== String(filter._id) ||
      index.sourceVersion !== version ||
      index.sourceDigest !== filter.contentDigest ||
      !event ||
      event.kind !== 'indexed' ||
      event.version !== version ||
      event.contentDigest !== filter.contentDigest ||
      String(event.actor) !== String(filter.owner) ||
      this.getOptions().upsert ||
      JSON.stringify(filter.embeddingIndex) !== '{"$exists":false}'
    )
      throw new Error('Knowledge indexing requires exact active source and audit');
    for (const [operator, fields] of Object.entries(update!)) {
      const allowed =
        operator === '$set'
          ? ['embeddingIndex', 'updatedAt']
          : operator === '$push'
            ? ['auditEvents']
            : operator === '$setOnInsert'
              ? ['createdAt']
              : [];
      if (
        !allowed.length ||
        !fields ||
        Object.keys(fields).some((field) => !allowed.includes(field))
      )
        throw new Error('Knowledge index cannot change source identity/content');
    }
    this.setQuery({ ...filter, 'auditEvents.200': { $exists: false } });
    return;
  }
  if (
    !update ||
    Array.isArray(update) ||
    !isObjectIdString(String(filter.owner)) ||
    !isObjectIdString(String(filter._id)) ||
    filter.deleted !== false ||
    !Number.isSafeInteger(version) ||
    version < 1 ||
    version > KNOWLEDGE_VERSION_MAX ||
    typeof filter.contentDigest !== 'string' ||
    !event ||
    !set ||
    update.$inc?.version !== 1 ||
    update.$unset?.embeddingIndex !== 1 ||
    event.version !== version + 1 ||
    String(event.actor) !== String(filter.owner) ||
    event.contentDigest !== set.contentDigest ||
    this.getOptions().upsert
  )
    throw new Error('Knowledge updates require exact audited version');
  for (const [operator, fields] of Object.entries(update)) {
    const allowed =
      operator === '$set'
        ? ['title', 'content', 'kind', 'project', 'contentDigest', 'deleted', 'slot', 'updatedAt']
        : operator === '$inc'
          ? ['version']
          : operator === '$unset'
            ? ['embeddingIndex']
            : operator === '$push'
              ? ['auditEvents']
              : operator === '$setOnInsert'
                ? ['createdAt']
                : [];
    if (!allowed.length || !fields || Object.keys(fields).some((field) => !allowed.includes(field)))
      throw new Error('Knowledge identity/audit cannot be replaced');
  }
  if (set.deleted === true) {
    if (
      event.kind !== 'deleted' ||
      set.slot !== null ||
      set.title !== '' ||
      set.content !== '' ||
      set.project !== null ||
      set.contentDigest !== filter.contentDigest
    )
      throw new Error('Knowledge deletion must clear content and free its slot');
  } else {
    if (
      event.kind !== 'updated' ||
      set.deleted !== false ||
      version >= KNOWLEDGE_VERSION_MAX ||
      Object.hasOwn(set, 'slot')
    )
      throw new Error('Knowledge version limit reached');
    const input = normalizeKnowledgeInput({
      title: set.title,
      content: set.content,
      kind: set.kind,
      project: set.project ? String(set.project) : null,
    });
    if (knowledgeDigest(input) !== set.contentDigest)
      throw new Error('Knowledge update requires matching digest');
  }
  this.setQuery({ ...filter, 'auditEvents.200': { $exists: false } });
});
for (const operation of [
  'updateOne',
  'updateMany',
  'replaceOne',
  'findOneAndReplace',
  'deleteOne',
  'deleteMany',
  'findOneAndDelete',
] as const)
  schema.pre(operation, function () {
    throw new Error('Knowledge sources require audited atomic updates');
  });
schema.index(
  { owner: 1, slot: 1 },
  { unique: true, partialFilterExpression: { slot: { $type: 'number' } } },
);
schema.index({ owner: 1, idempotencyKey: 1 }, { unique: true });
schema.index({ owner: 1, deleted: 1, slot: 1 });
schema.pre('bulkWrite', function () {
  throw new Error('Knowledge sources require audited atomic updates');
});
schema.pre('insertMany', function () {
  throw new Error('Knowledge sources require audited atomic updates');
});
export type KnowledgeSourceDocument = HydratedDocument<InferSchemaType<typeof schema>>;
export const KnowledgeSource = model('KnowledgeSource', schema);
