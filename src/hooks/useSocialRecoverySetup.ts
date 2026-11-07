'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { putRecoveryShare, RecoveryError } from '@/lib/api';
import { encodeShareCode, splitPhrase } from '@/lib/recovery-share-code';
import { peekSessionPhrase } from '@/lib/tab-phrase';
import { visualPin } from '@/lib/visual-pin';
import { ensureWalletConnected } from '@/lib/wallet/wallet-service';
import { useAuthStore } from '@/stores/auth-store';

/** Step of **Secure my account** (`/settings/social-recovery`). */
export type SocialRecoverySetupStep =
  'intro' | 'checking' | 'share1' | 'share2' | 'saving' | 'done';

/**
 * Why the setup stopped: the open wallet is not the account's verified wallet
 * (`mismatch`), the wallet could not be opened or its words not split
 * (`wallet`), the upload failed (`save`), or the api refused the upload
 * because the wallet changed (`changed`).
 */
export type SocialRecoverySetupError = 'mismatch' | 'wallet' | 'save' | 'changed';

/** What **Secure my account** shows. */
export interface SocialRecoverySetupState {
  /** The step on screen, or the step that failed. */
  step: SocialRecoverySetupStep;
  /** Why the setup stopped, or `null`. */
  error: SocialRecoverySetupError | null;
  /** QR payloads of the shares for person 1 and person 2, while they are shown. */
  codes: readonly [string, string] | null;
  /** Identifier of the set those codes belong to (not shown; a new split gives a new one). */
  identifier: number | null;
}

/** State and actions of **Secure my account**. */
export interface UseSocialRecoverySetupResult extends SocialRecoverySetupState {
  /** **Continue**: checks the open wallet and splits its 12 words. */
  start: () => void;
  /** **Person 1 has scanned it** shows person 2's code; **Person 2 has scanned it** stores 21.gifts' share. */
  scanned: () => void;
  /** **Start again with new codes**: splits the same words again and shows person 1's code. */
  resplit: () => void;
  /** **Try again** under an error: checks again, uploads again, or returns to the intro. */
  retry: () => void;
  /** The top-left arrow: person 2 → person 1 → intro; `false` lets it leave. */
  back: () => boolean;
}

/** What a split needs: the words, the wallet they open, and the owner in the codes. */
interface SplitSource {
  /** The 12 words of the account's verified wallet. */
  words: string;
  /** That wallet's key, sent with the upload. */
  sparkPubkey: string;
  /** Owner account id in the codes. */
  ownerId: string;
  /** Owner username in the codes. */
  ownerUsername: string;
}

/** A split kept in memory until the upload: its source and 21.gifts' share. */
interface SetupSecret extends SplitSource {
  /** 21.gifts' share (member index 2), 20 words. */
  share: string;
}

/** Step and error a split lands on. */
type Landing = Pick<SocialRecoverySetupState, 'step' | 'error'>;

/** The intro, with nothing split. */
const INTRO: SocialRecoverySetupState = {
  step: 'intro',
  error: null,
  codes: null,
  identifier: null,
};

/** Where a fresh split lands: person 1's code. */
const SHARE1: Landing = { step: 'share1', error: null };

/**
 * Words the pinned screenshots split: the public BIP-39 test phrase of 16 zero
 * bytes. The `/wallet/phrase` fixture words have no valid checksum, so they
 * cannot be split.
 */
const SETUP_VISUAL_FIXTURE_MNEMONIC =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';

/**
 * Playwright-only `?visual=` pins of `/settings/social-recovery`: the step
 * and error each one opens on, with {@link SETUP_VISUAL_FIXTURE_MNEMONIC}
 * split by a fixed random source ({@link visualRandom}). Read through
 * {@link visualPin}, so a deployed build ignores them.
 */
const RECOVERY_VISUAL_PINS: ReadonlyMap<string, Landing> = new Map<string, Landing>([
  ['sr-checking', { step: 'checking', error: null }],
  ['sr-share-1', { step: 'share1', error: null }],
  ['sr-share-2', { step: 'share2', error: null }],
  ['sr-done', { step: 'done', error: null }],
  ['sr-mismatch', { step: 'checking', error: 'mismatch' }],
  ['sr-save-error', { step: 'saving', error: 'save' }],
]);

/**
 * Fixed bytes for the pinned fixture split, so its codes are the same in
 * every screenshot: byte `n` of each draw is `(37n + 11) mod 256`.
 *
 * @param length - Byte count.
 * @returns The bytes.
 */
function visualRandom(length: number): Uint8Array<ArrayBuffer> {
  return Uint8Array.from({ length }, (_, index) => (index * 37 + 11) & 0xff);
}

/**
 * State of a stopped setup.
 *
 * @param step - The step that failed.
 * @param error - Why.
 * @returns The state, with no code shown.
 */
function stopped(
  step: SocialRecoverySetupStep,
  error: SocialRecoverySetupError,
): SocialRecoverySetupState {
  return { step, error, codes: null, identifier: null };
}

/**
 * **Secure my account** (`/settings/social-recovery`) for the signed-in
 * owner, in component memory only. **Continue** takes the 12 words of the
 * open wallet from tab memory ({@link peekSessionPhrase}; no passkey prompt),
 * makes sure the wallet is open ({@link ensureWalletConnected}), and stops
 * with `mismatch` unless its key is the account's verified wallet key. It
 * splits the words into three shares ({@link splitPhrase}, which checks every
 * pair) and shows person 1's and then person 2's code
 * ({@link encodeShareCode}). **Start again with new codes** splits the same
 * words again. After person 2, 21.gifts' share is uploaded
 * ({@link putRecoveryShare}) with the key checked before, and the returned
 * account replaces the stored one. A missing phrase, a wallet that does not
 * open, and a split or code that fails give `wallet`; a 409 gives `changed`;
 * any other upload failure gives `save`. Leaving the page, or stepping back
 * to the intro, drops the words and shares; an answer after that is dropped
 * too, except that a stored share still updates the account of the same
 * session. In a Playwright build the `sr-…` pins open a step with fixture
 * codes.
 *
 * @returns The state and its actions.
 */
export function useSocialRecoverySetup(): UseSocialRecoverySetupResult {
  const [state, setState] = useState<SocialRecoverySetupState>(INTRO);
  const secretRef = useRef<SetupSecret | null>(null);
  const runRef = useRef(0);

  /** Starts a new run; an answer of an older one is dropped. */
  const nextRun = useCallback((): number => {
    runRef.current += 1;
    return runRef.current;
  }, []);

  const split = useCallback(
    async (
      run: number,
      source: SplitSource,
      landing: Landing,
      random?: typeof visualRandom,
    ): Promise<void> => {
      try {
        const { identifier, shares } = await splitPhrase(source.words, random);
        const codes = [
          encodeShareCode(source.ownerId, source.ownerUsername, shares[0]),
          encodeShareCode(source.ownerId, source.ownerUsername, shares[1]),
        ] as const;
        if (runRef.current !== run) {
          return;
        }
        secretRef.current = {
          words: source.words,
          sparkPubkey: source.sparkPubkey,
          ownerId: source.ownerId,
          ownerUsername: source.ownerUsername,
          share: shares[2],
        };
        const shown = landing.step === 'share1' || landing.step === 'share2';
        setState({
          ...landing,
          codes: shown ? codes : null,
          identifier: shown ? identifier : null,
        });
      } catch {
        if (runRef.current !== run) {
          return;
        }
        secretRef.current = null;
        setState(stopped('checking', 'wallet'));
      }
    },
    [],
  );

  const start = useCallback((): void => {
    const run = nextRun();
    secretRef.current = null;
    const words = peekSessionPhrase();
    if (words === null) {
      setState(stopped('checking', 'wallet'));
      return;
    }
    setState({ ...INTRO, step: 'checking' });
    void (async () => {
      let identity: string;
      try {
        identity = await ensureWalletConnected();
      } catch {
        if (runRef.current === run) {
          setState(stopped('checking', 'wallet'));
        }
        return;
      }
      if (runRef.current !== run) {
        return;
      }
      const account = useAuthStore.getState().account;
      if (
        account === null ||
        account.sparkWalletVerified !== true ||
        identity.toLowerCase() !== account.sparkPubkey
      ) {
        setState(stopped('checking', 'mismatch'));
        return;
      }
      await split(
        run,
        {
          words,
          sparkPubkey: account.sparkPubkey,
          ownerId: account.id,
          ownerUsername: account.username ?? '',
        },
        SHARE1,
      );
    })();
  }, [nextRun, split]);

  const upload = useCallback((): void => {
    const secret = secretRef.current;
    if (secret === null) {
      return;
    }
    const run = nextRun();
    const session = useAuthStore.getState().session;
    if (session === null) {
      setState(stopped('saving', 'save'));
      return;
    }
    setState({ ...INTRO, step: 'saving' });
    void (async () => {
      try {
        const account = await putRecoveryShare(session, {
          sparkPubkey: secret.sparkPubkey,
          share: secret.share,
        });
        const auth = useAuthStore.getState();
        if (auth.session === session) {
          auth.setAccount(account);
        }
        if (runRef.current !== run) {
          return;
        }
        secretRef.current = null;
        setState({ ...INTRO, step: 'done' });
      } catch (error) {
        if (runRef.current !== run) {
          return;
        }
        if (error instanceof RecoveryError && error.kind === 'key_in_use') {
          secretRef.current = null;
          setState(stopped('saving', 'changed'));
          return;
        }
        setState(stopped('saving', 'save'));
      }
    })();
  }, [nextRun]);

  const resplit = useCallback((): void => {
    const secret = secretRef.current;
    if (secret === null) {
      return;
    }
    const run = nextRun();
    setState({ ...INTRO, step: 'checking' });
    void split(run, secret, SHARE1);
  }, [nextRun, split]);

  const toIntro = useCallback((): void => {
    nextRun();
    secretRef.current = null;
    setState(INTRO);
  }, [nextRun]);

  const scanned = (): void => {
    if (state.error !== null) {
      return;
    }
    if (state.step === 'share1') {
      setState({ ...state, step: 'share2' });
    } else if (state.step === 'share2') {
      upload();
    }
  };

  const retry = (): void => {
    if (state.error === 'wallet') {
      start();
    } else if (state.error === 'save') {
      upload();
    } else if (state.error === 'changed') {
      toIntro();
    }
  };

  const back = (): boolean => {
    if (state.error !== null) {
      return false;
    }
    if (state.step === 'share2') {
      setState({ ...state, step: 'share1' });
      return true;
    }
    if (state.step === 'share1') {
      toIntro();
      return true;
    }
    return false;
  };

  useEffect(() => {
    const pin = visualPin();
    const landing = pin === null ? undefined : RECOVERY_VISUAL_PINS.get(pin);
    const account = useAuthStore.getState().account;
    if (landing !== undefined && account !== null) {
      void split(
        nextRun(),
        {
          words: SETUP_VISUAL_FIXTURE_MNEMONIC,
          sparkPubkey: account.sparkPubkey ?? '',
          ownerId: account.id,
          ownerUsername: account.username ?? '',
        },
        landing,
        visualRandom,
      );
    }
    return () => {
      nextRun();
      secretRef.current = null;
    };
  }, [nextRun, split]);

  return { ...state, start, scanned, resplit, retry, back };
}
