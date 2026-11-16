import { Schema, model } from 'mongoose';
import { SKILL_SLUG_MAX, SKILL_SLUG_PATTERN } from '../../utils/skillSlug';

export const JOB_STATUSES = [
  'saved',
  'applied',
  'interviewing',
  'offer',
  'rejected',
  'closed',
] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];
export const JOB_TITLE_MAX = 120;
export const JOB_COMPANY_MAX = 120;
export const JOB_URL_MAX = 2000;
export const JOB_NOTES_MAX = 2000;
export const JOB_SKILLS_MAX = 30;

// A job the user saved by hand. TaskForge never fetches the URL; it is only a link.
const jobSchema = new Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: JOB_TITLE_MAX },
    company: { type: String, default: '', trim: true, maxlength: JOB_COMPANY_MAX },
    url: { type: String, default: '', maxlength: JOB_URL_MAX },
    requiredSkills: {
      type: [{ type: String, maxlength: SKILL_SLUG_MAX, match: SKILL_SLUG_PATTERN }],
      default: [],
      validate: {
        validator: (skills: string[]) => skills.length <= JOB_SKILLS_MAX,
        message: 'Too many skills',
      },
    },
    status: { type: String, enum: JOB_STATUSES, default: 'saved' },
    notes: { type: String, default: '', trim: true, maxlength: JOB_NOTES_MAX },
    // Set by the server only: when the job was saved, then whenever its status actually changes.
    // Jobs saved before KAN-72 have none.
    statusChangedAt: { type: Date, default: null },
    owner: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  },
  { timestamps: true },
);

export const SavedJob = model('SavedJob', jobSchema);
