import { act, cleanup, fireEvent, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WalletReceive } from '@/components/WalletReceive';
import type { Account } from '@/lib/api-types';
import { useAuthStore } from '@/stores/auth-store';
import { renderWithLocale } from '@/__tests__/render-with-locale';

const setup = vi.hoisted(() => ({ due: false, failed: false, retry: vi.fn() }));

vi.mock('@/hooks/useWalletSetup', () => ({
  useWalletSetup: () => setup,
}));

vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

function setAccount(username: string | null): void {
  useAuthStore.setState({
    session: 'tok',
    account: { id: 'acc_wallet', name: 'Ada', username } as Account,
  });
}

function renderReceive(): void {
  renderWithLocale(<WalletReceive />);
}

beforeEach(() => {
  setAccount('ada');
  setup.due = false;
  setup.failed = false;
  setup.retry.mockReset();
});

afterEach(() => {
  cleanup();
  useAuthStore.setState({ session: null, account: null });
});

describe('WalletReceive', () => {
  it('shows the label, the address QR, the address, Copy, and Set an amount', () => {
    renderReceive();
    expect(screen.getByText('Receive')).toBeTruthy();
    expect(screen.getByText('ada@21.gifts').className).toContain('font-mono');
    expect(screen.getByRole('img', { name: /QR/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Copy' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Set an amount' }).getAttribute('href')).toBe('/pos');
  });

  it('shows Opening your wallet… in place of the address while the one-time setup runs', () => {
    setup.due = true;
    renderReceive();
    expect(screen.getByText('Receive')).toBeTruthy();
    expect(screen.getByRole('status').textContent).toBe('Opening your wallet…');
    expect(document.querySelector('.animate-spin')).not.toBeNull();
    expect(screen.queryByText('ada@21.gifts')).toBeNull();
    expect(screen.queryByRole('img', { name: /QR/i })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Copy' })).toBeNull();
    expect(screen.getByRole('link', { name: 'Set an amount' })).toBeTruthy();
  });

  it('shows the setup note with Try again in place of the address after the setup gave up', () => {
    setup.due = true;
    setup.failed = true;
    renderReceive();
    expect(screen.getByRole('alert').textContent).toBe('Your wallet could not be set up yet.');
    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.queryByText('ada@21.gifts')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(setup.retry).toHaveBeenCalledTimes(1);
  });

  it('links to the profile when the account has no username yet', () => {
    setAccount(null);
    renderReceive();
    expect(screen.getByRole('link', { name: 'Set a username first.' }).getAttribute('href')).toBe(
      '/profile',
    );
    expect(screen.queryByRole('button', { name: 'Copy' })).toBeNull();
  });

  it('copies the address and says Copied for two seconds', async () => {
    vi.useFakeTimers();
    const writeText = vi.fn(() => Promise.resolve());
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    try {
      renderReceive();
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Copy' }));
        await Promise.resolve();
      });
      expect(writeText).toHaveBeenCalledWith('ada@21.gifts');
      expect(screen.getByRole('button', { name: 'Copied' })).toBeTruthy();
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1_999);
      });
      expect(screen.getByRole('button', { name: 'Copied' })).toBeTruthy();
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1);
      });
      expect(screen.getByRole('button', { name: 'Copy' })).toBeTruthy();
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Copy' }));
        await Promise.resolve();
      });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1_500);
      });
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Copied' }));
        await Promise.resolve();
      });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1_500);
      });
      expect(screen.getByRole('button', { name: 'Copied' })).toBeTruthy();
      await act(async () => {
        await vi.advanceTimersByTimeAsync(500);
      });
      expect(screen.getByRole('button', { name: 'Copy' })).toBeTruthy();
    } finally {
      vi.useRealTimers();
      Reflect.deleteProperty(navigator, 'clipboard');
    }
  });

  it('keeps Copy when the clipboard refuses the write or is missing', async () => {
    const writeText = vi.fn(() => Promise.reject(new Error('denied')));
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    try {
      renderReceive();
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Copy' }));
        await Promise.resolve();
      });
      expect(writeText).toHaveBeenCalledTimes(1);
      expect(screen.getByRole('button', { name: 'Copy' })).toBeTruthy();
      Reflect.deleteProperty(navigator, 'clipboard');
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Copy' }));
        await Promise.resolve();
      });
      expect(screen.getByRole('button', { name: 'Copy' })).toBeTruthy();
    } finally {
      Reflect.deleteProperty(navigator, 'clipboard');
    }
  });

  it('shows only Set an amount when signed out', () => {
    useAuthStore.setState({ session: null, account: null });
    renderWithLocale(<WalletReceive />);
    expect(screen.getByRole('link', { name: 'Set an amount' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Copy' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Set a username first.' })).toBeNull();
  });
});
