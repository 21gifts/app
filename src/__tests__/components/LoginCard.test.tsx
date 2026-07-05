import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LoginCard } from '@/components/LoginCard';
import { useLnurlLogin, type LoginStatus } from '@/hooks/useLnurlLogin';
import { fetchMe } from '@/lib/api';
import { clearSession, loadSession } from '@/lib/session-storage';
import { useAuthStore } from '@/stores/auth-store';

vi.mock('@/hooks/useLnurlLogin', () => ({ useLnurlLogin: vi.fn() }));
vi.mock('@/lib/session-storage', () => ({
  loadSession: vi.fn(),
  saveSession: vi.fn(),
  clearSession: vi.fn(),
}));
vi.mock('@/lib/api', () => ({
  fetchMe: vi.fn(),
  startLnurlAuth: vi.fn(),
  pollSession: vi.fn(),
}));

const account = {
  id: 'acc_1',
  linkingKey: `02${'a'.repeat(60)}`,
  role: 'basis' as const,
  createdAt: 1_700_000_000,
};

const startSpy = vi.fn();

/** Points the mocked hook at a fixed state for the next render. */
function mockHook(status: LoginStatus, lnurl: string | null): void {
  vi.mocked(useLnurlLogin).mockReturnValue({ status, lnurl, start: startSpy });
}

beforeEach(() => {
  vi.clearAllMocks();
  useAuthStore.setState({ session: null, account: null });
  vi.mocked(loadSession).mockReturnValue(null);
  mockHook('idle', null);
});

afterEach(cleanup);

describe('LoginCard', () => {
  it('shows the login call-to-action when logged out and idle', () => {
    render(<LoginCard />);
    const button = screen.getByRole('button', { name: /log in with your lightning wallet/i });
    fireEvent.click(button);
    expect(startSpy).toHaveBeenCalledTimes(1);
  });

  it('shows a loading state while starting', () => {
    mockHook('starting', null);
    render(<LoginCard />);
    expect(screen.getByText('Preparing your login…')).toBeTruthy();
  });

  it('shows the QR and wallet deep-link while waiting', () => {
    mockHook('waiting', 'lnurl1abc');
    render(<LoginCard />);

    expect(screen.getByRole('img', { name: 'Lightning login QR code' })).toBeTruthy();
    const link = screen.getByRole('link', { name: /open in wallet/i });
    expect(link.getAttribute('href')).toBe('lightning:lnurl1abc');
    expect(screen.getByText(/tap to open your wallet/i)).toBeTruthy();
  });

  it('falls back to the start view when waiting without an lnurl', () => {
    mockHook('waiting', null);
    render(<LoginCard />);
    expect(screen.getByRole('button', { name: /log in with your lightning wallet/i })).toBeTruthy();
  });

  it('shows the expired state with a working retry', () => {
    mockHook('expired', null);
    render(<LoginCard />);
    expect(screen.getByText('Login expired')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /try again/i }));
    expect(startSpy).toHaveBeenCalledTimes(1);
  });

  it('shows the error state with a working retry', () => {
    mockHook('error', null);
    render(<LoginCard />);
    expect(screen.getByText('Something went wrong. Please try again.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /try again/i }));
    expect(startSpy).toHaveBeenCalledTimes(1);
  });

  it('shows the signed-in view and logs out', () => {
    useAuthStore.setState({ session: 'sess', account });
    render(<LoginCard />);

    expect(screen.getByText('basis')).toBeTruthy();
    expect(screen.getByTitle(account.linkingKey)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /log out/i }));
    expect(clearSession).toHaveBeenCalledTimes(1);
    expect(useAuthStore.getState().account).toBeNull();
  });

  it('hydrates a valid persisted token into the signed-in view', async () => {
    vi.mocked(loadSession).mockReturnValue('tok');
    vi.mocked(fetchMe).mockResolvedValue(account);

    render(<LoginCard />);

    expect(await screen.findByText('basis')).toBeTruthy();
    expect(useAuthStore.getState().session).toBe('tok');
  });

  it('clears a stale persisted token', async () => {
    vi.mocked(loadSession).mockReturnValue('tok');
    vi.mocked(fetchMe).mockResolvedValue(null);

    render(<LoginCard />);

    await waitFor(() => {
      expect(clearSession).toHaveBeenCalledTimes(1);
    });
    expect(useAuthStore.getState().account).toBeNull();
  });

  it('logs but keeps the token when hydration fails', async () => {
    vi.mocked(loadSession).mockReturnValue('tok');
    vi.mocked(fetchMe).mockRejectedValue(new Error('500'));
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    render(<LoginCard />);

    await waitFor(() => {
      expect(errorSpy).toHaveBeenCalled();
    });
    expect(clearSession).not.toHaveBeenCalled();
    expect(useAuthStore.getState().account).toBeNull();
    errorSpy.mockRestore();
  });
});
