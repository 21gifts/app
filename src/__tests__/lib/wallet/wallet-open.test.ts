import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Account } from '@/lib/api-types';
import { getBreezApiKey, getE2eNow } from '@/lib/config';
import { peekSessionPhrase } from '@/lib/tab-phrase';
import { visualPin } from '@/lib/visual-pin';
import {
  finishWalletOpen,
  hydratesLocked,
  isWalletOpen,
  walletGateApplies,
} from '@/lib/wallet/wallet-open';
import {
  canUnlockWallet,
  settlePhraseDerivations,
  unlockWalletPhrase,
} from '@/lib/wallet/wallet-phrase';

vi.mock('@/lib/config', () => ({ getBreezApiKey: vi.fn(), getE2eNow: vi.fn() }));
vi.mock('@/lib/tab-phrase', () => ({ peekSessionPhrase: vi.fn() }));
vi.mock('@/lib/visual-pin', () => ({ visualPin: vi.fn() }));
vi.mock('@/lib/wallet/wallet-phrase', () => ({
  canUnlockWallet: vi.fn(),
  settlePhraseDerivations: vi.fn(),
  unlockWalletPhrase: vi.fn(),
}));

const account = { id: 'account' } as Account;

beforeEach(() => {
  vi.mocked(getE2eNow).mockReset().mockReturnValue(null);
  vi.mocked(getBreezApiKey).mockReset().mockReturnValue('key');
  vi.mocked(visualPin).mockReset().mockReturnValue(null);
  vi.mocked(canUnlockWallet).mockReset().mockReturnValue(true);
  vi.mocked(peekSessionPhrase).mockReset().mockReturnValue(null);
  vi.mocked(settlePhraseDerivations).mockReset().mockResolvedValue(undefined);
  vi.mocked(unlockWalletPhrase).mockReset().mockResolvedValue('unlocked');
});

describe('walletGateApplies', () => {
  it('uses only balance-locked pins in a Playwright build', () => {
    vi.mocked(getE2eNow).mockReturnValue('2026-01-07T12:00:00.000Z');
    vi.mocked(visualPin).mockReturnValue('balance-locked-error');
    expect(walletGateApplies(account)).toBe(true);
    vi.mocked(visualPin).mockReturnValue('balance-ready');
    expect(walletGateApplies(account)).toBe(false);
    vi.mocked(visualPin).mockReturnValue(null);
    expect(walletGateApplies(account)).toBe(false);
    expect(getBreezApiKey).not.toHaveBeenCalled();
  });

  it('requires both a Breez key and an unlockable account in a production build', () => {
    expect(walletGateApplies(account)).toBe(true);
    vi.mocked(getBreezApiKey).mockReturnValue(null);
    expect(walletGateApplies(account)).toBe(false);
    vi.mocked(getBreezApiKey).mockReturnValue('key');
    vi.mocked(canUnlockWallet).mockReturnValue(false);
    expect(walletGateApplies(account)).toBe(false);
  });

  it.each(['balance-locked', 'balance-locked-prf-unsupported', 'balance-locked-error'])(
    'does not treat %s as a pin in a production build',
    (visual) => {
      vi.mocked(visualPin).mockReturnValue(visual);
      vi.mocked(getBreezApiKey).mockReturnValue(null);
      expect(walletGateApplies(account)).toBe(false);
      expect(visualPin).not.toHaveBeenCalled();
    },
  );
});

describe('isWalletOpen', () => {
  it('is open with a phrase or when the gate does not apply', () => {
    expect(isWalletOpen(account, true)).toBe(true);
    vi.mocked(getBreezApiKey).mockReturnValue(null);
    expect(isWalletOpen(account, false)).toBe(true);
  });

  it('is closed when the gate applies without a phrase', () => {
    expect(isWalletOpen(account, false)).toBe(false);
  });
});

describe('hydratesLocked', () => {
  it('holds back a gated account without a phrase', () => {
    expect(hydratesLocked(account)).toBe(true);
  });

  it('does not hold back an open or ungated account', () => {
    vi.mocked(peekSessionPhrase).mockReturnValue('one two three');
    expect(hydratesLocked(account)).toBe(false);
    vi.mocked(peekSessionPhrase).mockReturnValue(null);
    vi.mocked(getBreezApiKey).mockReturnValue(null);
    expect(hydratesLocked(account)).toBe(false);
  });
});

describe('finishWalletOpen', () => {
  it('waits for login derivations and uses their phrase without another prompt', async () => {
    vi.mocked(peekSessionPhrase).mockReturnValue('one two three');
    await expect(finishWalletOpen()).resolves.toBe('open');
    expect(settlePhraseDerivations).toHaveBeenCalledTimes(1);
    expect(unlockWalletPhrase).not.toHaveBeenCalled();
  });

  it.each([
    ['unlocked', 'open'],
    ['cancelled', 'cancelled'],
    ['noPrf', 'noPrf'],
    ['failed', 'failed'],
  ] as const)('maps an %s unlock to %s', async (unlocked, outcome) => {
    vi.mocked(unlockWalletPhrase).mockResolvedValue(unlocked);
    await expect(finishWalletOpen()).resolves.toBe(outcome);
  });
});
