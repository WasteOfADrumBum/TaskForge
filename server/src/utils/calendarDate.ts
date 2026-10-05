// Due dates represent calendar days, never local times or arbitrary timestamps.
export const normalizeCalendarDate = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:T00:00:00\.000Z)?$/.exec(value);
  if (!match || match[0] !== value) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year < 1 || month < 1 || month > 12 || day < 1 || day > 31) return null;

  // Date.UTC maps years 0-99 into 1900-1999; setting the full year avoids that special case.
  const date = new Date(0);
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCFullYear(year, month - 1, day);
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return date.toISOString();
};

export const isCalendarDate = (value: unknown): value is Date =>
  value instanceof Date &&
  Number.isFinite(value.getTime()) &&
  value.getUTCFullYear() >= 1 &&
  value.getUTCFullYear() <= 9999 &&
  value.getUTCHours() === 0 &&
  value.getUTCMinutes() === 0 &&
  value.getUTCSeconds() === 0 &&
  value.getUTCMilliseconds() === 0;
