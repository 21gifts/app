import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { loadUnpaidSeenAt, saveUnpaidSeenAt } from '@/lib/forum-unpaid-seen';

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  window.localStorage.clear();
});

describe('forum-unpaid-seen (browser)', () => {
  it('returns null when nothing is stored', () => {
    expect(loadUnpaidSeenAt()).toBeNull();
  });

  it('round-trips a saved timestamp', () => {
    saveUnpaidSeenAt('2026-01-01T00:00:00.000Z');
    expect(loadUnpaidSeenAt()).toBe('2026-01-01T00:00:00.000Z');
  });

  it('overwrites a previously saved timestamp', () => {
    saveUnpaidSeenAt('2026-01-01T00:00:00.000Z');
    saveUnpaidSeenAt('2026-02-01T00:00:00.000Z');
    expect(loadUnpaidSeenAt()).toBe('2026-02-01T00:00:00.000Z');
  });

  it('returns null for empty, whitespace, or invalid stored values', () => {
    window.localStorage.setItem('21gifts.forum-unpaid-seen', '');
    expect(loadUnpaidSeenAt()).toBeNull();
    window.localStorage.setItem('21gifts.forum-unpaid-seen', '   ');
    expect(loadUnpaidSeenAt()).toBeNull();
    window.localStorage.setItem('21gifts.forum-unpaid-seen', 'not-a-date');
    expect(loadUnpaidSeenAt()).toBeNull();
  });
});
