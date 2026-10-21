import { act, renderHook as renderHookBase, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FiatPreferenceProvider } from '@/components/FiatPreferenceProvider';
import { useShopChargeFigure } from '@/hooks/useShopChargeFigure';
import type { FiatCode } from '@/lib/committed-fiat';

let viewerFiat: FiatCode = 'USD';

function wrapper({ children }: { children: ReactNode }): ReactNode {
  return <FiatPreferenceProvider initial={viewerFiat}>{children}</FiatPreferenceProvider>;
}

function renderHook<T>(callback: () => T): ReturnType<typeof renderHookBase<T>> {
  return renderHookBase(callback, { wrapper });
}

const RECEIPT = {
  id: 'chg_abc',
  amountSats: 2_100,
  status: 'paid',
  createdAt: '2026-09-22T00:00:00.000Z',
  expiresAt: '2026-09-22T00:05:00.000Z',
  paidAt: '2026-09-22T00:01:00.000Z',
  amountCurrency: 'PHP',
  amount: '12.00',
  amountUsd: '1.00',
  amountChf: null,
  amountEur: null,
  amountPhp: null,
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

afterEach(() => {
  viewerFiat = 'USD';
  vi.unstubAllGlobals();
});

describe('useShopChargeFigure', () => {
  it('does not fetch a payment that is not a shop charge', () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const { result } = renderHook(() => useShopChargeFigure({ purpose: 'gift' }));
    expect(result.current).toEqual({ pending: false, figure: null });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('shows bitcoin until the receipt returns the typed pair', async () => {
    const fetchMock = vi.fn().mockResolvedValue(json(RECEIPT));
    vi.stubGlobal('fetch', fetchMock);
    const { result } = renderHook(() =>
      useShopChargeFigure({
        purpose: 'shop',
        chargeId: 'chg_abc',
        lnAddress: 'shop@21.gifts',
      }),
    );
    expect(result.current).toEqual({ pending: true, figure: null });
    await waitFor(() => {
      expect(result.current).toEqual({
        pending: false,
        figure: { code: 'PHP', amount: '12.00' },
      });
    });
    expect(fetchMock).toHaveBeenCalledWith('/pay/shop/charges/chg_abc');
  });

  it('uses the id route when the payment has no Lightning local part', async () => {
    const fetchMock = vi.fn().mockResolvedValue(json(RECEIPT));
    vi.stubGlobal('fetch', fetchMock);
    const { result } = renderHook(() =>
      useShopChargeFigure({ purpose: 'shop', chargeId: 'chg_abc' }),
    );
    await waitFor(() => {
      expect(result.current.figure).toEqual({ code: 'PHP', amount: '12.00' });
    });
    expect(fetchMock).toHaveBeenCalledWith('/pay/charges/chg_abc');
  });

  it('loads the id route when the Lightning address has no @ or starts with @', async () => {
    for (const lnAddress of ['shop', '@21.gifts']) {
      const fetchMock = vi.fn().mockResolvedValue(json(RECEIPT));
      vi.stubGlobal('fetch', fetchMock);
      const { result, unmount } = renderHook(() =>
        useShopChargeFigure({ purpose: 'shop', chargeId: 'chg_abc', lnAddress }),
      );
      await waitFor(() => {
        expect(result.current.figure).toEqual({ code: 'PHP', amount: '12.00' });
      });
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock).toHaveBeenCalledWith('/pay/charges/chg_abc');
      unmount();
    }
  });

  it('loads the id route when the local part is empty or contains whitespace', async () => {
    for (const lnAddress of ['shop@', 'sh op@21.gifts']) {
      const fetchMock = vi.fn().mockResolvedValue(json(RECEIPT));
      vi.stubGlobal('fetch', fetchMock);
      const { result, unmount } = renderHook(() =>
        useShopChargeFigure({ purpose: 'shop', chargeId: 'chg_abc', lnAddress }),
      );
      await waitFor(() => {
        expect(result.current.figure).toEqual({ code: 'PHP', amount: '12.00' });
      });
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock).toHaveBeenCalledWith('/pay/charges/chg_abc');
      unmount();
    }
  });

  it('drops an answer that arrives after unmount', async () => {
    let finish: (value: Response) => void = () => undefined;
    const fetchMock = vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          finish = resolve;
        }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const { result, unmount } = renderHook(() =>
      useShopChargeFigure({
        purpose: 'shop',
        chargeId: 'chg_abc',
        lnAddress: 'shop@21.gifts',
      }),
    );
    expect(result.current).toEqual({ pending: true, figure: null });
    expect(fetchMock).toHaveBeenCalledWith('/pay/shop/charges/chg_abc');
    unmount();
    await act(async () => {
      finish(json(RECEIPT));
      await new Promise((resolve) => {
        setTimeout(resolve, 0);
      });
      await new Promise((resolve) => {
        setTimeout(resolve, 0);
      });
    });
    expect(result.current).toEqual({ pending: true, figure: null });
  });

  it('leaves the fiat absent after a 404', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({ error: 'missing' }, 404)));
    const { result } = renderHook(() =>
      useShopChargeFigure({ purpose: 'shop', chargeId: 'gone', lnAddress: 'shop@21.gifts' }),
    );
    await waitFor(() => {
      expect(result.current.pending).toBe(false);
    });
    expect(result.current.figure).toBeNull();
  });

  it('uses the visitor snapshot when the receipt has no typed pair', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        json({
          ...RECEIPT,
          amountCurrency: null,
          amount: null,
          amountUsd: '5.00',
        }),
      ),
    );
    const { result } = renderHook(() =>
      useShopChargeFigure({
        purpose: 'shop',
        chargeId: 'chg_abc',
        lnAddress: 'shop@21.gifts',
      }),
    );
    await waitFor(() => {
      expect(result.current.figure).toEqual({ code: 'USD', amount: '5.00' });
    });
  });

  it('does not use a snapshot stored for another currency', async () => {
    viewerFiat = 'CHF';
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        json({
          ...RECEIPT,
          amountCurrency: null,
          amount: null,
          amountUsd: '5.00',
        }),
      ),
    );
    const { result } = renderHook(() =>
      useShopChargeFigure({
        purpose: 'shop',
        chargeId: 'chg_abc',
        lnAddress: 'shop@21.gifts',
      }),
    );
    await waitFor(() => {
      expect(result.current.pending).toBe(false);
    });
    expect(result.current.figure).toBeNull();
  });
});
