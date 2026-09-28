import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
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
  window.history.replaceState({}, '', '/');
});

describe('PasskeyRenewNotice', () => {
  it('explains the renew and waits for confirmation', () => {
    useAuthStore.setState({ session: 'tok', account });
    renderWithLocale(<PasskeyRenewNotice />);
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByText('Nothing changes until you confirm.', { exact: false })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'OK' })).toBeNull();
    expect(renewPasskey).not.toHaveBeenCalled();
  });

  it('shows the passkey step only after Continue, then the success confirmation', async () => {
    const next = { ...account, walletRequired: true, passkeyCredentialId: 'seed' };
    let resolveRenew: (value: Awaited<ReturnType<typeof renewPasskey>>) => void = () => undefined;
    vi.mocked(renewPasskey).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveRenew = resolve;
        }),
    );
    useAuthStore.setState({ session: 'tok', account });
    renderWithLocale(<PasskeyRenewNotice />);
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(
      await screen.findByText('Your device is showing the passkey prompt.', { exact: false }),
    ).toBeTruthy();
    resolveRenew({ outcome: 'ok', account: next, prfFirst: new Uint8Array([1]) });
    expect(await screen.findByRole('heading', { name: 'It worked' })).toBeTruthy();
    expect(useAuthStore.getState().account?.walletRequired).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'OK' }));
    await waitFor(() => {
      expect(useAuthStore.getState().account).toEqual(next);
    });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('returns to the explanation when the device prompt is cancelled', async () => {
    vi.mocked(renewPasskey).mockResolvedValue({ outcome: 'cancelled' });
    useAuthStore.setState({ session: 'tok', account });
    renderWithLocale(<PasskeyRenewNotice />);
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(await screen.findByRole('button', { name: 'Continue' })).toBeTruthy();
    expect(screen.queryByText('The renewal did not work. You can try again.')).toBeNull();
  });

  it('shows the failure confirmation and try again returns to the explanation', async () => {
    vi.mocked(renewPasskey).mockResolvedValue({ outcome: 'failed', kind: 'generic' });
    vi.mocked(postPasskeyRenewAck).mockResolvedValue(account);
    useAuthStore.setState({ session: 'tok', account });
    renderWithLocale(<PasskeyRenewNotice />);
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(await screen.findByText('The renewal did not work. You can try again.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('button', { name: 'Continue' })).toBeTruthy();
    expect(postPasskeyRenewAck).toHaveBeenCalledWith('tok');
  });

  it('starts on the failure confirmation when a failure is still open', () => {
    useAuthStore.setState({
      session: 'tok',
      account: { ...account, passkeyRenewFailed: true },
    });
    renderWithLocale(<PasskeyRenewNotice />);
    expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Continue' })).toBeNull();
  });

  it('keeps the failure confirmation when acknowledgement fails', async () => {
    vi.mocked(postPasskeyRenewAck).mockRejectedValue(new Error('nope'));
    useAuthStore.setState({
      session: 'tok',
      account: { ...account, passkeyRenewFailed: true },
    });
    renderWithLocale(<PasskeyRenewNotice />);
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await screen.findByRole('button', { name: 'Try again' });
    expect(screen.getByText('The renewal did not work. You can try again.')).toBeTruthy();
  });

  it('does not start without a session', () => {
    useAuthStore.setState({ session: null, account });
    renderWithLocale(<PasskeyRenewNotice />);
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(renewPasskey).not.toHaveBeenCalled();
  });

  it('shows the screenshot steps from the visual query', () => {
    window.history.replaceState({}, '', '/welcome?visual=renew-passkey');
    useAuthStore.setState({ session: 'tok', account });
    const passkey = renderWithLocale(<PasskeyRenewNotice />);
    expect(
      screen.getByText('Your device is showing the passkey prompt.', { exact: false }),
    ).toBeTruthy();
    passkey.unmount();
    window.history.replaceState({}, '', '/welcome?visual=renew-ok');
    renderWithLocale(<PasskeyRenewNotice />);
    expect(screen.getByRole('heading', { name: 'It worked' })).toBeTruthy();
  });
});
