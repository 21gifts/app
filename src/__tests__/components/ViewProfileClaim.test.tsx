import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ViewProfileClaim } from '@/components/ViewProfileClaim';
import { usePasskeyLogin, type PasskeyStatus } from '@/hooks/usePasskeyLogin';
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
  hydrateReady.current = true;
  useAuthStore.setState({ session: null, account: null });
  mockPasskey('idle');
});

afterEach(() => {
  cleanup();
});

describe('ViewProfileClaim', () => {
  it('shows a spinner until session hydration is ready', () => {
    hydrateReady.current = false;
    const { container } = renderWithLocale(<ViewProfileClaim viewKey={VIEW_KEY} />);
    expect(container.querySelector('.animate-spin')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Set up passkey for this profile' })).toBeNull();
  });

  it('shows an icon-only claim button when logged out', () => {
    renderWithLocale(<ViewProfileClaim viewKey={VIEW_KEY} />);
    const button = screen.getByRole('button', { name: 'Set up passkey for this profile' });
    expect(button).toBeTruthy();
    expect(screen.queryByText('Set up passkey for this profile')).toBeNull();
  });

  it('calls register(viewKey) on click', () => {
    renderWithLocale(<ViewProfileClaim viewKey={VIEW_KEY} />);
    fireEvent.click(screen.getByRole('button', { name: 'Set up passkey for this profile' }));
    expect(registerSpy).toHaveBeenCalledWith(VIEW_KEY);
  });

  it('replaces to /setup/rules after a successful claim', async () => {
    registerSpy.mockImplementation(() => {
      useAuthStore.setState({ session: 'tok', account });
    });
    renderWithLocale(<ViewProfileClaim viewKey={VIEW_KEY} />);
    fireEvent.click(screen.getByRole('button', { name: 'Set up passkey for this profile' }));
    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith('/setup/rules');
    });
  });

  it('hides the button and does not redirect when already signed in', () => {
    useAuthStore.setState({ session: 'tok', account });
    renderWithLocale(<ViewProfileClaim viewKey={VIEW_KEY} />);
    expect(screen.queryByRole('button', { name: 'Set up passkey for this profile' })).toBeNull();
    expect(replace).not.toHaveBeenCalled();
  });

  it('shows already-claimed copy on 409', () => {
    mockPasskey('error', 'This profile already has a passkey');
    renderWithLocale(<ViewProfileClaim viewKey={VIEW_KEY} />);
    expect(screen.getByText('This profile already has a passkey. Log in instead.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Set up passkey for this profile' }));
    expect(authenticateSpy).toHaveBeenCalledTimes(1);
  });

  it('shows in-app copy when passkeys are unsupported', () => {
    mockPasskey('unsupported');
    renderWithLocale(<ViewProfileClaim viewKey={VIEW_KEY} />);
    expect(screen.getByText('Open this page in your browser')).toBeTruthy();
  });

  it('shows a spinner while the ceremony is starting', () => {
    mockPasskey('starting');
    const { container } = renderWithLocale(<ViewProfileClaim viewKey={VIEW_KEY} />);
    expect(container.querySelector('.animate-spin')).toBeTruthy();
  });

  it('shows claimError copy on other errors', () => {
    mockPasskey('error', 'network down');
    renderWithLocale(<ViewProfileClaim viewKey={VIEW_KEY} />);
    expect(screen.getByText('Could not set up a passkey. Please try again.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(retrySpy).toHaveBeenCalledTimes(1);
  });
});
