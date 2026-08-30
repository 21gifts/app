import { cleanup, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WelcomeScreen } from '@/components/WelcomeScreen';
import { useAuthStore } from '@/stores/auth-store';
import { renderWithLocale } from '@/__tests__/render-with-locale';

vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock('@/lib/api', () => ({
  fetchMessages: vi.fn().mockResolvedValue([]),
  postMessage: vi.fn(),
  fetchMessagePhoto: vi.fn(),
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
      forumLawsDismissed: false,
      createdAt: 1,
      rulesAgreedAt: 1_700_000_001,
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
    expect(screen.queryByRole('link', { name: /send a gift/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /unlink/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /save name/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /log out/i })).toBeNull();
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Forum' })).toBeTruthy();
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
        forumLawsDismissed: false,
        createdAt: 1,
        rulesAgreedAt: 1_700_000_001,
      },
    });
    renderWithLocale(<WelcomeScreen />);
    expect(screen.getByRole('heading', { name: /Welcome/ })).toBeTruthy();
  });
});
