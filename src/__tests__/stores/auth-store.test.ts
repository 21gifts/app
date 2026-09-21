import { beforeEach, describe, expect, it, vi } from 'vitest';
import { bumpUnreadAppBadgeEpoch, setUnreadAppBadge } from '@/lib/app-badge';
import { clearSession, saveSession } from '@/lib/session-storage';
import { peekSessionPhrase, rememberSessionPhrase } from '@/lib/tab-phrase';
import { useAuthStore } from '@/stores/auth-store';

vi.mock('@/lib/session-storage', () => ({
  loadSession: vi.fn(),
  saveSession: vi.fn(),
  clearSession: vi.fn(),
}));
vi.mock('@/lib/app-badge', () => ({
  setUnreadAppBadge: vi.fn(),
  bumpUnreadAppBadgeEpoch: vi.fn(),
}));

const account = {
  id: 'acc_1',
  linkingKey: '02abcdef',
  role: 'moderator' as const,
  name: null,
  location: null,
  lightningAddress: null,
  lightningAddressVerified: false,
  forumLawsDismissed: false,
  createdAt: 1_700_000_000,
  rulesAgreedAt: null as number | null,
  viewKey: 'a'.repeat(64),
  aboutMe: null,
  aboutMeHasPhoto: false,
  setup: null,
  missing: [],
};

beforeEach(() => {
  useAuthStore.setState({ session: null, account: null, wrongAccount: false });
  vi.clearAllMocks();
});

describe('useAuthStore', () => {
  it('starts logged out', () => {
    const state = useAuthStore.getState();
    expect(state.session).toBeNull();
    expect(state.account).toBeNull();
    expect(state.wrongAccount).toBe(false);
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
    rememberSessionPhrase('one two three');
    useAuthStore.getState().setAuth('tok', account);
    useAuthStore.getState().clearAuth();

    const state = useAuthStore.getState();
    expect(state.session).toBeNull();
    expect(state.account).toBeNull();
    expect(peekSessionPhrase()).toBeNull();
    expect(clearSession).toHaveBeenCalledTimes(1);
    expect(bumpUnreadAppBadgeEpoch).toHaveBeenCalled();
    expect(setUnreadAppBadge).toHaveBeenCalledWith(0);
  });

  it('setWrongAccount and clearWrongAccount toggle the hint flag', () => {
    useAuthStore.getState().setWrongAccount(true);
    expect(useAuthStore.getState().wrongAccount).toBe(true);
    useAuthStore.getState().clearWrongAccount();
    expect(useAuthStore.getState().wrongAccount).toBe(false);
  });

  it('setAuth clears the wrongAccount hint', () => {
    useAuthStore.getState().setWrongAccount(true);
    useAuthStore.getState().setAuth('tok', account);
    expect(useAuthStore.getState().wrongAccount).toBe(false);
  });

  it('clearAuth does not reset wrongAccount', () => {
    useAuthStore.getState().setAuth('tok', account);
    useAuthStore.getState().setWrongAccount(true);
    useAuthStore.getState().clearAuth();

    const state = useAuthStore.getState();
    expect(state.session).toBeNull();
    expect(state.account).toBeNull();
    expect(state.wrongAccount).toBe(true);
  });
});
