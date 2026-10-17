/** In-tab recovery phrase. Never written to localStorage or sent to the API. */
let sessionMnemonic: string | null = null;

/** Bumps on every remember and clear so async derivation can detect being overtaken. */
let phraseGenerationValue = 0;

/** Window event dispatched whenever the tab phrase is remembered or cleared. */
export const SESSION_PHRASE_EVENT = '21gifts:wallet-phrase';

function notifyPhraseListeners(): void {
  /* v8 ignore next 3 -- SSR has no window */
  if (typeof window === 'undefined') {
    return;
  }
  window.dispatchEvent(new Event(SESSION_PHRASE_EVENT));
}

/**
 * Counter that changes whenever the tab phrase is remembered or cleared. Lets
 * an asynchronous derivation detect that it was overtaken.
 *
 * @returns The current generation.
 */
export function sessionPhraseGeneration(): number {
  return phraseGenerationValue;
}

/**
 * Store a derived recovery phrase in tab memory. The phrase view shows it
 * without a second passkey prompt; hiding the words keeps it.
 *
 * @param mnemonic - Space-separated BIP-39 words.
 */
export function rememberSessionPhrase(mnemonic: string): void {
  phraseGenerationValue += 1;
  sessionMnemonic = mnemonic;
  notifyPhraseListeners();
}

/**
 * Current in-memory recovery phrase, or `null`.
 *
 * @returns The phrase, or `null`.
 */
export function peekSessionPhrase(): string | null {
  return sessionMnemonic;
}

/**
 * Drop the in-memory recovery phrase.
 */
export function clearSessionPhrase(): void {
  phraseGenerationValue += 1;
  sessionMnemonic = null;
  notifyPhraseListeners();
}
