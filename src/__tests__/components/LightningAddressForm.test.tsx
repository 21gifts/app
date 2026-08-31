import { act, cleanup, fireEvent, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LightningAddressForm } from '@/components/LightningAddressForm';
import { setLightningAddress, unlinkLightningAddress } from '@/lib/api';
import type { Account } from '@/lib/api-types';
import { useAuthStore } from '@/stores/auth-store';
import { renderWithLocale } from '@/__tests__/render-with-locale';

vi.mock('@/lib/api', () => ({
  setLightningAddress: vi.fn(),
  unlinkLightningAddress: vi.fn(),
  LIGHTNING_ADDRESS_NOT_ZAP_ERROR:
    'This Wallet of Satoshi address cannot receive these Bitcoin payments',
}));

const baseAccount: Account = {
  id: 'acc_1',
  linkingKey: '02abcdef',
  role: 'basis',
  name: null,
  lightningAddress: null,
  lightningAddressVerified: false,
  forumLawsDismissed: false,
  createdAt: 1_700_000_000,
  rulesAgreedAt: null,
  viewKey: 'a'.repeat(64),
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
    const { container } = renderWithLocale(<LightningAddressForm />);
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when the session token is absent', () => {
    useAuthStore.setState({ session: null, account: baseAccount });
    const { container } = renderWithLocale(<LightningAddressForm />);
    expect(container.firstChild).toBeNull();
  });

  it('uses icon actions beside the field on the profile variant without an address', () => {
    renderWithLocale(<LightningAddressForm variant="profile" />);
    expect(screen.getByRole('button', { name: /link address/i })).toBeTruthy();
    expect(screen.queryByText('Link address')).toBeNull();
    expect(screen.queryByRole('button', { name: /continue/i })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /link address/i }));
    expect(screen.getByRole('alert').textContent).toBe('Enter your Wallet of Satoshi address');
  });

  it('shows the link prompt and an empty input when no address is set', () => {
    renderWithLocale(<LightningAddressForm />);

    const input = screen.getByPlaceholderText(PLACEHOLDER) as HTMLInputElement;
    expect(input.value).toBe('');
    expect(screen.getByText(/gifts can reach you/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /continue/i })).toBeTruthy();
  });

  it('shows the link prompt for a whitespace-only address instead of display/unlink', () => {
    useAuthStore.setState({
      session: 'sess',
      account: { ...baseAccount, lightningAddress: '   ' },
    });
    renderWithLocale(<LightningAddressForm />);

    expect(screen.getByText(/gifts can reach you/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /continue/i })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /edit/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /unlink/i })).toBeNull();
  });

  it('does not call the api when the address is whitespace', () => {
    renderWithLocale(<LightningAddressForm />);

    fireEvent.change(screen.getByPlaceholderText(PLACEHOLDER), {
      target: { value: '   ' },
    });
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));

    expect(screen.getByRole('alert').textContent).toBe('Enter your Wallet of Satoshi address');
    expect(setLightningAddress).not.toHaveBeenCalled();
  });

  it('trims the address before posting', async () => {
    const updated: Account = { ...baseAccount, lightningAddress: 'me@walletofsatoshi.com' };
    vi.mocked(setLightningAddress).mockResolvedValue(updated);
    renderWithLocale(<LightningAddressForm />);

    fireEvent.change(screen.getByPlaceholderText(PLACEHOLDER), {
      target: { value: '  me@walletofsatoshi.com  ' },
    });
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));

    expect(await screen.findByText('me@walletofsatoshi.com')).toBeTruthy();
    expect(setLightningAddress).toHaveBeenCalledWith('sess', 'me@walletofsatoshi.com');
  });

  it('links an address and updates the store', async () => {
    const updated: Account = { ...baseAccount, lightningAddress: 'me@walletofsatoshi.com' };
    vi.mocked(setLightningAddress).mockResolvedValue(updated);
    renderWithLocale(<LightningAddressForm />);

    fireEvent.change(screen.getByPlaceholderText(PLACEHOLDER), {
      target: { value: 'me@walletofsatoshi.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));

    expect(await screen.findByText('me@walletofsatoshi.com')).toBeTruthy();
    expect(setLightningAddress).toHaveBeenCalledWith('sess', 'me@walletofsatoshi.com');
    expect(useAuthStore.getState().account).toEqual(updated);
    expect(screen.queryByPlaceholderText(PLACEHOLDER)).toBeNull();
  });

  it('shows the api error message when linking fails', async () => {
    vi.mocked(setLightningAddress).mockRejectedValue(
      new Error('That Wallet of Satoshi address is not valid'),
    );
    renderWithLocale(<LightningAddressForm />);

    fireEvent.change(screen.getByPlaceholderText(PLACEHOLDER), {
      target: { value: 'bad@example' },
    });
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toBe('Could not update your Wallet of Satoshi address');
    // The form stays put so the visitor can correct the value.
    expect(screen.getByPlaceholderText(PLACEHOLDER)).toBeTruthy();
  });

  it('shows the not-found message when the address could not be found', async () => {
    vi.mocked(setLightningAddress).mockRejectedValue(
      new Error('That Wallet of Satoshi address could not be found'),
    );
    renderWithLocale(<LightningAddressForm />);

    fireEvent.change(screen.getByPlaceholderText(PLACEHOLDER), {
      target: { value: PLACEHOLDER },
    });
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toBe('That Wallet of Satoshi address could not be found');
    expect(setLightningAddress).toHaveBeenCalledWith('sess', PLACEHOLDER);
    expect(screen.getByPlaceholderText(PLACEHOLDER)).toBeTruthy();
  });

  it('shows the not-zap message when the address cannot receive these payments', async () => {
    vi.mocked(setLightningAddress).mockRejectedValue(
      new Error('This Wallet of Satoshi address cannot receive these Bitcoin payments'),
    );
    renderWithLocale(<LightningAddressForm />);

    fireEvent.change(screen.getByPlaceholderText(PLACEHOLDER), {
      target: { value: 'nozap@walletofsatoshi.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toBe(
      'This Wallet of Satoshi address cannot receive these Bitcoin payments',
    );
    expect(screen.getByPlaceholderText(PLACEHOLDER)).toBeTruthy();
  });

  it('clears the not-zap alert on change and re-enables continue', async () => {
    vi.mocked(setLightningAddress).mockRejectedValue(
      new Error('This Wallet of Satoshi address cannot receive these Bitcoin payments'),
    );
    renderWithLocale(<LightningAddressForm />);

    fireEvent.change(screen.getByPlaceholderText(PLACEHOLDER), {
      target: { value: 'nozap@walletofsatoshi.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));

    expect(await screen.findByRole('alert')).toBeTruthy();
    expect((screen.getByRole('button', { name: /continue/i }) as HTMLButtonElement).disabled).toBe(
      true,
    );

    fireEvent.change(screen.getByPlaceholderText(PLACEHOLDER), {
      target: { value: 'nozap2@walletofsatoshi.com' },
    });

    expect(screen.queryByRole('alert')).toBeNull();
    expect((screen.getByRole('button', { name: /continue/i }) as HTMLButtonElement).disabled).toBe(
      false,
    );
  });

  it('clears the not-zap alert on change while editing a linked address', async () => {
    useAuthStore.setState({ session: 'sess', account: linkedAccount });
    vi.mocked(setLightningAddress).mockRejectedValue(
      new Error('This Wallet of Satoshi address cannot receive these Bitcoin payments'),
    );
    renderWithLocale(<LightningAddressForm />);

    fireEvent.click(screen.getByRole('button', { name: /edit/i }));
    fireEvent.change(screen.getByPlaceholderText(PLACEHOLDER), {
      target: { value: 'nozap@walletofsatoshi.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: /save/i }));

    expect(await screen.findByRole('alert')).toBeTruthy();

    fireEvent.change(screen.getByPlaceholderText(PLACEHOLDER), {
      target: { value: 'nozap2@walletofsatoshi.com' },
    });

    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('does not resubmit a blocked not-zap address', async () => {
    vi.mocked(setLightningAddress).mockRejectedValue(
      new Error('This Wallet of Satoshi address cannot receive these Bitcoin payments'),
    );
    renderWithLocale(<LightningAddressForm />);
    fireEvent.change(screen.getByPlaceholderText(PLACEHOLDER), {
      target: { value: 'nozap@walletofsatoshi.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));
    expect(await screen.findByRole('alert')).toBeTruthy();
    vi.mocked(setLightningAddress).mockClear();
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));
    expect(setLightningAddress).not.toHaveBeenCalled();
  });

  it('stringifies a non-Error rejection', async () => {
    vi.mocked(setLightningAddress).mockRejectedValue('boom');
    renderWithLocale(<LightningAddressForm />);

    fireEvent.change(screen.getByPlaceholderText(PLACEHOLDER), {
      target: { value: 'me@walletofsatoshi.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));

    expect(await screen.findByText('Could not update your Wallet of Satoshi address')).toBeTruthy();
  });

  it('shows the address and edit/unlink controls when set', () => {
    useAuthStore.setState({ session: 'sess', account: linkedAccount });
    renderWithLocale(<LightningAddressForm />);

    expect(screen.getByText('me@walletofsatoshi.com')).toBeTruthy();
    expect(screen.getByRole('button', { name: /edit/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /unlink/i })).toBeTruthy();
    expect(screen.queryByText('Edit')).toBeNull();
    expect(screen.queryByText('Unlink')).toBeNull();
    expect(screen.queryByRole('button', { name: /verify/i })).toBeNull();
    expect(screen.queryByText(/not yet verified/i)).toBeNull();
    expect(screen.queryByText('Verified')).toBeNull();
  });

  it('edits a linked address, pre-filling the current value, and saves', async () => {
    useAuthStore.setState({ session: 'sess', account: linkedAccount });
    const updated: Account = { ...linkedAccount, lightningAddress: 'new@walletofsatoshi.com' };
    vi.mocked(setLightningAddress).mockResolvedValue(updated);
    renderWithLocale(<LightningAddressForm />);

    fireEvent.click(screen.getByRole('button', { name: /edit/i }));
    const input = screen.getByPlaceholderText(PLACEHOLDER) as HTMLInputElement;
    expect(input.value).toBe('me@walletofsatoshi.com');

    fireEvent.change(input, { target: { value: 'new@walletofsatoshi.com' } });
    expect(screen.queryByText('Save')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /save/i }));

    expect(await screen.findByText('new@walletofsatoshi.com')).toBeTruthy();
    expect(setLightningAddress).toHaveBeenCalledWith('sess', 'new@walletofsatoshi.com');
  });

  it('cancels an edit and returns to the display view', () => {
    useAuthStore.setState({ session: 'sess', account: linkedAccount });
    renderWithLocale(<LightningAddressForm />);

    fireEvent.click(screen.getByRole('button', { name: /edit/i }));
    expect(screen.getByPlaceholderText(PLACEHOLDER)).toBeTruthy();

    expect(screen.queryByText('Cancel')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(screen.queryByPlaceholderText(PLACEHOLDER)).toBeNull();
    expect(screen.getByRole('button', { name: /edit/i })).toBeTruthy();
    expect(setLightningAddress).not.toHaveBeenCalled();
  });

  it('unlinks an address and returns to the prompt', async () => {
    useAuthStore.setState({ session: 'sess', account: linkedAccount });
    vi.mocked(unlinkLightningAddress).mockResolvedValue(baseAccount);
    renderWithLocale(<LightningAddressForm />);

    fireEvent.click(screen.getByRole('button', { name: /unlink/i }));

    expect(await screen.findByRole('button', { name: /continue/i })).toBeTruthy();
    expect(unlinkLightningAddress).toHaveBeenCalledWith('sess');
    expect(useAuthStore.getState().account).toEqual(baseAccount);
  });

  it('shows the update error when unlink fails', async () => {
    useAuthStore.setState({ session: 'sess', account: linkedAccount });
    vi.mocked(unlinkLightningAddress).mockRejectedValue(
      new Error('Could not remove your Wallet of Satoshi address'),
    );
    renderWithLocale(<LightningAddressForm />);
    fireEvent.click(screen.getByRole('button', { name: /unlink/i }));
    expect(await screen.findByRole('alert')).toHaveProperty(
      'textContent',
      'Could not update your Wallet of Satoshi address',
    );
    expect(screen.getByText('me@walletofsatoshi.com')).toBeTruthy();
  });

  it('disables the control and shows a spinner while a request is in flight', async () => {
    let resolve!: (value: Account) => void;
    const pending = new Promise<Account>((r) => {
      resolve = r;
    });
    vi.mocked(setLightningAddress).mockReturnValue(pending);
    renderWithLocale(<LightningAddressForm />);

    fireEvent.change(screen.getByPlaceholderText(PLACEHOLDER), {
      target: { value: 'me@walletofsatoshi.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));

    const button = screen.getByRole('button', { name: /continue/i }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect((screen.getByPlaceholderText(PLACEHOLDER) as HTMLInputElement).disabled).toBe(true);

    await act(async () => {
      resolve({ ...baseAccount, lightningAddress: 'me@walletofsatoshi.com' });
    });

    expect(screen.getByText('me@walletofsatoshi.com')).toBeTruthy();
  });

  it('keeps a concurrently saved name when the address response is stale', async () => {
    let resolve!: (value: Account) => void;
    const pending = new Promise<Account>((r) => {
      resolve = r;
    });
    vi.mocked(setLightningAddress).mockReturnValue(pending);
    renderWithLocale(<LightningAddressForm />);

    fireEvent.change(screen.getByPlaceholderText(PLACEHOLDER), {
      target: { value: 'me@walletofsatoshi.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));

    act(() => {
      useAuthStore.setState({
        session: 'sess',
        account: { ...baseAccount, name: 'Ada' },
      });
    });

    await act(async () => {
      resolve({ ...baseAccount, name: null, lightningAddress: 'me@walletofsatoshi.com' });
    });

    expect(useAuthStore.getState().account).toEqual({
      ...baseAccount,
      name: 'Ada',
      lightningAddress: 'me@walletofsatoshi.com',
      lightningAddressVerified: false,
    });
  });

  it('drops the address result when the account was cleared mid-flight', async () => {
    let resolve!: (value: Account) => void;
    const pending = new Promise<Account>((r) => {
      resolve = r;
    });
    vi.mocked(setLightningAddress).mockReturnValue(pending);
    renderWithLocale(<LightningAddressForm />);

    fireEvent.change(screen.getByPlaceholderText(PLACEHOLDER), {
      target: { value: 'me@walletofsatoshi.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));

    act(() => {
      useAuthStore.setState({ session: 'sess', account: null });
    });

    await act(async () => {
      resolve({ ...baseAccount, lightningAddress: 'me@walletofsatoshi.com' });
    });

    expect(useAuthStore.getState().account).toBeNull();
    expect(useAuthStore.getState().session).toBe('sess');
  });

  it('drops the result when the session changed mid-flight (e.g. after logout)', async () => {
    let resolve!: (value: Account) => void;
    const pending = new Promise<Account>((r) => {
      resolve = r;
    });
    vi.mocked(setLightningAddress).mockReturnValue(pending);
    renderWithLocale(<LightningAddressForm />);

    fireEvent.change(screen.getByPlaceholderText(PLACEHOLDER), {
      target: { value: 'me@walletofsatoshi.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));

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
