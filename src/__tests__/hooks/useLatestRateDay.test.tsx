import { act, cleanup, renderHook, screen, waitFor } from '@testing-library/react';
import type { ReactElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useLatestRateDay, useLatestRateDayState } from '@/hooks/useLatestRateDay';
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

/** Mounts {@link useLatestRateDayState} for assertions. */
function StateProbe({ enabled }: { enabled: boolean }): ReactElement {
  const { rateDay, settled } = useLatestRateDayState(enabled);
  const day = rateDay === null ? 'null' : String(rateDay.sats);
  return (
    <p>
      {settled ? 'settled' : 'pending'}:{day}
    </p>
  );
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

  it('skips a newer day that cannot convert the preferred fiat', async () => {
    fetchGiftStatsMock.mockResolvedValue({
      spendOverTime: [
        RATE_DAY,
        { ...RATE_DAY, sats: 1000, usd: '10.00', chf: null, eur: null, php: null },
      ],
    } as never);
    renderWithLocale(<Probe />, 'en', 'ch', 'PHP');
    await waitFor(() => {
      expect(screen.getByText(String(RATE_DAY.sats))).toBeTruthy();
    });
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

  it('stays settled and does not fetch when disabled', () => {
    renderWithLocale(<StateProbe enabled={false} />);
    expect(screen.getByText('settled:null')).toBeTruthy();
    expect(fetchGiftStatsMock).not.toHaveBeenCalled();
  });

  it('stays pending until fetchGiftStats resolves, then settles the day', async () => {
    let resolve!: (value: { spendOverTime: FiatRateDay[] }) => void;
    const pending = new Promise<{ spendOverTime: FiatRateDay[] }>((r) => {
      resolve = r;
    });
    fetchGiftStatsMock.mockReturnValue(pending as never);
    renderWithLocale(<StateProbe enabled />);
    expect(screen.getByText('pending:null')).toBeTruthy();
    await act(async () => {
      resolve({ spendOverTime: [RATE_DAY] });
    });
    expect(screen.getByText(`settled:${RATE_DAY.sats}`)).toBeTruthy();
  });

  it('settles with no day when fetchGiftStats rejects', async () => {
    let reject!: (reason?: unknown) => void;
    const pending = new Promise<never>((_, r) => {
      reject = r;
    });
    fetchGiftStatsMock.mockReturnValue(pending as never);
    renderWithLocale(<StateProbe enabled />);
    expect(screen.getByText('pending:null')).toBeTruthy();
    await act(async () => {
      reject(new Error('stats down'));
    });
    expect(screen.getByText('settled:null')).toBeTruthy();
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

describe('useLatestRateDayState', () => {
  it('is loading until the read settles, then carries the rate or null', async () => {
    let finish: (value: Awaited<ReturnType<typeof fetchGiftStats>>) => void = () => undefined;
    fetchGiftStatsMock.mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const { result } = renderHook(() => useLatestRateDayState());
    expect(result.current).toEqual({ rateDay: null, settled: false, loading: true });
    await act(async () => {
      finish({
        spendOverTime: [{ date: '2026-01-07', ...RATE_DAY }],
      } as unknown as Awaited<ReturnType<typeof fetchGiftStats>>);
    });
    expect(result.current.loading).toBe(false);
    fetchGiftStatsMock.mockRejectedValueOnce(new Error('down'));
    const failed = renderHook(() => useLatestRateDayState());
    await waitFor(() => {
      expect(failed.result.current).toEqual({ rateDay: null, settled: true, loading: false });
    });
  });

  it('stays loading without fetching while disabled', () => {
    const { result } = renderHook(() => useLatestRateDayState(false));
    expect(result.current).toEqual({ rateDay: null, settled: true, loading: true });
  });
});
