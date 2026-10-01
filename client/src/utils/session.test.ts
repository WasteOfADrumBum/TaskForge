import { describe, expect, it } from 'vitest';
import { isTokenExpired } from './session';

const base64Url = (value: string) =>
  btoa(value).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const tokenWith = (payload: unknown) =>
  'header.' + base64Url(JSON.stringify(payload)) + '.signature';
const nowSeconds = () => Math.floor(Date.now() / 1000);

describe('isTokenExpired', () => {
  it('accepts a token that expires in the future', () => {
    expect(isTokenExpired(tokenWith({ exp: nowSeconds() + 3600 }))).toBe(false);
  });

  it('decodes base64url payloads', () => {
    // These characters produce '+' and '/' in base64, which base64url turns into '-' and '_'.
    const payload = { exp: nowSeconds() + 3600, note: '~~~???>>>' };
    const token = tokenWith(payload);
    expect(token).toMatch(/[-_]/);
    expect(isTokenExpired(token)).toBe(false);
  });

  it.each([
    ['an expired exp', tokenWith({ exp: nowSeconds() - 1 })],
    ['a missing exp', tokenWith({ id: 'user-id' })],
    ['a string exp', tokenWith({ exp: String(nowSeconds() + 3600) })],
    ['a non-JSON payload', 'header.' + base64Url('not-json') + '.signature'],
    ['too few parts', 'header.payload'],
    ['too many parts', 'a.b.c.d'],
    ['an empty string', ''],
  ])('treats %s as expired', (_label, token) => {
    expect(isTokenExpired(token)).toBe(true);
  });
});
