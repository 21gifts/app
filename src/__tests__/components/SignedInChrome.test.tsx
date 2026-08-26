import { cleanup, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SignedInChrome } from '@/components/SignedInChrome';
import { usePasskeyLogin } from '@/hooks/usePasskeyLogin';
import { useAuthStore } from '@/stores/auth-store';
import { renderWithLocale } from '@/__tests__/render-with-locale';

const replace = vi.fn();
const refresh = vi.fn();
const cancel = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: (): { replace: typeof replace; refresh: typeof refresh } => ({
    replace,
    refresh,
  }),
}));
vi.mock('@/hooks/usePasskeyLogin', () => ({ usePasskeyLogin: vi.fn() }));
vi.mock('@/lib/session-storage', () => ({
  loadSession: vi.fn(),
  saveSession: vi.fn(),
  clearSession: vi.fn(),
}));

beforeEach(() => {
  replace.mockClear();
  refresh.mockClear();
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
      createdAt: 1,
    },
  });
});

afterEach(() => {
  cleanup();
});

describe('SignedInChrome', () => {
  it('renders the language select and log-out button', () => {
    renderWithLocale(<SignedInChrome />);
    expect(screen.getByLabelText('Language')).toBeTruthy();
    expect(screen.getByRole('button', { name: /log out/i })).toBeTruthy();
  });
});
