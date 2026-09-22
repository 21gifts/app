import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearSessionPhrase,
  peekSessionPhrase,
  rememberSessionPhrase,
  resetWalletCeremonyLock,
  useWalletPhrase,
} from '@/hooks/useWalletPhrase';
import { finishPasskeyReplace, postWalletBackupSeen, startPasskeyReplace } from '@/lib/api';
import { obtainPrfFirst, obtainPrfFirstFromGet, mnemonicFromPrfFirst } from '@/lib/prf-mnemonic';
import { creationOptionsFromJSON } from '@/lib/webauthn-browser';
import { useAuthStore } from '@/stores/auth-store';

vi.mock('@/lib/api', () => ({
  startPasskeyReplace: vi.fn(),
  finishPasskeyReplace: vi.fn(),
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

const push = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: (): { push: typeof push } => ({ push }),
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
  passkeyCredentialId: 'cred-owner',
};

const mnemonic =
  'abandon ability able about above absent absorb abstract absurd abuse access accident';

const originalHref = window.location.href;

beforeEach(() => {
  clearSessionPhrase();
  resetWalletCeremonyLock();
  push.mockReset();
  useAuthStore.setState({ session: 'tok', account });
  vi.mocked(startPasskeyReplace)
    .mockReset()
    .mockResolvedValue({
      challengeId: 'ch',
      options: { challenge: 'aa' },
    });
  vi.mocked(finishPasskeyReplace)
    .mockReset()
    .mockResolvedValue({
      ...account,
      walletRequired: false,
    });
  vi.mocked(postWalletBackupSeen)
    .mockReset()
    .mockResolvedValue({
      ...account,
      setup: 'name',
      walletBackupSeenAt: 1,
    });
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
  it('activates replace, derives words, and does not finish without PRF', async () => {
    const { result } = renderHook(() => useWalletPhrase());
    expect(result.current.view).toBe('activate');
    await act(async () => {
      await result.current.activate();
    });
    expect(startPasskeyReplace).toHaveBeenCalledWith('tok');
    expect(finishPasskeyReplace).toHaveBeenCalled();
    expect(postWalletBackupSeen).toHaveBeenCalledWith('tok');
    expect(result.current.words).toHaveLength(12);
  });

  it('does not finish replace when PRF is missing', async () => {
    vi.mocked(obtainPrfFirst).mockResolvedValueOnce(null);
    const { result } = renderHook(() => useWalletPhrase());
    await act(async () => {
      await result.current.activate();
    });
    expect(finishPasskeyReplace).not.toHaveBeenCalled();
    expect(result.current.error).toBe('prfUnsupported');
  });

  it('is a no-op when the session is missing', async () => {
    useAuthStore.setState({ session: null, account });
    const { result } = renderHook(() => useWalletPhrase());
    await act(async () => {
      await result.current.activate();
      await result.current.confirmSaved();
      await result.current.showPhrase();
    });
    expect(startPasskeyReplace).not.toHaveBeenCalled();
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
    expect(finishPasskeyReplace).not.toHaveBeenCalled();
  });

  it('showPhrase errors when the account has no passkey credential id', async () => {
    useAuthStore.setState({ session: 'tok', account: { ...account, passkeyCredentialId: null } });
    const { result } = renderHook(() => useWalletPhrase());
    await act(async () => {
      await result.current.showPhrase();
    });
    expect(obtainPrfFirstFromGet).not.toHaveBeenCalled();
    expect(result.current.error).toBe('generic');
    expect(result.current.status).toBe('error');
  });

  it('showPhrase derives words from get()', async () => {
    const { result } = renderHook(() => useWalletPhrase());
    await act(async () => {
      await result.current.showPhrase();
    });
    expect(Array.from(vi.mocked(obtainPrfFirstFromGet).mock.calls[0]?.[0] ?? [])).toEqual(
      Array.from(new TextEncoder().encode('cred-owner')),
    );
    expect(result.current.words).toHaveLength(12);
  });

  it('showPhrase records prfUnsupported when get has no PRF', async () => {
    vi.mocked(obtainPrfFirstFromGet).mockResolvedValueOnce(null);
    const { result } = renderHook(() => useWalletPhrase());
    await act(async () => {
      await result.current.showPhrase();
    });
    expect(result.current.error).toBe('prfUnsupported');
  });

  it('showPhrase fail maps cancel to idle', async () => {
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

  it('confirmSaved fail sets generic error', async () => {
    vi.mocked(postWalletBackupSeen).mockRejectedValueOnce(new Error('nope'));
    const { result } = renderHook(() => useWalletPhrase());
    await act(async () => {
      await result.current.confirmSaved();
    });
    expect(result.current.error).toBe('generic');
  });

  it('activate fail maps timeout', async () => {
    vi.mocked(startPasskeyReplace).mockRejectedValueOnce(
      Object.assign(new Error('t'), { name: 'TimeoutError' }),
    );
    const { result } = renderHook(() => useWalletPhrase());
    await act(async () => {
      await result.current.activate();
    });
    expect(result.current.error).toBe('timeout');
  });

  it('activate fail maps a non-Error throw to generic', async () => {
    vi.mocked(startPasskeyReplace).mockRejectedValueOnce('boom');
    const { result } = renderHook(() => useWalletPhrase());
    await act(async () => {
      await result.current.activate();
    });
    expect(result.current.error).toBe('generic');
  });

  it('activate fail maps wallet.prfUnsupported', async () => {
    vi.mocked(startPasskeyReplace).mockRejectedValueOnce(new Error('wallet.prfUnsupported'));
    const { result } = renderHook(() => useWalletPhrase());
    await act(async () => {
      await result.current.activate();
    });
    expect(result.current.error).toBe('prfUnsupported');
  });

  it('showPhrase fail maps prfUnsupported message', async () => {
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
    expect(finishPasskeyReplace).toHaveBeenCalled();
  });

  it('uses the visual phrase fixture', () => {
    const url = new URL(originalHref);
    url.search = '?visual=phrase';
    window.history.replaceState({}, '', url.toString());
    const { result } = renderHook(() => useWalletPhrase());
    expect(result.current.view).toBe('phrase');
    expect(result.current.words).toHaveLength(12);
  });

  it('uses the visual confirm fixture', () => {
    const url = new URL(originalHref);
    url.search = '?visual=confirm';
    window.history.replaceState({}, '', url.toString());
    const { result } = renderHook(() => useWalletPhrase());
    expect(result.current.view).toBe('confirm');
    expect(result.current.words).toHaveLength(12);
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

  it('does not post backup-seen for the visual fixture phrase', async () => {
    const url = new URL(originalHref);
    url.search = '?visual=confirm';
    window.history.replaceState({}, '', url.toString());
    useAuthStore.setState({
      session: 'tok',
      account: { ...account, setup: 'wallet' },
    });
    const { result } = renderHook(() => useWalletPhrase());
    await act(async () => {
      await result.current.confirmSaved();
    });
    expect(postWalletBackupSeen).not.toHaveBeenCalled();
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

  it('keeps the stored credential id when confirmSaved omits it', async () => {
    useAuthStore.setState({
      session: 'tok',
      account: { ...account, setup: 'wallet', passkeyCredentialId: 'cred-owner' },
    });
    rememberSessionPhrase(mnemonic);
    vi.mocked(postWalletBackupSeen).mockResolvedValueOnce({
      ...account,
      setup: 'name',
      walletBackupSeenAt: 1,
      passkeyCredentialId: null,
    });
    const { result } = renderHook(() => useWalletPhrase());
    await act(async () => {
      await result.current.confirmSaved();
    });
    expect(useAuthStore.getState().account?.passkeyCredentialId).toBe('cred-owner');
  });

  it('stores a null credential id when confirmSaved and the session have none', async () => {
    useAuthStore.setState({
      session: 'tok',
      account: { ...account, setup: 'wallet', passkeyCredentialId: null },
    });
    rememberSessionPhrase(mnemonic);
    vi.mocked(postWalletBackupSeen).mockResolvedValueOnce({
      ...account,
      setup: 'name',
      walletBackupSeenAt: 1,
      passkeyCredentialId: null,
    });
    const { result } = renderHook(() => useWalletPhrase());
    await act(async () => {
      await result.current.confirmSaved();
    });
    expect(useAuthStore.getState().account?.passkeyCredentialId).toBeNull();
  });

  it('confirmSaved posts backup-seen and navigates', async () => {
    useAuthStore.setState({
      session: 'tok',
      account: { ...account, setup: 'wallet' },
    });
    rememberSessionPhrase(mnemonic);
    const { result } = renderHook(() => useWalletPhrase());
    await act(async () => {
      await result.current.confirmSaved();
    });
    expect(postWalletBackupSeen).toHaveBeenCalledWith('tok');
    expect(push).toHaveBeenCalledWith('/setup/name');
    expect(peekSessionPhrase()).toBeNull();
  });

  it('does not keep a phrase when the session ends during showPhrase', async () => {
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

  it('does not finish replace when the session ends during activate', async () => {
    vi.mocked(startPasskeyReplace).mockImplementation(async () => {
      useAuthStore.setState({ session: null, account: null });
      return { challengeId: 'ch', options: { challenge: 'aa' } };
    });
    const { result } = renderHook(() => useWalletPhrase());
    await act(async () => {
      await result.current.activate();
    });
    expect(finishPasskeyReplace).not.toHaveBeenCalled();
    expect(peekSessionPhrase()).toBeNull();
  });

  it('does not finish replace when the session ends after create', async () => {
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
    expect(finishPasskeyReplace).not.toHaveBeenCalled();
    expect(peekSessionPhrase()).toBeNull();
  });

  it('does not finish replace when the session ends after PRF first', async () => {
    vi.mocked(obtainPrfFirst).mockImplementation(async () => {
      useAuthStore.setState({ session: null, account: null });
      return new Uint8Array(32).fill(7);
    });
    const { result } = renderHook(() => useWalletPhrase());
    await act(async () => {
      await result.current.activate();
    });
    expect(finishPasskeyReplace).not.toHaveBeenCalled();
    expect(peekSessionPhrase()).toBeNull();
  });

  it('does not finish replace when the session ends after PRF mnemonic', async () => {
    vi.mocked(mnemonicFromPrfFirst).mockImplementation(async () => {
      useAuthStore.setState({ session: null, account: null });
      return mnemonic;
    });
    const { result } = renderHook(() => useWalletPhrase());
    await act(async () => {
      await result.current.activate();
    });
    expect(finishPasskeyReplace).not.toHaveBeenCalled();
    expect(peekSessionPhrase()).toBeNull();
  });

  it('does not keep a phrase when the session ends after finishPasskeyReplace', async () => {
    vi.mocked(finishPasskeyReplace).mockImplementation(async () => {
      useAuthStore.setState({ session: null, account: null });
      return { ...account, walletRequired: true };
    });
    const { result } = renderHook(() => useWalletPhrase());
    await act(async () => {
      await result.current.activate();
    });
    expect(peekSessionPhrase()).toBeNull();
    expect(result.current.words).toEqual([]);
  });

  it('does not clear another session phrase when activate goes stale before remember', async () => {
    const otherMnemonic = 'zoo yellow wood wolf window wild wide width wife winter wisdom wish';
    vi.mocked(finishPasskeyReplace).mockImplementation(async () => {
      rememberSessionPhrase(otherMnemonic);
      useAuthStore.setState({
        session: 'tok-new',
        account: { ...account, id: 'acc_2' },
      });
      return { ...account, walletRequired: true };
    });
    const { result } = renderHook(() => useWalletPhrase());
    await act(async () => {
      await result.current.activate();
    });
    expect(peekSessionPhrase()).toBe(otherMnemonic);
    expect(result.current.status).toBe('idle');
  });

  it('does not clear another session phrase when activate goes stale after remember', async () => {
    const otherMnemonic = 'zoo yellow wood wolf window wild wide width wife winter wisdom wish';
    vi.mocked(postWalletBackupSeen).mockImplementation(async () => {
      rememberSessionPhrase(otherMnemonic);
      useAuthStore.setState({
        session: 'tok-new',
        account: { ...account, id: 'acc_2' },
      });
      return { ...account, walletBackupSeenAt: 1 };
    });
    const { result } = renderHook(() => useWalletPhrase());
    await act(async () => {
      await result.current.activate();
    });
    expect(peekSessionPhrase()).toBe(otherMnemonic);
    expect(result.current.status).toBe('idle');
  });

  it('does not keep a phrase when the session ends after mnemonic derivation', async () => {
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

  it('does not navigate when the session ends during confirmSaved', async () => {
    useAuthStore.setState({
      session: 'tok',
      account: { ...account, setup: 'wallet' },
    });
    rememberSessionPhrase(mnemonic);
    vi.mocked(postWalletBackupSeen).mockImplementation(async () => {
      useAuthStore.setState({ session: null, account: null });
      return { ...account, setup: 'name', walletBackupSeenAt: 1 };
    });
    const { result } = renderHook(() => useWalletPhrase());
    await act(async () => {
      await result.current.confirmSaved();
    });
    expect(push).not.toHaveBeenCalled();
  });

  it('runs only one activate at a time', async () => {
    let release: (() => void) | undefined;
    vi.mocked(startPasskeyReplace).mockImplementation(
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
    expect(startPasskeyReplace).toHaveBeenCalledTimes(1);
    await act(async () => {
      release?.();
      await first;
      await second;
    });
    expect(startPasskeyReplace).toHaveBeenCalledTimes(1);
  });

  it('does not start a second ceremony after remount while the first is in flight', async () => {
    let release: (() => void) | undefined;
    vi.mocked(startPasskeyReplace).mockImplementation(
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
      await secondHook.result.current.confirmSaved();
    });
    expect(startPasskeyReplace).toHaveBeenCalledTimes(1);
    expect(obtainPrfFirstFromGet).not.toHaveBeenCalled();
    expect(postWalletBackupSeen).not.toHaveBeenCalled();
    await act(async () => {
      release?.();
      await first;
    });
  });

  it('keeps the replace credential id when backup-seen omits it', async () => {
    vi.mocked(postWalletBackupSeen).mockResolvedValueOnce({
      ...account,
      setup: 'name',
      walletBackupSeenAt: 1,
      passkeyCredentialId: null,
    });
    const { result } = renderHook(() => useWalletPhrase());
    await act(async () => {
      await result.current.activate();
    });
    expect(useAuthStore.getState().account?.passkeyCredentialId).toBe('cred');
  });

  it('keeps the phrase when backup-seen fails after replace', async () => {
    vi.mocked(postWalletBackupSeen).mockRejectedValueOnce(new Error('nope'));
    const { result } = renderHook(() => useWalletPhrase());
    await act(async () => {
      await result.current.activate();
    });
    expect(peekSessionPhrase()).toBe(mnemonic);
    expect(result.current.words).toHaveLength(12);
    expect(result.current.view).toBe('confirm');
    expect(useAuthStore.getState().account?.passkeyCredentialId).toBe('cred');
    expect(result.current.error).toBe('generic');
    expect(result.current.status).toBe('idle');
  });

  it('does not surface backup-seen error after logout during activate', async () => {
    vi.mocked(postWalletBackupSeen).mockImplementation(async () => {
      useAuthStore.setState({ session: null, account: null });
      throw new Error('nope');
    });
    const { result } = renderHook(() => useWalletPhrase());
    await act(async () => {
      await result.current.activate();
    });
    expect(result.current.error).toBeNull();
    expect(result.current.status).toBe('idle');
    expect(peekSessionPhrase()).toBeNull();
  });

  it('does not keep a phrase when backup-seen runs after replace then the session ends', async () => {
    vi.mocked(postWalletBackupSeen).mockImplementation(async () => {
      useAuthStore.setState({ session: null, account: null });
      return { ...account, walletBackupSeenAt: 1 };
    });
    const { result } = renderHook(() => useWalletPhrase());
    await act(async () => {
      await result.current.activate();
    });
    expect(finishPasskeyReplace).toHaveBeenCalled();
    expect(postWalletBackupSeen).toHaveBeenCalled();
    expect(peekSessionPhrase()).toBeNull();
    expect(result.current.status).toBe('idle');
  });

  it('does not surface an error when activate rejects after logout', async () => {
    vi.mocked(startPasskeyReplace).mockImplementation(async () => {
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

  it('does not surface an error when confirmSaved rejects after logout', async () => {
    useAuthStore.setState({
      session: 'tok',
      account: { ...account, setup: 'wallet' },
    });
    rememberSessionPhrase(mnemonic);
    vi.mocked(postWalletBackupSeen).mockImplementation(async () => {
      useAuthStore.setState({ session: null, account: null });
      throw new Error('aborted');
    });
    const { result } = renderHook(() => useWalletPhrase());
    await act(async () => {
      await result.current.confirmSaved();
    });
    expect(result.current.status).toBe('idle');
    expect(result.current.error).toBeNull();
    expect(push).not.toHaveBeenCalled();
  });
});
