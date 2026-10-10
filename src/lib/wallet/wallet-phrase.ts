import type { Account } from '@/lib/api-types';
import { getBreezApiKey } from '@/lib/config';
import {
  classifyWebAuthnError,
  mnemonicFromPrfFirst,
  obtainPrfFirstFromGet,
} from '@/lib/prf-mnemonic';
import { traceWallet } from '@/lib/sentry';
import {
  peekSessionPhrase,
  rememberSessionPhrase,
  sessionPhraseGeneration,
} from '@/lib/tab-phrase';
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
export type WalletUnlockResult = 'unlocked' | 'cancelled' | 'noPrf' | 'failed';

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
 * Session whose login already used the seed passkey without giving the tab a
 * phrase: `noPrf` when the passkey gave no PRF output, `failed` when the
 * phrase could not be derived from it. Asking that passkey again cannot do
 * better, so {@link unlockWalletPhrase} answers with it. Bound to the
 * tab-phrase generation at that time (any later remember or clear ends it);
 * `null` otherwise.
 */
let seedAnswered: {
  session: string;
  generation: number;
  result: 'noPrf' | 'failed';
} | null = null;

/** Phrase derivations still running in this tab. */
const pendingDerivations = new Set<Promise<boolean>>();

/**
 * Derives the recovery phrase from PRF bytes and stores it in tab memory when
 * the Breez API key is set, the account is eligible, the credential matches,
 * the session is still current, and the tab phrase was not remembered or
 * cleared during derivation. When the seed passkey itself answered without
 * PRF output, or its PRF output could not be turned into a phrase, it records
 * that for the session, so {@link unlockWalletPhrase} answers `noPrf` or
 * `failed` without asking the same passkey a second time. Never rejects. Never sends the bytes or the
 * phrase and never stores them persistently (tab memory only). While it runs,
 * {@link settlePhraseDerivations} waits for it.
 *
 * @param source - PRF bytes, credential id, account, and session token.
 * @returns `true` when the phrase was remembered; otherwise `false`.
 */
export function rememberPhraseFromPrf(source: PhraseSource): Promise<boolean> {
  const run = derivePhrase(source);
  pendingDerivations.add(run);
  void run.finally(() => {
    pendingDerivations.delete(run);
  });
  return run;
}

/**
 * Waits until every phrase derivation running in this tab has finished, so a
 * caller that needs the phrase does not ask for the passkey again while the
 * login is still deriving it. Never rejects.
 *
 * @returns Resolves once no derivation is running.
 */
export async function settlePhraseDerivations(): Promise<void> {
  await Promise.all([...pendingDerivations]);
}

/**
 * The work of {@link rememberPhraseFromPrf}.
 *
 * @param source - PRF bytes, credential id, account, and session token.
 * @returns `true` when the phrase was remembered; otherwise `false`.
 */
async function derivePhrase(source: PhraseSource): Promise<boolean> {
  try {
    if (getBreezApiKey() === null) {
      return false;
    }
    const { prfFirst, credentialId, account, sessionToken } = source;
    if (prfFirst === null || prfFirst === undefined || prfFirst.byteLength === 0) {
      if (canUnlockWallet(account) && account.passkeyCredentialId === credentialId) {
        seedAnswered = {
          session: sessionToken,
          generation: sessionPhraseGeneration(),
          result: 'noPrf',
        };
      }
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
      seedAnswered = { session: sessionToken, generation, result: 'failed' };
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

/** The unlock ceremony in progress in this tab, shared across remounts. */
let unlockInFlight: Promise<WalletUnlockResult> | null = null;

/**
 * Prompts for the seed passkey, derives the recovery phrase, and remembers it
 * in tab memory. Never rejects. While a ceremony is in progress in this tab,
 * further calls join it instead of opening a second prompt. Does not prompt
 * when the phrase is already in tab memory, including after a derivation the
 * login started from its own prompt has finished, and does not prompt when
 * that login already used the seed passkey without giving a phrase (answers
 * `noPrf` or `failed` as that login did).
 *
 * @returns `'unlocked'` on success, `'cancelled'` when the visitor dismisses
 * the ceremony, `'noPrf'` when the passkey answered without PRF output (this
 * phone or browser cannot hold the wallet), otherwise `'failed'`.
 */
export function unlockWalletPhrase(): Promise<WalletUnlockResult> {
  if (unlockInFlight === null) {
    unlockInFlight = runUnlockCeremony().finally(() => {
      unlockInFlight = null;
    });
  }
  return unlockInFlight;
}

async function runUnlockCeremony(): Promise<WalletUnlockResult> {
  try {
    if (pendingDerivations.size > 0) {
      await settlePhraseDerivations();
    }
    if (peekSessionPhrase() !== null) {
      return 'unlocked';
    }
    const { session, account } = useAuthStore.getState();
    if (session === null || !canUnlockWallet(account)) {
      return 'failed';
    }
    if (
      seedAnswered !== null &&
      seedAnswered.session === session &&
      seedAnswered.generation === sessionPhraseGeneration()
    ) {
      return seedAnswered.result;
    }
    const credentialId = Uint8Array.from(base64UrlToBytes(account.passkeyCredentialId));
    const prfFirst = await traceWallet(
      'wallet.passkey',
      () => obtainPrfFirstFromGet(credentialId),
      {
        prompt: 'unlock',
      },
    );
    if (prfFirst === null) {
      return 'noPrf';
    }
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
