import type { Account } from '@/lib/api-types';
import { getBreezApiKey } from '@/lib/config';
import {
  classifyWebAuthnError,
  mnemonicFromPrfFirst,
  obtainPrfFirstFromGet,
} from '@/lib/prf-mnemonic';
import { rememberSessionPhrase, sessionPhraseGeneration } from '@/lib/tab-phrase';
import { base64UrlToBytes } from '@/lib/webauthn-browser';
import { useAuthStore } from '@/stores/auth-store';

/**
 * Inputs for deriving and remembering a tab-memory recovery phrase from PRF.
 */
export interface PhraseSource {
  /** PRF `eval.first` bytes from a WebAuthn ceremony, when present. */
  prfFirst: Uint8Array | null | undefined;
  /** Credential id that produced `prfFirst`. */
  credentialId: string;
  /** Account that must own the matching seed credential. */
  account: Account;
  /** Session token that must still be current after derivation. */
  sessionToken: string;
}

/**
 * Outcome of an unlock ceremony that re-derives the tab phrase from the seed
 * passkey.
 */
export type WalletUnlockResult = 'unlocked' | 'cancelled' | 'failed';

/**
 * True when the account can unlock the in-app wallet with its seed passkey.
 *
 * @param account - Signed-in account, or `null` when logged out.
 * @returns Whether `account` has a non-empty seed credential and requires a wallet.
 */
export function canUnlockWallet(
  account: Account | null,
): account is Account & { passkeyCredentialId: string } {
  return (
    account !== null &&
    account.walletRequired === true &&
    typeof account.passkeyCredentialId === 'string' &&
    account.passkeyCredentialId !== ''
  );
}

/**
 * Derives the recovery phrase from PRF bytes and stores it in tab memory when
 * the Breez API key is set, the account is eligible, the credential matches,
 * the session is still current, and the tab phrase was not remembered or
 * cleared during derivation. Never rejects. Never sends the bytes or the
 * phrase and never stores them persistently (tab memory only).
 *
 * @param source - PRF bytes, credential id, account, and session token.
 * @returns `true` when the phrase was remembered; otherwise `false`.
 */
export async function rememberPhraseFromPrf(source: PhraseSource): Promise<boolean> {
  try {
    if (getBreezApiKey() === null) {
      return false;
    }
    const { prfFirst, credentialId, account, sessionToken } = source;
    if (prfFirst === null || prfFirst === undefined || prfFirst.byteLength === 0) {
      return false;
    }
    if (!canUnlockWallet(account)) {
      return false;
    }
    if (account.passkeyCredentialId !== credentialId) {
      return false;
    }
    const generation = sessionPhraseGeneration();
    let mnemonic: string;
    try {
      mnemonic = await mnemonicFromPrfFirst(Uint8Array.from(prfFirst));
    } catch {
      return false;
    }
    if (useAuthStore.getState().session !== sessionToken) {
      return false;
    }
    if (sessionPhraseGeneration() !== generation) {
      return false;
    }
    rememberSessionPhrase(mnemonic);
    return true;
  } catch {
    return false;
  }
}

/**
 * Prompts for the seed passkey, derives the recovery phrase, and remembers it
 * in tab memory. Never rejects.
 *
 * @returns `'unlocked'` on success, `'cancelled'` when the visitor dismisses
 * the ceremony, otherwise `'failed'`.
 */
export async function unlockWalletPhrase(): Promise<WalletUnlockResult> {
  try {
    const { session, account } = useAuthStore.getState();
    if (session === null || !canUnlockWallet(account)) {
      return 'failed';
    }
    const prfFirst = await obtainPrfFirstFromGet(
      Uint8Array.from(base64UrlToBytes(account.passkeyCredentialId)),
    );
    const remembered = await rememberPhraseFromPrf({
      prfFirst,
      credentialId: account.passkeyCredentialId,
      account,
      sessionToken: session,
    });
    return remembered ? 'unlocked' : 'failed';
  } catch (err: unknown) {
    if (classifyWebAuthnError(err) === 'cancel') {
      return 'cancelled';
    }
    return 'failed';
  }
}
