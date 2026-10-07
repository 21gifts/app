import { act, cleanup, screen } from '@testing-library/react';
import type { ReactElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SPOT_REFRESH_MS, useSpotRate } from '@/hooks/useSpotRate';
import type { FxSpot } from '@/lib/api-types';
import { renderWithLocale } from '@/__tests__/render-with-locale';

vi.mock('@/lib/api', () => ({
  fetchFxSpot: vi.fn(),
}));

import { fetchFxSpot } from '@/lib/api';

const fetchFxSpotMock = vi.mocked(fetchFxSpot);

function spot(rates: FxSpot['rates']): FxSpot {
  return { asOf: '2026-10-07T12:00:00.000Z', source: 'test', rates };
}

/** Mounts {@link useSpotRate} and prints its CHF price. */
function Probe({ enabled }: { enabled?: boolean }): ReactElement {
  const rate = useSpotRate(enabled);
  return <p>{rate === null ? 'null' : `CHF ${rate.chf ?? '-'} per ${rate.sats}`}</p>;
}

/** Lets pending promise callbacks run. */
async function flush(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  fetchFxSpotMock.mockReset();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('useSpotRate', () => {
  it('resolves to the spot price of 1 BTC', async () => {
    fetchFxSpotMock.mockResolvedValue(spot({ CHF: '80000.00' }));
    renderWithLocale(<Probe />);
    expect(screen.getByText('null')).toBeTruthy();
    await flush();
    expect(screen.getByText('CHF 80000.00 per 100000000')).toBeTruthy();
    expect(fetchFxSpotMock).toHaveBeenCalledTimes(1);
  });

  it('asks again every few minutes and takes the newer price', async () => {
    fetchFxSpotMock.mockResolvedValueOnce(spot({ CHF: '80000.00' }));
    fetchFxSpotMock.mockResolvedValueOnce(spot({ CHF: '81000.00' }));
    renderWithLocale(<Probe />);
    await flush();
    await act(async () => {
      vi.advanceTimersByTime(SPOT_REFRESH_MS);
    });
    await flush();
    expect(fetchFxSpotMock).toHaveBeenCalledTimes(2);
    expect(screen.getByText('CHF 81000.00 per 100000000')).toBeTruthy();
  });

  it('keeps the last price when a refresh fails', async () => {
    fetchFxSpotMock.mockResolvedValueOnce(spot({ CHF: '80000.00' }));
    fetchFxSpotMock.mockRejectedValueOnce(new Error('down'));
    renderWithLocale(<Probe />);
    await flush();
    await act(async () => {
      vi.advanceTimersByTime(SPOT_REFRESH_MS);
    });
    await flush();
    expect(screen.getByText('CHF 80000.00 per 100000000')).toBeTruthy();
  });

  it('keeps the last price when an answer has no usable price', async () => {
    fetchFxSpotMock.mockResolvedValueOnce(spot({ CHF: '80000.00' }));
    fetchFxSpotMock.mockResolvedValueOnce(spot({}));
    renderWithLocale(<Probe />);
    await flush();
    await act(async () => {
      vi.advanceTimersByTime(SPOT_REFRESH_MS);
    });
    await flush();
    expect(screen.getByText('CHF 80000.00 per 100000000')).toBeTruthy();
  });

  it('does not start a refresh while the previous request is still open', async () => {
    let resolve!: (value: FxSpot) => void;
    fetchFxSpotMock.mockReturnValueOnce(
      new Promise<FxSpot>((r) => {
        resolve = r;
      }),
    );
    fetchFxSpotMock.mockResolvedValue(spot({ CHF: '81000.00' }));
    renderWithLocale(<Probe />);
    await flush();
    await act(async () => {
      vi.advanceTimersByTime(SPOT_REFRESH_MS);
    });
    expect(fetchFxSpotMock).toHaveBeenCalledTimes(1);
    await act(async () => {
      resolve(spot({ CHF: '80000.00' }));
    });
    expect(screen.getByText('CHF 80000.00 per 100000000')).toBeTruthy();
    await act(async () => {
      vi.advanceTimersByTime(SPOT_REFRESH_MS);
    });
    await flush();
    expect(fetchFxSpotMock).toHaveBeenCalledTimes(2);
    expect(screen.getByText('CHF 81000.00 per 100000000')).toBeTruthy();
  });

  it('stays null when the first request fails', async () => {
    fetchFxSpotMock.mockRejectedValue(new Error('down'));
    renderWithLocale(<Probe />);
    await flush();
    expect(screen.getByText('null')).toBeTruthy();
  });

  it('does not fetch while disabled', async () => {
    renderWithLocale(<Probe enabled={false} />);
    await flush();
    expect(fetchFxSpotMock).not.toHaveBeenCalled();
    expect(screen.getByText('null')).toBeTruthy();
  });

  it('returns null while disabled, also after a rate was loaded', async () => {
    fetchFxSpotMock.mockResolvedValue(spot({ CHF: '80000.00' }));
    const { rerender } = renderWithLocale(<Probe />);
    await flush();
    expect(screen.getByText('CHF 80000.00 per 100000000')).toBeTruthy();
    rerender(<Probe enabled={false} />);
    expect(screen.getByText('null')).toBeTruthy();
  });

  it('drops an answer after unmount and stops asking', async () => {
    let resolve!: (value: FxSpot) => void;
    fetchFxSpotMock.mockReturnValue(
      new Promise<FxSpot>((r) => {
        resolve = r;
      }),
    );
    const { unmount } = renderWithLocale(<Probe />);
    unmount();
    await act(async () => {
      resolve(spot({ CHF: '80000.00' }));
    });
    vi.advanceTimersByTime(SPOT_REFRESH_MS);
    expect(fetchFxSpotMock).toHaveBeenCalledTimes(1);
  });
});
