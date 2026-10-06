import { act, cleanup, fireEvent, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WalletSetupNotice } from '@/components/WalletSetupNotice';
import { useWalletSetup, type WalletSetupView } from '@/hooks/useWalletSetup';
import { disablePush } from '@/lib/push';
import { useAuthStore } from '@/stores/auth-store';
import { renderWithLocale } from '@/__tests__/render-with-locale';

const replace = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: (): { replace: typeof replace } => ({ replace }),
}));
vi.mock('@/hooks/useWalletSetup', () => ({ useWalletSetup: vi.fn() }));
vi.mock('@/lib/push', () => ({ disablePush: vi.fn() }));

const start = vi.fn();
const retry = vi.fn();

function show(view: WalletSetupView): void {
  vi.mocked(useWalletSetup).mockReturnValue({ view, start, retry });
  renderWithLocale(<WalletSetupNotice />);
}

beforeEach(() => {
  start.mockReset();
  retry.mockReset();
  replace.mockReset();
  vi.mocked(disablePush).mockReset().mockResolvedValue(undefined);
  useAuthStore.setState({ session: 'sess', account: null });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('WalletSetupNotice', () => {
  it('intro explains the step and starts on Set up wallet', () => {
    show('intro');
    const dialog = screen.getByRole('dialog', { name: 'Set up your wallet' });
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(screen.getByText(/Confirm with your passkey once/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Set up wallet' }));
    expect(start).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: /close/i })).toBeNull();
  });

  it('progress shows a status line and no action button besides Log out', () => {
    show('progress');
    expect(screen.getByRole('status').textContent).toBe('Setting up your wallet…');
    expect(screen.getAllByRole('button').map((b) => b.textContent)).toEqual(['Log out']);
  });

  it('error shows a plain alert and Try again', () => {
    show('error');
    expect(screen.getByRole('alert').textContent).toBe(
      'Your wallet could not be set up. Please try again.',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it('noPrf says this phone or browser cannot hold a wallet and offers only Log out', () => {
    show('noPrf');
    expect(screen.getByRole('dialog', { name: 'No wallet on this phone or browser' })).toBeTruthy();
    expect(screen.getByRole('alert').textContent).toBe(
      'This phone or browser cannot hold a 21.gifts wallet. Please use an up-to-date phone or browser that supports passkeys.',
    );
    expect(screen.getAllByRole('button').map((b) => b.textContent)).toEqual(['Log out']);
  });

  it('Log out turns off push, clears the session, and opens /login once', async () => {
    show('error');
    const button = screen.getByRole('button', { name: 'Log out' });
    await act(async () => {
      fireEvent.click(button);
      fireEvent.click(button);
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(disablePush).toHaveBeenCalledTimes(1);
    expect(disablePush).toHaveBeenCalledWith('sess');
    expect(useAuthStore.getState().session).toBeNull();
    expect(replace).toHaveBeenCalledWith('/login');
    expect(replace).toHaveBeenCalledTimes(1);
    expect((button as HTMLButtonElement).disabled).toBe(false);
    expect(button.querySelector('svg')).toBeNull();
  });

  it('Log out still leaves when turning off push hangs or fails', async () => {
    vi.useFakeTimers();
    vi.mocked(disablePush).mockReturnValueOnce(new Promise(() => undefined));
    show('intro');
    fireEvent.click(screen.getByRole('button', { name: 'Log out' }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    expect(replace).toHaveBeenCalledWith('/login');
    vi.useRealTimers();
    cleanup();
    replace.mockReset();
    useAuthStore.setState({ session: 'sess' });
    vi.mocked(disablePush).mockRejectedValueOnce(new Error('x'));
    show('intro');
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Log out' }));
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(replace).toHaveBeenCalledWith('/login');
  });

  it('Log out without a session skips push', async () => {
    useAuthStore.setState({ session: null });
    show('intro');
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Log out' }));
      await Promise.resolve();
    });
    expect(disablePush).not.toHaveBeenCalled();
    expect(replace).toHaveBeenCalledWith('/login');
  });
});
