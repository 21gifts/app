import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NameForm } from '@/components/NameForm';
import { setName } from '@/lib/api';
import type { Account } from '@/lib/api-types';
import { useAuthStore } from '@/stores/auth-store';

vi.mock('@/lib/api', () => ({
  setName: vi.fn(),
}));

const baseAccount: Account = {
  id: 'acc_1',
  linkingKey: '02abcdef',
  role: 'basis',
  name: null,
  lightningAddress: null,
  lightningAddressVerified: false,
  createdAt: 1_700_000_000,
};

const namedAccount: Account = {
  ...baseAccount,
  name: 'Ada',
};

beforeEach(() => {
  vi.clearAllMocks();
  useAuthStore.setState({ session: 'sess', account: baseAccount });
});

afterEach(cleanup);

describe('NameForm', () => {
  it('renders nothing when there is no account', () => {
    useAuthStore.setState({ session: 'sess', account: null });
    const { container } = render(<NameForm />);
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when the session token is absent', () => {
    useAuthStore.setState({ session: null, account: baseAccount });
    const { container } = render(<NameForm />);
    expect(container.firstChild).toBeNull();
  });

  it('shows the prompt and an empty input when no name is set', () => {
    render(<NameForm />);

    const input = screen.getByPlaceholderText('Your name') as HTMLInputElement;
    expect(input.value).toBe('');
    expect(screen.getByText(/people know who you are/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /save name/i })).toBeTruthy();
  });

  it('does not call the api when the name is empty', () => {
    render(<NameForm />);

    fireEvent.click(screen.getByRole('button', { name: /save name/i }));

    expect(screen.getByRole('alert').textContent).toBe('Enter your name');
    expect(setName).not.toHaveBeenCalled();
  });

  it('does not call the api when the name is whitespace', () => {
    render(<NameForm />);

    fireEvent.change(screen.getByPlaceholderText('Your name'), { target: { value: '   ' } });
    fireEvent.click(screen.getByRole('button', { name: /save name/i }));

    expect(screen.getByRole('alert').textContent).toBe('Enter your name');
    expect(setName).not.toHaveBeenCalled();
  });

  it('saves a name and updates the store', async () => {
    vi.mocked(setName).mockResolvedValue(namedAccount);
    render(<NameForm />);

    fireEvent.change(screen.getByPlaceholderText('Your name'), { target: { value: 'Ada' } });
    fireEvent.click(screen.getByRole('button', { name: /save name/i }));

    expect(await screen.findByText('Ada')).toBeTruthy();
    expect(setName).toHaveBeenCalledWith('sess', 'Ada');
    expect(useAuthStore.getState().account).toEqual(namedAccount);
    expect(screen.queryByPlaceholderText('Your name')).toBeNull();
  });

  it('trims the name before posting', async () => {
    vi.mocked(setName).mockResolvedValue(namedAccount);
    render(<NameForm />);

    fireEvent.change(screen.getByPlaceholderText('Your name'), { target: { value: '  Ada  ' } });
    fireEvent.click(screen.getByRole('button', { name: /save name/i }));

    expect(await screen.findByText('Ada')).toBeTruthy();
    expect(setName).toHaveBeenCalledWith('sess', 'Ada');
  });

  it('shows the api error message when saving fails', async () => {
    vi.mocked(setName).mockRejectedValue(new Error('Name must be 1–80 characters'));
    render(<NameForm />);

    fireEvent.change(screen.getByPlaceholderText('Your name'), { target: { value: 'Ada' } });
    fireEvent.click(screen.getByRole('button', { name: /save name/i }));

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toBe('Name must be 1–80 characters');
    expect(screen.getByPlaceholderText('Your name')).toBeTruthy();
  });

  it('stringifies a non-Error rejection', async () => {
    vi.mocked(setName).mockRejectedValue('boom');
    render(<NameForm />);

    fireEvent.change(screen.getByPlaceholderText('Your name'), { target: { value: 'Ada' } });
    fireEvent.click(screen.getByRole('button', { name: /save name/i }));

    expect(await screen.findByText('boom')).toBeTruthy();
  });

  it('shows the name and edit control when set', () => {
    useAuthStore.setState({ session: 'sess', account: namedAccount });
    render(<NameForm />);

    expect(screen.getByText('Ada')).toBeTruthy();
    expect(screen.getByRole('button', { name: /edit/i })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /unlink/i })).toBeNull();
  });

  it('edits a saved name, pre-filling the current value, and saves', async () => {
    useAuthStore.setState({ session: 'sess', account: namedAccount });
    const updated: Account = { ...namedAccount, name: 'Bob' };
    vi.mocked(setName).mockResolvedValue(updated);
    render(<NameForm />);

    fireEvent.click(screen.getByRole('button', { name: /edit/i }));
    const input = screen.getByPlaceholderText('Your name') as HTMLInputElement;
    expect(input.value).toBe('Ada');

    fireEvent.change(input, { target: { value: 'Bob' } });
    fireEvent.click(screen.getByRole('button', { name: /save/i }));

    expect(await screen.findByText('Bob')).toBeTruthy();
    expect(setName).toHaveBeenCalledWith('sess', 'Bob');
  });

  it('cancels an edit and returns to the display view', () => {
    useAuthStore.setState({ session: 'sess', account: namedAccount });
    render(<NameForm />);

    fireEvent.click(screen.getByRole('button', { name: /edit/i }));
    expect(screen.getByPlaceholderText('Your name')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(screen.queryByPlaceholderText('Your name')).toBeNull();
    expect(screen.getByRole('button', { name: /edit/i })).toBeTruthy();
    expect(setName).not.toHaveBeenCalled();
  });

  it('disables the control and shows a spinner while a request is in flight', async () => {
    let resolve!: (value: Account) => void;
    const pending = new Promise<Account>((r) => {
      resolve = r;
    });
    vi.mocked(setName).mockReturnValue(pending);
    render(<NameForm />);

    fireEvent.change(screen.getByPlaceholderText('Your name'), { target: { value: 'Ada' } });
    fireEvent.click(screen.getByRole('button', { name: /save name/i }));

    const button = screen.getByRole('button', { name: /save name/i }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect((screen.getByPlaceholderText('Your name') as HTMLInputElement).disabled).toBe(true);

    await act(async () => {
      resolve(namedAccount);
    });

    expect(screen.getByText('Ada')).toBeTruthy();
  });

  it('keeps a concurrently saved address when the name response is stale', async () => {
    let resolve!: (value: Account) => void;
    const pending = new Promise<Account>((r) => {
      resolve = r;
    });
    vi.mocked(setName).mockReturnValue(pending);
    render(<NameForm />);

    fireEvent.change(screen.getByPlaceholderText('Your name'), { target: { value: 'Ada' } });
    fireEvent.click(screen.getByRole('button', { name: /save name/i }));

    act(() => {
      useAuthStore.setState({
        session: 'sess',
        account: { ...baseAccount, lightningAddress: 'me@walletofsatoshi.com' },
      });
    });

    await act(async () => {
      resolve({ ...baseAccount, name: 'Ada', lightningAddress: null });
    });

    expect(useAuthStore.getState().account).toEqual({
      ...baseAccount,
      name: 'Ada',
      lightningAddress: 'me@walletofsatoshi.com',
    });
  });

  it('drops the name result when the account was cleared mid-flight', async () => {
    let resolve!: (value: Account) => void;
    const pending = new Promise<Account>((r) => {
      resolve = r;
    });
    vi.mocked(setName).mockReturnValue(pending);
    render(<NameForm />);

    fireEvent.change(screen.getByPlaceholderText('Your name'), { target: { value: 'Ada' } });
    fireEvent.click(screen.getByRole('button', { name: /save name/i }));

    act(() => {
      useAuthStore.setState({ session: 'sess', account: null });
    });

    await act(async () => {
      resolve(namedAccount);
    });

    expect(useAuthStore.getState().account).toBeNull();
    expect(useAuthStore.getState().session).toBe('sess');
  });

  it('drops the result when the session changed mid-flight (e.g. after logout)', async () => {
    let resolve!: (value: Account) => void;
    const pending = new Promise<Account>((r) => {
      resolve = r;
    });
    vi.mocked(setName).mockReturnValue(pending);
    render(<NameForm />);

    fireEvent.change(screen.getByPlaceholderText('Your name'), { target: { value: 'Ada' } });
    fireEvent.click(screen.getByRole('button', { name: /save name/i }));

    act(() => {
      useAuthStore.setState({ session: null, account: null });
    });

    await act(async () => {
      resolve(namedAccount);
    });

    expect(useAuthStore.getState().account).toBeNull();
  });
});
