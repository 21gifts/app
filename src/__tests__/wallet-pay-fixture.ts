import { vi } from 'vitest';
import type { Account } from '@/lib/api-types';
import type { WalletPayResult, WalletSendResult } from '@/lib/wallet/wallet-service';
import { useAuthStore } from '@/stores/auth-store';
import { useWalletStore, type WalletStatus } from '@/stores/wallet-store';

/** Request the api issues for the in-app wallet in surface tests. */
export const SPARK_INVOICE = 'spark1giftinvoice';

/**
 * Makes the signed-in account able to unlock the in-app wallet and sets the
 * wallet status. Keeps the rest of the current account.
 *
 * @param status - Wallet status to set.
 */
export function setWalletUsable(status: WalletStatus = 'ready'): void {
  const current = useAuthStore.getState();
  useAuthStore.setState({
    session: current.session ?? 'token',
    account: {
      ...(current.account ?? ({ id: 'acc_wallet', username: 'ada' } as Account)),
      walletRequired: true,
      passkeyCredentialId: 'credential',
    },
  });
  useWalletStore.setState({ status, balanceSats: 21_000, identityPubkey: null });
}

/** Puts the wallet store back to its resting status. */
export function resetWallet(): void {
  useWalletStore.getState().reset();
}

/**
 * A prepare result with a zero fee whose send is the given mock.
 *
 * @param send - Send mock; defaults to one that reports paid.
 * @param amountSats - Prepared amount; must match the sheet's amount.
 * @returns The confirm result.
 */
export function confirmResult(
  send: () => Promise<WalletSendResult> = vi.fn(async () => ({ kind: 'paid' as const })),
  amountSats = 21,
): WalletPayResult {
  return { kind: 'confirm', amountSats, feeSats: 0, send };
}
