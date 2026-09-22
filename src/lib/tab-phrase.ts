/** In-tab recovery phrase. Never written to localStorage or sent to the API. */
let sessionMnemonic: string | null = null;

const PHRASE_EVENT = '21gifts:wallet-phrase';

function notifyPhraseListeners(): void {
  if (typeof window === 'undefined') {
    return;
  }
  window.dispatchEvent(new Event(PHRASE_EVENT));
}

/**
 * Store a derived recovery phrase in tab memory so `/wallet` can show it
 * after register or replace without persisting it.
 *
 * @param mnemonic - Space-separated BIP-39 words.
 */
export function rememberSessionPhrase(mnemonic: string): void {
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
  sessionMnemonic = null;
  notifyPhraseListeners();
}
