import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
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

  describe('pinned instant', () => {
    afterEach(() => {
      vi.useRealTimers();
      document.head.innerHTML = '';
      delete document.documentElement.dataset['localSunday'];
      Reflect.deleteProperty(window, 'sessionStorage');
    });

    function runAt(pinned: string | null, meta: string | null): string | undefined {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2026, 8, 26, 12));
      if (meta !== null) {
        const tag = document.createElement('meta');
        tag.name = 'e2e-now';
        tag.content = meta;
        document.head.appendChild(tag);
      }
      Object.defineProperty(window, 'sessionStorage', {
        configurable: true,
        value: { getItem: (key: string) => (key === 'e2e-now' ? pinned : null) },
      });
      new Function(SUNDAY_BOOTSTRAP_SCRIPT)();
      return document.documentElement.dataset['localSunday'];
    }

    it('ignores sessionStorage e2e-now in a production build (no e2e-now meta)', () => {
      expect(runAt('2026-09-27T12:00:00', null)).toBe('0');
    });

    it('uses sessionStorage e2e-now in a Playwright build', () => {
      expect(runAt('2026-09-27T12:00:00', '2026-09-26T12:00:00')).toBe('1');
    });

    it('falls back to the e2e-now meta in a Playwright build', () => {
      expect(runAt(null, '2026-09-27T12:00:00')).toBe('1');
    });
  });
});
