import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LightningAddressForm } from '@/components/LightningAddressForm';
import { setLightningAddress, unlinkLightningAddress } from '@/lib/api';
import type { Account } from '@/lib/api-types';
import { useAuthStore } from '@/stores/auth-store';

vi.mock('@/lib/api', () => ({
  setLightningAddress: vi.fn(),
  unlinkLightningAddress: vi.fn(),
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

  it('shows the address, an unverified note, and edit/unlink controls when set', () => {
    useAuthStore.setState({ session: 'sess', account: linkedAccount });
    render(<LightningAddressForm />);

    expect(screen.getByText('me@walletofsatoshi.com')).toBeTruthy();
    expect(screen.getByText(/not yet verified/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /edit/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /unlink/i })).toBeTruthy();
  });

  it('hides the unverified note when the address is verified', () => {
    useAuthStore.setState({
      session: 'sess',
      account: { ...linkedAccount, lightningAddressVerified: true },
    });
    render(<LightningAddressForm />);

    expect(screen.getByText('me@walletofsatoshi.com')).toBeTruthy();
    expect(screen.queryByText(/not yet verified/i)).toBeNull();
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
});
