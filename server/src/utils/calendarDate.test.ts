import { isCalendarDate, normalizeCalendarDate } from './calendarDate';

describe('calendar date parsing', () => {
  it.each(['0001-01-01', '0099-12-31', '2000-02-29', '2024-02-29', '9999-12-31'])(
    'keeps valid calendar %s at UTC midnight',
    (input) => {
      expect(normalizeCalendarDate(input)).toBe(input + 'T00:00:00.000Z');
      expect(normalizeCalendarDate(input + 'T00:00:00.000Z')).toBe(input + 'T00:00:00.000Z');
    },
  );
  it.each([
    '1900-02-29',
    '2025-02-29',
    '2024-02-30',
    '2026-04-31',
    '2026-10-05\n',
    '2026-10-05T00:00:00.000Z\n',
    '2026-10-05T00:00:00.001Z',
    '2026-10-05T00:00:00.000-05:00',
    '0000-01-01',
    '10000-01-01',
    null,
    undefined,
    {},
    0,
    new Date('2026-10-05T00:00:00.000Z'),
  ])('rejects noncanonical or impossible date %j', (input) => {
    expect(normalizeCalendarDate(input)).toBeNull();
  });
  it('recognizes only finite midnight Date instances within the supported year range', () => {
    expect(isCalendarDate(new Date('0001-01-01T00:00:00.000Z'))).toBe(true);
    expect(isCalendarDate(new Date('2026-10-05T00:00:00.000Z'))).toBe(true);
    expect(isCalendarDate(new Date('2026-10-05T00:00:00.001Z'))).toBe(false);
    expect(isCalendarDate(new Date('2026-10-05T12:00:00.000Z'))).toBe(false);
    expect(isCalendarDate(new Date('0000-01-01T00:00:00.000Z'))).toBe(false);
    expect(isCalendarDate(new Date(NaN))).toBe(false);
    expect(isCalendarDate('2026-10-05')).toBe(false);
  });
});
