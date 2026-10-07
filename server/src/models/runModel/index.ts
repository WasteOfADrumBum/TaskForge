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
  failureReason: 'expired' | 'interrupted' | 'cancelled' | 'provider-error' | null;
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
    status: { type: String, enum: RUN_STATUSES, default: 'queued', required: true },
    version: { type: Number, default: 0, min: 0, validate: Number.isSafeInteger },
    idempotencyKey: { type: String, required: true, match: RUN_KEY_PATTERN },
    requestFingerprint: { type: String, required: true, match: /^[a-f0-9]{64}$/ },
    attemptId: { type: String, default: null },
    workDeadline: { type: Date, default: null },
    leaseExpiresAt: { type: Date, default: null },
    failureReason: {
      type: String,
      enum: ['expired', 'interrupted', 'cancelled', 'provider-error', null],
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
runSchema.index({ owner: 1, idempotencyKey: 1 }, { unique: true });
export const Run = model('Run', runSchema);
