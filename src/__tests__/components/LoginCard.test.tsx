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

const registerSpy = vi.fn();
const authenticateSpy = vi.fn();
const retrySpy = vi.fn();
const cancelPasskeySpy = vi.fn();
const ORIGINAL_UA = window.navigator.userAgent;

/** Points the mocked passkey hook at a fixed state for the next render. */
function mockPasskey(status: PasskeyStatus = 'idle'): void {
  vi.mocked(usePasskeyLogin).mockReturnValue({
    status,
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
  it('shows the login call-to-action when logged out and idle', () => {
    renderWithLocale(<LoginCard />);
    const create = screen.getByRole('button', { name: /create a passkey/i });
    fireEvent.click(create);
    expect(registerSpy).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: /continue with passkey/i }));
    expect(authenticateSpy).toHaveBeenCalledTimes(1);
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

  it('shows the signed-in view and logs out', () => {
    useAuthStore.setState({ session: 'sess', account });
    renderWithLocale(<LoginCard />);

    expect(screen.getByText('basis')).toBeTruthy();
    expect(screen.queryByTitle(account.linkingKey)).toBeNull();
    // The Lightning Address section is wired into the signed-in view.
    expect(screen.getByRole('button', { name: /save name/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /link address/i })).toBeTruthy();

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

    expect(await screen.findByText('basis')).toBeTruthy();
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
