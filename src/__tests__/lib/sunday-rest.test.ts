import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { isLocalSunday, SUNDAY_BOOTSTRAP_SCRIPT } from '@/lib/sunday-rest';

const SATURDAY_UTC = Date.parse('2026-09-26T12:00:00.000Z');
const SUNDAY_UTC = Date.parse('2026-09-27T12:00:00.000Z');

describe('isLocalSunday', () => {
  it('is false on Saturday in Europe/Zurich', () => {
    expect(isLocalSunday(SATURDAY_UTC, 'Europe/Zurich')).toBe(false);
  });

  it('is true on Sunday in Europe/Zurich', () => {
    expect(isLocalSunday(SUNDAY_UTC, 'Europe/Zurich')).toBe(true);
  });

  it('is Sunday in Pacific/Auckland while Europe/Zurich is still Saturday', () => {
    expect(isLocalSunday(SATURDAY_UTC, 'Europe/Zurich')).toBe(false);
    expect(isLocalSunday(SATURDAY_UTC, 'Pacific/Auckland')).toBe(true);
  });

  it('returns false for an invalid zone', () => {
    expect(isLocalSunday(SUNDAY_UTC, 'Not/AZone')).toBe(false);
  });

  it('omits timeZone and uses the runtime zone', () => {
    expect(typeof isLocalSunday(SUNDAY_UTC)).toBe('boolean');
  });
});

describe('SUNDAY_BOOTSTRAP_SCRIPT', () => {
  it('pins the device Sunday flag before paint', () => {
    expect(SUNDAY_BOOTSTRAP_SCRIPT.startsWith('(function(){')).toBe(true);
    expect(SUNDAY_BOOTSTRAP_SCRIPT).toContain('localSunday');
    expect(SUNDAY_BOOTSTRAP_SCRIPT).toContain('e2e-now');
    expect(SUNDAY_BOOTSTRAP_SCRIPT).toContain('weekday');
    expect(SUNDAY_BOOTSTRAP_SCRIPT).toContain('visibilitychange');
    expect(SUNDAY_BOOTSTRAP_SCRIPT).toContain('DOMContentLoaded');
    expect(SUNDAY_BOOTSTRAP_SCRIPT).toContain('setHours');
    const css = readFileSync('src/app/globals.css', 'utf8');
    expect(css).toContain('.sunday-write-field');
    expect(css).toContain('display: contents');
    expect(css).toContain('.sunday-write-notice');
  });
});

// Local boundaries, including the spring/fall DST Sundays in Zurich.
describe('local Monday reopening', () => {
  it.each([
    ['2026-10-03T15:59:59.999Z', 'Asia/Manila', false],
    ['2026-10-03T16:00:00.000Z', 'Asia/Manila', true],
    ['2026-10-04T16:00:00.000Z', 'Asia/Manila', true],
    ['2026-10-04T23:59:59.999Z', 'Asia/Manila', true],
    ['2026-10-05T00:00:00.000Z', 'Asia/Manila', false],
    ['2026-10-05T05:59:59.999Z', 'Europe/Zurich', true],
    ['2026-10-05T06:00:00.000Z', 'Europe/Zurich', false],
    ['2026-03-30T05:59:59.999Z', 'Europe/Zurich', true],
    ['2026-03-30T06:00:00.000Z', 'Europe/Zurich', false],
    ['2026-10-26T06:59:59.999Z', 'Europe/Zurich', true],
    ['2026-10-26T07:00:00.000Z', 'Europe/Zurich', false],
    ['2026-10-05T17:59:59.999Z', 'Pacific/Honolulu', true],
    ['2026-10-05T18:00:00.000Z', 'Pacific/Honolulu', false],
  ])('%s in %s has rest=%s', (instant, zone, expected) => {
    expect(isLocalSunday(Date.parse(instant), zone)).toBe(expected);
  });
});
