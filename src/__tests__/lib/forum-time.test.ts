import { describe, expect, it } from 'vitest';
import { formatForumTime } from '@/lib/forum-time';

describe('formatForumTime', () => {
  const iso = '2026-08-28T12:00:00.000Z';

  it('formats a valid ISO timestamp in UTC for en', () => {
    const expected = new Intl.DateTimeFormat('en', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: 'UTC',
    }).format(new Date(iso));
    expect(formatForumTime(iso, 'en')).toBe(expected);
  });

  it('formats a valid ISO timestamp in UTC for de', () => {
    const expected = new Intl.DateTimeFormat('de', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: 'UTC',
    }).format(new Date(iso));
    expect(formatForumTime(iso, 'de')).toBe(expected);
  });

  it('returns the original string when the instant is invalid', () => {
    expect(formatForumTime('not-a-date', 'en')).toBe('not-a-date');
  });
});
