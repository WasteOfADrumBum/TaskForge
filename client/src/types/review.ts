// Keep in sync with server/src/models/reviewModel.
export type ReviewKind = 'daily' | 'weekly';
export const REVIEW_KINDS: ReviewKind[] = ['daily', 'weekly'];
export const REVIEW_REFLECTION_MAX = 2000;
export const REVIEW_FOCUS_MAX: Record<ReviewKind, number> = { daily: 3, weekly: 5 };

export interface Review {
  _id?: string;
  id?: string;
  kind: ReviewKind;
  // Local calendar date of the day reviewed, or the Monday of the week, as "YYYY-MM-DD".
  period: string;
  reflection: string;
  focusTasks: string[];
  createdAt?: string;
  updatedAt?: string;
}

export interface ReviewInput {
  reflection: string;
  focusTasks: string[];
}
