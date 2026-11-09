import { cleanup, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { UsernameSetup } from '@/components/UsernameSetup';
import { useAuthStore } from '@/stores/auth-store';
import { renderWithLocale } from '@/__tests__/render-with-locale';

vi.mock('@/lib/api', () => ({
  setUsername: vi.fn(),
}));

beforeEach(() => {
  useAuthStore.setState({
    session: 'tok',
    account: {
      id: 'acc_1',
      linkingKey: null,
      role: 'basis',
      name: 'Ada',
      username: null,
      location: null,
      lightningAddress: null,
      lightningAddressVerified: false,
      forumLawsDismissed: false,
      createdAt: 1,
      rulesAgreedAt: null,
      viewKey: 'a'.repeat(64),
      aboutMe: null,
      aboutMeHasPhoto: false,
      setup: 'username',
      missing: ['username', 'lightning-address', 'rules'],
    },
  });
});

afterEach(() => {
  cleanup();
});

describe('UsernameSetup', () => {
  it('asks for a 21.gifts name and has no Skip control', () => {
    renderWithLocale(<UsernameSetup />);
    expect(screen.getByRole('heading', { name: 'Your 21.gifts name' }).className).toContain(
      'sm:text-3xl',
    );
    expect(screen.getByRole('button', { name: /continue/i })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Skip' })).toBeNull();
  });

  it('leaves out the address hint once the account wallet is verified', () => {
    const account = useAuthStore.getState().account;
    useAuthStore.setState({
      account: account === null ? null : { ...account, username: 'ada', sparkWalletVerified: true },
    });
    renderWithLocale(<UsernameSetup />);
    expect(screen.queryByText(/goes straight into your own wallet/)).toBeNull();
    expect(
      screen.getByText(
        'Your username can no longer be changed because your wallet address uses it.',
      ),
    ).toBeTruthy();
  });
});
