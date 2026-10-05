import { describe, expect, it } from 'vitest';
import { getRegistrationPasswordError } from './authInput';

describe('registration password validation', () => {
  it.each([
    'a'.repeat(15),
    'a'.repeat(72),
    '\u{1f600}'.repeat(15),
    '\u{1f600}'.repeat(18),
    '\u00e9'.repeat(36),
    ' '.repeat(15),
  ])('accepts the Unicode and UTF8 boundaries', (password) => {
    expect(getRegistrationPasswordError(password)).toBeNull();
  });
  it.each(['', 'a'.repeat(14), '\u{1f600}'.repeat(8)])(
    'counts codepoints rather than UTF16 units for the minimum',
    (password) => {
      expect(getRegistrationPasswordError(password)).toBe(
        'Use at least 15 characters for your password.',
      );
    },
  );
  it.each(['a'.repeat(73), '\u{1f600}'.repeat(19), '\u00e9'.repeat(37)])(
    'counts UTF8 bytes for the maximum',
    (password) => {
      expect(getRegistrationPasswordError(password)).toBe(
        'Password is too long. Use fewer characters, especially emoji or accented letters.',
      );
    },
  );
});
