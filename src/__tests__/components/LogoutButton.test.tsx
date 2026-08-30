import { cleanup, fireEvent, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LogoutButton } from '@/components/LogoutButton';
import { usePasskeyLogin } from '@/hooks/usePasskeyLogin';
import { clearSession } from '@/lib/session-storage';
import { useAuthStore } from '@/stores/auth-store';
import { renderWithLocale } from '@/__tests__/render-with-locale';

const replace = vi.fn();
const cancel = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: (): { replace: typeof replace } => ({ replace }),
}));
vi.mock('@/hooks/usePasskeyLogin', () => ({ usePasskeyLogin: vi.fn() }));
vi.mock('@/lib/session-storage', () => ({
  loadSession: vi.fn(),
  saveSession: vi.fn(),
  clearSession: vi.fn(),
}));

beforeEach(() => {
  replace.mockClear();
  cancel.mockClear();
  vi.mocked(usePasskeyLogin).mockReturnValue({
    status: 'idle',
    login: vi.fn(),
    register: vi.fn(),
    authenticate: vi.fn(),
    retry: vi.fn(),
    cancel,
  });
  useAuthStore.setState({
    session: 'tok',
    account: {
      id: 'acc_1',
      linkingKey: null,
      role: 'basis',
      name: 'Ada',
      lightningAddress: null,
      lightningAddressVerified: false,
      forumLawsDismissed: false,
      createdAt: 1,
      rulesAgreedAt: null,
    },
  });
});

afterEach(() => {
  cleanup();
});

describe('LogoutButton', () => {
  it('clears the session and returns to login', () => {
    renderWithLocale(<LogoutButton />);
    fireEvent.click(screen.getByRole('button', { name: /log out/i }));
    expect(cancel).toHaveBeenCalled();
    expect(clearSession).toHaveBeenCalled();
    expect(useAuthStore.getState().account).toBeNull();
    expect(replace).toHaveBeenCalledWith('/login');
  });
});
