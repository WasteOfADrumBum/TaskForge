// A brand logo link: https without credentials, or a path on this site such as /logo.svg.
// Paths are printable ASCII only, never //host, and never hide a slash, backslash or parent
// segment, so a later href or src can only point at this site. TaskForge never fetches either.
const SITE_PATH = /^\/(?!\/)[\x21-\x7e]*$/;
const HIDDEN = /(^|\/)(\.|%2e){2}(\/|$)|\\|%2f|%5c/i;

export const isSitePath = (value: string) => SITE_PATH.test(value) && !HIDDEN.test(value);

export const isBrandLogoUrl = (value: unknown): boolean => {
  if (typeof value !== 'string') return false;
  if (isSitePath(value)) return true;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password;
  } catch {
    return false;
  }
};
