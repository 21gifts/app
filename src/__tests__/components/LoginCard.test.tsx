import { cleanup, fireEvent, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LoginCard } from '@/components/LoginCard';
import { usePasskeyLogin, type PasskeyStatus } from '@/hooks/usePasskeyLogin';
import { useAuthStore } from '@/stores/auth-store';
import { renderWithLocale } from '@/__tests__/render-with-locale';

vi.mock('@/hooks/usePasskeyLogin', () => ({ usePasskeyLogin: vi.fn() }));

const loginSpy = vi.fn();
const registerSpy = vi.fn();
const authenticateSpy = vi.fn();
const retrySpy = vi.fn();
const cancelPasskeySpy = vi.fn();

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
  mockPasskey('idle');
});

afterEach(() => {
  cleanup();
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

  it('shows preparing when a signed-in account is already in the store', () => {
    useAuthStore.setState({
      session: 'tok',
      account: {
        id: 'acc_1',
        linkingKey: null,
        role: 'basis',
        name: null,
        lightningAddress: null,
        lightningAddressVerified: false,
        createdAt: 1,
      },
    });
    renderWithLocale(<LoginCard />);
    expect(screen.getByText('Preparing your login…')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^log in$/i })).toBeNull();
  });

  it('shows a passkey error with try again', () => {
    mockPasskey('error');
    renderWithLocale(<LoginCard />);
    fireEvent.click(screen.getByRole('button', { name: /try again/i }));
    expect(retrySpy).toHaveBeenCalledTimes(1);
  });
});
