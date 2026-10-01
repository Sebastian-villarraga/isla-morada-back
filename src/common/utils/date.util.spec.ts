import { bogotaToday, localDateToUtcDate, scheduledTimeAsUtc } from './date.util';

describe('date utilities', () => {
  it('stores a local calendar date without shifting its day', () => {
    expect(localDateToUtcDate('2026-10-03').toISOString()).toBe('2026-10-03T00:00:00.000Z');
  });

  it('converts a Bogota schedule time to its UTC instant', () => {
    expect(scheduledTimeAsUtc('2026-10-03', '12:30').toISOString()).toBe('2026-10-03T17:30:00.000Z');
  });

  it('returns the current business date in Bogota', () => {
    expect(bogotaToday(new Date('2026-10-03T03:00:00.000Z'))).toBe('2026-10-02');
  });
});