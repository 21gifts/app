import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LoginCard } from '@/components/LoginCard';
import { useLnurlLogin, type LoginStatus } from '@/hooks/useLnurlLogin';
import { usePasskeyLogin, type PasskeyStatus } from '@/hooks/usePasskeyLogin';
import { fetchMe } from '@/lib/api';
import { clearSession, loadSession } from '@/lib/session-storage';
import { useAuthStore } from '@/stores/auth-store';
import { renderWithLocale } from '@/__tests__/render-with-locale';

vi.mock('@/hooks/useLnurlLogin', () => ({ useLnurlLogin: vi.fn() }));
vi.mock('@/hooks/usePasskeyLogin', () => ({ usePasskeyLogin: vi.fn() }));
vi.mock('@/lib/session-storage', () => ({
  loadSession: vi.fn(),
  saveSession: vi.fn(),
  clearSession: vi.fn(),
}));
vi.mock('@/lib/api', () => ({
  fetchMe: vi.fn(),
  startLnurlAuth: vi.fn(),
  pollSession: vi.fn(),
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

const startSpy = vi.fn();
const registerSpy = vi.fn();
const authenticateSpy = vi.fn();
const retrySpy = vi.fn();
const ORIGINAL_UA = window.navigator.userAgent;

/** Points the mocked LNURL hook at a fixed state for the next render. */
function mockHook(status: LoginStatus, lnurl: string | null): void {
  vi.mocked(useLnurlLogin).mockReturnValue({ status, lnurl, start: startSpy });
}

/** Points the mocked passkey hook at a fixed state for the next render. */
function mockPasskey(status: PasskeyStatus = 'idle'): void {
  vi.mocked(usePasskeyLogin).mockReturnValue({
    status,
    register: registerSpy,
    authenticate: authenticateSpy,
    retry: retrySpy,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  useAuthStore.setState({ session: null, account: null });
  vi.mocked(loadSession).mockReturnValue(null);
  mockHook('idle', null);
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
    const wallet = screen.getByRole('button', { name: /log in with wallet of satoshi/i });
    fireEvent.click(wallet);
    expect(startSpy).toHaveBeenCalledTimes(1);
  });

  it('shows a loading state while a passkey ceremony starts', () => {
    mockPasskey('starting');
    renderWithLocale(<LoginCard />);
    expect(screen.getByText('Preparing your login…')).toBeTruthy();
  });

  it('hides the linking key when the signed-in account has none', () => {
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

  it('shows a loading state while starting', () => {
    mockHook('starting', null);
    renderWithLocale(<LoginCard />);
    expect(screen.getByText('Preparing your login…')).toBeTruthy();
  });

  it('shows the QR and Wallet of Satoshi link while waiting on desktop', () => {
    mockHook('waiting', 'lnurl1abc');
    renderWithLocale(<LoginCard />);

    expect(screen.getByRole('img', { name: 'Login QR code' })).toBeTruthy();
    const wos = screen.getByRole('link', { name: /open wallet of satoshi/i });
    expect(wos.getAttribute('href')).toBe('walletofsatoshi:lightning:LNURL1ABC');
    expect(screen.queryByRole('link', { name: /open default lightning wallet/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /copy login code/i })).toBeNull();
  });

  it('pins Wallet of Satoshi via Android intent', () => {
    Object.defineProperty(window.navigator, 'userAgent', {
      value: 'Mozilla/5.0 (Linux; Android 14; Pixel 8)',
      configurable: true,
    });
    mockHook('waiting', 'lnurl1abc');
    renderWithLocale(<LoginCard />);

    const wos = screen.getByRole('link', { name: /open wallet of satoshi/i });
    expect(wos.getAttribute('href')).toBe(
      'intent:lightning:LNURL1ABC#Intent;scheme=walletofsatoshi;package=com.livingroomofsatoshi.wallet;S.browser_fallback_url=https%3A%2F%2Fplay.google.com%2Fstore%2Fapps%2Fdetails%3Fid%3Dcom.livingroomofsatoshi.wallet;end',
    );
    expect(screen.queryByRole('link', { name: /open default lightning wallet/i })).toBeNull();
  });

  it('falls back to the start view when waiting without an lnurl', () => {
    mockHook('waiting', null);
    renderWithLocale(<LoginCard />);
    expect(screen.getByRole('button', { name: /log in with wallet of satoshi/i })).toBeTruthy();
  });

  it('shows the expired state with a working retry', () => {
    mockHook('expired', null);
    renderWithLocale(<LoginCard />);
    expect(screen.getByText('Login expired')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /try again/i }));
    expect(startSpy).toHaveBeenCalledTimes(1);
  });

  it('shows the error state with a working retry', () => {
    mockHook('error', null);
    renderWithLocale(<LoginCard />);
    expect(screen.getByText('Something went wrong. Please try again.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /try again/i }));
    expect(startSpy).toHaveBeenCalledTimes(1);
  });

  it('shows the signed-in view and logs out', () => {
    useAuthStore.setState({ session: 'sess', account });
    renderWithLocale(<LoginCard />);

    expect(screen.getByText('basis')).toBeTruthy();
    expect(screen.getByTitle(account.linkingKey)).toBeTruthy();
    // The Lightning Address section is wired into the signed-in view.
    expect(screen.getByRole('button', { name: /save name/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /link address/i })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /log out/i }));
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
