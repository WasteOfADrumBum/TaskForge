import { Schema, model } from 'mongoose';
export const KNOWLEDGE_DENIAL_REASONS = [
  'invalid-input',
  'source-not-found',
  'project-not-found',
  'state-conflict',
  'capacity-unavailable',
] as const;
const schema = new Schema(
  {
    owner: { type: Schema.Types.ObjectId, required: true, immutable: true },
    source: { type: Schema.Types.ObjectId, default: null, immutable: true },
    action: {
      type: String,
      enum: ['create', 'read', 'update', 'delete', 'search'],
      required: true,
      immutable: true,
    },
    reason: { type: String, enum: KNOWLEDGE_DENIAL_REASONS, required: true, immutable: true },
    at: { type: Date, default: Date.now, required: true, immutable: true },
  },
  { strict: 'throw' },
);
schema.index({ owner: 1, at: -1 });
schema.pre('save', function () {
  if (!this.isNew) throw new Error('Knowledge denials are append-only');
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
] as const)
  schema.pre(operation, function () {
    throw new Error('Knowledge denials are append-only');
  });
schema.pre('bulkWrite', function () {
  throw new Error('Knowledge denials are append-only');
});
export const KnowledgeDenial = model('KnowledgeDenial', schema);
