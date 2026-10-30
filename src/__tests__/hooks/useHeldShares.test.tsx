import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useHeldShares } from '@/hooks/useHeldShares';
import type { UseWalletPhraseResult } from '@/hooks/useWalletPhrase';
import type { Account } from '@/lib/api-types';
import type { HeldShare, HeldShares, KeepShareResult } from '@/lib/held-shares';
import { useAuthStore } from '@/stores/auth-store';

const mocks = vi.hoisted(() => ({
  deleteHeldShareBox: vi.fn(),
  heldShareBoxKey: vi.fn(),
  loadHeldShares: vi.fn(),
  keepHeldShare: vi.fn(),
  peekSessionPhrase: vi.fn(),
  settlePhraseDerivations: vi.fn(),
  showPhrase: vi.fn(),
  hidePhrase: vi.fn(),
  phrase: { words: [] as string[], status: 'idle', error: null as string | null },
}));

vi.mock('@/lib/api', () => ({ deleteHeldShareBox: mocks.deleteHeldShareBox }));
vi.mock('@/lib/held-share-box', () => ({ heldShareBoxKey: mocks.heldShareBoxKey }));
vi.mock('@/lib/held-shares', () => ({
  loadHeldShares: mocks.loadHeldShares,
  keepHeldShare: mocks.keepHeldShare,
}));
vi.mock('@/lib/tab-phrase', () => ({ peekSessionPhrase: mocks.peekSessionPhrase }));
vi.mock('@/lib/wallet/wallet-phrase', () => ({
  settlePhraseDerivations: mocks.settlePhraseDerivations,
}));
vi.mock(
  '@/hooks/useWalletPhrase',
  () =>
    ({
      useWalletPhrase: (): Partial<UseWalletPhraseResult> => ({
        words: mocks.phrase.words,
        status: mocks.phrase.status as UseWalletPhraseResult['status'],
        error: mocks.phrase.error as UseWalletPhraseResult['error'],
        showPhrase: mocks.showPhrase,
        hidePhrase: mocks.hidePhrase,
      }),
    }) satisfies Record<string, unknown>,
);

const WORDS = 'one two three four five six seven eight nine ten eleven twelve';
const KEY = { type: 'secret' } as unknown as CryptoKey;

const account: Account = {
  id: 'acc_hal',
  linkingKey: null,
  role: 'basis',
  name: 'Hal',
  username: 'hal',
  location: null,
  lightningAddress: null,
  lightningAddressVerified: false,
  forumLawsDismissed: false,
  createdAt: 1_700_000_000,
  rulesAgreedAt: 1_700_000_001,
  viewKey: 'a'.repeat(64),
  aboutMe: null,
  aboutMeHasPhoto: false,
  setup: null,
  missing: [],
};

/** A share of another set (identifier 7506). */
const OTHER_SET =
  'domain morning academic acid disease humidity peasant cleanup trend describe romp terminal should knit often alarm visitor tension universe peanut';

/**
 * A kept share.
 *
 * @param boxId - Box id.
 * @param username - Owner username.
 * @returns The share.
 */
function share(boxId: string, username: string): HeldShare {
  return {
    boxId,
    code: `21gifts-share:v1:acc_${username}:${username}:${OTHER_SET}`,
    ownerAccountId: `acc_${username}`,
    ownerUsername: username,
    identifier: 7506,
    memberIndex: 0,
  };
}

const BOB = share('b'.repeat(32), 'bob');
const CARA = share('c'.repeat(32), 'cara');

/**
 * Renders the hook with the words in tab memory and waits for the list.
 *
 * @param held - What the boxes give.
 * @returns The hook.
 */
async function ready(
  held: HeldShares = { shares: [BOB], lockedIds: [] },
): Promise<ReturnType<typeof renderHook<ReturnType<typeof useHeldShares>, unknown>>> {
  mocks.loadHeldShares.mockResolvedValue(held);
  const hook = renderHook(() => useHeldShares());
  await waitFor(() => {
    expect(hook.result.current.load).toBe('ready');
  });
  return hook;
}

beforeEach(() => {
  useAuthStore.setState({ session: 'sess', account });
  mocks.phrase.words = [];
  mocks.phrase.status = 'idle';
  mocks.phrase.error = null;
  mocks.deleteHeldShareBox.mockReset().mockResolvedValue(undefined);
  mocks.heldShareBoxKey.mockReset().mockResolvedValue(KEY);
  mocks.loadHeldShares.mockReset();
  mocks.keepHeldShare.mockReset();
  mocks.peekSessionPhrase.mockReset().mockReturnValue(WORDS);
  mocks.settlePhraseDerivations.mockReset().mockResolvedValue(undefined);
  mocks.showPhrase.mockReset().mockResolvedValue(undefined);
  mocks.hidePhrase.mockReset();
});

afterEach(() => {
  cleanup();
  useAuthStore.setState({ session: null, account: null });
});

describe('useHeldShares', () => {
  it('opens the boxes with the words in tab memory, without a passkey prompt', async () => {
    const { result } = await ready({ shares: [BOB, CARA], lockedIds: ['x'.repeat(32)] });
    expect(mocks.settlePhraseDerivations).toHaveBeenCalled();
    expect(mocks.heldShareBoxKey).toHaveBeenCalledWith(WORDS);
    expect(mocks.loadHeldShares).toHaveBeenCalledWith('sess', 'acc_hal', KEY);
    expect(mocks.showPhrase).not.toHaveBeenCalled();
    expect(result.current.shares).toEqual([BOB, CARA]);
    expect(result.current.lockedCount).toBe(1);
    expect(result.current.unlocking).toBe(false);
    expect(result.current.unlockError).toBeNull();
  });

  it('never reads another account with the key of the previous one', async () => {
    const { result } = await ready({ shares: [BOB], lockedIds: [] });
    let answer: (value: HeldShares) => void = () => undefined;
    mocks.loadHeldShares.mockReturnValue(
      new Promise<HeldShares>((resolve) => {
        answer = resolve;
      }),
    );
    act(() => {
      useAuthStore.setState({ session: 'sess-2', account: { ...account, id: 'acc_other' } });
    });
    expect(result.current.shares).toEqual([]);
    await waitFor(() => {
      expect(mocks.loadHeldShares).toHaveBeenLastCalledWith('sess-2', 'acc_other', KEY);
    });
    expect(mocks.heldShareBoxKey).toHaveBeenCalledTimes(2);
    await act(async () => {
      answer({ shares: [CARA], lockedIds: [] });
      await Promise.resolve();
    });
    expect(result.current.shares).toEqual([CARA]);
  });

  it('drops a key, a keep, and deletes that answer after the account changed', async () => {
    const OTHER = { ...account, id: 'acc_other' };
    const { result } = await ready({ shares: [BOB], lockedIds: ['x'.repeat(32), 'y'.repeat(32)] });
    let kept: (value: KeepShareResult) => void = () => undefined;
    mocks.keepHeldShare.mockReturnValue(
      new Promise<KeepShareResult>((resolve) => {
        kept = resolve;
      }),
    );
    let deleted: () => void = () => undefined;
    let refused: (reason: Error) => void = () => undefined;
    let lockedGone: () => void = () => undefined;
    mocks.deleteHeldShareBox
      .mockReturnValueOnce(
        new Promise<void>((resolve) => {
          deleted = resolve;
        }),
      )
      .mockReturnValueOnce(
        new Promise<void>((_, reject) => {
          refused = reject;
        }),
      )
      .mockReturnValueOnce(
        new Promise<void>((resolve) => {
          lockedGone = resolve;
        }),
      );
    act(() => {
      result.current.onScanResult(CARA.code);
      result.current.remove(BOB);
      result.current.remove(CARA);
      result.current.removeLocked();
    });
    let key: (value: CryptoKey) => void = () => undefined;
    mocks.heldShareBoxKey.mockReturnValueOnce(
      new Promise<CryptoKey>((resolve) => {
        key = resolve;
      }),
    );
    mocks.loadHeldShares.mockResolvedValue({ shares: [], lockedIds: [] });
    act(() => {
      useAuthStore.setState({ session: 'sess-2', account: OTHER });
    });
    await waitFor(() => {
      expect(mocks.heldShareBoxKey).toHaveBeenCalledTimes(2);
    });
    act(() => {
      useAuthStore.setState({ session: 'sess-3', account: { ...account, id: 'acc_third' } });
    });
    await waitFor(() => {
      expect(mocks.loadHeldShares).toHaveBeenLastCalledWith('sess-3', 'acc_third', KEY);
    });
    await act(async () => {
      key(KEY);
      kept({ ok: true, share: CARA });
      deleted();
      refused(new Error('Could not delete the share'));
      lockedGone();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(mocks.loadHeldShares).not.toHaveBeenCalledWith('sess-2', 'acc_other', KEY);
    expect(result.current.shares).toEqual([]);
    expect(result.current.lockedCount).toBe(0);
    expect(result.current.notice).toBeNull();
    expect(result.current.saving).toBe(false);
    expect(mocks.deleteHeldShareBox).not.toHaveBeenCalledWith('sess', 'y'.repeat(32));
  });

  it('drops a failed key of the previous account', async () => {
    mocks.loadHeldShares.mockResolvedValue({ shares: [], lockedIds: [] });
    let fail: (reason: Error) => void = () => undefined;
    mocks.heldShareBoxKey.mockReturnValueOnce(
      new Promise<CryptoKey>((_, reject) => {
        fail = reject;
      }),
    );
    const { result } = renderHook(() => useHeldShares());
    await waitFor(() => {
      expect(mocks.heldShareBoxKey).toHaveBeenCalledTimes(1);
    });
    act(() => {
      useAuthStore.setState({ session: 'sess-2', account: { ...account, id: 'acc_other' } });
    });
    await waitFor(() => {
      expect(result.current.load).toBe('ready');
    });
    await act(async () => {
      fail(new Error('bad words'));
      await Promise.resolve();
    });
    expect(result.current.load).toBe('ready');
  });

  it('leaves a box deleted here out of a read that was already running', async () => {
    const { result } = await ready({ shares: [BOB, CARA], lockedIds: ['x'.repeat(32)] });
    let answer: (value: HeldShares) => void = () => undefined;
    mocks.loadHeldShares.mockReturnValue(
      new Promise<HeldShares>((resolve) => {
        answer = resolve;
      }),
    );
    act(() => {
      result.current.reload();
    });
    await waitFor(() => {
      expect(mocks.loadHeldShares).toHaveBeenCalledTimes(2);
    });
    await act(async () => {
      result.current.remove(BOB);
      result.current.removeLocked();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    await act(async () => {
      answer({ shares: [BOB, CARA], lockedIds: ['x'.repeat(32)] });
      await Promise.resolve();
    });
    expect(result.current.shares).toEqual([CARA]);
    expect(result.current.lockedCount).toBe(0);
  });

  it('does nothing without a session or account', async () => {
    useAuthStore.setState({ session: null, account: null });
    const { result } = renderHook(() => useHeldShares());
    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current.load).toBe('opening');
    act(() => {
      result.current.scan();
      result.current.onScanResult('x');
      result.current.remove(BOB);
      result.current.removeLocked();
    });
    expect(result.current.view).toBe('list');
    expect(mocks.settlePhraseDerivations).not.toHaveBeenCalled();
    expect(mocks.keepHeldShare).not.toHaveBeenCalled();
    expect(mocks.deleteHeldShareBox).not.toHaveBeenCalled();
  });

  it('asks for the passkey when no words are in tab memory, and opens with the words it gives', async () => {
    mocks.peekSessionPhrase.mockReturnValue(null);
    mocks.loadHeldShares.mockResolvedValue({ shares: [], lockedIds: [] });
    mocks.phrase.status = 'busy';
    mocks.phrase.error = 'timeout';
    const { result, rerender } = renderHook(() => useHeldShares());
    await waitFor(() => {
      expect(result.current.load).toBe('unlock');
    });
    expect(result.current.unlocking).toBe(true);
    expect(result.current.unlockError).toBe('timeout');
    act(() => {
      result.current.unlock();
    });
    expect(mocks.showPhrase).not.toHaveBeenCalled();
    mocks.phrase.status = 'idle';
    rerender();
    act(() => {
      result.current.unlock();
    });
    expect(mocks.showPhrase).toHaveBeenCalledTimes(1);
    mocks.phrase.words = WORDS.split(' ');
    rerender();
    await waitFor(() => {
      expect(result.current.load).toBe('ready');
    });
    expect(mocks.hidePhrase).toHaveBeenCalled();
    expect(mocks.heldShareBoxKey).toHaveBeenCalledWith(WORDS);
  });

  it('derives no key when the passkey gives the words after the account left', async () => {
    mocks.peekSessionPhrase.mockReturnValue(null);
    const { result, rerender } = renderHook(() => useHeldShares());
    await waitFor(() => {
      expect(result.current.load).toBe('unlock');
    });
    act(() => {
      useAuthStore.setState({ session: null, account: null });
    });
    mocks.phrase.words = WORDS.split(' ');
    rerender();
    await act(async () => {
      await Promise.resolve();
    });
    expect(mocks.hidePhrase).toHaveBeenCalled();
    expect(mocks.heldShareBoxKey).not.toHaveBeenCalled();
  });

  it('reads nothing when the passkey gives the words after the session ended', async () => {
    mocks.peekSessionPhrase.mockReturnValue(null);
    const { result, rerender } = renderHook(() => useHeldShares());
    await waitFor(() => {
      expect(result.current.load).toBe('unlock');
    });
    act(() => {
      result.current.unlock();
      useAuthStore.setState({ session: null });
    });
    mocks.phrase.words = WORDS.split(' ');
    rerender();
    await waitFor(() => {
      expect(mocks.heldShareBoxKey).toHaveBeenCalledWith(WORDS);
    });
    await act(async () => {
      await Promise.resolve();
    });
    expect(mocks.loadHeldShares).not.toHaveBeenCalled();
  });

  it('drops the words of a passkey prompt started for the previous account, and hides them', async () => {
    mocks.peekSessionPhrase.mockReturnValue(null);
    const { result, rerender } = renderHook(() => useHeldShares());
    await waitFor(() => {
      expect(result.current.load).toBe('unlock');
    });
    act(() => {
      result.current.unlock();
    });
    act(() => {
      useAuthStore.setState({ session: 'sess-2', account: { ...account, id: 'acc_other' } });
    });
    await waitFor(() => {
      expect(result.current.load).toBe('unlock');
    });
    mocks.phrase.words = WORDS.split(' ');
    rerender();
    await act(async () => {
      await Promise.resolve();
    });
    expect(mocks.hidePhrase).toHaveBeenCalled();
    expect(mocks.heldShareBoxKey).not.toHaveBeenCalled();
    expect(result.current.load).toBe('unlock');
  });

  it('starts no passkey prompt without an account', () => {
    useAuthStore.setState({ session: null, account: null });
    const { result } = renderHook(() => useHeldShares());
    act(() => {
      result.current.unlock();
    });
    expect(mocks.showPhrase).not.toHaveBeenCalled();
  });

  it('adds a share kept here to a read that was already running, and keeps one share at a time', async () => {
    const { result } = await ready({ shares: [CARA], lockedIds: [] });
    let answer: (value: HeldShares) => void = () => undefined;
    mocks.loadHeldShares.mockReturnValue(
      new Promise<HeldShares>((resolve) => {
        answer = resolve;
      }),
    );
    act(() => {
      result.current.reload();
    });
    await waitFor(() => {
      expect(mocks.loadHeldShares).toHaveBeenCalledTimes(2);
    });
    let kept: (value: KeepShareResult) => void = () => undefined;
    mocks.keepHeldShare.mockReturnValue(
      new Promise<KeepShareResult>((resolve) => {
        kept = resolve;
      }),
    );
    act(() => {
      result.current.onScanResult(BOB.code);
      result.current.onScanResult(BOB.code);
    });
    expect(mocks.keepHeldShare).toHaveBeenCalledTimes(1);
    await act(async () => {
      kept({ ok: true, share: BOB });
      await Promise.resolve();
    });
    await act(async () => {
      answer({ shares: [CARA], lockedIds: [] });
      await Promise.resolve();
    });
    expect(result.current.shares).toEqual([BOB, CARA]);
  });

  it('reads with the newest key derivation when the session changes for the same account', async () => {
    mocks.loadHeldShares.mockResolvedValue({ shares: [CARA], lockedIds: [] });
    let first: (value: CryptoKey) => void = () => undefined;
    mocks.heldShareBoxKey.mockReturnValueOnce(
      new Promise<CryptoKey>((resolve) => {
        first = resolve;
      }),
    );
    const { result } = renderHook(() => useHeldShares());
    await waitFor(() => {
      expect(mocks.heldShareBoxKey).toHaveBeenCalledTimes(1);
    });
    act(() => {
      useAuthStore.setState({ session: 'sess-2' });
    });
    await waitFor(() => {
      expect(result.current.load).toBe('ready');
    });
    await act(async () => {
      first(KEY);
      await Promise.resolve();
    });
    expect(mocks.loadHeldShares).toHaveBeenCalledTimes(1);
    expect(mocks.loadHeldShares).toHaveBeenCalledWith('sess-2', 'acc_hal', KEY);
  });

  it('deletes the boxes that do not open once at a time', async () => {
    const { result } = await ready({ shares: [], lockedIds: ['x'.repeat(32)] });
    let gone: () => void = () => undefined;
    mocks.deleteHeldShareBox.mockReturnValueOnce(
      new Promise<void>((resolve) => {
        gone = resolve;
      }),
    );
    act(() => {
      result.current.removeLocked();
      result.current.removeLocked();
    });
    expect(mocks.deleteHeldShareBox).toHaveBeenCalledTimes(1);
    await act(async () => {
      gone();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(result.current.lockedCount).toBe(0);
    expect(result.current.notice).toBeNull();
  });

  it('ignores the tab-memory lookup of an unmounted page', async () => {
    let settle: () => void = () => undefined;
    mocks.settlePhraseDerivations.mockReturnValue(
      new Promise<void>((resolve) => {
        settle = resolve;
      }),
    );
    const { unmount } = renderHook(() => useHeldShares());
    unmount();
    await act(async () => {
      settle();
      await Promise.resolve();
    });
    expect(mocks.peekSessionPhrase).not.toHaveBeenCalled();
  });

  it('shows the load error when the words give no key or the boxes cannot be read, and Try again reads again', async () => {
    mocks.heldShareBoxKey.mockRejectedValueOnce(new Error('bad words'));
    const { result } = renderHook(() => useHeldShares());
    await waitFor(() => {
      expect(result.current.load).toBe('loadError');
    });
    mocks.loadHeldShares.mockRejectedValueOnce(new Error('Held shares are unavailable'));
    act(() => {
      result.current.reload();
    });
    await waitFor(() => {
      expect(mocks.loadHeldShares).toHaveBeenCalledTimes(1);
    });
    await waitFor(() => {
      expect(result.current.load).toBe('loadError');
    });
    mocks.loadHeldShares.mockResolvedValueOnce({ shares: [CARA], lockedIds: [] });
    act(() => {
      result.current.reload();
    });
    await waitFor(() => {
      expect(result.current.load).toBe('ready');
    });
    expect(mocks.heldShareBoxKey).toHaveBeenCalledTimes(2);
    expect(result.current.shares).toEqual([CARA]);
  });

  it('drops the answer of an older read', async () => {
    let first: (value: HeldShares) => void = () => undefined;
    let second: (reason: Error) => void = () => undefined;
    mocks.loadHeldShares
      .mockReturnValueOnce(
        new Promise<HeldShares>((resolve) => {
          first = resolve;
        }),
      )
      .mockReturnValueOnce(
        new Promise<HeldShares>((_, reject) => {
          second = reject;
        }),
      )
      .mockResolvedValueOnce({ shares: [CARA], lockedIds: [] });
    const { result } = renderHook(() => useHeldShares());
    await waitFor(() => {
      expect(mocks.loadHeldShares).toHaveBeenCalledTimes(1);
    });
    act(() => {
      result.current.reload();
    });
    await waitFor(() => {
      expect(mocks.loadHeldShares).toHaveBeenCalledTimes(2);
    });
    act(() => {
      result.current.reload();
    });
    await waitFor(() => {
      expect(result.current.load).toBe('ready');
    });
    await act(async () => {
      first({ shares: [BOB], lockedIds: [] });
      second(new Error('late'));
      await Promise.resolve();
    });
    expect(result.current.load).toBe('ready');
    expect(result.current.shares).toEqual([CARA]);
  });

  it('keeps a scanned share in a new box and lists it by username', async () => {
    const { result } = await ready({ shares: [CARA], lockedIds: [] });
    act(() => {
      result.current.scan();
    });
    expect(result.current.view).toBe('scan');
    let answer: (value: KeepShareResult) => void = () => undefined;
    mocks.keepHeldShare.mockReturnValue(
      new Promise<KeepShareResult>((resolve) => {
        answer = resolve;
      }),
    );
    act(() => {
      result.current.onScanResult(BOB.code);
    });
    expect(mocks.keepHeldShare).toHaveBeenCalledWith('sess', 'acc_hal', KEY, [CARA], BOB.code);
    expect(result.current.view).toBe('list');
    expect(result.current.saving).toBe(true);
    act(() => {
      result.current.scan();
    });
    expect(result.current.view).toBe('list');
    await act(async () => {
      answer({ ok: true, share: BOB });
      await Promise.resolve();
    });
    expect(result.current.saving).toBe(false);
    expect(result.current.notice).toEqual({ kind: 'stored', username: 'bob' });
    expect(result.current.shares).toEqual([BOB, CARA]);
  });

  it('says why a scanned share was not kept', async () => {
    const { result } = await ready();
    for (const [reason, kind] of [
      ['own', 'own'],
      ['duplicate', 'duplicate'],
      ['save', 'saveError'],
    ] as const) {
      mocks.keepHeldShare.mockResolvedValueOnce({ ok: false, reason });
      await act(async () => {
        result.current.onScanResult(BOB.code);
        await Promise.resolve();
      });
      expect(result.current.notice).toEqual({ kind, username: 'bob' });
    }
    mocks.keepHeldShare.mockResolvedValueOnce({ ok: false, reason: 'invalid' });
    await act(async () => {
      result.current.onScanResult('hello');
      await Promise.resolve();
    });
    expect(result.current.notice).toEqual({ kind: 'invalid' });
    expect(result.current.shares).toEqual([BOB]);
  });

  it('ignores a scan and Keep a share before the boxes are open', async () => {
    mocks.peekSessionPhrase.mockReturnValue(null);
    const { result } = renderHook(() => useHeldShares());
    await waitFor(() => {
      expect(result.current.load).toBe('unlock');
    });
    act(() => {
      result.current.scan();
      result.current.onScanResult(BOB.code);
    });
    expect(result.current.view).toBe('list');
    expect(mocks.keepHeldShare).not.toHaveBeenCalled();
  });

  it('shows a code, confirms and deletes a share, and keeps it when the api does not', async () => {
    const { result } = await ready({ shares: [BOB, CARA], lockedIds: [] });
    act(() => {
      result.current.showQr(BOB);
    });
    expect(result.current.view).toEqual({ qr: BOB });
    let stepped: boolean[] = [];
    act(() => {
      stepped = [result.current.back()];
    });
    act(() => {
      stepped.push(result.current.back());
    });
    expect(stepped).toEqual([true, false]);
    act(() => {
      result.current.askDelete(BOB);
    });
    expect(result.current.confirmDelete).toBe(BOB.boxId);
    act(() => {
      result.current.cancel();
    });
    expect(result.current.confirmDelete).toBeNull();
    mocks.deleteHeldShareBox.mockRejectedValueOnce(new Error('Could not delete the share'));
    await act(async () => {
      result.current.remove(BOB);
      await Promise.resolve();
    });
    expect(result.current.notice).toEqual({ kind: 'deleteError' });
    expect(result.current.shares).toEqual([BOB, CARA]);
    await act(async () => {
      result.current.remove(BOB);
      await Promise.resolve();
    });
    expect(mocks.deleteHeldShareBox).toHaveBeenLastCalledWith('sess', BOB.boxId);
    expect(result.current.notice).toBeNull();
    expect(result.current.shares).toEqual([CARA]);
  });

  it('confirms and deletes the boxes that do not open, keeping those the api did not delete', async () => {
    const { result } = await ready({ shares: [], lockedIds: ['x'.repeat(32), 'y'.repeat(32)] });
    act(() => {
      result.current.askDeleteLocked();
    });
    expect(result.current.confirmDeleteLocked).toBe(true);
    act(() => {
      result.current.askDelete(BOB);
    });
    expect(result.current.confirmDeleteLocked).toBe(false);
    expect(result.current.confirmDelete).toBe(BOB.boxId);
    act(() => {
      result.current.askDeleteLocked();
    });
    expect(result.current.confirmDeleteLocked).toBe(true);
    expect(result.current.confirmDelete).toBeNull();
    mocks.deleteHeldShareBox.mockRejectedValueOnce(new Error('Could not delete the share'));
    await act(async () => {
      result.current.removeLocked();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(mocks.deleteHeldShareBox).toHaveBeenCalledTimes(2);
    expect(mocks.deleteHeldShareBox).toHaveBeenCalledWith('sess', 'y'.repeat(32));
    expect(result.current.confirmDeleteLocked).toBe(false);
    expect(result.current.lockedCount).toBe(1);
    expect(result.current.notice).toEqual({ kind: 'deleteError' });
    await act(async () => {
      result.current.removeLocked();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(mocks.deleteHeldShareBox).toHaveBeenCalledTimes(3);
    expect(mocks.deleteHeldShareBox).toHaveBeenLastCalledWith('sess', 'x'.repeat(32));
    expect(result.current.lockedCount).toBe(0);
    expect(result.current.notice).toBeNull();
  });

  it('scanning or showing a code closes an open confirm and the notice', async () => {
    const { result } = await ready();
    /** Opens a notice and a confirm, then runs `step`, and checks all three are closed. */
    const closes = async (askLocked: boolean, step: () => void): Promise<void> => {
      mocks.keepHeldShare.mockResolvedValueOnce({ ok: false, reason: 'own' });
      await act(async () => {
        result.current.onScanResult(BOB.code);
        await Promise.resolve();
      });
      act(() => {
        if (askLocked) {
          result.current.askDeleteLocked();
        } else {
          result.current.askDelete(BOB);
        }
      });
      expect(result.current.notice).not.toBeNull();
      expect(result.current.confirmDelete !== null || result.current.confirmDeleteLocked).toBe(
        true,
      );
      act(step);
      expect(result.current.notice).toBeNull();
      expect(result.current.confirmDelete).toBeNull();
      expect(result.current.confirmDeleteLocked).toBe(false);
      act(() => {
        result.current.back();
      });
    };
    await closes(false, () => {
      result.current.scan();
    });
    await closes(true, () => {
      result.current.scan();
    });
    await closes(false, () => {
      result.current.showQr(BOB);
    });
    await closes(true, () => {
      result.current.showQr(BOB);
    });
  });
});
