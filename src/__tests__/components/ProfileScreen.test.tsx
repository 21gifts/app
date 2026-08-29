import { cleanup, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ProfileScreen } from '@/components/ProfileScreen';
import { fetchGiftStats } from '@/lib/api';
import { useAuthStore } from '@/stores/auth-store';
import { renderWithLocale } from '@/__tests__/render-with-locale';

vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock('@/lib/api', () => ({
  fetchGiftStats: vi.fn().mockResolvedValue({
    totalSats: 0,
    totalBtc: '0.00000000',
    totalUsd: '0.00',
    giftCount: 0,
    recipientCount: 0,
    firstPaidAt: null,
    lastPaidAt: null,
    spendOverTime: [],
    byRecipient: [],
    byMonth: [],
    fx: {
      quote: 'BTC-USD',
      dayBasis: 'utc',
      source: 'coinbase-exchange-daily-close',
    },
  }),
  setName: vi.fn(),
  setLightningAddress: vi.fn(),
  unlinkLightningAddress: vi.fn(),
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

describe('ProfileScreen', () => {
  it('shows the heading, back link, name form, and address form', async () => {
    renderWithLocale(<ProfileScreen />);
    expect(screen.getByRole('heading', { name: 'Profile' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Back to forum' }).getAttribute('href')).toBe(
      '/welcome',
    );
    expect(screen.getByText('Name')).toBeTruthy();
    expect(screen.getByText('Wallet of Satoshi address')).toBeTruthy();
    await waitFor(() => {
      expect(screen.getByText(/Given 0 sats/)).toBeTruthy();
    });
  });

  it('formats a single received sat with forum.satsOne', async () => {
    vi.mocked(fetchGiftStats).mockResolvedValue({
      totalSats: 0,
      totalBtc: '0.00000000',
      totalUsd: '0.00',
      giftCount: 0,
      recipientCount: 0,
      firstPaidAt: null,
      lastPaidAt: null,
      spendOverTime: [],
      byRecipient: [
        {
          recipient: 'alice',
          giftCount: 1,
          sats: 1,
          btc: '0.00000001',
          usd: '0.00',
        },
      ],
      byMonth: [],
      fx: {
        quote: 'BTC-USD',
        dayBasis: 'utc',
        source: 'coinbase-exchange-daily-close',
      },
    });
    renderWithLocale(<ProfileScreen />);
    await waitFor(() => {
      expect(screen.getByText(/Received 1 sat/)).toBeTruthy();
    });
  });
});
