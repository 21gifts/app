import { describe, expect, it, vi } from 'vitest';
import {
  claimFondDeposits,
  FOND_DEPOSIT_CLAIM_MAX_FEE_SATS,
  registerFondDepositAddress,
} from '@/lib/wallet/fond-deposits';
import type { WalletDeposit } from '@/lib/wallet/wallet-sdk';

/**
 * One open deposit.
 *
 * @param overrides - Fields to change.
 * @returns The deposit.
 */
function deposit(overrides: Partial<WalletDeposit> = {}): WalletDeposit {
  return {
    txid: 'ab'.repeat(32),
    vout: 1,
    amountSats: 100_000,
    done: false,
    maxClaimFeeSats: null,
    ...overrides,
  };
}

describe('claimFondDeposits', () => {
  it('claims an open deposit at a tenth of its amount, capped at the fixed maximum', async () => {
    const claimDeposit = vi.fn(async () => undefined);
    const claims = await claimFondDeposits({
      listUnclaimedDeposits: async () => [
        deposit({ txid: 'small', amountSats: 5_000 }),
        deposit({ txid: 'large', amountSats: 1_000_000, vout: 3 }),
      ],
      claimDeposit,
    });
    expect(claims).toBe(2);
    expect(claimDeposit.mock.calls).toEqual([
      [{ txid: 'small', vout: 1 }, 500],
      [{ txid: 'large', vout: 3 }, FOND_DEPOSIT_CLAIM_MAX_FEE_SATS],
    ]);
    expect(FOND_DEPOSIT_CLAIM_MAX_FEE_SATS).toBe(2_000);
  });

  it('skips claimed or refunded deposits, ones already carrying the ceiling, and dust', async () => {
    const claimDeposit = vi.fn(async () => undefined);
    const claims = await claimFondDeposits({
      listUnclaimedDeposits: async () => [
        deposit({ done: true }),
        deposit({ maxClaimFeeSats: FOND_DEPOSIT_CLAIM_MAX_FEE_SATS }),
        deposit({ amountSats: 9 }),
      ],
      claimDeposit,
    });
    expect(claims).toBe(0);
    expect(claimDeposit).not.toHaveBeenCalled();
  });

  it('raises a ceiling another value left on the deposit', async () => {
    const claimDeposit = vi.fn(async () => undefined);
    await claimFondDeposits({
      listUnclaimedDeposits: async () => [deposit({ maxClaimFeeSats: 99 })],
      claimDeposit,
    });
    expect(claimDeposit).toHaveBeenCalledWith({ txid: 'ab'.repeat(32), vout: 1 }, 2_000);
  });

  it('goes on to the next deposit when one claim fails', async () => {
    const claimDeposit = vi
      .fn<(d: { txid: string; vout: number }, fee: number) => Promise<void>>()
      .mockRejectedValueOnce(new Error('maxDepositClaimFeeExceeded'))
      .mockResolvedValueOnce(undefined);
    const claims = await claimFondDeposits({
      listUnclaimedDeposits: async () => [deposit({ txid: 'a' }), deposit({ txid: 'b' })],
      claimDeposit,
    });
    expect(claims).toBe(2);
    expect(claimDeposit).toHaveBeenCalledTimes(2);
  });

  it('passes a failed list on', async () => {
    await expect(
      claimFondDeposits({
        listUnclaimedDeposits: async () => {
          throw new Error('sdk');
        },
        claimDeposit: vi.fn(),
      }),
    ).rejects.toThrow('sdk');
  });
});

describe('registerFondDepositAddress', () => {
  const ADDRESS = 'bc1p5cyxnuxmeuwuvkwfem96lqzszd02n6xdcjrs20cac6yqjjwudpxqkedrcr';

  it('sends the wallet address with the session and reports registered', async () => {
    const put = vi.fn(async () => ({ ok: true as const, address: ADDRESS }));
    await expect(
      registerFondDepositAddress({
        session: 'sess',
        receiveBitcoinAddress: async () => ADDRESS,
        putFondDepositAddress: put,
      }),
    ).resolves.toBe('registered');
    expect(put).toHaveBeenCalledWith('sess', ADDRESS);
  });

  it.each([403, 404])('stops on %i', async (status) => {
    await expect(
      registerFondDepositAddress({
        session: 'sess',
        receiveBitcoinAddress: async () => ADDRESS,
        putFondDepositAddress: async () => ({ ok: false, status, error: null }),
      }),
    ).resolves.toBe('stop');
  });

  it.each([0, 400, 401, 500, 503])('retries later on %i', async (status) => {
    await expect(
      registerFondDepositAddress({
        session: 'sess',
        receiveBitcoinAddress: async () => ADDRESS,
        putFondDepositAddress: async () => ({ ok: false, status, error: 'x' }),
      }),
    ).resolves.toBe('retry');
  });

  it('retries later and sends nothing when the wallet cannot read its address', async () => {
    const put = vi.fn();
    await expect(
      registerFondDepositAddress({
        session: 'sess',
        receiveBitcoinAddress: async () => {
          throw new Error('wallet-connect');
        },
        putFondDepositAddress: put,
      }),
    ).resolves.toBe('retry');
    expect(put).not.toHaveBeenCalled();
  });
});
