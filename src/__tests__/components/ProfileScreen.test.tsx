import { cleanup, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ProfileScreen } from '@/components/ProfileScreen';
import { fetchGiftStats } from '@/lib/api';
import type { GiftStats } from '@/lib/api-types';
import { useAuthStore } from '@/stores/auth-store';
import { renderWithLocale } from '@/__tests__/render-with-locale';

vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    ...rest
  }: {
    href: string;
    children: React.ReactNode;
    [key: string]: unknown;
  }) => (
    <a href={href} {...rest}>
      {children}
    </a>
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
};

const VIEW_KEY = 'a'.repeat(64);

beforeEach(() => {
  vi.mocked(fetchGiftStats).mockReset();
  vi.mocked(fetchGiftStats).mockResolvedValue({
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
    expect(screen.getByRole('link', { name: 'Back to the forum' }).getAttribute('href')).toBe(
      '/welcome',
    );
    expect(screen.queryByText('Back to the forum')).toBeNull();
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
        },
        {
          day: '2026-06-02',
          sats: 0,
          cumulativeSats: 500,
          btc: '0.00000000',
          cumulativeBtc: '0.00000500',
          usd: '0.00',
          cumulativeUsd: '0.48',
        },
        {
          day: '2026-06-03',
          sats: 1000,
          cumulativeSats: 1500,
          btc: '0.00001000',
          cumulativeBtc: '0.00001500',
          usd: '0.95',
          cumulativeUsd: '1.43',
        },
      ],
      byRecipient: [
        { recipient: 'alice', giftCount: 2, sats: 1500, btc: '0.00001500', usd: '1.43' },
      ],
      byMonth: [],
      fx: EMPTY_FX,
    };
    vi.mocked(fetchGiftStats).mockResolvedValue(seriesStats);
    renderWithLocale(<ProfileScreen />);
    await waitFor(() => {
      expect(screen.getByText('2026-06-01')).toBeTruthy();
    });
    expect(screen.queryByLabelText('Received ₿1,500')).toBeNull();
  });

  it('shows the icon-only view-key copy control without the URL or key', async () => {
    renderWithLocale(<ProfileScreen />);
    expect(screen.getByRole('button', { name: 'Copy view-only link' })).toBeTruthy();
    expect(screen.queryByText('Copy view-only link')).toBeNull();
    expect(screen.queryByRole('heading', { name: 'View key' })).toBeNull();
    expect(screen.queryByText(`${window.location.origin}/view/${VIEW_KEY}`)).toBeNull();
    expect(screen.queryByText(VIEW_KEY)).toBeNull();
    expect(screen.queryByText(`/view/${VIEW_KEY}`)).toBeNull();
  });

  it('hides the view-key section when account is null', () => {
    useAuthStore.setState({ session: 'tok', account: null });
    renderWithLocale(<ProfileScreen />);
    expect(screen.queryByRole('heading', { name: 'View key' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Copy view-only link' })).toBeNull();
  });
});
