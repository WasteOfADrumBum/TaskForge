// Task due dates are calendar dates, not moments in time.
//
// The task form sends "YYYY-MM-DD". MongoDB stores that as UTC midnight, and the API returns
// it as "YYYY-MM-DDT00:00:00.000Z". Passing that string to `new Date()` and reading it in local
// time shifts it to the previous evening west of UTC, so "due today" looked overdue in the US.
// Always compare and display due dates through these helpers instead.

const DAY_MS = 24 * 60 * 60 * 1000;
const CALENDAR_DATE = /^(\d{4})-(\d{2})-(\d{2})/;

/** The "YYYY-MM-DD" calendar date of a stored due date, or null if there is none. */
export const toCalendarDate = (value: string | null | undefined): string | null => {
  const match = value?.match(CALENDAR_DATE);
  return match ? match[1] + '-' + match[2] + '-' + match[3] : null;
};

/** The user's local calendar date, for example "today", as "YYYY-MM-DD". */
export const localCalendarDate = (date: Date = new Date()): string =>
  [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');

// Whole-day arithmetic in UTC, so neither the time zone nor daylight saving can skew it.
const calendarDayNumber = (calendarDate: string) => {
  const [year, month, day] = calendarDate.split('-').map(Number);
  const date = new Date(0);
  date.setUTCHours(0, 0, 0, 0);
  // Date.UTC maps years 0–99 into 1900–1999; preserve the calendar year.
  date.setUTCFullYear(year, month - 1, day);
  return date.getTime() / DAY_MS;
};

/** Days from the local calendar date of `now` until the due date: 0 = today, -1 = yesterday. */
export const daysUntilDueDate = (
  dueDate: string | null | undefined,
  now: Date = new Date(),
): number | null => {
  const due = toCalendarDate(dueDate);
  if (!due) return null;
  return calendarDayNumber(due) - calendarDayNumber(localCalendarDate(now));
};

/** A due date formatted for display in the user's locale, without shifting the day. */
export const formatCalendarDate = (dueDate: string): string => {
  const calendarDate = toCalendarDate(dueDate);
  if (!calendarDate) return '';
  return new Date(calendarDayNumber(calendarDate) * DAY_MS).toLocaleDateString(undefined, {
    timeZone: 'UTC',
  });
};
