import { Schema, model } from 'mongoose';

export const RESUME_HEADLINE_MAX = 120;
export const RESUME_SUMMARY_MAX = 2000;
export const RESUME_BODY_MAX = 20000;

// The user's resume as plain text: a headline, a short summary, and the rest (experience,
// education, links) in one body. One per owner; the unique index is created lazily by the
// resume service.
const resumeSchema = new Schema(
  {
    owner: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    headline: { type: String, default: '', trim: true, maxlength: RESUME_HEADLINE_MAX },
    summary: { type: String, default: '', trim: true, maxlength: RESUME_SUMMARY_MAX },
    body: { type: String, default: '', maxlength: RESUME_BODY_MAX },
  },
  { timestamps: true },
);

export const Resume = model('Resume', resumeSchema);
