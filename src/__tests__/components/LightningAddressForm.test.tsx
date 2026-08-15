import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LightningAddressForm } from '@/components/LightningAddressForm';
import {
  confirmLightningAddressVerification,
  setLightningAddress,
  startLightningAddressVerification,
  unlinkLightningAddress,
} from '@/lib/api';
import type { Account, VerificationSent } from '@/lib/api-types';
import { useAuthStore } from '@/stores/auth-store';

vi.mock('@/lib/api', () => ({
  setLightningAddress: vi.fn(),
  unlinkLightningAddress: vi.fn(),
  startLightningAddressVerification: vi.fn(),
  confirmLightningAddressVerification: vi.fn(),
}));

const baseAccount: Account = {
  id: 'acc_1',
  linkingKey: '02abcdef',
  role: 'basis',
  lightningAddress: null,
  lightningAddressVerified: false,
  createdAt: 1_700_000_000,
};

const linkedAccount: Account = {
  ...baseAccount,
  lightningAddress: 'me@walletofsatoshi.com',
  lightningAddressVerified: false,
};

/** The placeholder that uniquely identifies the address input. */
const PLACEHOLDER = 'you@walletofsatoshi.com';

const sent: VerificationSent = { status: 'sent', expiresInSeconds: 120, sats: 1.5 };

beforeEach(() => {
  vi.clearAllMocks();
  useAuthStore.setState({ session: 'sess', account: baseAccount });
});

afterEach(cleanup);

describe('LightningAddressForm', () => {
  it('renders nothing when there is no account', () => {
    useAuthStore.setState({ session: 'sess', account: null });
    const { container } = render(<LightningAddressForm />);
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when the session token is absent', () => {
    useAuthStore.setState({ session: null, account: baseAccount });
    const { container } = render(<LightningAddressForm />);
    expect(container.firstChild).toBeNull();
  });

  it('shows the link prompt and an empty input when no address is set', () => {
    render(<LightningAddressForm />);

    const input = screen.getByPlaceholderText(PLACEHOLDER) as HTMLInputElement;
    expect(input.value).toBe('');
    expect(screen.getByText(/gifts can reach you/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /link address/i })).toBeTruthy();
  });

  it('links an address and updates the store', async () => {
    const updated: Account = { ...baseAccount, lightningAddress: 'me@walletofsatoshi.com' };
    vi.mocked(setLightningAddress).mockResolvedValue(updated);
    render(<LightningAddressForm />);

    fireEvent.change(screen.getByPlaceholderText(PLACEHOLDER), {
      target: { value: 'me@walletofsatoshi.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: /link address/i }));

    expect(await screen.findByText('me@walletofsatoshi.com')).toBeTruthy();
    expect(setLightningAddress).toHaveBeenCalledWith('sess', 'me@walletofsatoshi.com');
    expect(useAuthStore.getState().account).toEqual(updated);
    expect(screen.queryByPlaceholderText(PLACEHOLDER)).toBeNull();
  });

  it('shows the api error message when linking fails', async () => {
    vi.mocked(setLightningAddress).mockRejectedValue(new Error('Invalid Lightning Address'));
    render(<LightningAddressForm />);

    fireEvent.change(screen.getByPlaceholderText(PLACEHOLDER), {
      target: { value: 'bad@example' },
    });
    fireEvent.click(screen.getByRole('button', { name: /link address/i }));

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toBe('Invalid Lightning Address');
    // The form stays put so the visitor can correct the value.
    expect(screen.getByPlaceholderText(PLACEHOLDER)).toBeTruthy();
  });

  it('stringifies a non-Error rejection', async () => {
    vi.mocked(setLightningAddress).mockRejectedValue('boom');
    render(<LightningAddressForm />);

    fireEvent.change(screen.getByPlaceholderText(PLACEHOLDER), {
      target: { value: 'me@walletofsatoshi.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: /link address/i }));

    expect(await screen.findByText('boom')).toBeTruthy();
  });

  it('shows the address, an unverified note, and edit/unlink/verify controls when set', () => {
    useAuthStore.setState({ session: 'sess', account: linkedAccount });
    render(<LightningAddressForm />);

    expect(screen.getByText('me@walletofsatoshi.com')).toBeTruthy();
    expect(screen.getByText(/not yet verified/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /edit/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /unlink/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /verify/i })).toBeTruthy();
  });

  it('shows Verified and hides the Verify button when the address is verified', () => {
    useAuthStore.setState({
      session: 'sess',
      account: { ...linkedAccount, lightningAddressVerified: true },
    });
    render(<LightningAddressForm />);

    expect(screen.getByText('me@walletofsatoshi.com')).toBeTruthy();
    expect(screen.getByText('Verified')).toBeTruthy();
    expect(screen.queryByText(/not yet verified/i)).toBeNull();
    expect(screen.queryByRole('button', { name: /verify/i })).toBeNull();
  });

  it('edits a linked address, pre-filling the current value, and saves', async () => {
    useAuthStore.setState({ session: 'sess', account: linkedAccount });
    const updated: Account = { ...linkedAccount, lightningAddress: 'new@walletofsatoshi.com' };
    vi.mocked(setLightningAddress).mockResolvedValue(updated);
    render(<LightningAddressForm />);

    fireEvent.click(screen.getByRole('button', { name: /edit/i }));
    const input = screen.getByPlaceholderText(PLACEHOLDER) as HTMLInputElement;
    expect(input.value).toBe('me@walletofsatoshi.com');

    fireEvent.change(input, { target: { value: 'new@walletofsatoshi.com' } });
    fireEvent.click(screen.getByRole('button', { name: /save/i }));

    expect(await screen.findByText('new@walletofsatoshi.com')).toBeTruthy();
    expect(setLightningAddress).toHaveBeenCalledWith('sess', 'new@walletofsatoshi.com');
  });

  it('cancels an edit and returns to the display view', () => {
    useAuthStore.setState({ session: 'sess', account: linkedAccount });
    render(<LightningAddressForm />);

    fireEvent.click(screen.getByRole('button', { name: /edit/i }));
    expect(screen.getByPlaceholderText(PLACEHOLDER)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(screen.queryByPlaceholderText(PLACEHOLDER)).toBeNull();
    expect(screen.getByRole('button', { name: /edit/i })).toBeTruthy();
    expect(setLightningAddress).not.toHaveBeenCalled();
  });

  it('unlinks an address and returns to the prompt', async () => {
    useAuthStore.setState({ session: 'sess', account: linkedAccount });
    vi.mocked(unlinkLightningAddress).mockResolvedValue(baseAccount);
    render(<LightningAddressForm />);

    fireEvent.click(screen.getByRole('button', { name: /unlink/i }));

    expect(await screen.findByRole('button', { name: /link address/i })).toBeTruthy();
    expect(unlinkLightningAddress).toHaveBeenCalledWith('sess');
    expect(useAuthStore.getState().account).toEqual(baseAccount);
  });

  it('disables the control and shows a spinner while a request is in flight', async () => {
    let resolve!: (value: Account) => void;
    const pending = new Promise<Account>((r) => {
      resolve = r;
    });
    vi.mocked(setLightningAddress).mockReturnValue(pending);
    render(<LightningAddressForm />);

    fireEvent.change(screen.getByPlaceholderText(PLACEHOLDER), {
      target: { value: 'me@walletofsatoshi.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: /link address/i }));

    const button = screen.getByRole('button', { name: /link address/i }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect((screen.getByPlaceholderText(PLACEHOLDER) as HTMLInputElement).disabled).toBe(true);

    await act(async () => {
      resolve({ ...baseAccount, lightningAddress: 'me@walletofsatoshi.com' });
    });

    expect(screen.getByText('me@walletofsatoshi.com')).toBeTruthy();
  });

  it('drops the result when the session changed mid-flight (e.g. after logout)', async () => {
    let resolve!: (value: Account) => void;
    const pending = new Promise<Account>((r) => {
      resolve = r;
    });
    vi.mocked(setLightningAddress).mockReturnValue(pending);
    render(<LightningAddressForm />);

    fireEvent.change(screen.getByPlaceholderText(PLACEHOLDER), {
      target: { value: 'me@walletofsatoshi.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: /link address/i }));

    // The user logs out while the request is in flight.
    act(() => {
      useAuthStore.setState({ session: null, account: null });
    });

    // The late result must not revive the signed-out account.
    await act(async () => {
      resolve({ ...baseAccount, lightningAddress: 'me@walletofsatoshi.com' });
    });

    expect(useAuthStore.getState().account).toBeNull();
  });

  it('starts verification and shows the sent copy and code input', async () => {
    useAuthStore.setState({ session: 'sess', account: linkedAccount });
    vi.mocked(startLightningAddressVerification).mockResolvedValue(sent);
    render(<LightningAddressForm />);

    fireEvent.click(screen.getByRole('button', { name: /verify/i }));

    expect(await screen.findByText(/we sent 1\.5 sats to your wallet/i)).toBeTruthy();
    expect(
      screen.getByText(/open the payment in your wallet and enter the code from the comment/i),
    ).toBeTruthy();
    expect(screen.getByLabelText('Verification code')).toBeTruthy();
    expect(startLightningAddressVerification).toHaveBeenCalledWith('sess');
    expect(screen.queryByRole('button', { name: /verify/i })).toBeNull();
  });

  it('uses the singular sat unit when the micro-payment is 1 sat', async () => {
    useAuthStore.setState({ session: 'sess', account: linkedAccount });
    vi.mocked(startLightningAddressVerification).mockResolvedValue({ ...sent, sats: 1 });
    render(<LightningAddressForm />);

    fireEvent.click(screen.getByRole('button', { name: /verify/i }));

    expect(await screen.findByText(/we sent 1 sat to your wallet/i)).toBeTruthy();
    expect(screen.queryByText(/1 sats/)).toBeNull();
  });

  it('confirms the nonce and marks the address verified', async () => {
    useAuthStore.setState({ session: 'sess', account: linkedAccount });
    vi.mocked(startLightningAddressVerification).mockResolvedValue(sent);
    const verified: Account = { ...linkedAccount, lightningAddressVerified: true };
    vi.mocked(confirmLightningAddressVerification).mockResolvedValue(verified);
    render(<LightningAddressForm />);

    fireEvent.click(screen.getByRole('button', { name: /verify/i }));
    fireEvent.change(await screen.findByLabelText('Verification code'), {
      target: { value: 'secret-nonce' },
    });
    fireEvent.click(screen.getByRole('button', { name: /confirm/i }));

    expect(await screen.findByText('Verified')).toBeTruthy();
    expect(confirmLightningAddressVerification).toHaveBeenCalledWith('sess', 'secret-nonce');
    expect(useAuthStore.getState().account).toEqual(verified);
    expect(screen.queryByLabelText('Verification code')).toBeNull();
    expect(screen.queryByRole('button', { name: /verify/i })).toBeNull();
  });

  it('shows the api error when starting verification fails', async () => {
    useAuthStore.setState({ session: 'sess', account: linkedAccount });
    vi.mocked(startLightningAddressVerification).mockRejectedValue(
      new Error('Verification payments are not configured'),
    );
    render(<LightningAddressForm />);

    fireEvent.click(screen.getByRole('button', { name: /verify/i }));

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toBe('Verification payments are not configured');
    expect(screen.queryByLabelText('Verification code')).toBeNull();
    expect(screen.getByRole('button', { name: /verify/i })).toBeTruthy();
  });

  it('stringifies a non-Error rejection when starting verification', async () => {
    useAuthStore.setState({ session: 'sess', account: linkedAccount });
    vi.mocked(startLightningAddressVerification).mockRejectedValue('wallet down');
    render(<LightningAddressForm />);

    fireEvent.click(screen.getByRole('button', { name: /verify/i }));

    expect(await screen.findByText('wallet down')).toBeTruthy();
  });

  it('shows the api error when confirming fails and stays in pending mode', async () => {
    useAuthStore.setState({ session: 'sess', account: linkedAccount });
    vi.mocked(startLightningAddressVerification).mockResolvedValue(sent);
    vi.mocked(confirmLightningAddressVerification).mockRejectedValue(
      new Error('Incorrect verification code'),
    );
    render(<LightningAddressForm />);

    fireEvent.click(screen.getByRole('button', { name: /verify/i }));
    fireEvent.change(await screen.findByLabelText('Verification code'), {
      target: { value: 'wrong' },
    });
    fireEvent.click(screen.getByRole('button', { name: /confirm/i }));

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toBe('Incorrect verification code');
    expect(screen.getByLabelText('Verification code')).toBeTruthy();
  });

  it('cancels a pending verification and returns to the display view', async () => {
    useAuthStore.setState({ session: 'sess', account: linkedAccount });
    vi.mocked(startLightningAddressVerification).mockResolvedValue(sent);
    render(<LightningAddressForm />);

    fireEvent.click(screen.getByRole('button', { name: /verify/i }));
    fireEvent.change(await screen.findByLabelText('Verification code'), {
      target: { value: 'typed-nonce' },
    });
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));

    expect(screen.queryByLabelText('Verification code')).toBeNull();
    expect(screen.getByRole('button', { name: /verify/i })).toBeTruthy();
    expect(confirmLightningAddressVerification).not.toHaveBeenCalled();
  });

  it('exits pending mode when entering edit', async () => {
    useAuthStore.setState({ session: 'sess', account: linkedAccount });
    vi.mocked(startLightningAddressVerification).mockResolvedValue(sent);
    render(<LightningAddressForm />);

    fireEvent.click(screen.getByRole('button', { name: /verify/i }));
    fireEvent.change(await screen.findByLabelText('Verification code'), {
      target: { value: 'typed-nonce' },
    });
    fireEvent.click(screen.getByRole('button', { name: /edit/i }));

    expect(screen.queryByLabelText('Verification code')).toBeNull();
    const input = screen.getByPlaceholderText(PLACEHOLDER) as HTMLInputElement;
    expect(input.value).toBe('me@walletofsatoshi.com');
  });

  it('exits pending mode when unlinking', async () => {
    useAuthStore.setState({ session: 'sess', account: linkedAccount });
    vi.mocked(startLightningAddressVerification).mockResolvedValue(sent);
    vi.mocked(unlinkLightningAddress).mockResolvedValue(baseAccount);
    render(<LightningAddressForm />);

    fireEvent.click(screen.getByRole('button', { name: /verify/i }));
    await screen.findByLabelText('Verification code');
    fireEvent.click(screen.getByRole('button', { name: /unlink/i }));

    expect(await screen.findByRole('button', { name: /link address/i })).toBeTruthy();
    expect(unlinkLightningAddress).toHaveBeenCalledWith('sess');
    expect(screen.queryByLabelText('Verification code')).toBeNull();
  });

  it('disables Verify while start is in flight', async () => {
    useAuthStore.setState({ session: 'sess', account: linkedAccount });
    let resolve!: (value: VerificationSent) => void;
    const pending = new Promise<VerificationSent>((r) => {
      resolve = r;
    });
    vi.mocked(startLightningAddressVerification).mockReturnValue(pending);
    render(<LightningAddressForm />);

    fireEvent.click(screen.getByRole('button', { name: /verify/i }));

    expect((screen.getByRole('button', { name: /verify/i }) as HTMLButtonElement).disabled).toBe(
      true,
    );

    await act(async () => {
      resolve(sent);
    });

    expect(await screen.findByLabelText('Verification code')).toBeTruthy();
  });

  it('disables the code input and Confirm while confirmation is in flight', async () => {
    useAuthStore.setState({ session: 'sess', account: linkedAccount });
    vi.mocked(startLightningAddressVerification).mockResolvedValue(sent);
    let resolve!: (value: Account) => void;
    const pending = new Promise<Account>((r) => {
      resolve = r;
    });
    vi.mocked(confirmLightningAddressVerification).mockReturnValue(pending);
    render(<LightningAddressForm />);

    fireEvent.click(screen.getByRole('button', { name: /verify/i }));
    fireEvent.change(await screen.findByLabelText('Verification code'), {
      target: { value: 'secret-nonce' },
    });
    fireEvent.click(screen.getByRole('button', { name: /confirm/i }));

    expect((screen.getByRole('button', { name: /confirm/i }) as HTMLButtonElement).disabled).toBe(
      true,
    );
    expect((screen.getByLabelText('Verification code') as HTMLInputElement).disabled).toBe(true);

    await act(async () => {
      resolve({ ...linkedAccount, lightningAddressVerified: true });
    });

    expect(await screen.findByText('Verified')).toBeTruthy();
  });

  it('does not enter pending mode when the session changes mid-start', async () => {
    useAuthStore.setState({ session: 'sess', account: linkedAccount });
    let resolve!: (value: VerificationSent) => void;
    const pending = new Promise<VerificationSent>((r) => {
      resolve = r;
    });
    vi.mocked(startLightningAddressVerification).mockReturnValue(pending);
    render(<LightningAddressForm />);

    fireEvent.click(screen.getByRole('button', { name: /verify/i }));

    act(() => {
      useAuthStore.setState({ session: null, account: null });
    });

    await act(async () => {
      resolve(sent);
    });

    // Sign back in on the same mount: a leaked pending flag would show the code input.
    act(() => {
      useAuthStore.setState({ session: 'sess-2', account: linkedAccount });
    });

    expect(screen.queryByLabelText('Verification code')).toBeNull();
    expect(screen.getByRole('button', { name: /verify/i })).toBeTruthy();
    expect(useAuthStore.getState().account).toEqual(linkedAccount);
  });
});
