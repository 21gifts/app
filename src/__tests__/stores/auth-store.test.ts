import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clearSession, saveSession } from '@/lib/session-storage';
import { useAuthStore } from '@/stores/auth-store';

vi.mock('@/lib/session-storage', () => ({
  loadSession: vi.fn(),
  saveSession: vi.fn(),
  clearSession: vi.fn(),
}));

const account = {
  id: 'acc_1',
  linkingKey: '02abcdef',
  role: 'moderator' as const,
  lightningAddress: null,
  lightningAddressVerified: false,
  createdAt: 1_700_000_000,
};

beforeEach(() => {
  useAuthStore.setState({ session: null, account: null });
  vi.clearAllMocks();
});

describe('useAuthStore', () => {
  it('starts logged out', () => {
    const state = useAuthStore.getState();
    expect(state.session).toBeNull();
    expect(state.account).toBeNull();
  });

  it('setAuth records the session and persists the token', () => {
    useAuthStore.getState().setAuth('tok', account);

    const state = useAuthStore.getState();
    expect(state.session).toBe('tok');
    expect(state.account).toEqual(account);
    expect(saveSession).toHaveBeenCalledWith('tok');
  });

  it('setAccount replaces the account and keeps the session untouched', () => {
    useAuthStore.getState().setAuth('tok', account);
    const linked = {
      ...account,
      lightningAddress: 'me@walletofsatoshi.com',
      lightningAddressVerified: true,
    };
    useAuthStore.getState().setAccount(linked);

    const state = useAuthStore.getState();
    expect(state.account).toEqual(linked);
    expect(state.session).toBe('tok');
    // setAuth persisted the token once; setAccount must not re-touch storage.
    expect(saveSession).toHaveBeenCalledTimes(1);
    expect(clearSession).not.toHaveBeenCalled();
  });

  it('clearAuth wipes state and clears storage', () => {
    useAuthStore.getState().setAuth('tok', account);
    useAuthStore.getState().clearAuth();

    const state = useAuthStore.getState();
    expect(state.session).toBeNull();
    expect(state.account).toBeNull();
    expect(clearSession).toHaveBeenCalledTimes(1);
  });
});
