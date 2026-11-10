'use client';

import { useEffect, useRef, useState } from 'react';
import { fetchFondPayouts, postFondPayoutInvoice, postFondPayoutProof } from '@/lib/api';
import { roleAtLeast } from '@/lib/roles';
import {
  fondE2eWallet,
  runFondPayoutTickOnce,
  waitForFondPayoutRead,
} from '@/lib/wallet/fond-payouts';
import { listWalletPayments, payFromWallet } from '@/lib/wallet/wallet-service';
import { useAuthStore } from '@/stores/auth-store';
import { useWalletStore } from '@/stores/wallet-store';

/** How often an active Fond payout loop runs one tick. */
export const FOND_PAYOUT_INTERVAL_MS = 60_000;

/**
 * Runs the automatic Fond payout loop while the Fond account is signed in
 * with an open wallet.
 *
 * Active only for an account at rank `fond` or above with a session and a
 * `ready` wallet, or in a Playwright build where {@link fondE2eWallet}
 * supplies a fake wallet. It runs one tick on activation and then every
 * {@link FOND_PAYOUT_INTERVAL_MS}. Ticks are single-flight: an effect re-run
 * with the same session shares the running tick, while a new session waits
 * for it to settle and then runs its own tick. A tick that answers `forbidden`
 * (403) or `off` (404) stops only the effect run that started it. Unmount and
 * sign-out stop it.
 *
 * @returns `null` because the loop has no visual surface.
 */
export function FondPayoutSync(): null {
  const session = useAuthStore((state) => state.session);
  const accountId = useAuthStore((state) => state.account?.id ?? null);
  const accountRole = useAuthStore((state) => state.account?.role ?? null);
  const walletStatus = useWalletStore((state) => state.status);
  const [e2eWallet] = useState(() => fondE2eWallet());
  /**
   * `session:accountId` whose last tick stopped the loop on 403/404. It
   * survives a wallet reconnect in this tab, so only another account or
   * session starts the loop again.
   */
  const stoppedKey = useRef<string | null>(null);

  const active =
    session !== null &&
    accountId !== null &&
    roleAtLeast(accountRole, 'fond') &&
    (walletStatus === 'ready' || e2eWallet !== null);

  useEffect(() => {
    if (session === null || accountId === null) {
      return;
    }
    const runKey = `${session}:${accountId}`;
    if (!active || stoppedKey.current === runKey) {
      return;
    }
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const tick = async (): Promise<void> => {
      timer = null;
      let stop: 'forbidden' | 'off' | null = null;
      try {
        const result = await runFondPayoutTickOnce({
          session,
          isCancelled: () => stopped,
          fetchFondPayouts,
          postFondPayoutInvoice,
          postFondPayoutProof,
          payFromWallet: e2eWallet?.payFromWallet ?? payFromWallet,
          listWalletPayments: e2eWallet?.listWalletPayments ?? listWalletPayments,
          sleep: waitForFondPayoutRead,
        });
        stop = result.stop;
      } catch {
        // The next tick retries; the loop never crashes the page.
      }
      if (stopped) {
        return;
      }
      if (stop !== null) {
        stopped = true;
        stoppedKey.current = runKey;
        return;
      }
      timer = setTimeout(() => {
        void tick();
      }, FOND_PAYOUT_INTERVAL_MS);
    };

    void tick();

    return () => {
      stopped = true;
      if (timer !== null) {
        clearTimeout(timer);
        timer = null;
      }
    };
  }, [active, session, accountId, e2eWallet]);

  return null;
}
