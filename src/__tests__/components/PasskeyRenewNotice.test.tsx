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

const ORIGINAL_E2E_NOW = process.env.NEXT_PUBLIC_E2E_NOW;

afterEach(() => {
  cleanup();
  useAuthStore.setState({ session: null, account: null });
  vi.clearAllMocks();
  window.history.replaceState({}, '', '/');
  if (ORIGINAL_E2E_NOW === undefined) {
    delete process.env.NEXT_PUBLIC_E2E_NOW;
  } else {
    process.env.NEXT_PUBLIC_E2E_NOW = ORIGINAL_E2E_NOW;
  }
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
    expect(screen.queryByText('You do not need to do anything now.', { exact: false })).toBeNull();
  });

  it('keeps an open failure on the account before OK', async () => {
    const open = { ...account, passkeyRenewFailed: true };
    vi.mocked(renewPasskey).mockResolvedValue({
      outcome: 'failed',
      kind: 'generic',
      account: open,
    });
    useAuthStore.setState({ session: 'tok', account });
    const first = renderWithLocale(<PasskeyRenewNotice />);
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(
      await screen.findByText('You do not need to do anything now.', { exact: false }),
    ).toBeTruthy();
    expect(useAuthStore.getState().account).toEqual(open);
    first.unmount();
    renderWithLocale(<PasskeyRenewNotice />);
    expect(screen.getByRole('button', { name: 'OK' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Continue' })).toBeNull();
  });

  it('does not store a failure account after the session ends', async () => {
    const open = { ...account, passkeyRenewFailed: true };
    vi.mocked(renewPasskey).mockImplementation(async () => {
      useAuthStore.setState({ session: null, account: null });
      return { outcome: 'failed', kind: 'generic', account: open };
    });
    useAuthStore.setState({ session: 'tok', account });
    renderWithLocale(<PasskeyRenewNotice />);
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await waitFor(() => {
      expect(renewPasskey).toHaveBeenCalled();
    });
    expect(useAuthStore.getState().account).toBeNull();
    expect(useAuthStore.getState().session).toBeNull();
  });

  it('returns to the explanation when a failure was not recorded', async () => {
    vi.mocked(renewPasskey).mockResolvedValue({ outcome: 'failed', kind: 'generic' });
    useAuthStore.setState({ session: 'tok', account });
    renderWithLocale(<PasskeyRenewNotice />);
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(await screen.findByRole('button', { name: 'Continue' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'OK' })).toBeNull();
    expect(useAuthStore.getState().account).toEqual(account);
  });

  it('returns to the explanation when the returned account has no open failure', async () => {
    vi.mocked(renewPasskey).mockResolvedValue({
      outcome: 'failed',
      kind: 'generic',
      account,
    });
    useAuthStore.setState({ session: 'tok', account });
    renderWithLocale(<PasskeyRenewNotice />);
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(await screen.findByRole('button', { name: 'Continue' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'OK' })).toBeNull();
    expect(useAuthStore.getState().account).toEqual(account);
    expect(useAuthStore.getState().account?.passkeyRenewFailed).toBe(false);
  });

  it('closes after a failure is confirmed and does not start again', async () => {
    const open = { ...account, passkeyRenewFailed: true };
    vi.mocked(renewPasskey).mockResolvedValue({
      outcome: 'failed',
      kind: 'generic',
      account: open,
    });
    vi.mocked(postPasskeyRenewAck).mockResolvedValue({
      ...account,
      passkeyRenewClosed: true,
    });
    useAuthStore.setState({ session: 'tok', account });
    renderWithLocale(<PasskeyRenewNotice />);
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(
      await screen.findByText('You do not need to do anything now.', { exact: false }),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'OK' }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    expect(postPasskeyRenewAck).toHaveBeenCalledWith('tok');
    expect(renewPasskey).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: 'Continue' })).toBeNull();
  });

  it('starts on the failure confirmation when a failure is still open', () => {
    useAuthStore.setState({
      session: 'tok',
      account: { ...account, passkeyRenewFailed: true },
    });
    renderWithLocale(<PasskeyRenewNotice />);
    expect(screen.getByRole('button', { name: 'OK' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Continue' })).toBeNull();
  });

  it('says this phone or browser cannot hold a wallet after a renew without PRF', () => {
    useAuthStore.setState({
      session: 'tok',
      account: { ...account, passkeyRenewFailed: true, passkeyRenewPrfUnsupported: true },
    });
    renderWithLocale(<PasskeyRenewNotice />);
    expect(
      screen.getByText(
        'This phone or browser cannot hold a 21.gifts wallet. Please use an up-to-date phone or browser that supports passkeys.',
      ),
    ).toBeTruthy();
    expect(screen.queryByText(/try again later/i)).toBeNull();
    expect(screen.getByRole('button', { name: 'OK' })).toBeTruthy();
  });

  it('keeps the failure confirmation when acknowledgement fails', async () => {
    vi.mocked(postPasskeyRenewAck).mockRejectedValue(new Error('nope'));
    useAuthStore.setState({
      session: 'tok',
      account: { ...account, passkeyRenewFailed: true },
    });
    renderWithLocale(<PasskeyRenewNotice />);
    fireEvent.click(screen.getByRole('button', { name: 'OK' }));
    await screen.findByRole('button', { name: 'OK' });
    expect(screen.getByText('You do not need to do anything now.', { exact: false })).toBeTruthy();
  });

  it('does not apply the acknowledgement when the session is gone', async () => {
    let resolveAck: (value: Account) => void = () => {};
    vi.mocked(postPasskeyRenewAck).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveAck = resolve;
        }),
    );
    useAuthStore.setState({
      session: 'tok',
      account: { ...account, passkeyRenewFailed: true },
    });
    renderWithLocale(<PasskeyRenewNotice />);
    fireEvent.click(screen.getByRole('button', { name: 'OK' }));
    await waitFor(() => {
      expect(postPasskeyRenewAck).toHaveBeenCalledWith('tok');
    });
    useAuthStore.setState({ session: null, account: null });
    resolveAck({ ...account, passkeyRenewFailed: false, passkeyRenewClosed: true });
    await waitFor(() => {
      expect(useAuthStore.getState().account).toBeNull();
    });
    expect(useAuthStore.getState().session).toBeNull();
  });

  it('does not acknowledge a failure without a session', () => {
    useAuthStore.setState({
      session: null,
      account: { ...account, passkeyRenewFailed: true },
    });
    renderWithLocale(<PasskeyRenewNotice />);
    fireEvent.click(screen.getByRole('button', { name: 'OK' }));
    expect(postPasskeyRenewAck).not.toHaveBeenCalled();
  });

  it('does not start without a session', () => {
    useAuthStore.setState({ session: null, account });
    renderWithLocale(<PasskeyRenewNotice />);
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(renewPasskey).not.toHaveBeenCalled();
  });

  it('shows the screenshot steps from the visual query in a Playwright build', () => {
    process.env.NEXT_PUBLIC_E2E_NOW = '2026-01-07T12:00:00.000Z';
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

  it('starts at the explanation in a Playwright build without a renew pin', () => {
    process.env.NEXT_PUBLIC_E2E_NOW = '2026-01-07T12:00:00.000Z';
    window.history.replaceState({}, '', '/welcome?visual=balance-ready');
    useAuthStore.setState({ session: 'tok', account });
    renderWithLocale(<PasskeyRenewNotice />);
    expect(screen.getByRole('button', { name: 'Continue' })).toBeTruthy();
  });

  it('ignores the screenshot steps in a production build', () => {
    delete process.env.NEXT_PUBLIC_E2E_NOW;
    useAuthStore.setState({ session: 'tok', account });
    for (const visual of ['renew-passkey', 'renew-ok']) {
      window.history.replaceState({}, '', `/welcome?visual=${visual}`);
      const view = renderWithLocale(<PasskeyRenewNotice />);
      expect(screen.getByRole('button', { name: 'Continue' })).toBeTruthy();
      expect(screen.queryByRole('heading', { name: 'It worked' })).toBeNull();
      expect(
        screen.queryByText('Your device is showing the passkey prompt.', { exact: false }),
      ).toBeNull();
      view.unmount();
    }
  });
});
