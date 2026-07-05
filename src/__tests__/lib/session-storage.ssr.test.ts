// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { clearSession, loadSession, saveSession } from '@/lib/session-storage';

// With no `window`, every accessor takes its SSR-guard branch.
describe('session-storage (server)', () => {
  it('loadSession returns null', () => {
    expect(loadSession()).toBeNull();
  });

  it('saveSession is a no-op', () => {
    expect(() => saveSession('tok')).not.toThrow();
  });

  it('clearSession is a no-op', () => {
    expect(() => clearSession()).not.toThrow();
  });
});
