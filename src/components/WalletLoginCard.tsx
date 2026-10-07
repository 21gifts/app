'use client';

import { useEffect, useState, type ReactElement } from 'react';
import { LoginCard } from '@/components/LoginCard';
import { useTranslations } from '@/components/LocaleProvider';
import { visualPin } from '@/lib/visual-pin';
import { finishWalletOpen } from '@/lib/wallet/wallet-open';
import { useAuthStore } from '@/stores/auth-store';

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
 * above **Log in**; a dismissed prompt shows **Log in** alone. In a
 * Playwright build `?visual=balance-locked-prf-unsupported` and
 * `?visual=balance-locked-error` pin those two alerts.
 *
 * @returns The login card, with an alert when the last try could not open the wallet.
 */
export function WalletLoginCard(): ReactElement {
  const { t } = useTranslations();
  const session = useAuthStore((state) => state.session);
  const [problem, setProblem] = useState<'noPrf' | 'failed' | null>(pinnedProblem);

  useEffect(() => {
    if (session === null) {
      return;
    }
    let live = true;
    setProblem(null);
    void finishWalletOpen().then((outcome) => {
      if (!live || outcome === 'open' || useAuthStore.getState().session !== session) {
        return;
      }
      useAuthStore.getState().lockSession();
      setProblem(outcome === 'cancelled' ? null : outcome);
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
      <LoginCard />
    </div>
  );
}
