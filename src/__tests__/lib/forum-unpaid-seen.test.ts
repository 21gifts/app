import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadUnpaidSeenAt, saveUnpaidSeenAt } from '@/lib/forum-unpaid-seen';

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
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

  it('returns null when getItem throws', () => {
    vi.spyOn(window.localStorage, 'getItem').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError');
    });
    expect(loadUnpaidSeenAt()).toBeNull();
  });

  it('does not throw when setItem throws', () => {
    const setItem = vi.spyOn(window.localStorage, 'setItem').mockImplementation(() => {
      throw new DOMException('quota', 'QuotaExceededError');
    });
    expect(() => {
      saveUnpaidSeenAt('2026-01-01T00:00:00.000Z');
    }).not.toThrow();
    setItem.mockRestore();
    saveUnpaidSeenAt('2026-01-01T00:00:00.000Z');
    expect(loadUnpaidSeenAt()).toBe('2026-01-01T00:00:00.000Z');
  });
});
