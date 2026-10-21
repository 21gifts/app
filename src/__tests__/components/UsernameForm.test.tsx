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
      await screen.findByText(
        'Use 1–32 characters: a-z, 0-9, hyphen, underscore, or dot, starting with a letter or digit.',
      ),
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

  it('shows empty and format rules under the field and disables continue', () => {
    renderWithLocale(<UsernameForm />);
    const field = screen.getByRole('textbox');
    const button = screen.getByRole('button', { name: /continue/i }) as HTMLButtonElement;
    expect(button.disabled).toBe(false);
    expect(field.getAttribute('aria-invalid')).not.toBe('true');
    fireEvent.blur(field);
    const emptyAlert = screen.getByRole('alert');
    expect(emptyAlert.textContent).toBe('Enter a username');
    expect(field.getAttribute('aria-invalid')).toBe('true');
    expect(field.getAttribute('aria-describedby')).toBe(emptyAlert.id);
    expect(button.disabled).toBe(true);

    fireEvent.change(field, { target: { value: '_' } });
    const formatAlert = screen.getByRole('alert');
    expect(formatAlert.textContent).toBe(
      'Use 1–32 characters: a-z, 0-9, hyphen, underscore, or dot, starting with a letter or digit.',
    );
    expect(field.getAttribute('aria-describedby')).toBe(formatAlert.id);
    expect(button.disabled).toBe(true);
    fireEvent.click(button);
    expect(setUsername).not.toHaveBeenCalled();
  });

  it('maps the api username sentences onto the field without disabling continue', async () => {
    vi.mocked(setUsername).mockRejectedValueOnce(new Error('Username is already in use'));
    renderWithLocale(<UsernameForm />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'ada' } });
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));
    expect(await screen.findByText('That username is already taken')).toBeTruthy();
    expect((screen.getByRole('button', { name: /continue/i }) as HTMLButtonElement).disabled).toBe(
      false,
    );

    vi.mocked(setUsername).mockRejectedValueOnce(
      new Error('Username must be 1–32 characters of a-z, 0-9, hyphen, underscore, or dot'),
    );
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));
    expect(
      await screen.findByText(
        'Use 1–32 characters: a-z, 0-9, hyphen, underscore, or dot, starting with a letter or digit.',
      ),
    ).toBeTruthy();
    expect((screen.getByRole('button', { name: /continue/i }) as HTMLButtonElement).disabled).toBe(
      false,
    );
  });

  it('does nothing without a session', () => {
    useAuthStore.setState({ session: null, account: base });
    renderWithLocale(<UsernameForm />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'ada' } });
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));
    expect(setUsername).not.toHaveBeenCalled();
  });
});
