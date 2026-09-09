import { describe, expect, it } from 'vitest';
import { isUtcDay, utcCalendarDay } from '@/lib/utc-day';

describe('utcCalendarDay', () => {
  it('returns YYYY-MM-DD for a fixed instant', () => {
    expect(utcCalendarDay(new Date('2026-09-09T15:30:00.000Z'))).toBe('2026-09-09');
  });
});

describe('isUtcDay', () => {
  it('accepts a real calendar day', () => {
    expect(isUtcDay('2026-08-24')).toBe(true);
  });

  it('rejects impossible and malformed days', () => {
    expect(isUtcDay('2026-02-31')).toBe(false);
    expect(isUtcDay('foo')).toBe(false);
    expect(isUtcDay('2026-13-01')).toBe(false);
  });
});
