import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// Guards the TaskForge palette for OneSmallUI: the same pairs OneSmallUI checks for its own themes
// (scripts/check-contrast.mjs), held to AAA text (7:1) and 3:1 boundaries.
// Vitest runs from the client workspace; the second path covers a run from the repo root.
const cssPath = ['src', 'client/src']
  .map((dir) => resolve(process.cwd(), dir, 'assets/theme/onesmall-theme.css'))
  .find((path) => existsSync(path));
const css = readFileSync(cssPath ?? '', 'utf8');

const block = (selector: string) => {
  const start = css.indexOf(selector);
  const body = css.slice(css.indexOf('{', start) + 1, css.indexOf('}', start));
  return Object.fromEntries(
    [...body.matchAll(/--os-([a-z0-9-]+):\s*(#[0-9a-f]{6});/gi)].map((m) => [m[1], m[2]]),
  );
};

const luminance = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
};
const ratio = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

const surfaces = ['bg', 'surface', 'surface-2', 'surface-3'];
const brand = ['primary', 'secondary', 'accent'];
const pairs: [string, string, number][] = [];
for (const s of surfaces) {
  pairs.push(['text', s, 7], ['text-muted', s, 7], ['border-strong', s, 3], ['focus', s, 3]);
  for (const b of brand) pairs.push([`${b}-text`, s, 7]);
}
for (const b of brand) {
  pairs.push(
    [`on-${b}`, b, 7],
    [`on-${b}`, `${b}-hover`, 7],
    [`${b}-text`, `${b}-soft`, 7],
    ['text', `${b}-soft`, 7],
  );
}

describe.each([
  ['light', "[data-os-theme='light']"],
  ['dark', "[data-os-theme='dark']"],
])('OneSmallUI %s palette', (_name, selector) => {
  const tokens = block(selector);

  it('defines every token the contrast pairs use', () => {
    const missing = [...new Set(pairs.flatMap(([fg, bg]) => [fg, bg]))].filter((t) => !tokens[t]);
    expect(missing).toEqual([]);
  });

  it('meets AAA text contrast and 3:1 boundaries', () => {
    const failing = pairs
      .map(([fg, bg, min]) => ({
        pair: `${fg} on ${bg}`,
        ratio: ratio(tokens[fg], tokens[bg]),
        min,
      }))
      .filter((p) => p.ratio < p.min)
      .map((p) => `${p.pair} = ${p.ratio.toFixed(2)} < ${p.min}`);
    expect(failing).toEqual([]);
  });
});
