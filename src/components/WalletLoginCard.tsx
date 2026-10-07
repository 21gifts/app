'use client';

import { useEffect, useState, type ReactElement } from 'react';
import { LoginCard } from '@/components/LoginCard';
import { LogoutButton } from '@/components/LogoutButton';
import { useTranslations } from '@/components/LocaleProvider';
import { visualPin } from '@/lib/visual-pin';
import { finishWalletOpen } from '@/lib/wallet/wallet-open';
import { useAuthStore } from '@/stores/auth-store';

/**
 * How the last wallet open of a held-back session ended, so a card that
 * mounts for that session later (the visitor moved to another screen) still
 * shows its alert; `null` before any.
 */
let lastOutcome: { session: string; problem: 'noPrf' | 'failed' | null } | null = null;

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
 * output shows `wallet.prfUnsupported`, any other failure `login.error`,
 * above **Log in**; a dismissed prompt shows **Log in** alone. Under the card,
 * **Log out** (`LogoutButton`, the same control as in the Menu, which is not
 * shown here) ends a held-back session; it is not offered while a fresh
 * login is still opening its wallet, nor while a new login is in flight on
 * the card. A card that mounts later for the same held-back session shows
 * the alert of its last wallet open. In a
 * Playwright build `?visual=balance-locked-prf-unsupported` and
 * `?visual=balance-locked-error` pin those two alerts.
 *
 * @returns The login card, with an alert when the last try could not open the wallet.
 */
export function WalletLoginCard(): ReactElement {
  const { t } = useTranslations();
  const session = useAuthStore((state) => state.session);
  const lockedSession = useAuthStore((state) => state.lockedSession);
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
      const next = outcome === 'cancelled' ? null : outcome;
      lastOutcome = { session, problem: next };
      if (live) {
        setProblem(next);
      }
    });
    return () => {
      live = false;
    };
  }, [session]);

  return (
    <div className="flex w-full flex-col items-center gap-6">
      {problem === null ? null : (
        <p role="alert" className="max-w-sm text-center text-sm text-app-danger">
          {t(problem === 'noPrf' ? 'wallet.prfUnsupported' : 'login.error')}
        </p>
      )}
      <LoginCard
        footer={
          lockedSession === null ? undefined : (
            <div className="w-full max-w-xs">
              <LogoutButton />
            </div>
          )
        }
      />
    </div>
  );
}
