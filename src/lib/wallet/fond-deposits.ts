import type { FondPayoutFailure } from '@/lib/api';
import type { WalletDeposit } from '@/lib/wallet/wallet-sdk';

/** Most the Fond wallet pays to claim one on-chain deposit, in sats. */
export const FOND_DEPOSIT_CLAIM_MAX_FEE_SATS = 2_000;

/** Largest share of a deposit the claim fee may take (one tenth). */
const FOND_DEPOSIT_CLAIM_MAX_SHARE_DIVISOR = 10;

/**
 * Fee ceiling for claiming one deposit: a tenth of the deposit, at most
 * {@link FOND_DEPOSIT_CLAIM_MAX_FEE_SATS}.
 *
 * @param amountSats - Deposited amount.
 * @returns The ceiling in whole sats.
 */
function claimCeilingSats(amountSats: number): number {
  return Math.min(
    FOND_DEPOSIT_CLAIM_MAX_FEE_SATS,
    Math.floor(amountSats / FOND_DEPOSIT_CLAIM_MAX_SHARE_DIVISOR),
  );
}

/**
 * Gives every open deposit of the Fond wallet a bounded fee ceiling through the
 * SDK's `claimDeposit`.
 *
 * The SDK's default ceiling (1 sat/vbyte) leaves a deposit unclaimed whenever
 * the claim costs more. The ceiling passed here is recorded on the deposit and
 * the SDK applies it to its own later attempts, so a deposit that already
 * carries it, or that is claimed or refunded, is skipped. A failed claim (for
 * example a matured deposit whose claim costs more than the ceiling) is left
 * for the next pass.
 *
 * @param wallet - The wallet's deposit list and claim, and `isCancelled`, checked
 *   before each claim (sign-out or another session ends the pass).
 * @returns How many claims were asked for.
 */
export async function claimFondDeposits(wallet: {
  listUnclaimedDeposits: () => Promise<WalletDeposit[]>;
  claimDeposit: (deposit: { txid: string; vout: number }, maxFeeSats: number) => Promise<void>;
  isCancelled: () => boolean;
}): Promise<number> {
  const deposits = await wallet.listUnclaimedDeposits();
  let claims = 0;
  for (const deposit of deposits) {
    if (wallet.isCancelled()) {
      break;
    }
    const ceiling = claimCeilingSats(deposit.amountSats);
    if (deposit.done || ceiling <= 0 || deposit.maxClaimFeeSats === ceiling) {
      continue;
    }
    claims += 1;
    try {
      await wallet.claimDeposit({ txid: deposit.txid, vout: deposit.vout }, ceiling);
    } catch {
      // The SDK keeps the deposit; the next pass or its own sync tries again.
    }
  }
  return claims;
}

/** What one registration attempt means for the rest of the session. */
export type FondDepositRegistration = 'registered' | 'stop' | 'retry';

/**
 * Reads the Fond wallet's static deposit address and registers it with the
 * api.
 *
 * @param input - Session, the wallet's address read, and the api call.
 * @returns `registered` on success, `stop` when the api answers 403 or 404
 *   (not the Fond account, or the Fond surface is off), and `retry` for any
 *   other failure, including an address the wallet could not read.
 */
export async function registerFondDepositAddress(input: {
  session: string;
  receiveBitcoinAddress: () => Promise<string>;
  putFondDepositAddress: (
    session: string,
    address: string,
  ) => Promise<{ ok: true; address: string } | FondPayoutFailure>;
}): Promise<FondDepositRegistration> {
  let address: string;
  try {
    address = await input.receiveBitcoinAddress();
  } catch {
    return 'retry';
  }
  const result = await input.putFondDepositAddress(input.session, address);
  if (result.ok) {
    return 'registered';
  }
  return result.status === 403 || result.status === 404 ? 'stop' : 'retry';
}
