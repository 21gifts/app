import { cleanup, fireEvent, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PasskeyRenewNotice } from '@/components/PasskeyRenewNotice';
import { postPasskeyRenewAck } from '@/lib/api';
import { renewPasskey } from '@/lib/passkey-renew';
import type { Account } from '@/lib/api-types';
import { useAuthStore } from '@/stores/auth-store';
import { renderWithLocale } from '@/__tests__/render-with-locale';

vi.mock('@/lib/passkey-renew', () => ({
  renewPasskey: vi.fn(),
}));

vi.mock('@/lib/api', () => ({
  postPasskeyRenewAck: vi.fn(),
}));

const account = {
  id: 'acc_1',
  linkingKey: null,
  role: 'basis',
  name: null,
  location: null,
  lightningAddress: null,
  lightningAddressVerified: false,
  forumLawsDismissed: false,
  createdAt: 1,
  rulesAgreedAt: null,
  viewKey: 'a'.repeat(64),
  aboutMe: null,
  aboutMeHasPhoto: false,
  setup: null,
  missing: [],
  walletRequired: false,
  passkeyCredentialId: null,
  passkeyRenewFailed: false,
} as Account;

afterEach(() => {
  cleanup();
  useAuthStore.setState({ session: null, account: null });
  vi.clearAllMocks();
});

describe('PasskeyRenewNotice', () => {
  it('shows the renew bar and hides the dialog until a failure is open', () => {
    useAuthStore.setState({ session: 'tok', account });
    renderWithLocale(<PasskeyRenewNotice />);
    expect(screen.getByRole('button', { name: 'Renew passkey' })).toBeTruthy();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('starts the ceremony from the bar and stores a successful account', async () => {
    const next = { ...account, walletRequired: true, passkeyCredentialId: 'seed' };
    vi.mocked(renewPasskey).mockResolvedValue({
      outcome: 'ok',
      account: next,
      prfFirst: new Uint8Array([1]),
    });
    useAuthStore.setState({ session: 'tok', account });
    renderWithLocale(<PasskeyRenewNotice />);
    fireEvent.click(screen.getByRole('button', { name: 'Renew passkey' }));
    await screen.findByRole('button', { name: 'Renew passkey' });
    expect(renewPasskey).toHaveBeenCalledWith('tok');
    expect(useAuthStore.getState().account).toEqual(next);
  });

  it('shows the failure dialog and hides it after OK', async () => {
    const open = { ...account, passkeyRenewFailed: true };
    const closed = { ...account, passkeyRenewFailed: false };
    vi.mocked(postPasskeyRenewAck).mockResolvedValue(closed);
    useAuthStore.setState({ session: 'tok', account: open });
    renderWithLocale(<PasskeyRenewNotice />);
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(
      screen.getByText('You can try again later. You do not need to do anything now.'),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'OK' }));
    await screen.findByRole('button', { name: 'Renew passkey' });
    expect(postPasskeyRenewAck).toHaveBeenCalledWith('tok');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('keeps the dialog when acknowledgement fails', async () => {
    vi.mocked(postPasskeyRenewAck).mockRejectedValue(new Error('nope'));
    useAuthStore.setState({
      session: 'tok',
      account: { ...account, passkeyRenewFailed: true },
    });
    renderWithLocale(<PasskeyRenewNotice />);
    fireEvent.click(screen.getByRole('button', { name: 'OK' }));
    await screen.findByRole('dialog');
    expect(screen.getByRole('dialog')).toBeTruthy();
  });

  it('does not start a ceremony without a session', () => {
    useAuthStore.setState({ session: null, account });
    renderWithLocale(<PasskeyRenewNotice />);
    fireEvent.click(screen.getByRole('button', { name: 'Renew passkey' }));
    expect(renewPasskey).not.toHaveBeenCalled();
  });

  it('does not acknowledge without a session', () => {
    useAuthStore.setState({
      session: null,
      account: { ...account, passkeyRenewFailed: true },
    });
    renderWithLocale(<PasskeyRenewNotice />);
    fireEvent.click(screen.getByRole('button', { name: 'OK' }));
    expect(postPasskeyRenewAck).not.toHaveBeenCalled();
  });
});
