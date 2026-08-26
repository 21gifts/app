import { cleanup, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OnboardingGate } from '@/components/OnboardingGate';
import { usePasskeyLogin } from '@/hooks/usePasskeyLogin';
import { loadSession } from '@/lib/session-storage';
import { useAuthStore } from '@/stores/auth-store';
import { renderWithLocale } from '@/__tests__/render-with-locale';

const replace = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: (): { replace: typeof replace } => ({ replace }),
}));
vi.mock('@/hooks/usePasskeyLogin', () => ({ usePasskeyLogin: vi.fn() }));
vi.mock('@/lib/session-storage', () => ({
  loadSession: vi.fn(),
  saveSession: vi.fn(),
  clearSession: vi.fn(),
}));
vi.mock('@/lib/api', () => ({
  fetchMe: vi.fn(),
}));

const account = {
  id: 'acc_1',
  linkingKey: null as string | null,
  role: 'basis' as const,
  name: null as string | null,
  lightningAddress: null as string | null,
  lightningAddressVerified: false,
  createdAt: 1,
};

beforeEach(() => {
  replace.mockClear();
  vi.mocked(loadSession).mockReturnValue(null);
  vi.mocked(usePasskeyLogin).mockReturnValue({
    status: 'idle',
    login: vi.fn(),
    register: vi.fn(),
    authenticate: vi.fn(),
    retry: vi.fn(),
    cancel: vi.fn(),
  });
  useAuthStore.setState({ session: null, account: null });
});

afterEach(() => {
  cleanup();
});

describe('OnboardingGate', () => {
  it('renders login children while logged out', () => {
    renderWithLocale(
      <OnboardingGate screen="login">
        <p>login-ui</p>
      </OnboardingGate>,
    );
    expect(screen.getByText('login-ui')).toBeTruthy();
    expect(replace).not.toHaveBeenCalled();
  });

  it('sends a signed-in visitor from login to the name screen', () => {
    useAuthStore.setState({ session: 'tok', account });
    renderWithLocale(
      <OnboardingGate screen="login">
        <p>login-ui</p>
      </OnboardingGate>,
    );
    expect(replace).toHaveBeenCalledWith('/setup/name');
  });

  it('sends a logged-out visitor from welcome to login', () => {
    renderWithLocale(
      <OnboardingGate screen="welcome">
        <p>welcome-ui</p>
      </OnboardingGate>,
    );
    expect(replace).toHaveBeenCalledWith('/login');
  });
});
