import { describe, expect, it } from 'vitest';
import { clearSessionPhrase, peekSessionPhrase, rememberSessionPhrase } from '@/lib/tab-phrase';

describe('tab-phrase', () => {
  it('remembers, peeks, and clears tab RAM', () => {
    rememberSessionPhrase('one two three');
    expect(peekSessionPhrase()).toBe('one two three');
    clearSessionPhrase();
    expect(peekSessionPhrase()).toBeNull();
  });

  it('notifies listeners when the phrase is remembered or cleared', () => {
    const seen: string[] = [];
    const onPhrase = (): void => {
      seen.push(peekSessionPhrase() ?? 'null');
    };
    window.addEventListener('21gifts:wallet-phrase', onPhrase);
    rememberSessionPhrase('one two');
    clearSessionPhrase();
    window.removeEventListener('21gifts:wallet-phrase', onPhrase);
    expect(seen).toEqual(['one two', 'null']);
  });
});
