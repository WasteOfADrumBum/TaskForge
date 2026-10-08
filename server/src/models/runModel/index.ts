import { createHash } from 'node:crypto';
import { Schema, model, type Types } from 'mongoose';

export const RUN_STATUSES = [
  'queued',
  'running',
  'awaiting-approval',
  'approved',
  'rejected',
  'failed',
] as const;
export const RUN_WORKFLOWS = ['draft', 'chief-of-staff'] as const;
export type RunWorkflow = (typeof RUN_WORKFLOWS)[number];
export type RunStatus = (typeof RUN_STATUSES)[number];
export const RUN_INPUT_MAX = 8000;
export const RUN_CONTEXT_MAX_BYTES = 16384;
export const RUN_RESULT_MAX_BYTES = 65536;
export const RUN_KEY_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._-]{15,127}$/;

export const isBoundedJson = (value: unknown, maxBytes: number): boolean => {
  let nodes = 0;
  const walk = (item: unknown, depth: number): boolean => {
    if (++nodes > 10000 || depth > 12) return false;
    if (item === null || typeof item === 'boolean' || typeof item === 'string') return true;
    if (typeof item === 'number') return Number.isFinite(item);
    if (Array.isArray(item)) return item.every((entry) => walk(entry, depth + 1));
    if (
      typeof item !== 'object' ||
      !item ||
      ![Object.prototype, null].includes(Object.getPrototypeOf(item))
    )
      return false;
    return Object.values(item).every((entry) => walk(entry, depth + 1));
  };
  try {
    return walk(value, 0) && Buffer.byteLength(JSON.stringify(value), 'utf8') <= maxBytes;
  } catch {
    return false;
  }
};

export const digestRunResult = (result: unknown): string | null => {
  if (result === null || !isBoundedJson(result, RUN_RESULT_MAX_BYTES)) return null;
  const canonical = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(canonical);
    if (value && typeof value === 'object')
      return Object.fromEntries(
        Object.keys(value)
          .sort()
          .map((key) => [key, canonical((value as Record<string, unknown>)[key])]),
      );
    return value;
  };
  return createHash('sha256')
    .update(JSON.stringify(canonical(result)))
    .digest('hex');
};
export interface RunReview {
  decision: 'approved' | 'rejected';
  note: string;
  at: Date;
  reviewedVersion: number;
  resultDigest: string;
}
const reviewSchema = new Schema<RunReview>(
  {
    decision: { type: String, enum: ['approved', 'rejected'], required: true },
    note: { type: String, default: '', maxlength: 2000 },
    at: { type: Date, required: true },
    reviewedVersion: { type: Number, required: true, min: 0, validate: Number.isSafeInteger },
    resultDigest: { type: String, required: true, match: /^[a-f0-9]{64}$/ },
  },
  { _id: false, strict: 'throw' },
);

export const HANDOFF_MAX_DEPTH = 3;
export interface RunHandoff {
  parent: Types.ObjectId;
  ancestors: Types.ObjectId[];
  sourceVersion: number;
  sourceResultDigest: string;
}
const handoffSchema = new Schema<RunHandoff>(
  {
    parent: { type: Schema.Types.ObjectId, ref: 'Run', required: true },
    ancestors: {
      type: [Schema.Types.ObjectId],
      required: true,
      validate: (ids: Types.ObjectId[]) =>
        ids.length >= 1 &&
        ids.length <= HANDOFF_MAX_DEPTH &&
        new Set(ids.map(String)).size === ids.length,
    },
    sourceVersion: { type: Number, required: true, min: 0, validate: Number.isSafeInteger },
    sourceResultDigest: { type: String, required: true, match: /^[a-f0-9]{64}$/ },
  },
  { _id: false, strict: 'throw' },
);

export interface RunLifecycleEvent {
  id: string;
  at: Date;
  actor: Types.ObjectId;
  kind: 'created' | 'claimed' | 'drafted' | 'failed' | 'expired' | 'approved' | 'rejected';
  from: RunStatus | null;
  to: RunStatus;
  version: number;
  mode: 'demo' | 'local' | null;
  workflow?: RunWorkflow | null;
  resultDigest?: string | null;
  contextDigest?: string | null;
  parentRun?: Types.ObjectId | null;
  sourceResultDigest?: string | null;
  reason: 'expired' | 'interrupted' | 'cancelled' | 'provider-error' | 'permission-denied' | null;
}
const lifecycleSchema = new Schema<RunLifecycleEvent>(
  {
    id: { type: String, required: true, maxlength: 64 },
    at: { type: Date, required: true },
    actor: { type: Schema.Types.ObjectId, required: true },
    kind: {
      type: String,
      enum: ['created', 'claimed', 'drafted', 'failed', 'expired', 'approved', 'rejected'],
      required: true,
    },
    from: { type: String, enum: [...RUN_STATUSES, null], default: null },
    to: { type: String, enum: RUN_STATUSES, required: true },
    version: { type: Number, required: true, min: 0, validate: Number.isSafeInteger },
    resultDigest: { type: String, match: /^[a-f0-9]{64}$/, default: null },
    parentRun: { type: Schema.Types.ObjectId, default: null },
    sourceResultDigest: { type: String, match: /^[a-f0-9]{64}$/, default: null },
    contextDigest: { type: String, match: /^[a-f0-9]{64}$/, default: null },
    mode: { type: String, enum: ['demo', 'local', null], default: null },
    workflow: { type: String, enum: [...RUN_WORKFLOWS, null], default: null },
    reason: {
      type: String,
      enum: ['expired', 'interrupted', 'cancelled', 'provider-error', 'permission-denied', null],
      default: null,
    },
  },
  { _id: false, strict: 'throw' },
);

export interface RunRecord {
  owner: Types.ObjectId;
  task: Types.ObjectId;
  agent: Types.ObjectId;
  input: string;
  workflow: RunWorkflow;
  handoff: RunHandoff | null;
  context: unknown;
  contextDigest: string | null;
  result: unknown;
  status: RunStatus;
  version: number;
  idempotencyKey: string;
  requestFingerprint: string;
  attemptId: string | null;
  workDeadline: Date | null;
  leaseExpiresAt: Date | null;
  failureReason:
    'expired' | 'interrupted' | 'cancelled' | 'provider-error' | 'permission-denied' | null;
  executionMode: 'demo' | 'local' | null;
  auditEvents: RunLifecycleEvent[];
  review: RunReview | null;
  createdAt: Date;
  updatedAt: Date;
}

const runSchema = new Schema<RunRecord>(
  {
    owner: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    task: { type: Schema.Types.ObjectId, ref: 'Task', required: true },
    agent: { type: Schema.Types.ObjectId, ref: 'Agent', required: true },
    workflow: { type: String, enum: RUN_WORKFLOWS, default: 'draft' },
    handoff: { type: handoffSchema, default: null },
    input: { type: String, required: true, maxlength: RUN_INPUT_MAX },
    context: {
      type: Schema.Types.Mixed,
      default: () => ({}),
      validate: (value: unknown) => isBoundedJson(value, RUN_CONTEXT_MAX_BYTES),
    },
    result: {
      type: Schema.Types.Mixed,
      default: null,
      validate: (value: unknown) => isBoundedJson(value, RUN_RESULT_MAX_BYTES),
    },
    contextDigest: { type: String, match: /^[a-f0-9]{64}$/, default: null },
    executionMode: { type: String, enum: ['demo', 'local', null], default: null },
    auditEvents: {
      type: [lifecycleSchema],
      default: () => [],
      validate: (events: RunLifecycleEvent[]) => events.length <= 64,
    },
    review: { type: reviewSchema, default: null },
    status: { type: String, enum: RUN_STATUSES, default: 'queued', required: true },
    version: { type: Number, default: 0, min: 0, validate: Number.isSafeInteger },
    idempotencyKey: { type: String, required: true, match: RUN_KEY_PATTERN },
    requestFingerprint: { type: String, required: true, match: /^[a-f0-9]{64}$/ },
    attemptId: { type: String, default: null },
    workDeadline: { type: Date, default: null },
    leaseExpiresAt: { type: Date, default: null },
    failureReason: {
      type: String,
      enum: ['expired', 'interrupted', 'cancelled', 'provider-error', 'permission-denied', null],
      default: null,
    },
  },
  {
    timestamps: true,
    minimize: false,
    toJSON: {
      transform: (_doc, value) => {
        delete (value as Record<string, unknown>).requestFingerprint;
        delete (value as Record<string, unknown>).attemptId;
        (value as Record<string, unknown>).resultDigest = digestRunResult(value.result);
        return value;
      },
    },
  },
);
// All ordinary mutations must retain the audit trail; only a version-fenced,
// owner-scoped lifecycle CAS may append an event. Raw database administration is out of scope.
runSchema.pre('save', function (next) {
  if (!this.isNew) return next(new Error('Run records require audited lifecycle updates'));
  if (
    this.handoff &&
    (String(this.handoff.ancestors.at(-1)) !== String(this.handoff.parent) ||
      this.handoff.ancestors.some((id) => String(id) === String(this._id)) ||
      String(this.auditEvents[0]?.parentRun) !== String(this.handoff.parent) ||
      this.auditEvents[0]?.sourceResultDigest !== this.handoff.sourceResultDigest)
  )
    return next(new Error('Handoff identity requires matching creation audit'));
  next();
});
for (const operation of [
  'updateOne',
  'updateMany',
  'replaceOne',
  'findOneAndReplace',
  'deleteOne',
  'deleteMany',
  'findOneAndDelete',
] as const) {
  runSchema.pre(operation, function () {
    throw new Error('Run records require audited lifecycle updates');
  });
}
runSchema.pre('bulkWrite', function () {
  throw new Error('Run records require audited lifecycle updates');
});
runSchema.pre('findOneAndUpdate', function () {
  const update = this.getUpdate() as Record<string, Record<string, unknown>> | null;
  const filter = this.getFilter();
  const event = update?.$push?.auditEvents as RunLifecycleEvent | undefined;
  const transitions: Record<string, string[]> = {
    queued: ['running', 'failed'],
    running: ['awaiting-approval', 'failed'],
    'awaiting-approval': ['approved', 'rejected'],
  };
  if (
    !update ||
    Array.isArray(update) ||
    !event ||
    !filter.owner ||
    !Number.isSafeInteger(filter.version) ||
    !transitions[filter.status]?.includes(String(update.$set?.status)) ||
    update.$inc?.version !== 1 ||
    event.version !== filter.version + 1 ||
    event.from !== filter.status ||
    event.to !== update.$set?.status ||
    String(event.actor) !== String(filter.owner)
  ) {
    throw new Error('Run records require audited lifecycle updates');
  }
  for (const fields of Object.values(update)) {
    for (const field of Object.keys(fields)) {
      if (
        (field === 'workflow' || field.startsWith('workflow.')) &&
        (field !== 'workflow' ||
          fields !== update.$set ||
          filter.status !== 'queued' ||
          update.$set?.status !== 'running' ||
          event.workflow !== update.$set.workflow ||
          !RUN_WORKFLOWS.includes(update.$set.workflow as RunWorkflow))
      )
        throw new Error('Run workflow is frozen with its audited claim');
      if (
        (field === 'context' || field.startsWith('context.') || field === 'contextDigest') &&
        (field.startsWith('context.') ||
          filter.status !== 'queued' ||
          update.$set?.status !== 'running' ||
          fields !== update.$set)
      )
        throw new Error('Run context is frozen after claim');
    }
  }
  if (
    (update.$set?.context !== undefined || update.$set?.contextDigest !== undefined) &&
    (!isBoundedJson(update.$set.context, RUN_CONTEXT_MAX_BYTES) ||
      digestRunResult(update.$set.context) !== update.$set.contextDigest ||
      event.contextDigest !== update.$set.contextDigest)
  )
    throw new Error('Run context requires a matching audited digest');
  this.setQuery({ ...filter, 'auditEvents.63': { $exists: false } });
  const expectedKind =
    event.to === 'running' ? 'claimed' : event.to === 'awaiting-approval' ? 'drafted' : event.to;
  if (
    event.kind !== expectedKind &&
    !(event.to === 'failed' && event.kind === 'expired' && event.reason === 'expired')
  )
    throw new Error('Invalid run audit event');
  if (this.getOptions().upsert) throw new Error('Run records require audited lifecycle updates');
  for (const [operator, fields] of Object.entries(update)) {
    if (operator === '$setOnInsert' && Object.keys(fields).some((field) => field !== 'createdAt'))
      throw new Error('Run records require audited lifecycle updates');
    if (!['$set', '$inc', '$push', '$setOnInsert'].includes(operator))
      throw new Error('Run records require audited lifecycle updates');
    for (const field of Object.keys(fields)) {
      if ((field === 'auditEvents' || field.startsWith('auditEvents.')) && operator !== '$push')
        throw new Error('Run audit events are append-only');
      if (
        [
          'owner',
          'task',
          'agent',
          'input',
          'idempotencyKey',
          'requestFingerprint',
          'handoff',
        ].includes(field) ||
        field.startsWith('handoff.')
      )
        throw new Error('Run identity is immutable');
    }
  }
});
runSchema.index({ owner: 1, idempotencyKey: 1 }, { unique: true });
export const Run = model('Run', runSchema);
