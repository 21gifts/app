import { act, cleanup, fireEvent, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LocationForm } from '@/components/LocationForm';
import { setLocation } from '@/lib/api';
import type { Account } from '@/lib/api-types';
import { useAuthStore } from '@/stores/auth-store';
import { renderWithLocale } from '@/__tests__/render-with-locale';

vi.mock('@/lib/api', () => ({
  setLocation: vi.fn(),
}));

const baseAccount: Account = {
  id: 'acc_1',
  linkingKey: '02abcdef',
  role: 'basis',
  name: 'Ada',
  location: null,
  lightningAddress: 'alice@walletofsatoshi.com',
  lightningAddressVerified: false,
  forumLawsDismissed: false,
  createdAt: 1_700_000_000,
  rulesAgreedAt: 1_700_000_001,
  viewKey: 'a'.repeat(64),
  setup: null,
  missing: [],
};

const locatedAccount: Account = {
  ...baseAccount,
  location: 'Zug',
};

beforeEach(() => {
  vi.clearAllMocks();
  useAuthStore.setState({ session: 'sess', account: baseAccount });
});

afterEach(cleanup);

describe('LocationForm', () => {
  it('renders nothing when there is no account', () => {
    useAuthStore.setState({ session: 'sess', account: null });
    const { container } = renderWithLocale(<LocationForm />);
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when the session token is absent', () => {
    useAuthStore.setState({ session: null, account: baseAccount });
    const { container } = renderWithLocale(<LocationForm />);
    expect(container.firstChild).toBeNull();
  });

  it('shows the heading and muted unset copy with an edit control', () => {
    renderWithLocale(<LocationForm />);
    expect(screen.getByText('Location')).toBeTruthy();
    expect(screen.getByText('Not set')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Edit location' })).toBeTruthy();
    expect(screen.queryByText('Edit location')).toBeNull();
    expect(screen.queryByPlaceholderText('City, country, or anywhere')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Clear location' })).toBeNull();
  });

  it('treats a whitespace-only location as unset', () => {
    useAuthStore.setState({
      session: 'sess',
      account: { ...baseAccount, location: '   ' },
    });
    renderWithLocale(<LocationForm />);
    expect(screen.getByText('Not set')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Clear location' })).toBeNull();
  });

  it('edits and saves a location from the unset row', async () => {
    vi.mocked(setLocation).mockResolvedValue(locatedAccount);
    renderWithLocale(<LocationForm />);

    fireEvent.click(screen.getByRole('button', { name: 'Edit location' }));
    const input = screen.getByPlaceholderText('City, country, or anywhere') as HTMLInputElement;
    expect(input.className).toContain('text-base');
    expect(input.className).not.toContain('text-sm');
    expect(input.value).toBe('');
    expect(input.autocomplete).toBe('address-level2');
    expect(input.getAttribute('spellcheck')).toBe('false');
    expect(input.getAttribute('aria-label')).toBe('Location');

    fireEvent.change(input, { target: { value: 'Zug' } });
    expect(screen.getByRole('button', { name: 'Save' })).toBeTruthy();
    expect(screen.queryByText('Save')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('Zug')).toBeTruthy();
    expect(setLocation).toHaveBeenCalledWith('sess', 'Zug');
    expect(useAuthStore.getState().account?.location).toBe('Zug');
    expect(screen.queryByPlaceholderText('City, country, or anywhere')).toBeNull();
  });

  it('trims the location before posting', async () => {
    vi.mocked(setLocation).mockResolvedValue(locatedAccount);
    renderWithLocale(<LocationForm />);

    fireEvent.click(screen.getByRole('button', { name: 'Edit location' }));
    fireEvent.change(screen.getByPlaceholderText('City, country, or anywhere'), {
      target: { value: '  Zug  ' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('Zug')).toBeTruthy();
    expect(setLocation).toHaveBeenCalledWith('sess', 'Zug');
  });

  it('saves an empty trimmed draft to clear', async () => {
    useAuthStore.setState({ session: 'sess', account: locatedAccount });
    vi.mocked(setLocation).mockResolvedValue({ ...locatedAccount, location: null });
    renderWithLocale(<LocationForm />);

    fireEvent.click(screen.getByRole('button', { name: 'Edit location' }));
    fireEvent.change(screen.getByPlaceholderText('City, country, or anywhere'), {
      target: { value: '   ' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('Not set')).toBeTruthy();
    expect(setLocation).toHaveBeenCalledWith('sess', '');
  });

  it('clears a set location via the trash control', async () => {
    useAuthStore.setState({ session: 'sess', account: locatedAccount });
    vi.mocked(setLocation).mockResolvedValue({ ...locatedAccount, location: null });
    renderWithLocale(<LocationForm />);

    expect(screen.getByText('Zug')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Clear location' })).toBeTruthy();
    expect(screen.queryByText('Clear location')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Clear location' }));

    expect(await screen.findByText('Not set')).toBeTruthy();
    expect(setLocation).toHaveBeenCalledWith('sess', '');
    expect(useAuthStore.getState().account?.location).toBeNull();
  });

  it('shows the request error when saving fails', async () => {
    vi.mocked(setLocation).mockRejectedValue(new Error('Location must be at most 80 characters'));
    renderWithLocale(<LocationForm />);

    fireEvent.click(screen.getByRole('button', { name: 'Edit location' }));
    fireEvent.change(screen.getByPlaceholderText('City, country, or anywhere'), {
      target: { value: 'Zug' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toBe('Could not save your location');
    expect(screen.getByPlaceholderText('City, country, or anywhere')).toBeTruthy();
  });

  it('cancels an edit and returns to the display view', () => {
    useAuthStore.setState({ session: 'sess', account: locatedAccount });
    renderWithLocale(<LocationForm />);

    fireEvent.click(screen.getByRole('button', { name: 'Edit location' }));
    expect(screen.getByPlaceholderText('City, country, or anywhere')).toBeTruthy();

    expect(screen.getByRole('button', { name: 'Cancel' })).toBeTruthy();
    expect(screen.queryByText('Cancel')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByPlaceholderText('City, country, or anywhere')).toBeNull();
    expect(screen.getByText('Zug')).toBeTruthy();
    expect(setLocation).not.toHaveBeenCalled();
  });

  it('disables controls and shows a spinner while a request is in flight', async () => {
    let resolve!: (value: Account) => void;
    const pending = new Promise<Account>((r) => {
      resolve = r;
    });
    vi.mocked(setLocation).mockReturnValue(pending);
    renderWithLocale(<LocationForm />);

    fireEvent.click(screen.getByRole('button', { name: 'Edit location' }));
    fireEvent.change(screen.getByPlaceholderText('City, country, or anywhere'), {
      target: { value: 'Zug' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    const button = screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(
      (screen.getByPlaceholderText('City, country, or anywhere') as HTMLInputElement).disabled,
    ).toBe(true);
    expect(button.querySelector('.animate-spin')).toBeTruthy();

    await act(async () => {
      resolve(locatedAccount);
    });

    expect(screen.getByText('Zug')).toBeTruthy();
  });

  it('keeps a concurrently saved name when the location response is stale', async () => {
    let resolve!: (value: Account) => void;
    const pending = new Promise<Account>((r) => {
      resolve = r;
    });
    vi.mocked(setLocation).mockReturnValue(pending);
    renderWithLocale(<LocationForm />);

    fireEvent.click(screen.getByRole('button', { name: 'Edit location' }));
    fireEvent.change(screen.getByPlaceholderText('City, country, or anywhere'), {
      target: { value: 'Zug' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    act(() => {
      useAuthStore.setState({
        session: 'sess',
        account: { ...baseAccount, name: 'Bob' },
      });
    });

    await act(async () => {
      resolve({ ...baseAccount, name: 'Ada', location: 'Zug' });
    });

    expect(useAuthStore.getState().account).toEqual({
      ...baseAccount,
      name: 'Bob',
      location: 'Zug',
    });
  });

  it('drops the location result when the account was cleared mid-flight', async () => {
    let resolve!: (value: Account) => void;
    const pending = new Promise<Account>((r) => {
      resolve = r;
    });
    vi.mocked(setLocation).mockReturnValue(pending);
    renderWithLocale(<LocationForm />);

    fireEvent.click(screen.getByRole('button', { name: 'Edit location' }));
    fireEvent.change(screen.getByPlaceholderText('City, country, or anywhere'), {
      target: { value: 'Zug' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    act(() => {
      useAuthStore.setState({ session: 'sess', account: null });
    });

    await act(async () => {
      resolve(locatedAccount);
    });

    expect(useAuthStore.getState().account).toBeNull();
    expect(useAuthStore.getState().session).toBe('sess');
  });

  it('drops the result when the session changed mid-flight (e.g. after logout)', async () => {
    let resolve!: (value: Account) => void;
    const pending = new Promise<Account>((r) => {
      resolve = r;
    });
    vi.mocked(setLocation).mockReturnValue(pending);
    renderWithLocale(<LocationForm />);

    fireEvent.click(screen.getByRole('button', { name: 'Edit location' }));
    fireEvent.change(screen.getByPlaceholderText('City, country, or anywhere'), {
      target: { value: 'Zug' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    act(() => {
      useAuthStore.setState({ session: null, account: null });
    });

    await act(async () => {
      resolve(locatedAccount);
    });

    expect(useAuthStore.getState().account).toBeNull();
  });

  it('edits a saved location, pre-filling the current value', async () => {
    useAuthStore.setState({ session: 'sess', account: locatedAccount });
    const updated: Account = { ...locatedAccount, location: 'Bern' };
    vi.mocked(setLocation).mockResolvedValue(updated);
    renderWithLocale(<LocationForm />);

    fireEvent.click(screen.getByRole('button', { name: 'Edit location' }));
    const input = screen.getByPlaceholderText('City, country, or anywhere') as HTMLInputElement;
    expect(input.value).toBe('Zug');

    fireEvent.change(input, { target: { value: 'Bern' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('Bern')).toBeTruthy();
    expect(setLocation).toHaveBeenCalledWith('sess', 'Bern');
  });
});
