import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useActiveSession } from '@/hooks/useActiveSession';
import type { Account } from '@/lib/api-types';
import { useAuthStore } from '@/stores/auth-store';

const walletOpen = vi.hoisted(() => ({ value: true }));
vi.mock('@/hooks/useWalletOpen', () => ({ useWalletOpen: () => walletOpen.value }));

const account = { id: 'acc' } as Account;

afterEach(() => {
  walletOpen.value = true;
  useAuthStore.setState({ session: null, account: null, lockedSession: null });
});

describe('useActiveSession', () => {
  it('returns the session while the wallet is open', () => {
    useAuthStore.setState({ session: 'tok', account });
    expect(renderHook(() => useActiveSession()).result.current).toBe('tok');
  });

  it('returns null while a login is still opening its wallet', () => {
    useAuthStore.setState({ session: 'tok', account });
    walletOpen.value = false;
    expect(renderHook(() => useActiveSession()).result.current).toBeNull();
  });

  it('keeps a session whose account has not loaded yet', () => {
    useAuthStore.setState({ session: 'tok', account: null });
    walletOpen.value = false;
    expect(renderHook(() => useActiveSession()).result.current).toBe('tok');
  });

  it('is null without a session', () => {
    expect(renderHook(() => useActiveSession()).result.current).toBeNull();
  });
});
