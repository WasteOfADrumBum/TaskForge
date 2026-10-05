import { describe, expect, it } from 'vitest';
import { daysUntilDueDate, formatCalendarDate, localCalendarDate, toCalendarDate } from './dates';

// Due dates use the shape the API returns for a date-only value: UTC midnight. `now` values are
// built with the local Date constructor, so these tests hold in every time zone. The early and
// late hours are where the old local-time parsing went wrong.
const due = (calendarDate: string) => calendarDate + 'T00:00:00.000Z';
const at = (day: number, hour: number, minute = 0) => new Date(2026, 9, day, hour, minute);

describe('toCalendarDate', () => {
  it('reads the calendar date from API timestamps and date-only strings', () => {
    expect(toCalendarDate('2026-10-15T00:00:00.000Z')).toBe('2026-10-15');
    expect(toCalendarDate('2026-10-15')).toBe('2026-10-15');
    expect(toCalendarDate(null)).toBeNull();
    expect(toCalendarDate(undefined)).toBeNull();
    expect(toCalendarDate('')).toBeNull();
    expect(toCalendarDate('not a date')).toBeNull();
  });
});

describe('localCalendarDate', () => {
  it('uses the local calendar day, including just after midnight and just before', () => {
    expect(localCalendarDate(at(15, 0, 5))).toBe('2026-10-15');
    expect(localCalendarDate(at(15, 23, 55))).toBe('2026-10-15');
    expect(localCalendarDate(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
});

describe('daysUntilDueDate', () => {
  it.each([
    ['just after midnight', at(15, 0, 5)],
    ['midday', at(15, 12)],
    ['late evening', at(15, 23, 55)],
  ])('classifies today, yesterday, and tomorrow correctly at %s', (_label, now) => {
    expect(daysUntilDueDate(due('2026-10-15'), now)).toBe(0);
    expect(daysUntilDueDate(due('2026-10-14'), now)).toBe(-1);
    expect(daysUntilDueDate(due('2026-10-16'), now)).toBe(1);
  });

  it('counts whole days across month and year boundaries and daylight-saving changes', () => {
    expect(daysUntilDueDate(due('2026-11-01'), at(31, 22))).toBe(1);
    expect(daysUntilDueDate(due('2027-01-01'), new Date(2026, 11, 31, 23))).toBe(1);
    // US DST starts Mar 8 and EU DST starts Mar 29, 2026.
    expect(daysUntilDueDate(due('2026-03-10'), new Date(2026, 2, 7, 12))).toBe(3);
    expect(daysUntilDueDate(due('2026-04-01'), new Date(2026, 2, 27, 12))).toBe(5);
  });

  it('returns null when there is no due date', () => {
    expect(daysUntilDueDate(null, at(15, 12))).toBeNull();
  });
});

describe('formatCalendarDate', () => {
  it('shows the stored calendar day, not the day before', () => {
    // A local Date on Oct 15 formats as Oct 15 in any zone, so it is the expected output.
    expect(formatCalendarDate(due('2026-10-15'))).toBe(new Date(2026, 9, 15).toLocaleDateString());
    expect(formatCalendarDate('2026-10-15')).toBe(new Date(2026, 9, 15).toLocaleDateString());
  });
});

it('keeps years below 100 in the correct century for arithmetic and display', () => {
  const now = new Date(2000, 0, 1, 12);
  now.setFullYear(100);
  expect(daysUntilDueDate(due('0099-12-31'), now)).toBe(-1);
  expect(daysUntilDueDate(due('0100-01-02'), now)).toBe(1);
  const ancientDate = new Date('0099-12-31T00:00:00.000Z');
  const expected = ancientDate.toLocaleDateString(undefined, { timeZone: 'UTC' });
  expect(formatCalendarDate(due('0099-12-31'))).toBe(expected);
  expect(formatCalendarDate(due('0099-12-31'))).not.toBe(formatCalendarDate(due('1999-12-31')));
});
