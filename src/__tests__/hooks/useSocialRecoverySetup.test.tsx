import { act, cleanup, renderHook, waitFor, type RenderHookResult } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  useSocialRecoverySetup,
  type UseSocialRecoverySetupResult,
} from '@/hooks/useSocialRecoverySetup';
import { putRecoveryShare, RecoveryError } from '@/lib/api';
import type { Account } from '@/lib/api-types';
import {
  parseShareCode,
  phraseFromShareCodes,
  splitPhrase,
  type ShareCode,
} from '@/lib/recovery-share-code';
import { parseShare } from '@/lib/slip39';
import { clearSessionPhrase, rememberSessionPhrase } from '@/lib/tab-phrase';
import { ensureWalletConnected } from '@/lib/wallet/wallet-service';
import { useAuthStore } from '@/stores/auth-store';

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return { ...actual, putRecoveryShare: vi.fn() };
});
vi.mock('@/lib/wallet/wallet-service', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/wallet/wallet-service')>();
  return { ...actual, ensureWalletConnected: vi.fn() };
});
vi.mock('@/lib/recovery-share-code', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/recovery-share-code')>();
  return { ...actual, splitPhrase: vi.fn(actual.splitPhrase) };
});

/** Public BIP-39 test phrase: the open wallet's 12 words. */
const PHRASE = 'legal winner thank year wave sausage worth useful legal winner thank yellow';

/** The public BIP-39 test phrase the screenshot pins split. */
const FIXTURE_PHRASE =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';

/** The verified wallet key of the owner. */
const KEY = `02${'a'.repeat(64)}`;

const SESSION = 'sess-owner';

/** The rendered hook. */
type Rendered = RenderHookResult<UseSocialRecoverySetupResult, unknown>;
const ORIGINAL_E2E_NOW = process.env.NEXT_PUBLIC_E2E_NOW;
const originalHref = window.location.href;

/**
 * The signed-in owner.
 *
 * @param overrides - Fields to change.
 * @returns The account.
 */
function owner(overrides: Partial<Account> = {}): Account {
  return {
    id: 'acc_owner',
    linkingKey: null,
    role: 'basis',
    name: 'Ada',
    username: 'ada',
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
    walletRequired: true,
    passkeyCredentialId: 'cred-seed',
    sparkPubkey: KEY,
    sparkWalletVerified: true,
    socialRecoverySetUp: false,
    ...overrides,
  };
}

/**
 * A promise to settle by hand.
 *
 * @returns The promise and its settlers.
 */
function deferred<T>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason: unknown) => void;
} {
  let resolve: (value: T) => void = () => undefined;
  let reject: (reason: unknown) => void = () => undefined;
  const promise = new Promise<T>((settle, fail) => {
    resolve = settle;
    reject = fail;
  });
  return { promise, resolve, reject };
}

/**
 * Reads a shown code.
 *
 * @param code - The QR payload.
 * @returns Its fields.
 */
function read(code: string): ShareCode {
  const parsed = parseShareCode(code);
  if (parsed === null) {
    throw new Error('not a share code');
  }
  return parsed;
}

/**
 * Renders the hook and presses **Continue** until person 1's code shows.
 *
 * @returns The rendered hook.
 */
async function toShare1(): Promise<Rendered> {
  const hook = renderHook(() => useSocialRecoverySetup());
  act(() => {
    hook.result.current.start();
  });
  await waitFor(() => {
    expect(hook.result.current.step).toBe('share1');
  });
  return hook;
}

beforeEach(() => {
  delete process.env.NEXT_PUBLIC_E2E_NOW;
  window.history.replaceState({}, '', '/settings/social-recovery');
  rememberSessionPhrase(PHRASE);
  useAuthStore.setState({ session: SESSION, account: owner() });
  vi.mocked(ensureWalletConnected).mockReset().mockResolvedValue(KEY);
  vi.mocked(putRecoveryShare)
    .mockReset()
    .mockResolvedValue(owner({ socialRecoverySetUp: true }));
  vi.mocked(splitPhrase).mockClear();
});

afterEach(() => {
  cleanup();
  clearSessionPhrase();
  useAuthStore.setState({ session: null, account: null });
  window.history.replaceState({}, '', originalHref);
  if (ORIGINAL_E2E_NOW === undefined) {
    delete process.env.NEXT_PUBLIC_E2E_NOW;
  } else {
    process.env.NEXT_PUBLIC_E2E_NOW = ORIGINAL_E2E_NOW;
  }
});

describe('useSocialRecoverySetup', () => {
  it('starts on the intro with nothing split', () => {
    const { result } = renderHook(() => useSocialRecoverySetup());
    expect(result.current).toMatchObject({
      step: 'intro',
      error: null,
      codes: null,
      identifier: null,
    });
    expect(result.current.back()).toBe(false);
    expect(splitPhrase).not.toHaveBeenCalled();
  });

  it('checks the open wallet, then shows the codes of person 1 and 2 of one new set', async () => {
    const { result } = renderHook(() => useSocialRecoverySetup());
    act(() => {
      result.current.start();
    });
    expect(result.current.step).toBe('checking');
    expect(result.current.back()).toBe(false);
    await waitFor(() => {
      expect(result.current.step).toBe('share1');
    });
    expect(ensureWalletConnected).toHaveBeenCalledTimes(1);
    expect(splitPhrase).toHaveBeenCalledWith(PHRASE, undefined);
    const codes = result.current.codes!;
    const first = read(codes[0]);
    const second = read(codes[1]);
    expect(first).toMatchObject({
      ownerAccountId: 'acc_owner',
      ownerUsername: 'ada',
      memberIndex: 0,
      identifier: result.current.identifier,
    });
    expect(second).toMatchObject({ memberIndex: 1, identifier: result.current.identifier });
    await expect(phraseFromShareCodes(first, second)).resolves.toBe(PHRASE);
    expect(putRecoveryShare).not.toHaveBeenCalled();
  });

  it('accepts the wallet key in any letter case', async () => {
    vi.mocked(ensureWalletConnected).mockResolvedValue(KEY.toUpperCase());
    const { result } = await toShare1();
    expect(result.current.error).toBeNull();
  });

  it('stops with wallet when the tab holds no words, without opening the wallet', () => {
    clearSessionPhrase();
    const { result } = renderHook(() => useSocialRecoverySetup());
    act(() => {
      result.current.start();
    });
    expect(result.current).toMatchObject({ step: 'checking', error: 'wallet', codes: null });
    expect(ensureWalletConnected).not.toHaveBeenCalled();
    expect(result.current.back()).toBe(false);
  });

  it('stops with wallet when the wallet does not open, and Try again checks again', async () => {
    vi.mocked(ensureWalletConnected).mockRejectedValueOnce(new Error('wallet-connect'));
    const { result } = renderHook(() => useSocialRecoverySetup());
    act(() => {
      result.current.start();
    });
    await waitFor(() => {
      expect(result.current.error).toBe('wallet');
    });
    act(() => {
      result.current.retry();
    });
    await waitFor(() => {
      expect(result.current.step).toBe('share1');
    });
    expect(ensureWalletConnected).toHaveBeenCalledTimes(2);
  });

  it.each([
    ['another wallet is open', owner(), `03${'b'.repeat(64)}`],
    ['the wallet is not verified', owner({ sparkWalletVerified: false }), KEY],
    ['the account has no wallet key', owner({ sparkPubkey: null }), KEY],
  ] as const)('stops with mismatch when %s', async (_label, account, identity) => {
    useAuthStore.setState({ account });
    vi.mocked(ensureWalletConnected).mockResolvedValue(identity);
    const { result } = renderHook(() => useSocialRecoverySetup());
    act(() => {
      result.current.start();
    });
    await waitFor(() => {
      expect(result.current.error).toBe('mismatch');
    });
    expect(result.current.codes).toBeNull();
    expect(splitPhrase).not.toHaveBeenCalled();
    act(() => {
      result.current.retry();
    });
    expect(result.current.error).toBe('mismatch');
    expect(ensureWalletConnected).toHaveBeenCalledTimes(1);
    expect(result.current.back()).toBe(false);
  });

  it('stops with mismatch when the account is gone once the wallet answers', async () => {
    const opened = deferred<string>();
    vi.mocked(ensureWalletConnected).mockReturnValue(opened.promise);
    const { result } = renderHook(() => useSocialRecoverySetup());
    act(() => {
      result.current.start();
    });
    useAuthStore.setState({ account: null });
    await act(async () => {
      opened.resolve(KEY);
      await opened.promise;
    });
    await waitFor(() => {
      expect(result.current.error).toBe('mismatch');
    });
  });

  it('stops with wallet when the split fails', async () => {
    vi.mocked(splitPhrase).mockRejectedValueOnce(new Error('Recovery split check failed'));
    const { result } = renderHook(() => useSocialRecoverySetup());
    act(() => {
      result.current.start();
    });
    await waitFor(() => {
      expect(result.current.error).toBe('wallet');
    });
    expect(result.current.codes).toBeNull();
  });

  it('stops with wallet when no code can be built (no username)', async () => {
    useAuthStore.setState({ account: owner({ username: null }) });
    const { result } = renderHook(() => useSocialRecoverySetup());
    act(() => {
      result.current.start();
    });
    await waitFor(() => {
      expect(result.current.error).toBe('wallet');
    });
  });

  it('steps person 1 → person 2 with Scanned, and back with the arrow to the intro', async () => {
    const { result } = await toShare1();
    const codes = result.current.codes;
    act(() => {
      result.current.scanned();
    });
    expect(result.current.step).toBe('share2');
    expect(result.current.codes).toBe(codes);
    let stepped = false;
    act(() => {
      stepped = result.current.back();
    });
    expect(stepped).toBe(true);
    expect(result.current.step).toBe('share1');
    expect(result.current.codes).toBe(codes);
    act(() => {
      stepped = result.current.back();
    });
    expect(stepped).toBe(true);
    expect(result.current).toMatchObject({ step: 'intro', codes: null, identifier: null });
    expect(result.current.back()).toBe(false);
    act(() => {
      result.current.scanned();
      result.current.resplit();
    });
    expect(result.current.step).toBe('intro');
    expect(splitPhrase).toHaveBeenCalledTimes(1);
  });

  it('starts again with new codes from the same words', async () => {
    const { result } = await toShare1();
    act(() => {
      result.current.scanned();
    });
    const before = result.current.codes!;
    act(() => {
      result.current.resplit();
    });
    expect(result.current).toMatchObject({ step: 'checking', codes: null });
    await waitFor(() => {
      expect(result.current.step).toBe('share1');
    });
    expect(splitPhrase).toHaveBeenCalledTimes(2);
    expect(vi.mocked(splitPhrase).mock.calls[1]).toEqual([PHRASE, undefined]);
    const after = result.current.codes!;
    expect(after).not.toEqual(before);
    await expect(phraseFromShareCodes(read(after[0]), read(after[1]))).resolves.toBe(PHRASE);
    expect(ensureWalletConnected).toHaveBeenCalledTimes(1);
  });

  it('uploads the 21.gifts share of the same set after person 2 and stores the account', async () => {
    const { result } = await toShare1();
    const first = read(result.current.codes![0]);
    act(() => {
      result.current.scanned();
    });
    act(() => {
      result.current.scanned();
    });
    expect(result.current).toMatchObject({ step: 'saving', codes: null, identifier: null });
    expect(result.current.back()).toBe(false);
    await waitFor(() => {
      expect(result.current.step).toBe('done');
    });
    expect(putRecoveryShare).toHaveBeenCalledTimes(1);
    const [session, body] = vi.mocked(putRecoveryShare).mock.calls[0]!;
    expect(session).toBe(SESSION);
    expect(body.sparkPubkey).toBe(KEY);
    const third = parseShare(body.share);
    expect(third.memberIndex).toBe(2);
    expect(third.identifier).toBe(first.identifier);
    await expect(
      phraseFromShareCodes(first, {
        ...first,
        share: body.share,
        memberIndex: 2,
      }),
    ).resolves.toBe(PHRASE);
    expect(useAuthStore.getState().account?.socialRecoverySetUp).toBe(true);
    expect(result.current.back()).toBe(false);
  });

  it.each([
    ['an unavailable api', new RecoveryError('unavailable')],
    ['a failed request', new Error('Failed to fetch')],
  ])('keeps the share after %s, and Try again uploads it again', async (_label, failure) => {
    vi.mocked(putRecoveryShare).mockRejectedValueOnce(failure);
    const { result } = await toShare1();
    act(() => {
      result.current.scanned();
    });
    act(() => {
      result.current.scanned();
    });
    await waitFor(() => {
      expect(result.current.error).toBe('save');
    });
    expect(result.current.back()).toBe(false);
    act(() => {
      result.current.scanned();
    });
    expect(putRecoveryShare).toHaveBeenCalledTimes(1);
    act(() => {
      result.current.retry();
    });
    expect(result.current).toMatchObject({ step: 'saving', error: null });
    await waitFor(() => {
      expect(result.current.step).toBe('done');
    });
    const calls = vi.mocked(putRecoveryShare).mock.calls;
    expect(calls).toHaveLength(2);
    expect(calls[1]).toEqual(calls[0]);
  });

  it('stops with changed on a 409, and Try again returns to the intro without the shares', async () => {
    vi.mocked(putRecoveryShare).mockRejectedValueOnce(new RecoveryError('key_in_use'));
    const { result } = await toShare1();
    act(() => {
      result.current.scanned();
    });
    act(() => {
      result.current.scanned();
    });
    await waitFor(() => {
      expect(result.current.error).toBe('changed');
    });
    act(() => {
      result.current.retry();
    });
    expect(result.current).toMatchObject({ step: 'intro', error: null, codes: null });
    act(() => {
      result.current.resplit();
    });
    expect(result.current.step).toBe('intro');
    expect(putRecoveryShare).toHaveBeenCalledTimes(1);
  });

  it('gives save without a request when the session is gone', async () => {
    const { result } = await toShare1();
    act(() => {
      result.current.scanned();
    });
    useAuthStore.setState({ session: null });
    act(() => {
      result.current.scanned();
    });
    expect(result.current.error).toBe('save');
    expect(putRecoveryShare).not.toHaveBeenCalled();
  });

  it('does not store the answer on another session', async () => {
    const stored = deferred<Account>();
    vi.mocked(putRecoveryShare).mockReturnValueOnce(stored.promise);
    const { result } = await toShare1();
    act(() => {
      result.current.scanned();
    });
    act(() => {
      result.current.scanned();
    });
    useAuthStore.setState({ session: 'sess-other' });
    await act(async () => {
      stored.resolve(owner({ socialRecoverySetUp: true }));
      await stored.promise;
    });
    await waitFor(() => {
      expect(result.current.step).toBe('done');
    });
    expect(useAuthStore.getState().account?.socialRecoverySetUp).toBe(false);
  });

  it('drops a wallet answer after leaving the page', async () => {
    const opened = deferred<string>();
    vi.mocked(ensureWalletConnected).mockReturnValueOnce(opened.promise);
    const { result, unmount } = renderHook(() => useSocialRecoverySetup());
    act(() => {
      result.current.start();
    });
    unmount();
    await act(async () => {
      opened.resolve(KEY);
      await opened.promise;
    });
    expect(splitPhrase).not.toHaveBeenCalled();
  });

  it('drops a failed wallet open after leaving the page', async () => {
    const opened = deferred<string>();
    vi.mocked(ensureWalletConnected).mockReturnValueOnce(opened.promise);
    const { result, unmount } = renderHook(() => useSocialRecoverySetup());
    act(() => {
      result.current.start();
    });
    unmount();
    await act(async () => {
      opened.reject(new Error('wallet-connect'));
      await opened.promise.catch(() => undefined);
    });
    expect(result.current.step).toBe('checking');
  });

  it.each(['resolves', 'rejects'] as const)(
    'drops a split that %s after leaving the page, and keeps nothing to upload',
    async (outcome) => {
      const splitting = deferred<Awaited<ReturnType<typeof splitPhrase>>>();
      vi.mocked(splitPhrase).mockReturnValueOnce(splitting.promise);
      const { result, unmount } = renderHook(() => useSocialRecoverySetup());
      act(() => {
        result.current.start();
      });
      await waitFor(() => {
        expect(splitPhrase).toHaveBeenCalledTimes(1);
      });
      unmount();
      await act(async () => {
        if (outcome === 'resolves') {
          splitting.resolve({
            identifier: 1,
            shares: [
              'body lily academic acid acne violence volume package glen escape prospect wealthy gesture venture legal already activity raspy camera easel',
              'body lily academic agency domain sugar learn owner kitchen exhaust aircraft sled fused dragon froth argue traveler reunion library geology',
              'body lily academic always demand practice cage cultural frequent elegant style metric frozen jacket fawn advance fitness coding elephant frozen',
            ],
          });
        } else {
          splitting.reject(new Error('Recovery split check failed'));
        }
        await splitting.promise.catch(() => undefined);
      });
      expect(result.current.step).toBe('checking');
      act(() => {
        result.current.resplit();
      });
      expect(splitPhrase).toHaveBeenCalledTimes(1);
    },
  );

  it.each(['resolves', 'rejects'] as const)(
    'drops an upload that %s after leaving the page; a stored share still updates the account',
    async (outcome) => {
      const stored = deferred<Account>();
      vi.mocked(putRecoveryShare).mockReturnValueOnce(stored.promise);
      const { result, unmount } = await toShare1();
      act(() => {
        result.current.scanned();
      });
      act(() => {
        result.current.scanned();
      });
      unmount();
      await act(async () => {
        if (outcome === 'resolves') {
          stored.resolve(owner({ socialRecoverySetUp: true }));
        } else {
          stored.reject(new RecoveryError('key_in_use'));
        }
        await stored.promise.catch(() => undefined);
      });
      expect(result.current.step).toBe('saving');
      expect(useAuthStore.getState().account?.socialRecoverySetUp).toBe(outcome === 'resolves');
    },
  );

  it('uploads nothing once the page is left', async () => {
    const { result, unmount } = await toShare1();
    act(() => {
      result.current.scanned();
    });
    const { scanned } = result.current;
    unmount();
    scanned();
    expect(putRecoveryShare).not.toHaveBeenCalled();
  });
});

describe('useSocialRecoverySetup screenshot pins', () => {
  /**
   * Opens the setup with a `?visual=` pin.
   *
   * @param pin - The pin name.
   * @param playwright - Whether this is a Playwright build.
   * @returns The rendered hook.
   */
  function pinned(pin: string, playwright = true): Rendered {
    if (playwright) {
      process.env.NEXT_PUBLIC_E2E_NOW = '2026-01-07T12:00:00.000Z';
    }
    window.history.replaceState({}, '', `/settings/social-recovery?visual=${pin}`);
    return renderHook(() => useSocialRecoverySetup());
  }

  it.each(['sr-share-1', 'sr-share-2'] as const)(
    '%s shows a fixed split of the fixture words',
    async (pin) => {
      const { result } = pinned(pin);
      await waitFor(() => {
        expect(result.current.codes).not.toBeNull();
      });
      expect(result.current.step).toBe(pin === 'sr-share-1' ? 'share1' : 'share2');
      const codes = result.current.codes!;
      await expect(phraseFromShareCodes(read(codes[0]), read(codes[1]))).resolves.toBe(
        FIXTURE_PHRASE,
      );
      cleanup();
      const again = pinned(pin);
      await waitFor(() => {
        expect(again.result.current.codes).toEqual(codes);
      });
      expect(splitPhrase).toHaveBeenCalledWith(FIXTURE_PHRASE, expect.any(Function));
    },
  );

  it.each([
    ['sr-checking', 'checking', null],
    ['sr-done', 'done', null],
    ['sr-mismatch', 'checking', 'mismatch'],
    ['sr-save-error', 'saving', 'save'],
  ] as const)('%s opens on %s with error %s and no code', async (pin, step, error) => {
    const { result } = pinned(pin);
    await waitFor(() => {
      expect(result.current).toMatchObject({ step, error, codes: null, identifier: null });
    });
  });

  it('sr-save-error uploads the fixture share of 21.gifts with the account key on Try again', async () => {
    const { result } = pinned('sr-save-error');
    await waitFor(() => {
      expect(result.current.error).toBe('save');
    });
    act(() => {
      result.current.retry();
    });
    await waitFor(() => {
      expect(result.current.step).toBe('done');
    });
    const [session, body] = vi.mocked(putRecoveryShare).mock.calls[0]!;
    expect(session).toBe(SESSION);
    expect(body.sparkPubkey).toBe(KEY);
    expect(parseShare(body.share).memberIndex).toBe(2);
  });

  it('builds the fixture without a wallet key or username as the account has them', async () => {
    useAuthStore.setState({ account: owner({ sparkPubkey: null, username: null }) });
    const { result } = pinned('sr-share-1');
    await waitFor(() => {
      expect(result.current.error).toBe('wallet');
    });
  });

  it('ignores an unknown pin and a pin without an account', async () => {
    const unknown = pinned('sr-unknown');
    useAuthStore.setState({ account: null });
    const missing = pinned('sr-share-1');
    await act(async () => {
      await Promise.resolve();
    });
    expect(unknown.result.current.step).toBe('intro');
    expect(missing.result.current.step).toBe('intro');
    expect(splitPhrase).not.toHaveBeenCalled();
  });

  it.each(['sr-checking', 'sr-share-1', 'sr-share-2', 'sr-done', 'sr-mismatch', 'sr-save-error'])(
    'ignores %s in a production build',
    async (pin) => {
      const { result } = pinned(pin, false);
      await act(async () => {
        await Promise.resolve();
      });
      expect(result.current).toMatchObject({ step: 'intro', error: null, codes: null });
      expect(splitPhrase).not.toHaveBeenCalled();
    },
  );

  it('drops the fixture split after leaving the page', async () => {
    const splitting = deferred<Awaited<ReturnType<typeof splitPhrase>>>();
    vi.mocked(splitPhrase).mockReturnValueOnce(splitting.promise);
    const { result, unmount } = pinned('sr-share-1');
    unmount();
    await act(async () => {
      splitting.reject(new Error('Recovery split check failed'));
      await splitting.promise.catch(() => undefined);
    });
    expect(result.current.step).toBe('intro');
  });
});
