import { isBrandLogoUrl, isSitePath } from './brandLogoUrl';

describe('brand logo links', () => {
  it.each(['/taskforge-logo.svg', '/brand/logo-2.png?v=1', 'https://example.com/logo.png'])(
    'accepts %s',
    (value) => {
      expect(isBrandLogoUrl(value)).toBe(true);
    },
  );

  it.each([
    '//evil.example/logo.png',
    '/\\evil.example',
    '/a/../b',
    '/a/%2e%2e/b',
    '/a/.%2E/b',
    '/a/%2e./b',
    '/a/%2F/b',
    '/caf\u00e9.svg',
    '/a b',
    'http://example.com/logo.png',
    'https://u:p@example.com/logo.png',
    'javascript:alert(1)',
    'logo.png',
    '',
    5,
  ])('refuses %j', (value) => {
    expect(isBrandLogoUrl(value)).toBe(false);
  });

  it('treats only site paths as paths', () => {
    expect(isSitePath('https://example.com/logo.png')).toBe(false);
    expect(isSitePath('/logo.svg')).toBe(true);
  });
});
