import { Schema, model } from 'mongoose';
import { SKILL_SLUG_MAX, SKILL_SLUG_PATTERN } from '../../utils/skillSlug';

export const SKILL_LEVELS = ['learning', 'working', 'strong', 'expert'] as const;
export type SkillLevel = (typeof SKILL_LEVELS)[number];

// One entry in the user's skills inventory. One per owner and name; the unique index is
// created lazily by the career service.
const skillSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      maxlength: SKILL_SLUG_MAX,
      match: SKILL_SLUG_PATTERN,
    },
    level: { type: String, enum: SKILL_LEVELS, default: 'working' },
    owner: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true },
);

export const Skill = model('Skill', skillSchema);
