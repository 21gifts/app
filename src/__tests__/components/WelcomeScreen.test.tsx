import { cleanup, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WelcomeScreen } from '@/components/WelcomeScreen';
import { useAuthStore } from '@/stores/auth-store';
import { renderWithLocale } from '@/__tests__/render-with-locale';

vi.mock('@/lib/api', () => ({
  fetchMessages: vi.fn().mockResolvedValue([]),
  postMessage: vi.fn(),
}));

beforeEach(() => {
  useAuthStore.setState({
    session: 'tok',
    account: {
      id: 'acc_1',
      linkingKey: null,
      role: 'basis',
      name: 'Ada',
      lightningAddress: 'alice@walletofsatoshi.com',
      lightningAddressVerified: false,
      createdAt: 1,
    },
  });
});

afterEach(() => {
  cleanup();
});

describe('WelcomeScreen', () => {
  it('shows a welcome without name or address forms', async () => {
    renderWithLocale(<WelcomeScreen />);
    expect(screen.getByRole('heading', { name: 'Welcome, Ada' })).toBeTruthy();
    expect(screen.getByRole('link', { name: /send a gift/i }).getAttribute('href')).toBe('/donate');
    expect(screen.queryByRole('button', { name: /unlink/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /save name/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /log out/i })).toBeNull();
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Messages' })).toBeTruthy();
    });
  });

  it('still renders a welcome heading when the store has no name', () => {
    useAuthStore.setState({
      session: 'tok',
      account: {
        id: 'acc_1',
        linkingKey: null,
        role: 'basis',
        name: null,
        lightningAddress: 'alice@walletofsatoshi.com',
        lightningAddressVerified: false,
        createdAt: 1,
      },
    });
    renderWithLocale(<WelcomeScreen />);
    expect(screen.getByRole('heading', { name: /Welcome/ })).toBeTruthy();
  });
});
