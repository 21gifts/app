import { cleanup, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ProfileScreen } from '@/components/ProfileScreen';
import { fetchGiftStats } from '@/lib/api';
import type { GiftStats } from '@/lib/api-types';
import { useAuthStore } from '@/stores/auth-store';
import { renderWithLocale } from '@/__tests__/render-with-locale';

vi.mock('@/lib/api', () => ({
  fetchGiftStats: vi.fn().mockResolvedValue({
    totalSats: 0,
    totalBtc: '0.00000000',
    totalUsd: '0.00',
    totalChf: '0.00',
    totalEur: '0.00',
    totalPhp: '0.00',
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
      quotes: [{ code: 'USD', pair: 'BTC-USD', source: 'coinbase-exchange-daily-close' }],
    },
  }),
  setName: vi.fn(),
  setLightningAddress: vi.fn(),
  unlinkLightningAddress: vi.fn(),
}));

vi.mock('@/lib/push', () => ({
  enablePush: vi.fn(),
  disablePush: vi.fn(),
  isIosSafari: vi.fn().mockReturnValue(false),
  isStandaloneDisplay: vi.fn().mockReturnValue(false),
  registerPushWorker: vi.fn(),
  vapidPublicKeyToBytes: vi.fn(),
}));

const EMPTY_FX = {
  quote: 'BTC-USD' as const,
  dayBasis: 'utc' as const,
  source: 'coinbase-exchange-daily-close' as const,
  quotes: [{ code: 'USD' as const, pair: 'BTC-USD', source: 'coinbase-exchange-daily-close' }],
};

const FX_ALL = {
  quote: 'BTC-USD' as const,
  dayBasis: 'utc' as const,
  source: 'coinbase-exchange-daily-close' as const,
  quotes: [
    { code: 'USD' as const, pair: 'BTC-USD', source: 'coinbase-exchange-daily-close' },
    { code: 'CHF' as const, pair: 'USD-CHF', source: 'ecb-daily' },
    { code: 'EUR' as const, pair: 'USD-EUR', source: 'ecb-daily' },
    { code: 'PHP' as const, pair: 'USD-PHP', source: 'ecb-daily' },
  ],
};

const VIEW_KEY = 'a'.repeat(64);

beforeEach(() => {
  vi.mocked(fetchGiftStats).mockReset();
  vi.mocked(fetchGiftStats).mockResolvedValue({
    totalSats: 0,
    totalBtc: '0.00000000',
    totalUsd: '0.00',
    totalChf: '0.00',
    totalEur: '0.00',
    totalPhp: '0.00',
    giftCount: 0,
    recipientCount: 0,
    firstPaidAt: null,
    lastPaidAt: null,
    spendOverTime: [],
    byRecipient: [],
    byMonth: [],
    fx: EMPTY_FX,
  });
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
      viewKey: VIEW_KEY,
      setup: null,
      missing: [],
    },
  });
});

afterEach(() => {
  cleanup();
});

describe('ProfileScreen', () => {
  it('shows the heading, back link, name form, address form, and chart', async () => {
    renderWithLocale(<ProfileScreen />);
    expect(screen.getByRole('heading', { name: 'Profile' })).toBeTruthy();
    expect(screen.getByText('Name')).toBeTruthy();
    expect(screen.getByText('Wallet of Satoshi address')).toBeTruthy();
    expect(screen.getByText('No gifts yet.')).toBeTruthy();
    expect(screen.queryByRole('img', { name: 'Given and received in ₿' })).toBeNull();
    expect(screen.queryByText('Loading…')).toBeNull();
    await waitFor(() => {
      expect(vi.mocked(fetchGiftStats)).toHaveBeenCalled();
    });
  });

  it('keeps the chart mounted with no Loading… while fetch is pending', () => {
    vi.mocked(fetchGiftStats).mockReturnValue(new Promise<GiftStats>(() => undefined));
    renderWithLocale(<ProfileScreen />);
    expect(screen.queryByText('Loading…')).toBeNull();
    expect(screen.getByText('No gifts yet.')).toBeTruthy();
    expect(screen.queryByRole('img', { name: 'Given and received in ₿' })).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Given and received' })).toBeNull();
    expect(screen.queryByLabelText('Given ₿0')).toBeNull();
  });

  it('shows a series day tick after filtered stats load', async () => {
    const seriesStats: GiftStats = {
      totalSats: 1500,
      totalBtc: '0.00001500',
      totalUsd: '1.43',
      totalChf: '1.20',
      totalEur: '1.30',
      totalPhp: '80.00',
      giftCount: 2,
      recipientCount: 1,
      firstPaidAt: '2026-06-01T00:00:00.000Z',
      lastPaidAt: '2026-06-03T00:00:00.000Z',
      spendOverTime: [
        {
          day: '2026-06-01',
          sats: 500,
          cumulativeSats: 500,
          btc: '0.00000500',
          cumulativeBtc: '0.00000500',
          usd: '0.48',
          cumulativeUsd: '0.48',
          chf: '0.40',
          eur: '0.44',
          php: '27.00',
          cumulativeChf: '0.40',
          cumulativeEur: '0.44',
          cumulativePhp: '27.00',
        },
        {
          day: '2026-06-02',
          sats: 0,
          cumulativeSats: 500,
          btc: '0.00000000',
          cumulativeBtc: '0.00000500',
          usd: '0.00',
          cumulativeUsd: '0.48',
          chf: '0.00',
          eur: '0.00',
          php: '0.00',
          cumulativeChf: '0.40',
          cumulativeEur: '0.44',
          cumulativePhp: '27.00',
        },
        {
          day: '2026-06-03',
          sats: 1000,
          cumulativeSats: 1500,
          btc: '0.00001000',
          cumulativeBtc: '0.00001500',
          usd: '0.95',
          cumulativeUsd: '1.43',
          chf: '0.80',
          eur: '0.86',
          php: '53.00',
          cumulativeChf: '1.20',
          cumulativeEur: '1.30',
          cumulativePhp: '80.00',
        },
      ],
      byRecipient: [
        {
          recipient: 'alice',
          giftCount: 2,
          sats: 1500,
          btc: '0.00001500',
          usd: '1.43',
          chf: '1.20',
          eur: '1.30',
          php: '80.00',
        },
      ],
      byMonth: [],
      fx: FX_ALL,
    };
    vi.mocked(fetchGiftStats).mockResolvedValue(seriesStats);
    renderWithLocale(<ProfileScreen />);
    await waitFor(() => {
      expect(screen.getByText('2026-06-01')).toBeTruthy();
    });
    expect(screen.queryByLabelText('Received ₿1,500')).toBeNull();
  });

  it('does not show a copy view-only link control, View key heading, view URL, or raw key', () => {
    renderWithLocale(<ProfileScreen />);
    expect(screen.queryByRole('button', { name: 'Copy view-only link' })).toBeNull();
    expect(screen.queryByRole('heading', { name: 'View key' })).toBeNull();
    expect(screen.queryByText(`${window.location.origin}/view/${VIEW_KEY}`)).toBeNull();
    expect(screen.queryByText(VIEW_KEY)).toBeNull();
    expect(screen.queryByText(`/view/${VIEW_KEY}`)).toBeNull();
  });
});
