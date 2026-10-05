import { Schema, model } from 'mongoose';
import { isCalendarDate, normalizeCalendarDate } from '../../utils/calendarDate';

export const TASK_STATUSES = ['todo', 'in-progress', 'done'] as const;
export const TASK_TITLE_MAX = 120;
export const TASK_DESCRIPTION_MAX = 2000;
export const TASK_PRIORITIES = ['low', 'medium', 'high'] as const;
// Who a task is assigned to: the owner themselves ('user'), one of the owner's agents
// ('agent'), or nobody (null). Assigning to an agent only records the assignment; nothing runs it.
export const TASK_ASSIGNEE_TYPES = ['user', 'agent'] as const;

const taskSchema = new Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: TASK_TITLE_MAX },
    description: { type: String, default: '', trim: true, maxlength: TASK_DESCRIPTION_MAX },
    status: { type: String, enum: TASK_STATUSES, default: 'todo' },
    priority: { type: String, enum: TASK_PRIORITIES, default: 'medium' },
    dueDate: {
      type: Date,
      default: null,
      // Reject invalid raw calendar strings before Mongoose can roll them into another day.
      set: (value: unknown) => {
        if (value === null || value === undefined) return value;
        if (isCalendarDate(value)) return value;
        const normalized = normalizeCalendarDate(value);
        if (normalized === null) throw new TypeError('Invalid due date');
        return new Date(normalized);
      },
      validate: {
        validator: (value: unknown) =>
          value === null || value === undefined || isCalendarDate(value),
        message: 'Invalid due date',
      },
    },
    owner: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    // Optional; tasks can exist without a project. Always a project owned by the same user.
    project: { type: Schema.Types.ObjectId, ref: 'Project', default: null, index: true },
    // 'user' always means the task's owner; a task can't be assigned to another user.
    assigneeType: { type: String, enum: [...TASK_ASSIGNEE_TYPES, null], default: null },
    // Set only when assigneeType is 'agent', and always an agent owned by the same user.
    assigneeAgent: { type: Schema.Types.ObjectId, ref: 'Agent', default: null, index: true },
  },
  { timestamps: true },
);

export const Task = model('Task', taskSchema);
