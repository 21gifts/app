import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { WalletUsageLoader } from '@/app/(marketing)/stats/wallet/wallet-usage-loader';
import type { WalletStats, WalletUsage } from '@/lib/api-types';

const USAGE = {
  releasedAt: '2026-11-09T11:17:00.000Z',
  asOf: null,
  totals: {
    paymentCount: 4,
    volumeSats: 10,
    feeSats: 0,
    medianSats: 1,
    averageSats: 1,
    activeWalletCount: 1,
    sendingWalletCount: 1,
    topFiveSenderShare: 0,
    heartCount: 0,
    paidShopChargeCount: 0,
  },
  days: [],
  flows: [],
  amountBuckets: [],
  hours: [],
  forum: [],
  shopCharges: [],
} as WalletUsage;

const WALLETS: WalletStats = {
  walletCount: 2,
  fundedWalletCount: 2,
  totalSats: 10,
  totalBtc: '0.00000010',
  asOf: null,
  balanceOverTime: [
    {
      day: '2026-11-09',
      totalSats: 10,
      totalBtc: '0.00000010',
      walletCount: 2,
      fundedWalletCount: 2,
    },
  ],
};

vi.mock('@/lib/api', () => ({
  fetchWalletUsage: vi.fn(),
  fetchWalletStats: vi.fn(),
}));

vi.mock('@/components/WalletUsageDashboard', () => ({
  WalletUsageDashboard: ({
    usage,
    wallets,
    error,
    loading,
  }: {
    usage: WalletUsage | null;
    wallets: WalletStats | null;
    error: string | null;
    loading: boolean;
  }) => (
    <div>
      <span>{loading ? 'loading' : 'ready'}</span>
      <span>{error === null ? '' : error}</span>
      <span>{usage === null ? 'no-usage' : String(usage.totals.paymentCount)}</span>
      <span>{wallets === null ? 'no-wallets' : String(wallets.fundedWalletCount)}</span>
    </div>
  ),
}));

import { fetchWalletStats, fetchWalletUsage } from '@/lib/api';

const usageMock = vi.mocked(fetchWalletUsage);
const walletsMock = vi.mocked(fetchWalletStats);

afterEach(() => {
  cleanup();
  usageMock.mockReset();
  walletsMock.mockReset();
});

describe('WalletUsageLoader', () => {
  it('renders usage and wallet stats together', async () => {
    usageMock.mockResolvedValue(USAGE);
    walletsMock.mockResolvedValue(WALLETS);
    render(<WalletUsageLoader />);
    await waitFor(() => {
      expect(screen.getByText('4')).toBeTruthy();
    });
    expect(screen.getByText('2')).toBeTruthy();
    expect(screen.getByText('ready')).toBeTruthy();
  });

  it('keeps usage and hides wallet stats when that fetch fails', async () => {
    usageMock.mockResolvedValue(USAGE);
    walletsMock.mockRejectedValueOnce(new Error('Could not load wallet stats. Please try again.'));
    render(<WalletUsageLoader />);
    await waitFor(() => {
      expect(screen.getByText('4')).toBeTruthy();
    });
    expect(screen.getByText('no-wallets')).toBeTruthy();
    expect(screen.queryByText('Could not load wallet stats. Please try again.')).toBeNull();
  });

  it('shows one quiet line when usage fails', async () => {
    usageMock.mockRejectedValueOnce(new Error('Could not load wallet usage. Please try again.'));
    walletsMock.mockResolvedValue(WALLETS);
    render(<WalletUsageLoader />);
    await waitFor(() => {
      expect(screen.getByText('Could not load wallet usage. Please try again.')).toBeTruthy();
    });
    expect(screen.getByText('no-usage')).toBeTruthy();
    expect(screen.getByText('no-wallets')).toBeTruthy();
  });

  it('uses the fallback sentence for a non-Error rejection', async () => {
    usageMock.mockRejectedValueOnce('nope');
    walletsMock.mockResolvedValue(WALLETS);
    render(<WalletUsageLoader />);
    await waitFor(() => {
      expect(screen.getByText('Could not load wallet usage. Please try again.')).toBeTruthy();
    });
  });

  it('ignores a stale success after unmount', async () => {
    let resolveUsage: ((value: WalletUsage) => void) | undefined;
    let resolveWallets: ((value: WalletStats) => void) | undefined;
    usageMock.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveUsage = resolve;
        }),
    );
    walletsMock.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveWallets = resolve;
        }),
    );
    const view = render(<WalletUsageLoader />);
    view.unmount();
    resolveUsage?.(USAGE);
    resolveWallets?.(WALLETS);
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    expect(usageMock).toHaveBeenCalled();
  });

  it('ignores a stale rejection after unmount', async () => {
    let rejectUsage: ((reason: Error) => void) | undefined;
    usageMock.mockImplementationOnce(
      () =>
        new Promise((_, reject) => {
          rejectUsage = reject;
        }),
    );
    walletsMock.mockResolvedValue(WALLETS);
    const view = render(<WalletUsageLoader />);
    view.unmount();
    rejectUsage?.(new Error('gone'));
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    expect(usageMock).toHaveBeenCalled();
  });
});
