import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useRemainingBalance } from '@/hooks/useRemainingBalance';
import { deletePreviousWallet, fetchPreviousWallets } from '@/lib/api';
import type { Account, PreviousWallet } from '@/lib/api-types';
import { relockHeldShares } from '@/lib/held-shares';
import { peekSessionPhrase } from '@/lib/tab-phrase';
import {
  closePreviousWallet,
  openPreviousWallet,
  transferRemainingBalance,
} from '@/lib/remaining-balance';
import { returnToView } from '@/lib/view-history';
import { useAuthStore } from '@/stores/auth-store';

const router = { back: vi.fn(), push: vi.fn(), replace: vi.fn() };

vi.mock('next/navigation', () => ({
  useRouter: (): typeof router => router,
}));
vi.mock('@/lib/view-history', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/view-history')>()),
  returnToView: vi.fn(),
}));
vi.mock('@/lib/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api')>()),
  fetchPreviousWallets: vi.fn(),
  deletePreviousWallet: vi.fn(),
}));
vi.mock('@/lib/held-shares', () => ({
  relockHeldShares: vi.fn(async () => 0),
}));
vi.mock('@/lib/tab-phrase', () => ({
  peekSessionPhrase: vi.fn(() => null),
}));
vi.mock('@/lib/remaining-balance', () => ({
  openPreviousWallet: vi.fn(),
  transferRemainingBalance: vi.fn(),
  closePreviousWallet: vi.fn(async () => undefined),
}));

const KEY = `02${'c'.repeat(64)}`;
const WORDS = 'old words of the previous wallet';
const WALLET: PreviousWallet = {
  sparkPubkey: KEY,
  sparkAddress: 'spark1old',
  replacedAt: 1_767_268_800_000,
  balanceSats: 21_000,
};
const ORIGINAL_E2E_NOW = process.env.NEXT_PUBLIC_E2E_NOW;
const originalHref = window.location.href;

/**
 * Renders the hook for the wallet and waits for the list to be read.
 *
 * @param key - The wallet key in the address.
 * @returns The rendered hook.
 */
async function rendered(
  key = KEY,
): Promise<ReturnType<typeof renderHook<ReturnType<typeof useRemainingBalance>, unknown>>> {
  const hook = renderHook(() => useRemainingBalance(key));
  await waitFor(() => {
    expect(hook.result.current.step).not.toBe('checking');
  });
  return hook;
}

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.NEXT_PUBLIC_E2E_NOW;
  window.history.replaceState({}, '', `/settings/previous-wallets/${KEY}`);
  useAuthStore.setState({ session: 'sess-owner' });
  vi.mocked(fetchPreviousWallets).mockResolvedValue([WALLET]);
  vi.mocked(openPreviousWallet).mockResolvedValue({ balanceSats: 21_000 });
  vi.mocked(transferRemainingBalance).mockResolvedValue('sent');
  vi.mocked(deletePreviousWallet).mockResolvedValue(undefined);
});

afterEach(() => {
  cleanup();
  window.history.replaceState({}, '', originalHref);
  if (ORIGINAL_E2E_NOW === undefined) {
    delete process.env.NEXT_PUBLIC_E2E_NOW;
  } else {
    process.env.NEXT_PUBLIC_E2E_NOW = ORIGINAL_E2E_NOW;
  }
});

describe('useRemainingBalance', () => {
  it('checks that the wallet is one of the account’s previous wallets', async () => {
    const { result } = await rendered(KEY.toUpperCase());
    expect(fetchPreviousWallets).toHaveBeenCalledWith('sess-owner');
    expect(result.current.step).toBe('start');
    expect(result.current.removable).toBe(false);
  });

  it('a wallet that is not listed is not found', async () => {
    vi.mocked(fetchPreviousWallets).mockResolvedValue([]);
    const { result } = await rendered();
    expect(result.current.step).toBe('notFound');
    expect(result.current.removable).toBe(false);
  });

  it('Done returns to the settings', async () => {
    vi.mocked(openPreviousWallet).mockResolvedValueOnce({ balanceSats: 0 });
    const { result } = await rendered();
    await act(async () => {
      result.current.onWords(WORDS);
    });
    act(() => {
      result.current.leave();
    });
    expect(returnToView).toHaveBeenCalledWith('/settings', router);
  });

  it('a list that cannot be read offers Try again', async () => {
    vi.mocked(fetchPreviousWallets).mockRejectedValueOnce(new Error('503'));
    const { result } = await rendered();
    expect(result.current.step).toBe('loadError');
    act(() => {
      result.current.reload();
    });
    await waitFor(() => {
      expect(result.current.step).toBe('start');
    });
    expect(fetchPreviousWallets).toHaveBeenCalledTimes(2);
  });

  it('reads nothing without a session, and drops an answer after unmount', async () => {
    useAuthStore.setState({ session: null });
    const signedOut = renderHook(() => useRemainingBalance(KEY));
    expect(signedOut.result.current.step).toBe('checking');
    expect(fetchPreviousWallets).not.toHaveBeenCalled();
    signedOut.unmount();
    useAuthStore.setState({ session: 'sess-owner' });
    let answer: (wallets: PreviousWallet[]) => void = () => undefined;
    let fail: (error: Error) => void = () => undefined;
    vi.mocked(fetchPreviousWallets)
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            answer = resolve;
          }),
      )
      .mockImplementationOnce(
        () =>
          new Promise((_resolve, reject) => {
            fail = reject;
          }),
      );
    const first = renderHook(() => useRemainingBalance(KEY));
    first.unmount();
    answer([WALLET]);
    const second = renderHook(() => useRemainingBalance(KEY));
    second.unmount();
    fail(new Error('late'));
    await Promise.resolve();
    expect(closePreviousWallet).toHaveBeenCalledTimes(3);
  });

  it('scans or types the words, and the arrow steps back to the start', async () => {
    const { result } = await rendered();
    expect(result.current.back()).toBe(false);
    act(() => {
      result.current.scan();
    });
    expect(result.current.step).toBe('scan');
    let stepped = false;
    act(() => {
      stepped = result.current.back();
    });
    expect(stepped).toBe(true);
    expect(result.current.step).toBe('start');
    act(() => {
      result.current.type();
    });
    expect(result.current.step).toBe('type');
    act(() => {
      result.current.back();
    });
    expect(result.current.step).toBe('start');
  });

  it('opens the wallet and shows its synced balance, then moves it', async () => {
    const { result } = await rendered();
    let open: (value: { balanceSats: number }) => void = () => undefined;
    vi.mocked(openPreviousWallet).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          open = resolve;
        }),
    );
    act(() => {
      result.current.onWords(WORDS);
    });
    expect(result.current.step).toBe('opening');
    expect(openPreviousWallet).toHaveBeenCalledWith(WORDS, KEY);
    await act(async () => {
      open({ balanceSats: 21_000 });
    });
    expect(result.current.step).toBe('balance');
    expect(result.current.balanceSats).toBe(21_000);
    expect(result.current.removable).toBe(false);
    let sent: (value: 'sent') => void = () => undefined;
    vi.mocked(transferRemainingBalance).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          sent = resolve;
        }),
    );
    act(() => {
      result.current.transfer();
    });
    expect(result.current.step).toBe('sending');
    act(() => {
      result.current.transfer();
    });
    expect(transferRemainingBalance).toHaveBeenCalledTimes(1);
    expect(transferRemainingBalance).toHaveBeenCalledWith('sess-owner');
    await act(async () => {
      sent('sent');
    });
    expect(result.current.step).toBe('done');
    expect(result.current.balanceSats).toBe(0);
    expect(result.current.removable).toBe(true);
  });

  it('a failed move offers Try again, which moves again', async () => {
    const { result } = await rendered();
    await act(async () => {
      result.current.onWords(WORDS);
    });
    vi.mocked(transferRemainingBalance).mockResolvedValueOnce('error');
    await act(async () => {
      result.current.transfer();
    });
    expect(result.current.step).toBe('error');
    expect(result.current.balanceSats).toBe(21_000);
    await act(async () => {
      result.current.transfer();
    });
    expect(result.current.step).toBe('done');
  });

  it('words of another wallet: Try again returns to the start', async () => {
    vi.mocked(openPreviousWallet).mockResolvedValueOnce('mismatch');
    const { result } = await rendered();
    await act(async () => {
      result.current.onWords(WORDS);
    });
    expect(result.current.step).toBe('mismatch');
    act(() => {
      result.current.retryOpen();
    });
    expect(result.current.step).toBe('start');
  });

  it('a wallet that does not open: Try again opens it again with the same words', async () => {
    vi.mocked(openPreviousWallet).mockResolvedValueOnce('wallet');
    const { result } = await rendered();
    await act(async () => {
      result.current.onWords(WORDS);
    });
    expect(result.current.step).toBe('walletError');
    await act(async () => {
      result.current.retryOpen();
    });
    expect(openPreviousWallet).toHaveBeenLastCalledWith(WORDS, KEY);
    expect(result.current.step).toBe('balance');
  });

  it('drops answers after the page closed', async () => {
    const { result, unmount } = await rendered();
    let open: (value: { balanceSats: number }) => void = () => undefined;
    vi.mocked(openPreviousWallet).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          open = resolve;
        }),
    );
    act(() => {
      result.current.onWords(WORDS);
    });
    unmount();
    await act(async () => {
      open({ balanceSats: 5 });
    });
    expect(result.current.step).toBe('opening');
    expect(closePreviousWallet).toHaveBeenCalled();
  });

  it('drops a move that ends after the page closed', async () => {
    const { result, unmount } = await rendered();
    await act(async () => {
      result.current.onWords(WORDS);
    });
    let sent: (value: 'sent') => void = () => undefined;
    vi.mocked(transferRemainingBalance).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          sent = resolve;
        }),
    );
    act(() => {
      result.current.transfer();
    });
    unmount();
    await act(async () => {
      sent('sent');
    });
    expect(result.current.step).toBe('sending');
  });

  it('an empty wallet can be removed after a confirm, which returns to the settings', async () => {
    vi.mocked(openPreviousWallet).mockResolvedValueOnce({ balanceSats: 0 });
    const { result } = await rendered();
    await act(async () => {
      result.current.onWords(WORDS);
    });
    expect(result.current.removable).toBe(true);
    act(() => {
      result.current.askRemove();
    });
    expect(result.current.removal).toBe('confirm');
    act(() => {
      result.current.cancelRemove();
    });
    expect(result.current.removal).toBe('idle');
    act(() => {
      result.current.askRemove();
    });
    let removed: () => void = () => undefined;
    vi.mocked(deletePreviousWallet).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          removed = resolve;
        }),
    );
    act(() => {
      result.current.confirmRemove();
    });
    expect(result.current.removal).toBe('busy');
    act(() => {
      result.current.confirmRemove();
    });
    expect(deletePreviousWallet).toHaveBeenCalledTimes(1);
    expect(deletePreviousWallet).toHaveBeenCalledWith('sess-owner', KEY);
    await act(async () => {
      removed();
    });
    expect(closePreviousWallet).toHaveBeenCalled();
    expect(returnToView).toHaveBeenCalledWith('/settings', router);
  });

  it('a removal that fails keeps the confirm with its error', async () => {
    vi.mocked(openPreviousWallet).mockResolvedValueOnce({ balanceSats: 0 });
    vi.mocked(deletePreviousWallet).mockRejectedValueOnce(new Error('503'));
    const { result } = await rendered();
    await act(async () => {
      result.current.onWords(WORDS);
    });
    act(() => {
      result.current.askRemove();
    });
    await act(async () => {
      result.current.confirmRemove();
    });
    expect(result.current.removal).toBe('error');
    expect(returnToView).not.toHaveBeenCalled();
  });

  it('Try again after a failed removal removes the wallet and returns to the settings', async () => {
    vi.mocked(openPreviousWallet).mockResolvedValueOnce({ balanceSats: 0 });
    vi.mocked(deletePreviousWallet).mockRejectedValueOnce(new Error('502'));
    const { result } = await rendered();
    await act(async () => {
      result.current.onWords(WORDS);
    });
    await act(async () => {
      result.current.transfer();
    });
    expect(result.current.step).toBe('done');
    act(() => {
      result.current.askRemove();
    });
    await act(async () => {
      result.current.confirmRemove();
    });
    expect(result.current.removal).toBe('error');
    expect(returnToView).not.toHaveBeenCalled();
    await act(async () => {
      result.current.confirmRemove();
    });
    expect(deletePreviousWallet).toHaveBeenCalledTimes(2);
    expect(closePreviousWallet).toHaveBeenCalled();
    expect(returnToView).toHaveBeenCalledWith('/settings', router);
  });

  it('a removal that ends after the page closed changes nothing', async () => {
    vi.mocked(openPreviousWallet).mockResolvedValueOnce({ balanceSats: 0 });
    const { result, unmount } = await rendered();
    await act(async () => {
      result.current.onWords(WORDS);
    });
    let removed: () => void = () => undefined;
    let failed: (error: Error) => void = () => undefined;
    vi.mocked(deletePreviousWallet)
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            removed = resolve;
          }),
      )
      .mockImplementationOnce(
        () =>
          new Promise((_resolve, reject) => {
            failed = reject;
          }),
      );
    act(() => {
      result.current.askRemove();
    });
    act(() => {
      result.current.confirmRemove();
    });
    unmount();
    await act(async () => {
      removed();
    });
    expect(returnToView).not.toHaveBeenCalled();
    const again = await rendered();
    vi.mocked(openPreviousWallet).mockResolvedValueOnce({ balanceSats: 0 });
    await act(async () => {
      again.result.current.onWords(WORDS);
    });
    act(() => {
      again.result.current.askRemove();
    });
    act(() => {
      again.result.current.confirmRemove();
    });
    again.unmount();
    await act(async () => {
      failed(new Error('late'));
    });
    expect(again.result.current.removal).toBe('busy');
  });

  it('a wallet with a balance, or without a session, cannot be removed', async () => {
    const { result } = await rendered();
    await act(async () => {
      result.current.onWords(WORDS);
    });
    act(() => {
      result.current.askRemove();
      result.current.confirmRemove();
    });
    expect(result.current.removal).toBe('idle');
    vi.mocked(openPreviousWallet).mockResolvedValueOnce({ balanceSats: 0 });
    useAuthStore.setState({ session: null });
    await act(async () => {
      result.current.onWords(WORDS);
    });
    act(() => {
      result.current.confirmRemove();
    });
    expect(deletePreviousWallet).not.toHaveBeenCalled();
  });

  it('Transfer does nothing on another step', async () => {
    const { result } = await rendered();
    act(() => {
      result.current.transfer();
    });
    expect(transferRemainingBalance).not.toHaveBeenCalled();
  });

  it.each([
    ['prev-opening', 'opening', null],
    ['prev-mismatch', 'mismatch', null],
    ['prev-balance', 'balance', 21_000],
    ['prev-empty', 'balance', 0],
    ['prev-sending', 'sending', 21_000],
    ['prev-error', 'error', 21_000],
    ['prev-done', 'done', 0],
  ] as const)(
    'pin %s opens on %s without reading the list, and a production build ignores it',
    async (pin, step, balanceSats) => {
      process.env.NEXT_PUBLIC_E2E_NOW = '2026-01-07T12:00:00.000Z';
      window.history.replaceState({}, '', `/settings/previous-wallets/${KEY}?visual=${pin}`);
      const playwright = renderHook(() => useRemainingBalance(KEY));
      expect(playwright.result.current.step).toBe(step);
      expect(playwright.result.current.balanceSats).toBe(balanceSats);
      expect(fetchPreviousWallets).not.toHaveBeenCalled();
      playwright.unmount();
      delete process.env.NEXT_PUBLIC_E2E_NOW;
      const production = await rendered();
      expect(production.result.current.step).toBe('start');
    },
  );

  it('ignores an unknown pin', async () => {
    process.env.NEXT_PUBLIC_E2E_NOW = '2026-01-07T12:00:00.000Z';
    window.history.replaceState({}, '', `/settings/previous-wallets/${KEY}?visual=prev-nothing`);
    const { result } = await rendered();
    expect(result.current.step).toBe('start');
  });
});

describe('useRemainingBalance relock', () => {
  const owner = { id: 'acc_owner' } as Account;

  it('moves the kept shares from the entered words to the words in tab memory', async () => {
    useAuthStore.setState({ session: 'sess-owner', account: owner });
    vi.mocked(peekSessionPhrase).mockReturnValue('current words');
    const { result } = await rendered();
    act(() => {
      result.current.onWords(WORDS);
    });
    expect(relockHeldShares).toHaveBeenCalledWith(
      'sess-owner',
      'acc_owner',
      WORDS,
      'current words',
    );
    useAuthStore.setState({ account: null });
  });

  it('passes no current words when the tab holds none, and starts nothing without an account', async () => {
    useAuthStore.setState({ session: 'sess-owner', account: owner });
    vi.mocked(peekSessionPhrase).mockReturnValue(null);
    const { result } = await rendered();
    act(() => {
      result.current.onWords(WORDS);
    });
    expect(relockHeldShares).toHaveBeenCalledWith('sess-owner', 'acc_owner', WORDS, null);
    vi.mocked(relockHeldShares).mockClear();
    useAuthStore.setState({ account: null });
    vi.mocked(peekSessionPhrase).mockReturnValue('current words');
    act(() => {
      result.current.onWords(WORDS);
    });
    expect(relockHeldShares).not.toHaveBeenCalled();
  });
});
