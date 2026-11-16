import { Schema, model } from 'mongoose';
import { isBrandLogoUrl } from '../../utils/brandLogoUrl';

export const BRAND_KINDS = ['taskforge', 'personal'] as const;
export type BrandKind = (typeof BRAND_KINDS)[number];
export const BRAND_FONT_ROLES = ['heading', 'body', 'mono', 'accent'] as const;
export type BrandFontRole = (typeof BRAND_FONT_ROLES)[number];

export const BRAND_NAME_MAX = 80;
export const BRAND_TAGLINE_MAX = 160;
export const BRAND_COLORS_MAX = 12;
export const BRAND_COLOR_NAME_MAX = 40;
export const BRAND_FONTS_MAX = 6;
export const BRAND_FONT_FAMILY_MAX = 80;
export const BRAND_LOGOS_MAX = 8;
export const BRAND_LOGO_LABEL_MAX = 60;
export const BRAND_LOGO_URL_MAX = 2000;
export const BRAND_TEXT_MAX = 2000;
export const BRAND_PROMPTS_MAX = 10;
export const BRAND_PROMPT_MAX = 500;
export const BRAND_HEX = /^#[0-9A-F]{6}$/;

const maxItems = (max: number) => ({
  validator: (items: unknown[]) => items.length <= max,
  message: 'Too many items',
});

// A brand profile, text only: TaskForge stores links and words, never files, and never fetches
// a logo link. One per owner and kind; the unique index is created lazily by the brand service.
const brandSchema = new Schema(
  {
    owner: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    kind: { type: String, enum: BRAND_KINDS, required: true },
    name: { type: String, required: true, trim: true, maxlength: BRAND_NAME_MAX },
    tagline: { type: String, default: '', trim: true, maxlength: BRAND_TAGLINE_MAX },
    colors: {
      type: [
        {
          _id: false,
          name: { type: String, required: true, trim: true, maxlength: BRAND_COLOR_NAME_MAX },
          hex: { type: String, required: true, match: BRAND_HEX },
        },
      ],
      default: [],
      validate: maxItems(BRAND_COLORS_MAX),
    },
    fonts: {
      type: [
        {
          _id: false,
          role: { type: String, enum: BRAND_FONT_ROLES, required: true },
          family: { type: String, required: true, trim: true, maxlength: BRAND_FONT_FAMILY_MAX },
        },
      ],
      default: [],
      validate: maxItems(BRAND_FONTS_MAX),
    },
    logos: {
      type: [
        {
          _id: false,
          label: { type: String, required: true, trim: true, maxlength: BRAND_LOGO_LABEL_MAX },
          url: {
            type: String,
            required: true,
            maxlength: BRAND_LOGO_URL_MAX,
            validate: { validator: isBrandLogoUrl, message: 'Invalid logo link' },
          },
        },
      ],
      default: [],
      validate: maxItems(BRAND_LOGOS_MAX),
    },
    voice: { type: String, default: '', trim: true, maxlength: BRAND_TEXT_MAX },
    writingStyle: { type: String, default: '', trim: true, maxlength: BRAND_TEXT_MAX },
    imagePrompts: {
      type: [{ type: String, trim: true, maxlength: BRAND_PROMPT_MAX }],
      default: [],
      validate: maxItems(BRAND_PROMPTS_MAX),
    },
  },
  { timestamps: true },
);

export const Brand = model('Brand', brandSchema);
