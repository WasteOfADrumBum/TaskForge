import { Schema, model } from 'mongoose';

export const TASK_STATUSES = ['todo', 'in-progress', 'done'] as const;
export const TASK_PRIORITIES = ['low', 'medium', 'high'] as const;

const taskSchema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, default: '', trim: true },
    status: { type: String, enum: TASK_STATUSES, default: 'todo' },
    priority: { type: String, enum: TASK_PRIORITIES, default: 'medium' },
    dueDate: { type: Date, default: null },
    owner: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    // Optional; tasks can exist without a project. Always a project owned by the same user.
    project: { type: Schema.Types.ObjectId, ref: 'Project', default: null, index: true },
  },
  { timestamps: true },
);

export const Task = model('Task', taskSchema);
