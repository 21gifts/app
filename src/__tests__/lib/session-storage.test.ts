import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { clearSession, loadSession, saveSession } from '@/lib/session-storage';

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  window.localStorage.clear();
});

describe('session-storage (browser)', () => {
  it('returns null when nothing is stored', () => {
    expect(loadSession()).toBeNull();
  });

  it('round-trips a saved token', () => {
    saveSession('tok');
    expect(loadSession()).toBe('tok');
  });

  it('overwrites a previously saved token', () => {
    saveSession('first');
    saveSession('second');
    expect(loadSession()).toBe('second');
  });

  it('clears a saved token', () => {
    saveSession('tok');
    clearSession();
    expect(loadSession()).toBeNull();
  });
});
