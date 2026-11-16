import { Schema, model } from 'mongoose';
import { isCalendarDate, normalizeCalendarDate } from '../../utils/calendarDate';

export const GOAL_STATUSES = ['active', 'achieved', 'dropped'] as const;
export type GoalStatus = (typeof GOAL_STATUSES)[number];
// What a goal is about. Goals saved before areas existed read as general.
export const GOAL_AREAS = ['general', 'career', 'learning'] as const;
export type GoalArea = (typeof GOAL_AREAS)[number];
export const GOAL_TITLE_MAX = 120;
export const GOAL_DESCRIPTION_MAX = 2000;

const goalSchema = new Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: GOAL_TITLE_MAX },
    description: { type: String, default: '', trim: true, maxlength: GOAL_DESCRIPTION_MAX },
    status: { type: String, enum: GOAL_STATUSES, default: 'active' },
    area: { type: String, enum: GOAL_AREAS, default: 'general' },
    // A calendar date, stored as UTC midnight like task due dates.
    targetDate: {
      type: Date,
      default: null,
      set: (value: unknown) => {
        if (value === null || value === undefined) return value;
        if (isCalendarDate(value)) return value;
        const normalized = normalizeCalendarDate(value);
        if (normalized === null) throw new TypeError('Invalid target date');
        return new Date(normalized);
      },
      validate: {
        validator: (value: unknown) =>
          value === null || value === undefined || isCalendarDate(value),
        message: 'Invalid target date',
      },
    },
    // When the goal last became achieved; null otherwise. Set by the goal service only.
    achievedAt: { type: Date, default: null },
    owner: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  },
  { timestamps: true },
);

export const Goal = model('Goal', goalSchema);
