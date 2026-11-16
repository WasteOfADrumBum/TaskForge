import {
  brandFontRoleLabel,
  brandKindLabel,
  type BrandInput,
  type BrandProfile,
} from '../types/brand';

// Rule-based brand helpers. Nothing here is AI-generated.

const HEX = /^#?([0-9a-f]{6})$/i;

// "#0F766E" for a six-digit hex color with or without "#", or null.
export const normalizeHex = (value: string): string | null => {
  const match = value.trim().match(HEX);
  return match ? '#' + match[1].toUpperCase() : null;
};

// WCAG 2.x relative luminance of a "#RRGGBB" color.
const luminance = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((start) => {
    const channel = parseInt(hex.slice(start, start + 2), 16) / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

export const contrastRatio = (hexA: string, hexB: string) => {
  const [light, dark] = [luminance(hexA), luminance(hexB)].sort((a, b) => b - a);
  return (light + 0.05) / (dark + 0.05);
};

// AA for normal-size text.
export const AA_NORMAL = 4.5;

export interface ContrastCheck {
  white: number;
  black: number;
  better: 'white' | 'black';
}

export const contrastCheck = (hex: string): ContrastCheck => {
  const white = contrastRatio(hex, '#FFFFFF');
  const black = contrastRatio(hex, '#000000');
  return { white, black, better: white >= black ? 'white' : 'black' };
};

// Rounded down, so a ratio is never shown as passing when it does not.
const ratioText = (ratio: number) => (Math.floor(ratio * 10) / 10).toFixed(1) + ':1';
const verdict = (ratio: number) => (ratio >= AA_NORMAL ? 'passes AA' : 'fails AA');

// The check in words, for example "White text 5.4:1 (passes AA), black text 3.8:1 (fails AA).
// Use white text." Every color reaches at least 4.58:1 against white or black, so the better
// of the two always passes AA for normal text.
export const contrastText = (check: ContrastCheck) =>
  'White text ' +
  ratioText(check.white) +
  ' (' +
  verdict(check.white) +
  '), black text ' +
  ratioText(check.black) +
  ' (' +
  verdict(check.black) +
  '). Use ' +
  check.better +
  ' text.';

// Mirrors the server's site-path rule, so only a path on this site is ever previewed as an image.
const SITE_PATH = /^\/(?!\/)[\x21-\x7e]*$/;
const HIDDEN = /(^|\/)(\.|%2e){2}(\/|$)|\\|%2f|%5c/i;
export const isSitePath = (value: string) => SITE_PATH.test(value) && !HIDDEN.test(value);

export const safeLogoHref = (value: string): string | null => {
  if (isSitePath(value)) return value;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password ? url.toString() : null;
  } catch {
    return null;
  }
};

// Escapes Markdown in text the user typed, so a name or prompt can't add headings or links.
export const escapeMarkdown = (text: string) => text.replace(/[\\`*_[\]<>#|]/g, '\\$&');

const section = (title: string, lines: string[]) =>
  lines.length ? ['## ' + title, '', ...lines, ''] : [];

// A Markdown brand guide from a saved profile, built in the browser.
export const brandGuideMarkdown = (profile: BrandProfile) => {
  const quoted = (text: string) =>
    text.split('\n').map((line) => (line ? '> ' + escapeMarkdown(line) : '>'));
  return [
    '# ' + escapeMarkdown(profile.name) + ' brand guide',
    '',
    brandKindLabel[profile.kind] +
      ' brand' +
      (profile.tagline ? ': ' + escapeMarkdown(profile.tagline) : '.'),
    '',
    ...section(
      'Colors',
      profile.colors.map((color) => {
        const check = contrastCheck(color.hex);
        return (
          '- **' + escapeMarkdown(color.name) + '** `' + color.hex + '`: ' + contrastText(check)
        );
      }),
    ),
    ...section(
      'Fonts',
      profile.fonts.map(
        (font) => '- **' + brandFontRoleLabel[font.role] + ':** ' + escapeMarkdown(font.family),
      ),
    ),
    ...section(
      'Logos',
      profile.logos.map((logo) => '- **' + escapeMarkdown(logo.label) + ':** <' + logo.url + '>'),
    ),
    ...section('Brand voice', profile.voice ? quoted(profile.voice) : []),
    ...section('Writing style', profile.writingStyle ? quoted(profile.writingStyle) : []),
    ...section(
      'Image prompts',
      profile.imagePrompts.map((prompt, index) => index + 1 + '. ' + escapeMarkdown(prompt)),
    ),
  ]
    .join('\n')
    .trimEnd()
    .concat('\n');
};

export const brandGuideFileName = (profile: BrandProfile) =>
  (profile.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || profile.kind) + '-brand-guide.md';

// How the server stores a logo link: a site path as typed, an https link in URL form (so
// "https://example.com" becomes "https://example.com/").
const normalizeLogoUrl = (value: string) => {
  const trimmed = value.trim();
  if (isSitePath(trimmed)) return trimmed;
  try {
    return new URL(trimmed).toString();
  } catch {
    return trimmed;
  }
};

// The values a save would send, trimmed and normalized like the server, so unsaved-change
// checks compare like with like.
export const normalizeBrandInput = (input: BrandInput): BrandInput => ({
  name: input.name.trim(),
  tagline: input.tagline.trim(),
  colors: input.colors.map((color) => ({
    name: color.name.trim(),
    hex: normalizeHex(color.hex) ?? color.hex.trim(),
  })),
  fonts: input.fonts.map((font) => ({ role: font.role, family: font.family.trim() })),
  logos: input.logos.map((logo) => ({ label: logo.label.trim(), url: normalizeLogoUrl(logo.url) })),
  voice: input.voice.trim(),
  writingStyle: input.writingStyle.trim(),
  imagePrompts: input.imagePrompts.map((prompt) => prompt.trim()),
});

export const emptyBrandInput = (): BrandInput => ({
  name: '',
  tagline: '',
  colors: [],
  fonts: [],
  logos: [],
  voice: '',
  writingStyle: '',
  imagePrompts: [],
});

export const brandInputOf = (profile: BrandProfile | undefined): BrandInput =>
  profile
    ? {
        name: profile.name,
        tagline: profile.tagline,
        colors: profile.colors.map(({ name, hex }) => ({ name, hex })),
        fonts: profile.fonts.map(({ role, family }) => ({ role, family })),
        logos: profile.logos.map(({ label, url }) => ({ label, url })),
        voice: profile.voice,
        writingStyle: profile.writingStyle,
        imagePrompts: [...profile.imagePrompts],
      }
    : emptyBrandInput();
