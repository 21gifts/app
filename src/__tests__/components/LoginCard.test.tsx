import { act, cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LoginCard } from '@/components/LoginCard';
import { usePasskeyLogin, type PasskeyStatus } from '@/hooks/usePasskeyLogin';
import { fetchMe } from '@/lib/api';
import { clearSession, loadSession } from '@/lib/session-storage';
import { useAuthStore } from '@/stores/auth-store';
import { renderWithLocale } from '@/__tests__/render-with-locale';

vi.mock('@/hooks/usePasskeyLogin', () => ({ usePasskeyLogin: vi.fn() }));
vi.mock('@/lib/session-storage', () => ({
  loadSession: vi.fn(),
  saveSession: vi.fn(),
  clearSession: vi.fn(),
}));
vi.mock('@/lib/api', () => ({
  fetchMe: vi.fn(),
  setName: vi.fn(),
  setLightningAddress: vi.fn(),
  unlinkLightningAddress: vi.fn(),
}));

const account = {
  id: 'acc_1',
  linkingKey: `02${'a'.repeat(60)}`,
  role: 'basis' as const,
  name: null,
  lightningAddress: null,
  lightningAddressVerified: false,
  createdAt: 1_700_000_000,
};

const loginSpy = vi.fn();
const registerSpy = vi.fn();
const authenticateSpy = vi.fn();
const retrySpy = vi.fn();
const cancelPasskeySpy = vi.fn();
const ORIGINAL_UA = window.navigator.userAgent;

/** Points the mocked passkey hook at a fixed state for the next render. */
function mockPasskey(status: PasskeyStatus = 'idle'): void {
  vi.mocked(usePasskeyLogin).mockReturnValue({
    status,
    login: loginSpy,
    register: registerSpy,
    authenticate: authenticateSpy,
    retry: retrySpy,
    cancel: cancelPasskeySpy,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  useAuthStore.setState({ session: null, account: null });
  vi.mocked(loadSession).mockReturnValue(null);
  mockPasskey('idle');
});

afterEach(() => {
  cleanup();
  Object.defineProperty(window.navigator, 'userAgent', {
    value: ORIGINAL_UA,
    configurable: true,
  });
});

describe('LoginCard', () => {
  it('shows a single Log in button when logged out and idle', () => {
    renderWithLocale(<LoginCard />);
    fireEvent.click(screen.getByRole('button', { name: /^log in$/i }));
    expect(loginSpy).toHaveBeenCalledTimes(1);
    expect(screen.getAllByRole('button')).toHaveLength(1);
  });

  it('shows a loading state while a passkey ceremony starts', () => {
    mockPasskey('starting');
    renderWithLocale(<LoginCard />);
    expect(screen.getByText('Preparing your login…')).toBeTruthy();
  });

  it('shows the signed-in view without a linking key', () => {
    useAuthStore.setState({
      session: 'tok',
      account: { ...account, linkingKey: null },
    });
    renderWithLocale(<LoginCard />);
    expect(screen.getByText('Signed in')).toBeTruthy();
    expect(screen.queryByTitle(account.linkingKey)).toBeNull();
  });

  it('shows a passkey error with try again', () => {
    mockPasskey('error');
    renderWithLocale(<LoginCard />);
    fireEvent.click(screen.getByRole('button', { name: /try again/i }));
    expect(retrySpy).toHaveBeenCalledTimes(1);
  });

  it('asks for a name when an address exists but a name does not', () => {
    useAuthStore.setState({
      session: 'sess',
      account: { ...account, lightningAddress: 'alice@walletofsatoshi.com' },
    });
    renderWithLocale(<LoginCard />);
    expect(screen.getByRole('button', { name: /save name/i })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: /welcome/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /unlink/i })).toBeNull();
  });

  it('asks for a name before a Wallet of Satoshi address', () => {
    useAuthStore.setState({ session: 'sess', account });
    renderWithLocale(<LoginCard />);
    expect(screen.getByRole('button', { name: /save name/i })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /link address/i })).toBeNull();
  });

  it('asks for a Wallet of Satoshi address after a name is saved', () => {
    useAuthStore.setState({
      session: 'sess',
      account: { ...account, name: 'Ada' },
    });
    renderWithLocale(<LoginCard />);
    expect(screen.getByText('Hi, Ada')).toBeTruthy();
    expect(screen.getByRole('button', { name: /link address/i })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /save name/i })).toBeNull();
  });

  it('shows a welcome after name and address are saved', () => {
    useAuthStore.setState({
      session: 'sess',
      account: {
        ...account,
        name: 'Ada',
        lightningAddress: 'alice@walletofsatoshi.com',
      },
    });
    renderWithLocale(<LoginCard />);
    expect(screen.getByRole('heading', { name: 'Welcome, Ada' })).toBeTruthy();
    expect(screen.getByRole('link', { name: /send a gift/i }).getAttribute('href')).toBe('/donate');
    expect(screen.queryByRole('button', { name: /unlink/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /save name/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /edit/i })).toBeNull();
  });

  it('shows the signed-in view and logs out', () => {
    useAuthStore.setState({ session: 'sess', account });
    renderWithLocale(<LoginCard />);

    expect(screen.queryByTitle(account.linkingKey)).toBeNull();
    expect(screen.getByRole('button', { name: /save name/i })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /log out/i }));
    expect(cancelPasskeySpy).toHaveBeenCalledTimes(1);
    expect(clearSession).toHaveBeenCalledTimes(1);
    expect(useAuthStore.getState().account).toBeNull();
  });

  it('does not clobber a profile already stored for the same token', async () => {
    let resolve!: (value: typeof account | null) => void;
    const pending = new Promise<typeof account | null>((r) => {
      resolve = r;
    });
    vi.mocked(loadSession).mockReturnValue('tok');
    vi.mocked(fetchMe).mockReturnValue(pending);

    renderWithLocale(<LoginCard />);
    act(() => {
      useAuthStore.getState().setAuth('tok', { ...account, name: 'Ada' });
    });

    await act(async () => {
      resolve(account);
    });

    expect(useAuthStore.getState().account?.name).toBe('Ada');
  });

  it('does not clear a newer session when stale hydration returns 401', async () => {
    let resolve!: (value: typeof account | null) => void;
    const pending = new Promise<typeof account | null>((r) => {
      resolve = r;
    });
    vi.mocked(loadSession).mockReturnValueOnce('old').mockReturnValue('new');
    vi.mocked(fetchMe).mockReturnValue(pending);

    renderWithLocale(<LoginCard />);
    act(() => {
      useAuthStore.getState().setAuth('new', { ...account, name: 'Ada' });
    });

    await act(async () => {
      resolve(null);
    });

    expect(clearSession).not.toHaveBeenCalled();
    expect(useAuthStore.getState().session).toBe('new');
  });

  it('ignores stale hydration when the store already holds a different session', async () => {
    let resolve!: (value: typeof account | null) => void;
    const pending = new Promise<typeof account | null>((r) => {
      resolve = r;
    });
    vi.mocked(loadSession).mockReturnValue('old');
    vi.mocked(fetchMe).mockReturnValue(pending);

    renderWithLocale(<LoginCard />);
    act(() => {
      useAuthStore.getState().setAuth('new', { ...account, name: 'Ada' });
    });

    await act(async () => {
      resolve(account);
    });

    expect(useAuthStore.getState().session).toBe('new');
    expect(useAuthStore.getState().account?.name).toBe('Ada');
  });

  it('clears store and storage when 401 matches the store token', async () => {
    let resolve!: (value: typeof account | null) => void;
    const pending = new Promise<typeof account | null>((r) => {
      resolve = r;
    });
    vi.mocked(loadSession).mockReturnValue('tok');
    vi.mocked(fetchMe).mockReturnValue(pending);

    renderWithLocale(<LoginCard />);
    act(() => {
      useAuthStore.getState().setAuth('tok', account);
    });

    await act(async () => {
      resolve(null);
    });

    expect(clearSession).toHaveBeenCalled();
    expect(useAuthStore.getState().session).toBeNull();
  });

  it('does not clobber a newer session when stale hydration succeeds', async () => {
    let resolve!: (value: typeof account | null) => void;
    const pending = new Promise<typeof account | null>((r) => {
      resolve = r;
    });
    vi.mocked(loadSession).mockReturnValueOnce('old').mockReturnValue('new');
    vi.mocked(fetchMe).mockReturnValue(pending);

    renderWithLocale(<LoginCard />);
    act(() => {
      useAuthStore.getState().setAuth('new', { ...account, name: 'Ada' });
    });

    await act(async () => {
      resolve(account);
    });

    expect(useAuthStore.getState().session).toBe('new');
    expect(useAuthStore.getState().account?.name).toBe('Ada');
  });

  it('does not apply hydration when the persisted token has changed', async () => {
    let resolve!: (value: typeof account | null) => void;
    const pending = new Promise<typeof account | null>((r) => {
      resolve = r;
    });
    vi.mocked(loadSession).mockReturnValue('old-tok');
    vi.mocked(fetchMe).mockReturnValue(pending);

    renderWithLocale(<LoginCard />);
    vi.mocked(loadSession).mockReturnValue('new-tok');

    await act(async () => {
      resolve(account);
    });

    expect(useAuthStore.getState().session).toBeNull();
  });

  it('does not restore a session after logout while hydration is in flight', async () => {
    let resolve!: (value: typeof account | null) => void;
    const pending = new Promise<typeof account | null>((r) => {
      resolve = r;
    });
    vi.mocked(loadSession).mockReturnValue('old-tok');
    vi.mocked(fetchMe).mockReturnValue(pending);
    useAuthStore.setState({ session: 'sess', account });

    renderWithLocale(<LoginCard />);
    fireEvent.click(screen.getByRole('button', { name: /log out/i }));
    expect(useAuthStore.getState().account).toBeNull();

    await act(async () => {
      resolve(account);
    });

    expect(useAuthStore.getState().session).toBeNull();
    expect(useAuthStore.getState().account).toBeNull();
  });

  it('hydrates a valid persisted token into the signed-in view', async () => {
    vi.mocked(loadSession).mockReturnValue('tok');
    vi.mocked(fetchMe).mockResolvedValue(account);

    renderWithLocale(<LoginCard />);

    expect(await screen.findByText('Signed in')).toBeTruthy();
    expect(useAuthStore.getState().session).toBe('tok');
  });

  it('clears a stale persisted token', async () => {
    vi.mocked(loadSession).mockReturnValue('tok');
    vi.mocked(fetchMe).mockResolvedValue(null);

    renderWithLocale(<LoginCard />);

    await waitFor(() => {
      expect(clearSession).toHaveBeenCalledTimes(1);
    });
    expect(useAuthStore.getState().account).toBeNull();
  });

  it('clears an in-memory session when hydration 401s the same token', async () => {
    vi.mocked(loadSession).mockReturnValue('tok');
    vi.mocked(fetchMe).mockResolvedValue(null);
    useAuthStore.setState({ session: 'tok', account });

    renderWithLocale(<LoginCard />);

    await waitFor(() => {
      expect(useAuthStore.getState().session).toBeNull();
    });
    expect(useAuthStore.getState().account).toBeNull();
  });

  it('does not apply hydration after unmount', async () => {
    let resolve!: (value: typeof account | null) => void;
    const pending = new Promise<typeof account | null>((r) => {
      resolve = r;
    });
    vi.mocked(loadSession).mockReturnValue('tok');
    vi.mocked(fetchMe).mockReturnValue(pending);

    const { unmount } = renderWithLocale(<LoginCard />);
    unmount();

    await act(async () => {
      resolve(account);
    });

    expect(useAuthStore.getState().session).toBeNull();
    expect(cancelPasskeySpy).not.toHaveBeenCalled();
  });

  it('does not let an unmounted hydration 401 wipe a remounted session', async () => {
    let resolveFirst!: (value: typeof account | null) => void;
    const first = new Promise<typeof account | null>((r) => {
      resolveFirst = r;
    });
    vi.mocked(loadSession).mockReturnValue('tok');
    vi.mocked(fetchMe).mockReturnValueOnce(first).mockResolvedValueOnce(account);

    const { unmount } = renderWithLocale(<LoginCard />);
    unmount();
    renderWithLocale(<LoginCard />);

    await waitFor(() => {
      expect(useAuthStore.getState().session).toBe('tok');
    });

    await act(async () => {
      resolveFirst(null);
    });

    expect(useAuthStore.getState().session).toBe('tok');
    expect(useAuthStore.getState().account).toEqual(account);
  });

  it('cancels an in-flight passkey when hydration succeeds', async () => {
    vi.mocked(loadSession).mockReturnValue('tok');
    vi.mocked(fetchMe).mockResolvedValue(account);

    renderWithLocale(<LoginCard />);

    await waitFor(() => {
      expect(useAuthStore.getState().session).toBe('tok');
    });
    expect(cancelPasskeySpy).toHaveBeenCalled();
  });

  it('logs but keeps the token when hydration fails', async () => {
    vi.mocked(loadSession).mockReturnValue('tok');
    vi.mocked(fetchMe).mockRejectedValue(new Error('500'));
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    renderWithLocale(<LoginCard />);

    await waitFor(() => {
      expect(errorSpy).toHaveBeenCalled();
    });
    expect(clearSession).not.toHaveBeenCalled();
    expect(useAuthStore.getState().account).toBeNull();
    errorSpy.mockRestore();
  });
});
