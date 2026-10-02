import { Schema, model } from 'mongoose';

export const PROJECT_STATUSES = ['active', 'completed', 'archived'] as const;
export const PROJECT_NAME_MAX = 120;
export const PROJECT_DESCRIPTION_MAX = 2000;

const projectSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: PROJECT_NAME_MAX },
    description: { type: String, default: '', trim: true, maxlength: PROJECT_DESCRIPTION_MAX },
    status: { type: String, enum: PROJECT_STATUSES, default: 'active' },
    owner: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  },
  { timestamps: true },
);

export const Project = model('Project', projectSchema);
