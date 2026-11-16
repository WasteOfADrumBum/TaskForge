import { Schema, model } from 'mongoose';

export const REVIEW_KINDS = ['daily', 'weekly'] as const;
export type ReviewKind = (typeof REVIEW_KINDS)[number];
export const REVIEW_REFLECTION_MAX = 2000;
// How many tasks a review can carry forward as focus for the next day or week.
export const REVIEW_FOCUS_MAX: Record<ReviewKind, number> = { daily: 3, weekly: 5 };

// One saved daily or weekly review. `period` is the user's local calendar date of the day
// reviewed, or the Monday of the week reviewed, as "YYYY-MM-DD". One review per owner, kind and
// period; the unique index is created lazily by the review service.
const reviewSchema = new Schema(
  {
    owner: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    kind: { type: String, enum: REVIEW_KINDS, required: true },
    period: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
    reflection: { type: String, default: '', trim: true, maxlength: REVIEW_REFLECTION_MAX },
    // Always the owner's own tasks when saved. A focus task deleted later simply stops resolving.
    focusTasks: { type: [{ type: Schema.Types.ObjectId, ref: 'Task' }], default: [] },
  },
  { timestamps: true },
);

export const Review = model('Review', reviewSchema);
