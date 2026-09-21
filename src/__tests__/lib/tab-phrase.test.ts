import { describe, expect, it } from 'vitest';
import { clearSessionPhrase, peekSessionPhrase, rememberSessionPhrase } from '@/lib/tab-phrase';

describe('tab-phrase', () => {
  it('remembers, peeks, and clears tab RAM', () => {
    rememberSessionPhrase('one two three');
    expect(peekSessionPhrase()).toBe('one two three');
    clearSessionPhrase();
    expect(peekSessionPhrase()).toBeNull();
  });
});
