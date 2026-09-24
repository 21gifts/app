import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearSessionPhrase,
  peekSessionPhrase,
  rememberSessionPhrase,
  resetWalletCeremonyLock,
  useWalletPhrase,
} from '@/hooks/useWalletPhrase';
import { fetchMe, finishPasskeySeed, postWalletBackupSeen, startPasskeySeed } from '@/lib/api';
import { obtainPrfFirst, obtainPrfFirstFromGet, mnemonicFromPrfFirst } from '@/lib/prf-mnemonic';
import { creationOptionsFromJSON } from '@/lib/webauthn-browser';
import { useAuthStore } from '@/stores/auth-store';

vi.mock('@/lib/api', () => ({
  startPasskeySeed: vi.fn(),
  finishPasskeySeed: vi.fn(),
  fetchMe: vi.fn(),
  postWalletBackupSeen: vi.fn(),
}));

vi.mock('@/lib/prf-mnemonic', () => ({
  classifyWebAuthnError: vi.fn((err: unknown) => {
    if (err && typeof err === 'object' && 'name' in err) {
      const name = String((err as { name: string }).name);
      if (name === 'TimeoutError' || name === 'AbortError') {
        return 'timeout';
      }
      if (name === 'NotAllowedError') {
        return 'cancel';
      }
    }
    return 'generic';
  }),
  obtainPrfFirst: vi.fn(),
  obtainPrfFirstFromGet: vi.fn(),
  mnemonicFromPrfFirst: vi.fn(),
  prfEvalFirstSalt: vi.fn().mockResolvedValue(new Uint8Array(32).fill(1)),
}));

vi.mock('@/lib/webauthn-browser', () => ({
  creationOptionsFromJSON: vi.fn().mockReturnValue({ challenge: new ArrayBuffer(1) }),
  credentialToJSON: vi.fn().mockReturnValue({ id: 'cred' }),
  base64UrlToBytes: vi.fn((value: string) => new TextEncoder().encode(value)),
}));

const account = {
  id: 'acc_1',
  linkingKey: null as string | null,
  role: 'basis' as const,
  name: null as string | null,
  location: null as string | null,
  lightningAddress: null as string | null,
  lightningAddressVerified: false,
  forumLawsDismissed: false,
  createdAt: 1,
  rulesAgreedAt: null as number | null,
  viewKey: 'a'.repeat(64),
  aboutMe: null,
  aboutMeHasPhoto: false,
  setup: null as 'wallet' | 'name' | null,
  missing: [] as ('wallet' | 'name' | 'username' | 'lightning-address' | 'rules')[],
  passkeyCredentialId: null as string | null,
};

const seededAccount = {
  ...account,
  passkeyCredentialId: 'cred-owner',
};

const mnemonic =
  'abandon ability able about above absent absorb abstract absurd abuse access accident';

const originalHref = window.location.href;

beforeEach(() => {
  clearSessionPhrase();
  resetWalletCeremonyLock();
  useAuthStore.setState({ session: 'tok', account });
  vi.mocked(startPasskeySeed)
    .mockReset()
    .mockResolvedValue({
      challengeId: 'ch',
      options: { challenge: 'aa' },
    });
  vi.mocked(finishPasskeySeed)
    .mockReset()
    .mockResolvedValue({
      ...account,
      passkeyCredentialId: 'seed-from-api',
    });
  vi.mocked(fetchMe).mockReset().mockResolvedValue(null);
  vi.mocked(postWalletBackupSeen).mockReset();
  vi.mocked(obtainPrfFirst).mockReset().mockResolvedValue(new Uint8Array(32).fill(7));
  vi.mocked(obtainPrfFirstFromGet).mockReset().mockResolvedValue(new Uint8Array(32).fill(7));
  vi.mocked(mnemonicFromPrfFirst).mockReset().mockResolvedValue(mnemonic);
  vi.stubGlobal('navigator', {
    ...navigator,
    credentials: {
      create: vi.fn().mockResolvedValue({ id: 'cred', type: 'public-key' }),
      get: vi.fn(),
    },
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.history.replaceState({}, '', originalHref);
});

describe('session phrase helpers', () => {
  it('remembers, peeks, and clears tab RAM', () => {
    rememberSessionPhrase(mnemonic);
    expect(peekSessionPhrase()).toBe(mnemonic);
    clearSessionPhrase();
    expect(peekSessionPhrase()).toBeNull();
  });
});

describe('useWalletPhrase', () => {
  it('adds a seed, shows the words, and does not keep them in tab RAM', async () => {
    const { result } = renderHook(() => useWalletPhrase());
    expect(result.current.view).toBe('activate');
    await act(async () => {
      await result.current.activate();
    });
    expect(startPasskeySeed).toHaveBeenCalledWith('tok');
    expect(finishPasskeySeed).toHaveBeenCalled();
    expect(postWalletBackupSeen).not.toHaveBeenCalled();
    expect(result.current.words).toHaveLength(12);
    expect(peekSessionPhrase()).toBeNull();
  });

  it('keeps the seed account when word derivation throws', async () => {
    vi.mocked(mnemonicFromPrfFirst).mockRejectedValueOnce(new Error('boom'));
    const { result } = renderHook(() => useWalletPhrase());
    await act(async () => {
      await result.current.activate();
    });
    expect(finishPasskeySeed).toHaveBeenCalled();
    expect(useAuthStore.getState().account?.passkeyCredentialId).toBe('seed-from-api');
    expect(result.current.words).toEqual([]);
    expect(result.current.error).toBe('generic');
  });

  it('loads the seed from the server when finish fails after it was stored', async () => {
    vi.mocked(finishPasskeySeed).mockRejectedValueOnce(
      new Error('Failed to finish passkey seed: 500'),
    );
    vi.mocked(fetchMe).mockResolvedValueOnce({
      ...account,
      passkeyCredentialId: 'seed-from-server',
    });
    const { result } = renderHook(() => useWalletPhrase());
    await act(async () => {
      await result.current.activate();
    });
    expect(result.current.error).toBeNull();
    expect(result.current.status).toBe('idle');
    expect(useAuthStore.getState().account?.passkeyCredentialId).toBe('seed-from-server');
  });

  it('does not finish seed when PRF is missing', async () => {
    vi.mocked(obtainPrfFirst).mockResolvedValueOnce(null);
    const { result } = renderHook(() => useWalletPhrase());
    await act(async () => {
      await result.current.activate();
    });
    expect(finishPasskeySeed).not.toHaveBeenCalled();
    expect(result.current.error).toBe('prfUnsupported');
  });

  it('maps seed begin 409 to generic and does not finish', async () => {
    vi.mocked(startPasskeySeed).mockRejectedValueOnce(
      new Error('Failed to start passkey seed: 409'),
    );
    const { result } = renderHook(() => useWalletPhrase());
    await act(async () => {
      await result.current.activate();
    });
    expect(finishPasskeySeed).not.toHaveBeenCalled();
    expect(result.current.error).toBe('generic');
  });

  it('stores the api passkeyCredentialId even when it differs from credential.id', async () => {
    const { result } = renderHook(() => useWalletPhrase());
    await act(async () => {
      await result.current.activate();
    });
    expect(useAuthStore.getState().account?.passkeyCredentialId).toBe('seed-from-api');
  });

  it('is a no-op when the session is missing', async () => {
    useAuthStore.setState({ session: null, account });
    const { result } = renderHook(() => useWalletPhrase());
    await act(async () => {
      await result.current.activate();
      await result.current.showPhrase();
    });
    expect(startPasskeySeed).not.toHaveBeenCalled();
    expect(postWalletBackupSeen).not.toHaveBeenCalled();
    expect(obtainPrfFirstFromGet).not.toHaveBeenCalled();
  });

  it('returns to idle when create yields no credential', async () => {
    vi.stubGlobal('navigator', {
      ...navigator,
      credentials: { create: vi.fn().mockResolvedValue(null), get: vi.fn() },
    });
    const { result } = renderHook(() => useWalletPhrase());
    await act(async () => {
      await result.current.activate();
    });
    expect(result.current.status).toBe('idle');
    expect(finishPasskeySeed).not.toHaveBeenCalled();
  });

  it('showPhrase errors when the account has no passkey credential id', async () => {
    useAuthStore.setState({ session: 'tok', account: { ...account, passkeyCredentialId: null } });
    const { result } = renderHook(() => useWalletPhrase());
    await act(async () => {
      await result.current.showPhrase();
    });
    expect(obtainPrfFirstFromGet).not.toHaveBeenCalled();
    expect(startPasskeySeed).not.toHaveBeenCalled();
    expect(result.current.error).toBe('generic');
    expect(result.current.status).toBe('error');
  });

  it('showPhrase errors when the credential id is empty', async () => {
    useAuthStore.setState({ session: 'tok', account: { ...account, passkeyCredentialId: '' } });
    const { result } = renderHook(() => useWalletPhrase());
    await act(async () => {
      await result.current.showPhrase();
    });
    expect(obtainPrfFirstFromGet).not.toHaveBeenCalled();
    expect(result.current.error).toBe('generic');
  });

  it('showPhrase errors when the credential id is omitted', async () => {
    const { passkeyCredentialId: _omitted, ...withoutId } = account;
    void _omitted;
    useAuthStore.setState({ session: 'tok', account: withoutId });
    const { result } = renderHook(() => useWalletPhrase());
    await act(async () => {
      await result.current.showPhrase();
    });
    expect(obtainPrfFirstFromGet).not.toHaveBeenCalled();
    expect(result.current.error).toBe('generic');
  });

  it('showPhrase derives words from get() and does not create or seed', async () => {
    useAuthStore.setState({ session: 'tok', account: seededAccount });
    const { result } = renderHook(() => useWalletPhrase());
    await act(async () => {
      await result.current.showPhrase();
    });
    expect(Array.from(vi.mocked(obtainPrfFirstFromGet).mock.calls[0]?.[0] ?? [])).toEqual(
      Array.from(new TextEncoder().encode('cred-owner')),
    );
    expect(startPasskeySeed).not.toHaveBeenCalled();
    expect(navigator.credentials.create).not.toHaveBeenCalled();
    expect(result.current.words).toHaveLength(12);
    expect(peekSessionPhrase()).toBeNull();
  });

  it('showPhrase records prfUnsupported when get has no PRF', async () => {
    useAuthStore.setState({ session: 'tok', account: seededAccount });
    vi.mocked(obtainPrfFirstFromGet).mockResolvedValueOnce(null);
    const { result } = renderHook(() => useWalletPhrase());
    await act(async () => {
      await result.current.showPhrase();
    });
    expect(result.current.error).toBe('prfUnsupported');
  });

  it('showPhrase fail maps cancel to idle', async () => {
    useAuthStore.setState({ session: 'tok', account: seededAccount });
    vi.mocked(obtainPrfFirstFromGet).mockRejectedValueOnce(
      Object.assign(new Error('denied'), { name: 'NotAllowedError' }),
    );
    const { result } = renderHook(() => useWalletPhrase());
    await act(async () => {
      await result.current.showPhrase();
    });
    expect(result.current.status).toBe('idle');
    expect(result.current.error).toBeNull();
  });

  it('activate fail maps timeout', async () => {
    vi.mocked(startPasskeySeed).mockRejectedValueOnce(
      Object.assign(new Error('t'), { name: 'TimeoutError' }),
    );
    const { result } = renderHook(() => useWalletPhrase());
    await act(async () => {
      await result.current.activate();
    });
    expect(result.current.error).toBe('timeout');
  });

  it('activate fail maps a non-Error throw to generic', async () => {
    vi.mocked(startPasskeySeed).mockRejectedValueOnce('boom');
    const { result } = renderHook(() => useWalletPhrase());
    await act(async () => {
      await result.current.activate();
    });
    expect(result.current.error).toBe('generic');
  });

  it('activate fail maps wallet.prfUnsupported', async () => {
    vi.mocked(startPasskeySeed).mockRejectedValueOnce(new Error('wallet.prfUnsupported'));
    const { result } = renderHook(() => useWalletPhrase());
    await act(async () => {
      await result.current.activate();
    });
    expect(result.current.error).toBe('prfUnsupported');
  });

  it('activate NotAllowedError returns to idle without an error', async () => {
    vi.mocked(startPasskeySeed).mockRejectedValueOnce(
      Object.assign(new Error('denied'), { name: 'NotAllowedError' }),
    );
    const { result } = renderHook(() => useWalletPhrase());
    await act(async () => {
      await result.current.activate();
    });
    expect(result.current.status).toBe('idle');
    expect(result.current.error).toBeNull();
    expect(finishPasskeySeed).not.toHaveBeenCalled();
  });

  it('showPhrase fail maps prfUnsupported message', async () => {
    useAuthStore.setState({ session: 'tok', account: seededAccount });
    vi.mocked(obtainPrfFirstFromGet).mockRejectedValueOnce(new Error('prfUnsupported'));
    const { result } = renderHook(() => useWalletPhrase());
    await act(async () => {
      await result.current.showPhrase();
    });
    expect(result.current.error).toBe('prfUnsupported');
  });

  it('merges existing create() extensions with prf', async () => {
    vi.mocked(creationOptionsFromJSON).mockReturnValueOnce({
      challenge: new ArrayBuffer(1),
      extensions: { appidExclude: true },
    } as unknown as PublicKeyCredentialCreationOptions);
    const { result } = renderHook(() => useWalletPhrase());
    await act(async () => {
      await result.current.activate();
    });
    expect(finishPasskeySeed).toHaveBeenCalled();
  });

  it('uses the visual phrase fixture', () => {
    const url = new URL(originalHref);
    url.search = '?visual=phrase';
    window.history.replaceState({}, '', url.toString());
    const { result } = renderHook(() => useWalletPhrase());
    expect(result.current.view).toBe('phrase');
    expect(result.current.words).toHaveLength(12);
  });

  it('refreshes the visual phrase when the wallet event fires', () => {
    const url = new URL(originalHref);
    url.search = '?visual=phrase';
    window.history.replaceState({}, '', url.toString());
    const { result } = renderHook(() => useWalletPhrase());
    act(() => {
      window.dispatchEvent(new Event('21gifts:wallet-phrase'));
    });
    expect(result.current.view).toBe('phrase');
    expect(result.current.words).toHaveLength(12);
  });

  it('ignores the wallet phrase event when no visual fixture is set', () => {
    const { result } = renderHook(() => useWalletPhrase());
    act(() => {
      window.dispatchEvent(new Event('21gifts:wallet-phrase'));
    });
    expect(result.current.words).toEqual([]);
  });

  it('does not show peekSessionPhrase words on mount', () => {
    rememberSessionPhrase(mnemonic);
    const { result } = renderHook(() => useWalletPhrase());
    expect(result.current.words).toEqual([]);
    expect(result.current.view).toBe('activate');
  });

  it('does not pull peekSessionPhrase words from the phrase event', () => {
    const { result } = renderHook(() => useWalletPhrase());
    act(() => {
      rememberSessionPhrase(mnemonic);
    });
    expect(result.current.words).toEqual([]);
  });

  it('view is activate when passkeyCredentialId is null', () => {
    useAuthStore.setState({ session: 'tok', account: { ...account, passkeyCredentialId: null } });
    const { result } = renderHook(() => useWalletPhrase());
    expect(result.current.view).toBe('activate');
  });

  it('view is activate when passkeyCredentialId is empty', () => {
    useAuthStore.setState({ session: 'tok', account: { ...account, passkeyCredentialId: '' } });
    const { result } = renderHook(() => useWalletPhrase());
    expect(result.current.view).toBe('activate');
  });

  it('view is activate when passkeyCredentialId is omitted', () => {
    const { passkeyCredentialId: _omitted, ...withoutId } = account;
    void _omitted;
    useAuthStore.setState({ session: 'tok', account: withoutId });
    const { result } = renderHook(() => useWalletPhrase());
    expect(result.current.view).toBe('activate');
  });

  it('view is reveal when passkeyCredentialId is non-empty', () => {
    useAuthStore.setState({ session: 'tok', account: seededAccount });
    const { result } = renderHook(() => useWalletPhrase());
    expect(result.current.view).toBe('reveal');
    expect(result.current.words).toEqual([]);
  });

  it('walletBackupSeenAt and walletRequired do not change the view', () => {
    useAuthStore.setState({
      session: 'tok',
      account: {
        ...account,
        passkeyCredentialId: null,
        walletRequired: true,
        walletBackupSeenAt: 1,
      },
    });
    const withoutSeed = renderHook(() => useWalletPhrase());
    expect(withoutSeed.result.current.view).toBe('activate');
    withoutSeed.unmount();
    useAuthStore.setState({
      session: 'tok',
      account: {
        ...seededAccount,
        walletRequired: false,
        walletBackupSeenAt: null,
      },
    });
    const withSeed = renderHook(() => useWalletPhrase());
    expect(withSeed.result.current.view).toBe('reveal');
  });

  it('uses the visual timeout fixture', () => {
    const url = new URL(originalHref);
    url.search = '?visual=timeout';
    window.history.replaceState({}, '', url.toString());
    const { result } = renderHook(() => useWalletPhrase());
    expect(result.current.error).toBe('timeout');
  });

  it('uses the visual error fixture', () => {
    const url = new URL(originalHref);
    url.search = '?visual=error';
    window.history.replaceState({}, '', url.toString());
    const { result } = renderHook(() => useWalletPhrase());
    expect(result.current.error).toBe('generic');
    expect(result.current.status).toBe('idle');
  });

  it('uses the visual prf-unsupported fixture', () => {
    const url = new URL(originalHref);
    url.search = '?visual=prf-unsupported';
    window.history.replaceState({}, '', url.toString());
    const { result } = renderHook(() => useWalletPhrase());
    expect(result.current.error).toBe('prfUnsupported');
  });

  it('hidePhrase and retry clear error state', async () => {
    rememberSessionPhrase(mnemonic);
    const { result } = renderHook(() => useWalletPhrase());
    act(() => {
      result.current.hidePhrase();
      result.current.retry();
    });
    expect(peekSessionPhrase()).toBeNull();
    expect(result.current.error).toBeNull();
    expect(result.current.status).toBe('idle');
  });

  it('does not keep a phrase when the session ends during showPhrase', async () => {
    useAuthStore.setState({ session: 'tok', account: seededAccount });
    vi.mocked(obtainPrfFirstFromGet).mockImplementation(async () => {
      useAuthStore.setState({ session: null, account: null });
      return new Uint8Array(32).fill(7);
    });
    const { result } = renderHook(() => useWalletPhrase());
    await act(async () => {
      await result.current.showPhrase();
    });
    expect(peekSessionPhrase()).toBeNull();
    expect(result.current.words).toEqual([]);
    expect(result.current.status).toBe('idle');
  });

  it('does not finish seed when the session ends during activate', async () => {
    vi.mocked(startPasskeySeed).mockImplementation(async () => {
      useAuthStore.setState({ session: null, account: null });
      return { challengeId: 'ch', options: { challenge: 'aa' } };
    });
    const { result } = renderHook(() => useWalletPhrase());
    await act(async () => {
      await result.current.activate();
    });
    expect(finishPasskeySeed).not.toHaveBeenCalled();
    expect(peekSessionPhrase()).toBeNull();
  });

  it('does not finish seed when the session ends after create', async () => {
    vi.stubGlobal('navigator', {
      ...navigator,
      credentials: {
        create: vi.fn().mockImplementation(async () => {
          useAuthStore.setState({ session: null, account: null });
          return { id: 'cred', type: 'public-key' };
        }),
        get: vi.fn(),
      },
    });
    const { result } = renderHook(() => useWalletPhrase());
    await act(async () => {
      await result.current.activate();
    });
    expect(finishPasskeySeed).not.toHaveBeenCalled();
    expect(peekSessionPhrase()).toBeNull();
  });

  it('does not finish seed when the session ends after PRF first', async () => {
    vi.mocked(obtainPrfFirst).mockImplementation(async () => {
      useAuthStore.setState({ session: null, account: null });
      return new Uint8Array(32).fill(7);
    });
    const { result } = renderHook(() => useWalletPhrase());
    await act(async () => {
      await result.current.activate();
    });
    expect(finishPasskeySeed).not.toHaveBeenCalled();
    expect(peekSessionPhrase()).toBeNull();
  });

  it('does not set words when the session ends while deriving the mnemonic', async () => {
    vi.mocked(mnemonicFromPrfFirst).mockImplementation(async () => {
      useAuthStore.setState({ session: null, account: null });
      return mnemonic;
    });
    const { result } = renderHook(() => useWalletPhrase());
    await act(async () => {
      await result.current.activate();
    });
    expect(finishPasskeySeed).toHaveBeenCalled();
    expect(result.current.words).toEqual([]);
    expect(result.current.status).toBe('idle');
    expect(peekSessionPhrase()).toBeNull();
  });

  it('does not write the seed account when the session changes while deriving the mnemonic', async () => {
    const otherMnemonic = 'zoo yellow wood wolf window wild wide width wife winter wisdom wish';
    vi.mocked(mnemonicFromPrfFirst).mockImplementation(async () => {
      rememberSessionPhrase(otherMnemonic);
      useAuthStore.setState({
        session: 'tok-new',
        account: { ...account, id: 'acc_2' },
      });
      return mnemonic;
    });
    const { result } = renderHook(() => useWalletPhrase());
    await act(async () => {
      await result.current.activate();
    });
    expect(finishPasskeySeed).toHaveBeenCalled();
    expect(result.current.words).toEqual([]);
    expect(result.current.status).toBe('idle');
    expect(result.current.error).toBeNull();
    expect(useAuthStore.getState().account?.id).toBe('acc_2');
    expect(peekSessionPhrase()).toBe(otherMnemonic);
  });

  it('does not keep a phrase when the session ends after finishPasskeySeed', async () => {
    vi.mocked(finishPasskeySeed).mockImplementation(async () => {
      useAuthStore.setState({ session: null, account: null });
      return { ...account, passkeyCredentialId: 'seed-from-api' };
    });
    const { result } = renderHook(() => useWalletPhrase());
    await act(async () => {
      await result.current.activate();
    });
    expect(peekSessionPhrase()).toBeNull();
    expect(result.current.words).toEqual([]);
  });

  it('does not clear another session phrase when activate goes stale after finish', async () => {
    const otherMnemonic = 'zoo yellow wood wolf window wild wide width wife winter wisdom wish';
    vi.mocked(finishPasskeySeed).mockImplementation(async () => {
      rememberSessionPhrase(otherMnemonic);
      useAuthStore.setState({
        session: 'tok-new',
        account: { ...account, id: 'acc_2' },
      });
      return { ...account, passkeyCredentialId: 'seed-from-api' };
    });
    const { result } = renderHook(() => useWalletPhrase());
    await act(async () => {
      await result.current.activate();
    });
    expect(peekSessionPhrase()).toBe(otherMnemonic);
    expect(result.current.status).toBe('idle');
    expect(result.current.words).toEqual([]);
    expect(useAuthStore.getState().account?.id).toBe('acc_2');
  });

  it('does not keep a phrase when the session ends after mnemonic derivation', async () => {
    useAuthStore.setState({ session: 'tok', account: seededAccount });
    vi.mocked(mnemonicFromPrfFirst).mockImplementation(async () => {
      useAuthStore.setState({ session: null, account: null });
      return mnemonic;
    });
    const { result } = renderHook(() => useWalletPhrase());
    await act(async () => {
      await result.current.showPhrase();
    });
    expect(peekSessionPhrase()).toBeNull();
    expect(result.current.words).toEqual([]);
  });

  it('runs only one activate at a time', async () => {
    let release: (() => void) | undefined;
    vi.mocked(startPasskeySeed).mockImplementation(
      () =>
        new Promise((resolve) => {
          release = () => resolve({ challengeId: 'ch', options: { challenge: 'aa' } });
        }),
    );
    const { result } = renderHook(() => useWalletPhrase());
    let first: Promise<void> | undefined;
    let second: Promise<void> | undefined;
    await act(async () => {
      first = result.current.activate();
      second = result.current.activate();
    });
    expect(startPasskeySeed).toHaveBeenCalledTimes(1);
    await act(async () => {
      release?.();
      await first;
      await second;
    });
    expect(startPasskeySeed).toHaveBeenCalledTimes(1);
  });

  it('does not start a second ceremony after remount while the first is in flight', async () => {
    let release: (() => void) | undefined;
    vi.mocked(startPasskeySeed).mockImplementation(
      () =>
        new Promise((resolve) => {
          release = () => resolve({ challengeId: 'ch', options: { challenge: 'aa' } });
        }),
    );
    const firstHook = renderHook(() => useWalletPhrase());
    let first: Promise<void> | undefined;
    await act(async () => {
      first = firstHook.result.current.activate();
    });
    firstHook.unmount();
    const secondHook = renderHook(() => useWalletPhrase());
    await act(async () => {
      await secondHook.result.current.activate();
      await secondHook.result.current.showPhrase();
    });
    expect(startPasskeySeed).toHaveBeenCalledTimes(1);
    expect(obtainPrfFirstFromGet).not.toHaveBeenCalled();
    expect(postWalletBackupSeen).not.toHaveBeenCalled();
    await act(async () => {
      release?.();
      await first;
    });
  });

  it('does not surface an error when activate rejects after logout', async () => {
    vi.mocked(startPasskeySeed).mockImplementation(async () => {
      useAuthStore.setState({ session: null, account: null });
      throw new Error('aborted');
    });
    const { result } = renderHook(() => useWalletPhrase());
    await act(async () => {
      await result.current.activate();
    });
    expect(result.current.status).toBe('idle');
    expect(result.current.error).toBeNull();
  });

  it('does not surface an error when showPhrase rejects after logout', async () => {
    useAuthStore.setState({ session: 'tok', account: seededAccount });
    vi.mocked(obtainPrfFirstFromGet).mockImplementation(async () => {
      useAuthStore.setState({ session: null, account: null });
      throw new Error('aborted');
    });
    const { result } = renderHook(() => useWalletPhrase());
    await act(async () => {
      await result.current.showPhrase();
    });
    expect(result.current.status).toBe('idle');
    expect(result.current.error).toBeNull();
  });
});
