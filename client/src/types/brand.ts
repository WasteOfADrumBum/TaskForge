// Keep in sync with server/src/models/brandModel.
export type BrandKind = 'taskforge' | 'personal';
export const BRAND_KINDS: BrandKind[] = ['taskforge', 'personal'];
export const brandKindLabel: Record<BrandKind, string> = {
  taskforge: 'TaskForge',
  personal: 'Personal',
};

export type BrandFontRole = 'heading' | 'body' | 'mono' | 'accent';
export const BRAND_FONT_ROLES: BrandFontRole[] = ['heading', 'body', 'mono', 'accent'];
export const brandFontRoleLabel: Record<BrandFontRole, string> = {
  heading: 'Heading',
  body: 'Body',
  mono: 'Monospace',
  accent: 'Accent',
};

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

export interface BrandColor {
  name: string;
  hex: string;
}
export interface BrandFont {
  role: BrandFontRole;
  family: string;
}
export interface BrandLogo {
  label: string;
  url: string;
}

export interface BrandInput {
  name: string;
  tagline: string;
  colors: BrandColor[];
  fonts: BrandFont[];
  logos: BrandLogo[];
  voice: string;
  writingStyle: string;
  imagePrompts: string[];
}

export interface BrandProfile extends BrandInput {
  _id?: string;
  kind: BrandKind;
  createdAt?: string;
  updatedAt?: string;
}
