// Keep in sync with server/src/models/skillModel and jobModel.
export type SkillLevel = 'learning' | 'working' | 'strong' | 'expert';
export const SKILL_LEVELS: SkillLevel[] = ['learning', 'working', 'strong', 'expert'];
export const skillLevelLabel: Record<SkillLevel, string> = {
  learning: 'Learning',
  working: 'Working knowledge',
  strong: 'Strong',
  expert: 'Expert',
};

export type JobStatus = 'saved' | 'applied' | 'interviewing' | 'offer' | 'rejected' | 'closed';
export const JOB_STATUSES: JobStatus[] = [
  'saved',
  'applied',
  'interviewing',
  'offer',
  'rejected',
  'closed',
];
export const jobStatusLabel: Record<JobStatus, string> = {
  saved: 'Saved',
  applied: 'Applied',
  interviewing: 'Interviewing',
  offer: 'Offer',
  rejected: 'Rejected',
  closed: 'Closed',
};
export const JOB_TITLE_MAX = 120;
export const JOB_COMPANY_MAX = 120;
export const JOB_NOTES_MAX = 2000;
export const JOB_SKILLS_MAX = 30;
export const SKILL_NAME_MAX = 40;

export interface Skill {
  _id?: string;
  id?: string;
  name: string;
  level: SkillLevel;
  createdAt?: string;
  updatedAt?: string;
}

export interface SavedJob {
  _id?: string;
  id?: string;
  title: string;
  company: string;
  url: string;
  requiredSkills: string[];
  status: JobStatus;
  notes: string;
  // Set by the server when the job is saved and whenever its status changes; null or missing
  // on jobs saved before KAN-72.
  statusChangedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export type SkillInput = { name: string; level?: SkillLevel };
export type JobInput = {
  title: string;
  company?: string;
  url?: string;
  requiredSkills?: string[];
  notes?: string;
};
export type JobUpdate = Partial<JobInput> & { status?: JobStatus };

export const getRecordId = (record: { _id?: string; id?: string }) => record._id ?? record.id ?? '';
