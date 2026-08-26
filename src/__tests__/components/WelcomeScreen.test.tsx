import { cleanup, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WelcomeScreen } from '@/components/WelcomeScreen';
import { usePasskeyLogin } from '@/hooks/usePasskeyLogin';
import { useAuthStore } from '@/stores/auth-store';
import { renderWithLocale } from '@/__tests__/render-with-locale';

vi.mock('next/navigation', () => ({
  useRouter: (): { replace: () => void } => ({ replace: vi.fn() }),
}));
vi.mock('@/hooks/usePasskeyLogin', () => ({ usePasskeyLogin: vi.fn() }));

beforeEach(() => {
  vi.mocked(usePasskeyLogin).mockReturnValue({
    status: 'idle',
    login: vi.fn(),
    register: vi.fn(),
    authenticate: vi.fn(),
    retry: vi.fn(),
    cancel: vi.fn(),
  });
  useAuthStore.setState({
    session: 'tok',
    account: {
      id: 'acc_1',
      linkingKey: null,
      role: 'basis',
      name: 'Ada',
      lightningAddress: 'alice@walletofsatoshi.com',
      lightningAddressVerified: false,
      createdAt: 1,
    },
  });
});

afterEach(() => {
  cleanup();
});

describe('WelcomeScreen', () => {
  it('shows a welcome without name or address forms', () => {
    renderWithLocale(<WelcomeScreen />);
    expect(screen.getByRole('heading', { name: 'Welcome, Ada' })).toBeTruthy();
    expect(screen.getByRole('link', { name: /send a gift/i }).getAttribute('href')).toBe('/donate');
    expect(screen.queryByRole('button', { name: /unlink/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /save name/i })).toBeNull();
  });

  it('still renders a welcome heading when the store has no name', () => {
    useAuthStore.setState({
      session: 'tok',
      account: {
        id: 'acc_1',
        linkingKey: null,
        role: 'basis',
        name: null,
        lightningAddress: 'alice@walletofsatoshi.com',
        lightningAddressVerified: false,
        createdAt: 1,
      },
    });
    renderWithLocale(<WelcomeScreen />);
    expect(screen.getByRole('heading', { name: /Welcome/ })).toBeTruthy();
  });
});
