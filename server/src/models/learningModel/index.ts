import { Schema, model } from 'mongoose';
import { isCalendarDate, normalizeCalendarDate } from '../../utils/calendarDate';
import { SKILL_SLUG_MAX, SKILL_SLUG_PATTERN } from '../../utils/skillSlug';

export const LEARNING_KINDS = [
  'course',
  'article',
  'book',
  'video',
  'project',
  'practice',
  'other',
] as const;
export type LearningKind = (typeof LEARNING_KINDS)[number];
export const LEARNING_STATUSES = ['planned', 'in_progress', 'done'] as const;
export type LearningStatus = (typeof LEARNING_STATUSES)[number];
export const LEARNING_TITLE_MAX = 120;
export const LEARNING_NOTES_MAX = 2000;
export const LEARNING_URL_MAX = 2000;

// One step on the user's learning roadmap: a course, article, project or other resource,
// optionally tied to a skill by its slug so it lines up with the skills inventory.
const learningSchema = new Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: LEARNING_TITLE_MAX },
    skill: {
      type: String,
      default: '',
      maxlength: SKILL_SLUG_MAX,
      validate: {
        validator: (value: string) => value === '' || SKILL_SLUG_PATTERN.test(value),
        message: 'Invalid skill name',
      },
    },
    kind: { type: String, enum: LEARNING_KINDS, default: 'course' },
    url: { type: String, default: '', maxlength: LEARNING_URL_MAX },
    status: { type: String, enum: LEARNING_STATUSES, default: 'planned' },
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
    notes: { type: String, default: '', trim: true, maxlength: LEARNING_NOTES_MAX },
    // When the item last became done; null otherwise. Set by the learning service only.
    completedAt: { type: Date, default: null },
    owner: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  },
  { timestamps: true },
);

export const LearningItem = model('LearningItem', learningSchema);
