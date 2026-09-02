import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ViewProfileClaim } from '@/components/ViewProfileClaim';
import { usePasskeyLogin, type PasskeyStatus } from '@/hooks/usePasskeyLogin';
import { isInAppBrowser } from '@/lib/in-app-browser';
import { useAuthStore } from '@/stores/auth-store';
import { renderWithLocale } from '@/__tests__/render-with-locale';

const VIEW_KEY = 'a'.repeat(64);
const replace = vi.fn();
const loginSpy = vi.fn();
const registerSpy = vi.fn();
const authenticateSpy = vi.fn();
const retrySpy = vi.fn();
const cancelSpy = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: (): { replace: typeof replace } => ({ replace }),
}));

vi.mock('@/hooks/usePasskeyLogin', () => ({ usePasskeyLogin: vi.fn() }));
const hydrateReady = { current: true };
vi.mock('@/hooks/useHydrateSession', () => ({
  useHydrateSession: (): { ready: boolean } => ({ ready: hydrateReady.current }),
}));

vi.mock('@/lib/in-app-browser', () => ({
  isInAppBrowser: vi.fn(() => false),
  openInSystemBrowser: vi.fn(),
}));

const account = {
  id: 'acc_1',
  linkingKey: null as string | null,
  role: 'basis' as const,
  name: 'Ada',
  lightningAddress: 'alice@walletofsatoshi.com',
  lightningAddressVerified: false,
  forumLawsDismissed: false,
  createdAt: 1,
  rulesAgreedAt: null,
  viewKey: VIEW_KEY,
  setup: 'rules' as const,
  missing: ['rules'] as ('name' | 'lightning-address' | 'rules')[],
};

/** Points the mocked passkey hook at a fixed state for the next render. */
function mockPasskey(status: PasskeyStatus = 'idle', error: string | null = null): void {
  vi.mocked(usePasskeyLogin).mockReturnValue({
    status,
    login: loginSpy,
    register: registerSpy,
    authenticate: authenticateSpy,
    retry: retrySpy,
    cancel: cancelSpy,
    error: status === 'error' ? error : null,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  registerSpy.mockReset();
  authenticateSpy.mockReset();
  retrySpy.mockReset();
  cancelSpy.mockReset();
  loginSpy.mockReset();
  replace.mockReset();
  hydrateReady.current = true;
  useAuthStore.setState({ session: null, account: null });
  vi.mocked(isInAppBrowser).mockReturnValue(false);
  mockPasskey('idle');
});

afterEach(() => {
  cleanup();
});

describe('ViewProfileClaim', () => {
  it('shows a spinner until session hydration is ready', () => {
    hydrateReady.current = false;
    const { container } = renderWithLocale(
      <ViewProfileClaim viewKey={VIEW_KEY} hasPasskey={false} />,
    );
    expect(container.querySelector('.animate-spin')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Activate' })).toBeNull();
  });

  it('shows activation copy and Activate when logged out without a passkey', () => {
    renderWithLocale(<ViewProfileClaim viewKey={VIEW_KEY} hasPasskey={false} />);
    expect(screen.getByText('Action required, the account must be activated')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Activate' })).toBeTruthy();
  });

  it('calls register(viewKey) when Activate is clicked', () => {
    renderWithLocale(<ViewProfileClaim viewKey={VIEW_KEY} hasPasskey={false} />);
    fireEvent.click(screen.getByRole('button', { name: 'Activate' }));
    expect(registerSpy).toHaveBeenCalledWith(VIEW_KEY);
  });

  it('hides the Activate button when the profile already has a passkey', () => {
    renderWithLocale(<ViewProfileClaim viewKey={VIEW_KEY} hasPasskey={true} />);
    expect(screen.queryByRole('button', { name: 'Activate' })).toBeNull();
    expect(screen.queryByText('Action required, the account must be activated')).toBeNull();
  });

  it('hides everything when claimed even if signed in', () => {
    useAuthStore.setState({ session: 'tok', account });
    renderWithLocale(<ViewProfileClaim viewKey={VIEW_KEY} hasPasskey={true} />);
    expect(screen.queryByRole('button', { name: 'Activate' })).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Open this page in your browser' })).toBeNull();
    expect(replace).not.toHaveBeenCalled();
  });

  it('hides everything when claimed even in an in-app browser', async () => {
    vi.mocked(isInAppBrowser).mockReturnValue(true);
    renderWithLocale(<ViewProfileClaim viewKey={VIEW_KEY} hasPasskey={true} />);
    await waitFor(() => {
      expect(isInAppBrowser).toHaveBeenCalled();
    });
    expect(screen.queryByRole('button', { name: 'Activate' })).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Open this page in your browser' })).toBeNull();
  });

  it('replaces to /setup/rules after a successful claim', async () => {
    registerSpy.mockImplementation(() => {
      useAuthStore.setState({ session: 'tok', account });
    });
    renderWithLocale(<ViewProfileClaim viewKey={VIEW_KEY} hasPasskey={false} />);
    fireEvent.click(screen.getByRole('button', { name: 'Activate' }));
    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith('/setup/rules');
    });
  });

  it('shows Activate when signed in on an unclaimed profile and does not redirect on mount', () => {
    useAuthStore.setState({ session: 'tok', account });
    renderWithLocale(<ViewProfileClaim viewKey={VIEW_KEY} hasPasskey={false} />);
    expect(screen.getByRole('button', { name: 'Activate' })).toBeTruthy();
    expect(screen.getByText('Action required, the account must be activated')).toBeTruthy();
    expect(replace).not.toHaveBeenCalled();
  });

  it('clears the signed-in session then register(viewKey) when Activate is clicked', () => {
    useAuthStore.setState({ session: 'tok', account });
    renderWithLocale(<ViewProfileClaim viewKey={VIEW_KEY} hasPasskey={false} />);
    fireEvent.click(screen.getByRole('button', { name: 'Activate' }));
    expect(cancelSpy).toHaveBeenCalled();
    expect(useAuthStore.getState().account).toBeNull();
    expect(useAuthStore.getState().session).toBeNull();
    expect(registerSpy).toHaveBeenCalledWith(VIEW_KEY);
  });

  it('shows already-claimed copy on 409', async () => {
    authenticateSpy.mockImplementation(() => {
      useAuthStore.setState({ session: 'tok', account });
    });
    mockPasskey('error', 'This profile already has a passkey');
    const { rerender } = renderWithLocale(
      <ViewProfileClaim viewKey={VIEW_KEY} hasPasskey={false} />,
    );
    expect(screen.getByText('This profile already has a passkey. Log in instead.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Set up a passkey for this profile' }));
    expect(authenticateSpy).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(useAuthStore.getState().account).not.toBeNull();
    });
    expect(replace).not.toHaveBeenCalled();
    mockPasskey('idle');
    rerender(<ViewProfileClaim viewKey={VIEW_KEY} hasPasskey={false} />);
    expect(screen.queryByRole('button', { name: 'Activate' })).toBeNull();
    expect(screen.queryByText('Action required, the account must be activated')).toBeNull();
  });

  it('keeps already-claimed copy if login-instead is cancelled', () => {
    mockPasskey('error', 'This profile already has a passkey');
    const { rerender } = renderWithLocale(
      <ViewProfileClaim viewKey={VIEW_KEY} hasPasskey={false} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Set up a passkey for this profile' }));
    mockPasskey('idle');
    rerender(<ViewProfileClaim viewKey={VIEW_KEY} hasPasskey={false} />);
    expect(screen.getByText('This profile already has a passkey. Log in instead.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Activate' })).toBeNull();
  });

  it('shows a spinner while login-instead is starting', () => {
    mockPasskey('error', 'This profile already has a passkey');
    const { rerender, container } = renderWithLocale(
      <ViewProfileClaim viewKey={VIEW_KEY} hasPasskey={false} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Set up a passkey for this profile' }));
    mockPasskey('starting');
    rerender(<ViewProfileClaim viewKey={VIEW_KEY} hasPasskey={false} />);
    expect(container.querySelector('.animate-spin')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Activate' })).toBeNull();
  });

  it('shows claimError if login-instead fails with a non-409 error', () => {
    mockPasskey('error', 'This profile already has a passkey');
    const { rerender } = renderWithLocale(
      <ViewProfileClaim viewKey={VIEW_KEY} hasPasskey={false} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Set up a passkey for this profile' }));
    mockPasskey('error', 'network down');
    rerender(<ViewProfileClaim viewKey={VIEW_KEY} hasPasskey={false} />);
    expect(screen.getByText('Could not set up a passkey. Please try again.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(retrySpy).toHaveBeenCalledTimes(1);
  });

  it('shows the in-app escape card when passkeys are unsupported', () => {
    mockPasskey('unsupported');
    renderWithLocale(<ViewProfileClaim viewKey={VIEW_KEY} hasPasskey={false} />);
    expect(screen.getByRole('heading', { name: 'Open this page in your browser' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Open in browser' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Activate' })).toBeNull();
  });

  it('shows the in-app escape card on mount when isInAppBrowser is true', async () => {
    vi.mocked(isInAppBrowser).mockReturnValue(true);
    renderWithLocale(<ViewProfileClaim viewKey={VIEW_KEY} hasPasskey={false} />);
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Open this page in your browser' })).toBeTruthy();
    });
    expect(screen.getByRole('button', { name: 'Open in browser' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Activate' })).toBeNull();
  });

  it('shows a spinner while the ceremony is starting', () => {
    mockPasskey('starting');
    const { container } = renderWithLocale(
      <ViewProfileClaim viewKey={VIEW_KEY} hasPasskey={false} />,
    );
    expect(container.querySelector('.animate-spin')).toBeTruthy();
  });

  it('shows claimError copy on other errors', () => {
    mockPasskey('error', 'network down');
    renderWithLocale(<ViewProfileClaim viewKey={VIEW_KEY} hasPasskey={false} />);
    expect(screen.getByText('Could not set up a passkey. Please try again.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(retrySpy).toHaveBeenCalledTimes(1);
  });

  it('shows claimError when signed in on an unclaimed profile', () => {
    useAuthStore.setState({ session: 'tok', account });
    mockPasskey('error', 'network down');
    renderWithLocale(<ViewProfileClaim viewKey={VIEW_KEY} hasPasskey={false} />);
    expect(screen.getByText('Could not set up a passkey. Please try again.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Activate' })).toBeNull();
  });
});
