import { Schema, model, type Types } from 'mongoose';

export const RUN_STATUSES = [
  'queued',
  'running',
  'awaiting-approval',
  'approved',
  'rejected',
  'failed',
] as const;
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

export interface RunLifecycleEvent {
  id: string;
  at: Date;
  actor: Types.ObjectId;
  kind: 'created' | 'claimed' | 'drafted' | 'failed' | 'expired' | 'approved' | 'rejected';
  from: RunStatus | null;
  to: RunStatus;
  version: number;
  mode: 'demo' | 'local' | null;
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
    mode: { type: String, enum: ['demo', 'local', null], default: null },
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
  context: unknown;
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
  createdAt: Date;
  updatedAt: Date;
}

const runSchema = new Schema<RunRecord>(
  {
    owner: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    task: { type: Schema.Types.ObjectId, ref: 'Task', required: true },
    agent: { type: Schema.Types.ObjectId, ref: 'Agent', required: true },
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
    executionMode: { type: String, enum: ['demo', 'local', null], default: null },
    auditEvents: {
      type: [lifecycleSchema],
      default: () => [],
      validate: (events: RunLifecycleEvent[]) => events.length <= 64,
    },
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
        return value;
      },
    },
  },
);
// All ordinary mutations must retain the audit trail; only a version-fenced,
// owner-scoped lifecycle CAS may append an event. Raw database administration is out of scope.
runSchema.pre('save', function (next) {
  if (!this.isNew) return next(new Error('Run records require audited lifecycle updates'));
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
        ['owner', 'task', 'agent', 'input', 'idempotencyKey', 'requestFingerprint'].includes(field)
      )
        throw new Error('Run identity is immutable');
    }
  }
});
runSchema.index({ owner: 1, idempotencyKey: 1 }, { unique: true });
export const Run = model('Run', runSchema);
