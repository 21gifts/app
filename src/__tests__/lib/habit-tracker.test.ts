import { describe, expect, it } from 'vitest';
import { habitTrackerSchema } from '@/lib/habit-tracker';

const tracker = {
  week: { start: '2026-09-28', label: '2026-W40', nextAt: 1791129600000 },
  currentWeek: '2026-09-28',
  firstWeek: '2026-09-21',
  habits: [
    {
      id: 'm1',
      accountId: 'm',
      role: 'moderator',
      name: 'Moderator',
      text: 'Listen daily',
      firstWeek: '2026-09-21',
      lastWeek: null,
    },
  ],
  results: [],
  comments: [],
};

describe('habitTrackerSchema', () => {
  it('accepts a habit whose role is moderator', () => {
    const parsed = habitTrackerSchema.parse(tracker);
    expect(parsed.habits[0]?.role).toBe('moderator');
  });

  it('rejects a habit whose role is unknown', () => {
    expect(() =>
      habitTrackerSchema.parse({
        ...tracker,
        habits: [{ ...tracker.habits[0], role: 'guest' }],
      }),
    ).toThrow();
  });
});
