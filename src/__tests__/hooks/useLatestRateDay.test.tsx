import { act, cleanup, screen, waitFor } from '@testing-library/react';
import type { ReactElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useLatestRateDay } from '@/hooks/useLatestRateDay';
import type { FiatRateDay } from '@/lib/stats-money';
import { renderWithLocale } from '@/__tests__/render-with-locale';

vi.mock('@/lib/api', () => ({
  fetchGiftStats: vi.fn(),
}));

import { fetchGiftStats } from '@/lib/api';

const fetchGiftStatsMock = vi.mocked(fetchGiftStats);

const RATE_DAY: FiatRateDay = {
  sats: 100_000_000,
  usd: '100000.00',
  chf: '80000.00',
  eur: '90000.00',
  php: '5600000.00',
};

/** Mounts {@link useLatestRateDay} for assertions. */
function Probe(): ReactElement {
  const rateDay = useLatestRateDay();
  return <p>{rateDay === null ? 'null' : rateDay.sats}</p>;
}

beforeEach(() => {
  fetchGiftStatsMock.mockReset();
});

afterEach(() => {
  cleanup();
});

describe('useLatestRateDay', () => {
  it('resolves to the latest day with sats > 0', async () => {
    fetchGiftStatsMock.mockResolvedValue({
      spendOverTime: [{ ...RATE_DAY, sats: 0 }, RATE_DAY],
    } as never);
    renderWithLocale(<Probe />);
    await waitFor(() => {
      expect(screen.getByText(String(RATE_DAY.sats))).toBeTruthy();
    });
    expect(fetchGiftStatsMock).toHaveBeenCalledTimes(1);
  });

  it('resolves to null when fetchGiftStats resolves an empty spendOverTime', async () => {
    let resolve!: (value: { spendOverTime: FiatRateDay[] }) => void;
    const pending = new Promise<{ spendOverTime: FiatRateDay[] }>((r) => {
      resolve = r;
    });
    fetchGiftStatsMock.mockReturnValue(pending as never);
    renderWithLocale(<Probe />);
    expect(screen.getByText('null')).toBeTruthy();
    await act(async () => {
      resolve({ spendOverTime: [] });
    });
    expect(screen.getByText('null')).toBeTruthy();
  });

  it('resolves to null when fetchGiftStats rejects', async () => {
    let reject!: (reason?: unknown) => void;
    const pending = new Promise<never>((_, r) => {
      reject = r;
    });
    fetchGiftStatsMock.mockReturnValue(pending as never);
    renderWithLocale(<Probe />);
    expect(screen.getByText('null')).toBeTruthy();
    await act(async () => {
      reject(new Error('stats down'));
    });
    expect(screen.getByText('null')).toBeTruthy();
  });

  it('does not apply the rate after unmount', async () => {
    let resolve!: (value: { spendOverTime: FiatRateDay[] }) => void;
    const pending = new Promise<{ spendOverTime: FiatRateDay[] }>((r) => {
      resolve = r;
    });
    fetchGiftStatsMock.mockReturnValue(pending as never);
    const { unmount } = renderWithLocale(<Probe />);
    unmount();
    await act(async () => {
      resolve({ spendOverTime: [RATE_DAY] });
    });
  });

  it('does not apply a rejection after unmount', async () => {
    let reject!: (reason?: unknown) => void;
    const pending = new Promise<never>((_, r) => {
      reject = r;
    });
    fetchGiftStatsMock.mockReturnValue(pending as never);
    const { unmount } = renderWithLocale(<Probe />);
    unmount();
    await act(async () => {
      reject(new Error('stats down'));
    });
  });
});
