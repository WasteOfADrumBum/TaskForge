import { Schema, model } from 'mongoose';

export const AUDIT_DENIAL_REASONS = [
  'run-not-found',
  'task-not-assigned',
  'agent-not-active',
  'missing-permission',
  'invalid-permission',
  'project-not-found',
  'invalid-mode',
  'execution-disabled',
  'state-conflict',
  'capacity-unavailable',
] as const;
const auditEventSchema = new Schema(
  {
    owner: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      immutable: true,
      index: true,
    },
    attemptedRun: { type: Schema.Types.ObjectId, default: null, immutable: true },
    action: {
      type: String,
      enum: ['execute', 'cancel', 'review'],
      required: true,
      immutable: true,
    },
    kind: { type: String, enum: ['denied'], required: true, immutable: true },
    reason: { type: String, enum: AUDIT_DENIAL_REASONS, required: true, immutable: true },
    at: { type: Date, default: Date.now, immutable: true, required: true },
  },
  { strict: 'throw' },
);
// Append-only application model. Direct database administrators remain outside this boundary.
auditEventSchema.pre('save', function (next) {
  if (!this.isNew) return next(new Error('Audit events are append-only'));
  next();
});
for (const operation of [
  'updateOne',
  'updateMany',
  'findOneAndUpdate',
  'replaceOne',
  'findOneAndReplace',
  'deleteOne',
  'deleteMany',
  'findOneAndDelete',
] as const) {
  auditEventSchema.pre(operation, function () {
    throw new Error('Audit events are append-only');
  });
}
auditEventSchema.pre('bulkWrite', function () {
  throw new Error('Audit events are append-only');
});
export const AuditEvent = model('AuditEvent', auditEventSchema);
