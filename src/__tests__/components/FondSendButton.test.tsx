import { cleanup, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FondSendButton } from '@/components/FondSendButton';
import { renderWithLocale } from '@/__tests__/render-with-locale';
import type { UseWalletResult } from '@/hooks/useWallet';
import type { Account } from '@/lib/api-types';
import { useAuthStore } from '@/stores/auth-store';

const mocks = vi.hoisted(() => ({
  session: 'sess' as string | null,
  status: 'ready' as UseWalletResult['status'],
}));

vi.mock('@/hooks/useActiveSession', () => ({
  useActiveSession: () => mocks.session,
}));

vi.mock('@/hooks/useWallet', () => ({
  useWallet: (): UseWalletResult => ({
    status: mocks.status,
    balanceSats: mocks.status === 'ready' ? 21_000 : null,
    retry: vi.fn(),
    downloading: false,
    setupFailed: false,
    retrying: false,
  }),
}));

/**
 * Signs in an account with `username` in the auth store.
 *
 * @param username - The signed-in member's handle, or `null`.
 */
function signIn(username: string | null): void {
  useAuthStore.setState({
    session: 'sess',
    account: { id: 'acc-1', username } as unknown as Account,
  });
}

beforeEach(() => {
  mocks.session = 'sess';
  mocks.status = 'ready';
  signIn('ada');
});

afterEach(() => {
  cleanup();
  useAuthStore.setState({ session: null, account: null });
});

describe('FondSendButton', () => {
  it('links a signed-in member with a ready wallet to the Send flow for the Fond', () => {
    renderWithLocale(<FondSendButton username="tondo-fond" />);
    const link = screen.getByRole('link', { name: 'Send from your wallet' });
    expect(link.getAttribute('href')).toBe('/wallet?send=tondo-fond');
    expect(link.className).toContain('bg-app-btn');
    expect(link.className).toContain('w-full');
  });

  it('lower-cases and encodes the handle in the link', () => {
    renderWithLocale(<FondSendButton username=" Tondo-Fond " />);
    const link = screen.getByRole('link', { name: 'Send from your wallet' });
    expect(link.getAttribute('href')).toBe('/wallet?send=tondo-fond');
  });

  it('also shows for a member without a username of their own', () => {
    signIn(null);
    renderWithLocale(<FondSendButton username="tondo-fond" />);
    expect(screen.getByRole('link', { name: 'Send from your wallet' })).toBeTruthy();
  });

  it('shows nothing to a signed-out visitor or a login whose wallet is still opening', () => {
    mocks.session = null;
    const { container } = renderWithLocale(<FondSendButton username="tondo-fond" />);
    expect(screen.queryByRole('link', { name: 'Send from your wallet' })).toBeNull();
    expect(container.textContent).toBe('');
  });

  it('shows nothing while the wallet is connecting, failed, or not available', () => {
    for (const status of ['connecting', 'error', 'disabled'] as const) {
      mocks.status = status;
      renderWithLocale(<FondSendButton username="tondo-fond" />);
      expect(screen.queryByRole('link', { name: 'Send from your wallet' })).toBeNull();
      cleanup();
    }
  });

  it('shows nothing to the Fond account itself (any case)', () => {
    signIn('Tondo-Fond');
    renderWithLocale(<FondSendButton username="tondo-fond" />);
    expect(screen.queryByRole('link', { name: 'Send from your wallet' })).toBeNull();
  });

  it('shows nothing for a blank handle', () => {
    renderWithLocale(<FondSendButton username="  " />);
    expect(screen.queryByRole('link', { name: 'Send from your wallet' })).toBeNull();
  });
});
