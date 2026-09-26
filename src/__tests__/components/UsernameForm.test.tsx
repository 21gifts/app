import { act, cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { UsernameForm } from '@/components/UsernameForm';
import { setUsername } from '@/lib/api';
import type { Account } from '@/lib/api-types';
import { useAuthStore } from '@/stores/auth-store';
import { renderWithLocale } from '@/__tests__/render-with-locale';

vi.mock('@/lib/api', () => ({
  setUsername: vi.fn(),
}));

const base: Account = {
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
};

beforeEach(() => {
  vi.clearAllMocks();
  useAuthStore.setState({ session: 'sess', account: base });
});

afterEach(cleanup);

describe('UsernameForm', () => {
  it('does not call the api when the username is empty', () => {
    renderWithLocale(<UsernameForm />);
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));
    expect(screen.getByRole('alert').textContent).toBe('Enter a username');
    expect(setUsername).not.toHaveBeenCalled();
  });

  it('saves a username, updates the store, and calls onSaved', async () => {
    const onSaved = vi.fn();
    const saved: Account = {
      ...base,
      username: 'ada',
      setup: 'lightning-address',
      missing: ['lightning-address', 'rules'],
    };
    vi.mocked(setUsername).mockResolvedValue(saved);
    renderWithLocale(<UsernameForm onSaved={onSaved} />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '  Ada  ' } });
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));
    await waitFor(() => {
      expect(setUsername).toHaveBeenCalledWith('sess', 'ada', 'setup');
    });
    expect(useAuthStore.getState().account).toEqual(saved);
    expect(onSaved).toHaveBeenCalled();
  });

  it('sends the device zone when the overlay saves', async () => {
    const saved: Account = { ...base, username: 'ada', setup: null, missing: [] };
    vi.mocked(setUsername).mockResolvedValue(saved);
    renderWithLocale(<UsernameForm variant="overlay" />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'ada' } });
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));
    await waitFor(() => {
      expect(setUsername).toHaveBeenCalledWith('sess', 'ada', 'enforce');
    });
  });

  it('shows taken, invalid, and request errors', async () => {
    vi.mocked(setUsername).mockRejectedValueOnce(new Error('username-taken'));
    renderWithLocale(<UsernameForm />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'ada' } });
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));
    expect(await screen.findByText('That username is already taken')).toBeTruthy();

    vi.mocked(setUsername).mockRejectedValueOnce(new Error('username-invalid'));
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));
    expect(
      await screen.findByText('Use English letters, numbers, hyphen, underscore, or dot'),
    ).toBeTruthy();

    vi.mocked(setUsername).mockRejectedValueOnce('boom');
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));
    expect(await screen.findByText('Could not save your username')).toBeTruthy();
  });

  it('disables the control and shows a spinner while a request is in flight', async () => {
    let resolve!: (value: Account) => void;
    const pending = new Promise<Account>((r) => {
      resolve = r;
    });
    vi.mocked(setUsername).mockReturnValue(pending);
    renderWithLocale(<UsernameForm />);

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'ada' } });
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));

    const button = screen.getByRole('button', { name: /continue/i }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect((screen.getByRole('textbox') as HTMLInputElement).disabled).toBe(true);

    await act(async () => {
      resolve({
        ...base,
        username: 'ada',
        setup: 'lightning-address',
        missing: ['lightning-address', 'rules'],
      });
    });
  });

  it('does nothing without a session', () => {
    useAuthStore.setState({ session: null, account: base });
    renderWithLocale(<UsernameForm />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'ada' } });
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));
    expect(setUsername).not.toHaveBeenCalled();
  });
});
