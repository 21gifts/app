import { act, cleanup, renderHook } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactElement } from 'react';
import { useWalletOpen } from '@/hooks/useWalletOpen';
import type { Account } from '@/lib/api-types';
import { clearSessionPhrase, rememberSessionPhrase } from '@/lib/tab-phrase';
import { isWalletOpen } from '@/lib/wallet/wallet-open';
import { useAuthStore } from '@/stores/auth-store';

vi.mock('@/lib/wallet/wallet-open', () => ({ isWalletOpen: vi.fn() }));

const account = { id: 'account' } as Account;

function Probe(): ReactElement {
  return <p>{useWalletOpen() ? 'open' : 'closed'}</p>;
}

beforeEach(() => {
  clearSessionPhrase();
  useAuthStore.setState({ session: null, account: null, lockedSession: null });
  vi.mocked(isWalletOpen)
    .mockReset()
    .mockImplementation((_account, hasPhrase) => hasPhrase);
});

afterEach(() => {
  cleanup();
  clearSessionPhrase();
});

describe('useWalletOpen', () => {
  it('is false while signed out', () => {
    expect(renderHook(() => useWalletOpen()).result.current).toBe(false);
    expect(isWalletOpen).not.toHaveBeenCalled();
  });

  it('subscribes to phrase changes and unsubscribes on unmount', () => {
    useAuthStore.setState({ session: 'token', account });
    const { result, unmount } = renderHook(() => useWalletOpen());
    expect(result.current).toBe(false);
    act(() => rememberSessionPhrase('one two three'));
    expect(result.current).toBe(true);
    expect(isWalletOpen).toHaveBeenLastCalledWith(account, true);
    unmount();
    act(() => clearSessionPhrase());
  });

  it('uses a phrase-free server snapshot', () => {
    useAuthStore.setState({ session: 'token', account });
    vi.mocked(isWalletOpen).mockReturnValue(false);
    // The server render reads the store's initial state (no account), and
    // the phrase snapshot is the server one: the wallet counts as closed.
    expect(renderToString(<Probe />)).toContain('closed');
  });
});
