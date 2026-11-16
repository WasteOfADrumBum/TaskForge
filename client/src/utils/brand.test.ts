import { describe, expect, it } from 'vitest';
import type { BrandProfile } from '../types/brand';
import {
  brandGuideFileName,
  brandGuideMarkdown,
  contrastCheck,
  contrastRatio,
  contrastText,
  isSitePath,
  normalizeBrandInput,
  normalizeHex,
  safeLogoHref,
} from './brand';

describe('brand helpers', () => {
  it('normalizes six-digit hex colors only', () => {
    expect(normalizeHex(' 0f766e ')).toBe('#0F766E');
    expect(normalizeHex('#ABCDEF')).toBe('#ABCDEF');
    expect(normalizeHex('#FFF')).toBeNull();
    expect(normalizeHex('teal')).toBeNull();
  });

  it('computes WCAG contrast ratios', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 5);
    expect(contrastRatio('#FFFFFF', '#FFFFFF')).toBeCloseTo(1, 5);
    // #767676 is the classic lightest gray that passes AA on white.
    expect(contrastRatio('#767676', '#FFFFFF')).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio('#777777', '#FFFFFF')).toBeLessThan(4.5);
  });

  it('describes the check in words and recommends the better text color', () => {
    expect(contrastText(contrastCheck('#0F766E'))).toBe(
      'White text 5.4:1 (passes AA), black text 3.8:1 (fails AA). Use white text.',
    );
    expect(contrastText(contrastCheck('#FDE68A'))).toMatch(
      /^White text 1\.\d:1 \(fails AA\).*Use black text\.$/,
    );
    // Even a mid gray passes against one of the two.
    expect(contrastText(contrastCheck('#808080'))).toMatch(
      /black text 5\.3:1 \(passes AA\)\. Use black text\.$/,
    );
  });

  it('never shows a failing ratio as passing', () => {
    // #777777 on white is 4.47:1; rounding up would read 4.5:1.
    expect(contrastText(contrastCheck('#777777'))).toMatch(/^White text 4\.4:1 \(fails AA\)/);
  });

  it('treats only safe paths on this site and https links as logo links', () => {
    expect(isSitePath('/taskforge-logo.svg')).toBe(true);
    for (const value of ['//evil.example', '/a/../b', '/a%2Fb', '/a b', 'logo.svg']) {
      expect(isSitePath(value)).toBe(false);
    }
    expect(safeLogoHref('/logo.svg')).toBe('/logo.svg');
    expect(safeLogoHref('https://example.com/logo.png')).toBe('https://example.com/logo.png');
    expect(safeLogoHref('javascript:alert(1)')).toBeNull();
    expect(safeLogoHref('http://example.com/logo.png')).toBeNull();
  });

  it('builds a Markdown guide and a file name from a saved profile', () => {
    const profile: BrandProfile = {
      kind: 'taskforge',
      name: 'TaskForge',
      tagline: 'Forge your work',
      colors: [{ name: 'Teal', hex: '#0F766E' }],
      fonts: [{ role: 'heading', family: 'Inter' }],
      logos: [{ label: 'Mark', url: '/taskforge-logo.svg' }],
      voice: 'Plain.\n\nWarm.',
      writingStyle: '',
      imagePrompts: ['Anvil, flat icon'],
    };
    expect(brandGuideMarkdown(profile)).toBe(
      [
        '# TaskForge brand guide',
        '',
        'TaskForge brand: Forge your work',
        '',
        '## Colors',
        '',
        '- **Teal** `#0F766E`: White text 5.4:1 (passes AA), black text 3.8:1 (fails AA). Use white text.',
        '',
        '## Fonts',
        '',
        '- **Heading:** Inter',
        '',
        '## Logos',
        '',
        '- **Mark:** /taskforge-logo.svg',
        '',
        '## Brand voice',
        '',
        '> Plain.',
        '>',
        '> Warm.',
        '',
        '## Image prompts',
        '',
        '1. Anvil, flat icon',
        '',
      ].join('\n'),
    );
    expect(brandGuideFileName(profile)).toBe('taskforge-brand-guide.md');
    expect(brandGuideFileName({ ...profile, name: '!!!', kind: 'personal' })).toBe(
      'personal-brand-guide.md',
    );
  });

  it('normalizes input like the server for unsaved-change checks', () => {
    expect(
      normalizeBrandInput({
        name: ' TF ',
        tagline: '',
        colors: [{ name: ' Teal ', hex: '0f766e' }],
        fonts: [{ role: 'body', family: ' Inter ' }],
        logos: [{ label: ' Mark ', url: ' /l.svg ' }],
        voice: ' v ',
        writingStyle: '',
        imagePrompts: [' p '],
      }),
    ).toEqual({
      name: 'TF',
      tagline: '',
      colors: [{ name: 'Teal', hex: '#0F766E' }],
      fonts: [{ role: 'body', family: 'Inter' }],
      logos: [{ label: 'Mark', url: '/l.svg' }],
      voice: 'v',
      writingStyle: '',
      imagePrompts: ['p'],
    });
  });
});
