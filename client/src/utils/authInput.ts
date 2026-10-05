export const REGISTRATION_PASSWORD_HELP =
  'Use 15–72 characters. Emoji and accented letters may reach the limit sooner.';

export const getRegistrationPasswordError = (password: string): string | null => {
  if (Array.from(password).length < 15) return 'Use at least 15 characters for your password.';
  if (new TextEncoder().encode(password).length > 72) {
    return 'Password is too long. Use fewer characters, especially emoji or accented letters.';
  }
  return null;
};
