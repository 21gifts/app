'use client';

import { useEffect, useState, type ReactElement } from 'react';
import { LoginCard } from '@/components/LoginCard';
import { visualPin } from '@/lib/visual-pin';
import { finishWalletOpen } from '@/lib/wallet/wallet-open';
import { useAuthStore } from '@/stores/auth-store';

/**
 * How the last wallet open of a held-back session ended, so a card that
 * mounts for that session later (the visitor moved to another screen) still
 * shows its alert; `null` before any.
 */
let lastOutcome: { session: string; problem: 'noPrf' | 'failed' } | null = null;

/**
 * Alert pinned by `?visual=balance-locked-…`, honoured only in a Playwright build.
 *
 * @returns The pinned alert, or `null`.
 */
function pinnedProblem(): 'noPrf' | 'failed' | null {
  switch (visualPin()) {
    case 'balance-locked-prf-unsupported':
      return 'noPrf';
    case 'balance-locked-error':
      return 'failed';
    default:
      return null;
  }
}

/**
 * The login shown in place of a signed-in screen while the wallet is not open
 * in this tab, so the member stays on the same path. It is the `/login` card:
 * **Log in** is one passkey prompt that refreshes the session and derives the
 * recovery phrase into tab memory. Once a session is there, the wallet opens
 * while the card shows its starting line (a second prompt only when another
 * passkey signed in), and `OnboardingGate` then shows the screen; the one-time
 * wallet setup runs in the background, without a dialog. When the wallet
 * cannot be opened the session is held back again: a passkey without PRF
 * output shows `wallet.prfUnsupported`, any other failure or a dismissed
 * prompt `login.error`, above **Log in** on `LoginCard`'s held start view.
 * That view is the ordinary login (**Log in**, **Open a new account**) with
 * no **Log out**: whichever passkey logs in decides the account, and a
 * different account replaces the held session. A card that mounts later for
 * the same held-back session shows the alert of its last wallet open. In a
 * Playwright build `?visual=balance-locked-prf-unsupported` and
 * `?visual=balance-locked-error` pin those two alerts.
 *
 * @returns The login card, with an alert when the last try could not open the wallet.
 */
export function WalletLoginCard(): ReactElement {
  const session = useAuthStore((state) => state.session);
  const [problem, setProblem] = useState<'noPrf' | 'failed' | null>(
    () =>
      pinnedProblem() ??
      (lastOutcome !== null && lastOutcome.session === useAuthStore.getState().lockedSession
        ? lastOutcome.problem
        : null),
  );

  useEffect(() => {
    if (session === null) {
      return;
    }
    let live = true;
    setProblem(null);
    void finishWalletOpen().then((outcome) => {
      if (outcome === 'open') {
        return;
      }
      const state = useAuthStore.getState();
      if (state.session === session) {
        // Hold the session back even when the card has unmounted meanwhile.
        state.lockSession();
      } else if (state.lockedSession !== session) {
        // Another session took over; this outcome is not about it.
        return;
      }
      const next = outcome === 'noPrf' ? 'noPrf' : 'failed';
      lastOutcome = { session, problem: next };
      if (live) {
        setProblem(next);
      }
    });
    return () => {
      live = false;
    };
  }, [session]);

  return <LoginCard heldProblem={problem} />;
}
