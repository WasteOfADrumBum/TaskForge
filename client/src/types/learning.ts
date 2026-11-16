// Keep in sync with server/src/models/learningModel.
export type LearningKind =
  'course' | 'article' | 'book' | 'video' | 'project' | 'practice' | 'other';
export const LEARNING_KINDS: LearningKind[] = [
  'course',
  'article',
  'book',
  'video',
  'project',
  'practice',
  'other',
];
export const learningKindLabel: Record<LearningKind, string> = {
  course: 'Course',
  article: 'Article',
  book: 'Book',
  video: 'Video',
  project: 'Project',
  practice: 'Practice',
  other: 'Other',
};

export type LearningStatus = 'planned' | 'in_progress' | 'done';
export const LEARNING_STATUSES: LearningStatus[] = ['in_progress', 'planned', 'done'];
export const learningStatusLabel: Record<LearningStatus, string> = {
  planned: 'Planned',
  in_progress: 'In progress',
  done: 'Done',
};

export const LEARNING_TITLE_MAX = 120;
export const LEARNING_NOTES_MAX = 2000;
export const LEARNING_URL_MAX = 2000;

export interface LearningItem {
  _id?: string;
  id?: string;
  title: string;
  skill: string;
  kind: LearningKind;
  url: string;
  status: LearningStatus;
  // A calendar date as UTC midnight, like task due dates, or null.
  targetDate: string | null;
  notes: string;
  // Set by the server when the item becomes done; null otherwise.
  completedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface LearningInput {
  title: string;
  skill?: string;
  kind?: LearningKind;
  url?: string;
  status?: LearningStatus;
  targetDate?: string | null;
  notes?: string;
}

export type LearningUpdate = Partial<LearningInput>;
