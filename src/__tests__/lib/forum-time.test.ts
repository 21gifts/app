import { describe, expect, it, vi } from 'vitest';
import { formatForumTime, formatForumTimeFromMs } from '@/lib/forum-time';

describe('formatForumTime', () => {
  const iso = '2026-08-28T12:00:00.000Z';

  it('formats a valid ISO timestamp in the local timezone for en', () => {
    const expected = new Intl.DateTimeFormat('en', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(iso));
    expect(formatForumTime(iso, 'en')).toBe(expected);
  });

  it('formats a valid ISO timestamp in the local timezone for de', () => {
    const expected = new Intl.DateTimeFormat('de', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(iso));
    expect(formatForumTime(iso, 'de')).toBe(expected);
  });

  it('returns the original string when the instant is invalid', () => {
    expect(formatForumTime('not-a-date', 'en')).toBe('not-a-date');
  });

  it('does not pass timeZone to Intl.DateTimeFormat', () => {
    const Original = Intl.DateTimeFormat;
    const spy = vi.spyOn(Intl, 'DateTimeFormat').mockImplementation((locales, options) => {
      expect(options?.timeZone).toBeUndefined();
      expect(options).not.toHaveProperty('timeZone');
      return new Original(locales, options);
    });
    try {
      formatForumTime('2026-08-28T12:00:00.000Z', 'en');
      expect(spy).toHaveBeenCalled();
    } finally {
      spy.mockRestore();
    }
  });
});

describe('formatForumTimeFromMs', () => {
  it('matches formatForumTime for a valid epoch', () => {
    const ms = Date.parse('2026-08-28T12:00:00.000Z');
    expect(formatForumTimeFromMs(ms, 'en')).toBe(
      formatForumTime('2026-08-28T12:00:00.000Z', 'en'),
    );
  });

  it('returns String(ms) when the instant is invalid', () => {
    expect(formatForumTimeFromMs(Number.NaN, 'en')).toBe('NaN');
  });
});
