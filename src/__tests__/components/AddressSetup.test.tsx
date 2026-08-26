import { cleanup, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AddressSetup } from '@/components/AddressSetup';
import { usePasskeyLogin } from '@/hooks/usePasskeyLogin';
import { useAuthStore } from '@/stores/auth-store';
import { renderWithLocale } from '@/__tests__/render-with-locale';

vi.mock('next/navigation', () => ({
  useRouter: (): { replace: () => void } => ({ replace: vi.fn() }),
}));
vi.mock('@/hooks/usePasskeyLogin', () => ({ usePasskeyLogin: vi.fn() }));
vi.mock('@/lib/api', () => ({
  setName: vi.fn(),
  setLightningAddress: vi.fn(),
  unlinkLightningAddress: vi.fn(),
}));

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
      lightningAddress: null,
      lightningAddressVerified: false,
      createdAt: 1,
    },
  });
});

afterEach(() => {
  cleanup();
});

describe('AddressSetup', () => {
  it('asks for a Wallet of Satoshi address after the name', () => {
    renderWithLocale(<AddressSetup />);
    expect(screen.getByRole('heading', { name: 'Your Wallet of Satoshi address' })).toBeTruthy();
    expect(screen.getByText('Hi, Ada')).toBeTruthy();
    expect(screen.getByRole('button', { name: /link address/i })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /save name/i })).toBeNull();
  });

  it('omits the greeting when the store has no name', () => {
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
    renderWithLocale(<AddressSetup />);
    expect(screen.queryByText(/Hi,/)).toBeNull();
    expect(screen.getByRole('button', { name: /link address/i })).toBeTruthy();
  });
});
