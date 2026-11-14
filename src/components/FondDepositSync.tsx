'use client';

import { useEffect, useRef, useState } from 'react';
import { putFondDepositAddress } from '@/lib/api';
import { roleAtLeast } from '@/lib/roles';
import { claimFondDeposits, registerFondDepositAddress } from '@/lib/wallet/fond-deposits';
import { fondE2eWallet } from '@/lib/wallet/fond-payouts';
import {
  claimWalletDeposit,
  listWalletUnclaimedDeposits,
  onWalletDeposits,
  receiveWalletBitcoinAddress,
} from '@/lib/wallet/wallet-service';
import { useAuthStore } from '@/stores/auth-store';
import { useWalletStore } from '@/stores/wallet-store';

/**
 * Keeps the Fond's on-chain deposits working while the Fond account is signed
 * in with an open wallet: registers the wallet's static deposit address with
 * the api, and claims the wallet's deposits under a bounded fee.
 *
 * Active on the same condition as `FondPayoutSync`: an account at rank `fond`
 * or above with a session and a `ready` wallet, or in a Playwright build where
 * {@link fondE2eWallet} supplies a fake wallet.
 *
 * The address is sent once per session and account (`PUT /fond/deposit-address`,
 * idempotent on the api). A 403 or 404 stops further attempts for that session;
 * any other failure is tried again on the next activation (a wallet reconnect
 * or a new session), never on a timer.
 *
 * Deposits are claimed through {@link claimFondDeposits} only once the api has
 * stored the address for this session and account, which confirms that the
 * wallet is the Fond's (any other account at rank `fond` or above gets 403 and
 * keeps the SDK default). A pass runs then and on every `newDeposits` or
 * `unclaimedDeposits` report of the wallet; a pass that is still running
 * absorbs the next report.
 *
 * @returns `null` because the sync has no visual surface.
 */
export function FondDepositSync(): null {
  const session = useAuthStore((state) => state.session);
  const accountId = useAuthStore((state) => state.account?.id ?? null);
  const accountRole = useAuthStore((state) => state.account?.role ?? null);
  const walletStatus = useWalletStore((state) => state.status);
  const [e2eWallet] = useState(() => fondE2eWallet());
  /** `session:accountId` that registered its address or was refused with 403/404. */
  const settledKey = useRef<string | null>(null);
  /** `session:accountId` whose registration is in flight. */
  const pendingKey = useRef<string | null>(null);
  /** `session:accountId` whose address the api stored: the wallet is the Fond's. */
  const [registeredKey, setRegisteredKey] = useState<string | null>(null);

  const active =
    session !== null &&
    accountId !== null &&
    roleAtLeast(accountRole, 'fond') &&
    (walletStatus === 'ready' || e2eWallet !== null);

  useEffect(() => {
    if (!active || session === null || accountId === null) {
      return;
    }
    const runKey = `${session}:${accountId}`;
    if (settledKey.current === runKey || pendingKey.current === runKey) {
      return;
    }
    pendingKey.current = runKey;
    void (async () => {
      try {
        const outcome = await registerFondDepositAddress({
          session,
          receiveBitcoinAddress: e2eWallet?.receiveBitcoinAddress ?? receiveWalletBitcoinAddress,
          putFondDepositAddress,
        });
        if (outcome !== 'retry') {
          settledKey.current = runKey;
        }
        if (outcome === 'registered') {
          setRegisteredKey(runKey);
        }
      } catch {
        // Tried again on the next activation.
      } finally {
        if (pendingKey.current === runKey) {
          pendingKey.current = null;
        }
      }
    })();
  }, [active, session, accountId, e2eWallet]);

  useEffect(() => {
    if (!active || registeredKey !== `${session}:${accountId}`) {
      return;
    }
    const wallet = {
      listUnclaimedDeposits: e2eWallet?.listUnclaimedDeposits ?? listWalletUnclaimedDeposits,
      claimDeposit: e2eWallet?.claimDeposit ?? claimWalletDeposit,
    };
    let running = false;
    const pass = async (): Promise<void> => {
      if (running) {
        return;
      }
      running = true;
      try {
        await claimFondDeposits(wallet);
      } catch {
        // The next deposit report runs another pass.
      } finally {
        running = false;
      }
    };
    void pass();
    const unsubscribe = onWalletDeposits(() => {
      void pass();
    });
    return unsubscribe;
  }, [active, session, accountId, registeredKey, e2eWallet]);

  return null;
}
