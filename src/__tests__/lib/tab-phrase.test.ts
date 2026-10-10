import { describe, expect, it } from 'vitest';
import {
  clearSessionPhrase,
  peekSessionPhrase,
  rememberSessionPhrase,
  SESSION_PHRASE_EVENT,
  sessionPhraseGeneration,
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

  it('increases the generation on remember and on clear', () => {
    const start = sessionPhraseGeneration();
    rememberSessionPhrase('one two three');
    expect(sessionPhraseGeneration()).toBe(start + 1);
    clearSessionPhrase();
    expect(sessionPhraseGeneration()).toBe(start + 2);
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
