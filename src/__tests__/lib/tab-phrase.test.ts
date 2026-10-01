import { describe, expect, it } from 'vitest';
import {
  clearSessionPhrase,
  peekSessionPhrase,
  rememberSessionPhrase,
  SESSION_PHRASE_EVENT,
} from '@/lib/tab-phrase';

describe('tab-phrase', () => {
  it('exports the phrase event name', () => {
    expect(SESSION_PHRASE_EVENT).toBe('21gifts:wallet-phrase');
  });

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
    window.addEventListener(SESSION_PHRASE_EVENT, onPhrase);
    rememberSessionPhrase('one two');
    clearSessionPhrase();
    window.removeEventListener(SESSION_PHRASE_EVENT, onPhrase);
    expect(seen).toEqual(['one two', 'null']);
  });
});
