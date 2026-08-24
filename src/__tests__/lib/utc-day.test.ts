import { describe, expect, it } from 'vitest';
import { isUtcDay } from '@/lib/utc-day';

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
