import type { Request, Response } from 'express';
import {
  BRAND_COLOR_NAME_MAX,
  BRAND_COLORS_MAX,
  BRAND_FONT_FAMILY_MAX,
  BRAND_FONT_ROLES,
  BRAND_FONTS_MAX,
  BRAND_KINDS,
  BRAND_LOGO_LABEL_MAX,
  BRAND_LOGO_URL_MAX,
  BRAND_LOGOS_MAX,
  BRAND_NAME_MAX,
  BRAND_PROMPT_MAX,
  BRAND_PROMPTS_MAX,
  BRAND_TAGLINE_MAX,
  BRAND_TEXT_MAX,
  type BrandFontRole,
  type BrandKind,
} from '../../models/brandModel';
import {
  BrandUnavailableError,
  findBrandsByOwner,
  saveBrand,
  type BrandInput,
} from '../../services/brandService';
import { readHttpsLink } from '../../utils/httpsLink';

const getUserId = (req: Request) => req.userId as string;
type Result<T> = { value: T } | { error: string };
const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

// A trimmed string up to max; missing or null is ''. required refuses an empty result.
const readText = (raw: unknown, max: number, label: string, required = false): Result<string> => {
  if (raw === undefined || raw === null) {
    return required ? { error: label + ' is required' } : { value: '' };
  }
  if (typeof raw !== 'string') return { error: 'Invalid ' + label.toLowerCase() };
  const value = raw.trim();
  if (required && !value) return { error: label + ' is required' };
  if (value.length > max) return { error: label + ' is too long' };
  return { value };
};

// A list of at most max entries, each read by readItem; missing or null is [].
const readList = <T>(
  raw: unknown,
  max: number,
  label: string,
  readItem: (item: unknown) => Result<T>,
): Result<T[]> => {
  if (raw === undefined || raw === null) return { value: [] };
  if (!Array.isArray(raw)) return { error: 'Invalid ' + label.toLowerCase() };
  if (raw.length > max) return { error: 'Too many ' + label.toLowerCase() };
  const value: T[] = [];
  for (const item of raw) {
    const read = readItem(item);
    if ('error' in read) return read;
    value.push(read.value);
  }
  return { value };
};

const HEX = /^#?([0-9a-f]{6})$/i;
const readColor = (item: unknown): Result<{ name: string; hex: string }> => {
  if (!isObject(item)) return { error: 'Invalid colors' };
  const name = readText(item.name, BRAND_COLOR_NAME_MAX, 'Color name', true);
  if ('error' in name) return name;
  const match = typeof item.hex === 'string' ? item.hex.trim().match(HEX) : null;
  if (!match) return { error: 'Use a six-digit hex color, for example #0F766E' };
  return { value: { name: name.value, hex: '#' + match[1].toUpperCase() } };
};

const readFont = (item: unknown): Result<{ role: BrandFontRole; family: string }> => {
  if (!isObject(item) || !BRAND_FONT_ROLES.includes(item.role as never)) {
    return { error: 'Invalid fonts' };
  }
  const family = readText(item.family, BRAND_FONT_FAMILY_MAX, 'Font family', true);
  if ('error' in family) return family;
  return { value: { role: item.role as BrandFontRole, family: family.value } };
};

// https without credentials, or a path on this site such as /logo.svg (never //host).
const SITE_PATH = /^\/(?!\/)[^\s\\]*$/;
const readLogo = (item: unknown): Result<{ label: string; url: string }> => {
  if (!isObject(item)) return { error: 'Invalid logos' };
  const label = readText(item.label, BRAND_LOGO_LABEL_MAX, 'Logo label', true);
  if ('error' in label) return label;
  const raw = typeof item.url === 'string' ? item.url.trim() : item.url;
  if (typeof raw === 'string' && raw.length <= BRAND_LOGO_URL_MAX && SITE_PATH.test(raw)) {
    return { value: { label: label.value, url: raw } };
  }
  const link = readHttpsLink(raw, BRAND_LOGO_URL_MAX);
  if ('error' in link || !link.value) {
    return { error: 'Logo link must be an https address or a path such as /logo.svg' };
  }
  return { value: { label: label.value, url: link.value } };
};

const readPrompt = (item: unknown) => readText(item, BRAND_PROMPT_MAX, 'Image prompt', true);

// Every field of a profile, or the first error. owner, kind, _id and timestamps are never read
// from the body.
const readBrand = (body: Record<string, unknown>): Result<BrandInput> => {
  const name = readText(body.name, BRAND_NAME_MAX, 'Brand name', true);
  if ('error' in name) return name;
  const tagline = readText(body.tagline, BRAND_TAGLINE_MAX, 'Tagline');
  if ('error' in tagline) return tagline;
  const colors = readList(body.colors, BRAND_COLORS_MAX, 'Colors', readColor);
  if ('error' in colors) return colors;
  const fonts = readList(body.fonts, BRAND_FONTS_MAX, 'Fonts', readFont);
  if ('error' in fonts) return fonts;
  const logos = readList(body.logos, BRAND_LOGOS_MAX, 'Logos', readLogo);
  if ('error' in logos) return logos;
  const voice = readText(body.voice, BRAND_TEXT_MAX, 'Brand voice');
  if ('error' in voice) return voice;
  const writingStyle = readText(body.writingStyle, BRAND_TEXT_MAX, 'Writing style');
  if ('error' in writingStyle) return writingStyle;
  const imagePrompts = readList(body.imagePrompts, BRAND_PROMPTS_MAX, 'Image prompts', readPrompt);
  if ('error' in imagePrompts) return imagePrompts;
  return {
    value: {
      name: name.value,
      tagline: tagline.value,
      colors: colors.value,
      fonts: fonts.value,
      logos: logos.value,
      voice: voice.value,
      writingStyle: writingStyle.value,
      imagePrompts: imagePrompts.value,
    },
  };
};

export const listBrands = async (req: Request, res: Response) => {
  try {
    return res.json({ brands: await findBrandsByOwner(getUserId(req)) });
  } catch {
    return res.status(500).json({ message: 'Server error' });
  }
};

export const putBrand = async (req: Request<{ kind: string }>, res: Response) => {
  if (!BRAND_KINDS.includes(req.params.kind as never)) {
    return res.status(404).json({ message: 'Brand not found' });
  }
  // A missing or non-object body (no JSON content type, an array) must not wipe the profile.
  if (!isObject(req.body)) return res.status(400).json({ message: 'Invalid brand' });
  const fields = readBrand(req.body);
  if ('error' in fields) return res.status(400).json({ message: fields.error });
  try {
    const brand = await saveBrand(getUserId(req), req.params.kind as BrandKind, fields.value);
    return res.json({ brand });
  } catch (error) {
    if (error instanceof BrandUnavailableError) {
      return res.status(503).json({ message: 'Brand profiles are temporarily unavailable' });
    }
    return res.status(500).json({ message: 'Server error' });
  }
};
