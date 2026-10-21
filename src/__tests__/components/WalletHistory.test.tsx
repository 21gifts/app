import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WalletHistory } from '@/components/WalletHistory';
import { useShopChargeFigure } from '@/hooks/useShopChargeFigure';
import { useSpotRate } from '@/hooks/useSpotRate';
import { useWalletHistory, type UseWalletHistoryResult } from '@/hooks/useWalletHistory';
import type { FiatRateDay } from '@/lib/stats-money';
import type { WalletPayment } from '@/lib/wallet/wallet-sdk';
import { useAuthStore } from '@/stores/auth-store';
import { renderWithLocale } from '@/__tests__/render-with-locale';

vi.mock('@/hooks/useSpotRate', () => ({ useSpotRate: vi.fn() }));
vi.mock('@/hooks/useWalletHistory', () => ({ useWalletHistory: vi.fn() }));
vi.mock('@/hooks/useShopChargeFigure', () => ({
  useShopChargeFigure: vi.fn(() => ({ pending: false, figure: null })),
}));

const RATE_DAY: FiatRateDay = {
  sats: 100_000_000,
  usd: '100000.00',
  chf: '80000.00',
  eur: '90000.00',
  php: '5600000.00',
};

const loadMore = vi.fn();
const retry = vi.fn();

function payment(overrides: Partial<WalletPayment>): WalletPayment {
  return {
    id: 'p',
    direction: 'received',
    amountSats: 21_000,
    timestamp: Date.parse('2026-01-07T10:00:00.000Z'),
    feesSats: 0,
    status: 'completed',
    method: 'lightning',
    senderComment: null,
    info: {},
    ...overrides,
  };
}

function show(state: Partial<UseWalletHistoryResult>): ReturnType<typeof renderWithLocale> {
  vi.mocked(useWalletHistory).mockReturnValue({
    status: 'ready',
    payments: [],
    hasMore: false,
    loadMore,
    retry,
    ...state,
  });
  return renderWithLocale(<WalletHistory />);
}

type ObserverCallback = (entries: Array<{ isIntersecting: boolean }>) => void;
const observers: Array<{ callback: ObserverCallback; disconnect: ReturnType<typeof vi.fn> }> = [];

beforeEach(() => {
  loadMore.mockReset();
  retry.mockReset();
  vi.mocked(useShopChargeFigure).mockReset();
  vi.mocked(useShopChargeFigure).mockReturnValue({ pending: false, figure: null });
  vi.mocked(useSpotRate).mockReset().mockReturnValue(RATE_DAY);
  useAuthStore.setState({ session: null, account: null });
  observers.length = 0;
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      disconnect = vi.fn();
      constructor(callback: ObserverCallback) {
        observers.push({ callback, disconnect: this.disconnect });
      }
      observe(): void {}
    },
  );
});

afterEach(() => {
  cleanup();
  useAuthStore.setState({ session: null, account: null });
  vi.unstubAllGlobals();
});

describe('WalletHistory', () => {
  it('renders nothing during the first load', () => {
    const { container } = show({ status: 'loading' });
    expect(container.firstChild).toBeNull();
  });

  it('shows the empty line', () => {
    show({});
    expect(screen.getByRole('region', { name: 'Payments' })).toBeTruthy();
    expect(screen.getByText('No payments yet.')).toBeTruthy();
  });

  it('shows an error with Try again', () => {
    show({ status: 'error' });
    expect(screen.getByRole('alert').textContent).toBe(
      'Your payments could not be loaded. Please try again.',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it('links each row to its payment screen with a title, a signed bitcoin amount, the date and status, and the message', () => {
    show({
      payments: [
        payment({ id: 'a', senderComment: 'Thanks for the coffee' }),
        payment({
          id: 'b',
          direction: 'sent',
          amountSats: 5_000,
          info: { lnAddress: 'bob@example.com', lnurlComment: 'For lunch' },
        }),
        payment({ id: 'c', status: 'pending', amountSats: 1_500 }),
        payment({ id: 'd', status: 'failed', direction: 'sent', amountSats: 7 }),
      ],
    });
    const rows = screen.getAllByRole('link');
    expect(rows).toHaveLength(4);
    expect(rows[0]?.getAttribute('href')).toBe('/wallet/payment?id=a');
    expect(rows[0]?.textContent).toContain('Received');
    expect(rows[0]?.textContent).toContain("+₿21'000");
    expect(rows[0]?.textContent).toContain('$21.00');
    expect(rows[0]?.textContent).toContain('Thanks for the coffee');
    expect(rows[0]?.querySelector('time')?.getAttribute('datetime')).toBe(
      '2026-01-07T10:00:00.000Z',
    );
    expect(rows[1]?.textContent).toContain('bob@example.com');
    expect(rows[1]?.textContent).toContain("−₿5'000");
    expect(rows[1]?.textContent).toContain('For lunch');
    expect(rows[1]?.textContent).not.toContain('Pending');
    expect(rows[2]?.textContent).toContain('· Pending');
    expect(rows[3]?.textContent).toContain('Sent');
    expect(screen.getByText('· Failed', { exact: false }).className).toContain('text-app-danger');
    expect(screen.getByText('−₿7', { exact: false }).className).toContain('line-through');
  });

  it('shows the stored PHP figure on a shop row and bitcoin when the receipt has none', () => {
    vi.mocked(useShopChargeFigure).mockImplementation((info) => {
      if (info !== null && info.chargeId === 'chg_php') {
        return { pending: false, figure: { code: 'PHP', amount: '12.00' } };
      }
      return { pending: false, figure: null };
    });
    show({
      payments: [
        payment({
          id: 'shop-php',
          info: { purpose: 'shop', chargeId: 'chg_php', lnAddress: 'shop@21.gifts' },
        }),
        payment({ id: 'gift', info: { purpose: 'gift' } }),
        payment({
          id: 'shop-miss',
          info: { purpose: 'shop', chargeId: 'chg_miss', lnAddress: 'shop@21.gifts' },
        }),
      ],
    });
    const rows = screen.getAllByRole('link');
    expect(rows[0]?.textContent).toContain('Shop payment');
    expect(rows[0]?.textContent).toContain('₱12.00');
    expect(rows[0]?.textContent).not.toContain('$');
    expect(rows[1]?.textContent).toContain('$21.00');
    expect(rows[1]?.textContent).not.toContain('₱');
    expect(rows[2]?.textContent).toContain('$21.00');
    expect(rows[2]?.textContent).not.toContain('₱');
  });

  it('keeps the bitcoin amount when no rate is loaded', () => {
    vi.mocked(useSpotRate).mockReturnValue(null);
    show({ payments: [payment({})] });
    expect(screen.getByRole('listitem').textContent).not.toContain('$');
  });

  it('shows a heart row with one line of post text instead of the gift title', async () => {
    const paymentHashes = ['a'.repeat(64), 'b'.repeat(64), 'c'.repeat(64)] as const;
    useAuthStore.setState({ session: 'session', account: null });
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        Response.json({
          hearts: [
            {
              paymentHash: paymentHashes[0],
              messageId: 'message-21',
              authorName: 'Ada',
              text: 'First line\nsecond line',
              deleted: true,
            },
            {
              paymentHash: paymentHashes[1],
              messageId: 'message-22',
              authorName: 'Bea',
              text: '   ',
              deleted: false,
            },
            {
              paymentHash: paymentHashes[2],
              messageId: 'message-23',
              authorName: '',
              text: '',
              deleted: false,
            },
          ],
        }),
      ),
    );
    show({
      payments: [
        payment({
          id: 'heart',
          direction: 'sent',
          method: 'spark',
          info: { purpose: 'gift', paymentHash: paymentHashes[0] },
        }),
        payment({
          id: 'heart-author',
          direction: 'sent',
          method: 'spark',
          info: { purpose: 'gift', paymentHash: paymentHashes[1] },
        }),
        payment({
          id: 'heart-empty',
          direction: 'sent',
          method: 'spark',
          info: { purpose: 'gift', paymentHash: paymentHashes[2] },
        }),
      ],
    });

    await waitFor(() => expect(screen.getByText('First line second line')).toBeTruthy());
    expect(screen.getByText('Bea')).toBeTruthy();
    const rows = screen.getAllByRole('link');
    expect(rows[0]?.getAttribute('href')).toBe('/wallet/payment?id=heart');
    expect(rows.every((row) => !row.textContent?.includes('Gift'))).toBe(true);
    const heartIcon = rows[0]?.querySelector('.lucide-heart');
    expect(heartIcon?.getAttribute('fill')).toBe('currentColor');
    expect(heartIcon?.getAttribute('class')).toContain('text-app-accent');
    expect(rows[2]?.getAttribute('aria-label')).toBeNull();
    expect(screen.queryByRole('link', { name: 'message-23' })).toBeNull();
    expect(rows[2]?.textContent).not.toContain('message-23');
  });

  it('shows Gift and no heart when a settled lookup has no post', async () => {
    const paymentHash = 'f'.repeat(64);
    useAuthStore.setState({ session: 'session', account: null });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ hearts: [] })));
    show({
      payments: [
        payment({
          id: 'miss',
          direction: 'sent',
          method: 'spark',
          info: { purpose: 'gift', paymentHash },
        }),
      ],
    });

    await waitFor(() => expect(screen.getByRole('link').textContent).toContain('Gift'));
    const row = screen.getByRole('link');
    expect(row.querySelector('.lucide-heart')).toBeNull();
    expect(row.querySelector('.lucide-arrow-up-right')).toBeTruthy();
  });

  it('keeps Gift and the direction icon when a pending payment would match a heart', () => {
    const paymentHash = 'e'.repeat(64);
    useAuthStore.setState({ session: 'session', account: null });
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({
        hearts: [
          {
            paymentHash,
            messageId: 'message-pending',
            authorName: 'Ada',
            text: 'Sunday lunch',
            deleted: false,
          },
        ],
      }),
    );
    vi.stubGlobal('fetch', fetchMock);
    show({
      payments: [
        payment({
          id: 'still-pending',
          status: 'pending',
          direction: 'sent',
          method: 'spark',
          info: { purpose: 'gift', paymentHash },
        }),
      ],
    });

    const row = screen.getByRole('link');
    expect(row.textContent).toContain('Gift');
    expect(row.textContent).not.toContain('Sunday lunch');
    expect(row.textContent).not.toContain('message-pending');
    expect(row.querySelector('.lucide-heart')).toBeNull();
    expect(row.querySelector('.lucide-arrow-up-right')).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('keeps Gift and the direction icon while a heart row is pending', () => {
    const paymentHash = 'd'.repeat(64);
    useAuthStore.setState({ session: 'session', account: null });
    vi.stubGlobal(
      'fetch',
      vi.fn(() => new Promise<Response>(() => undefined)),
    );
    show({
      payments: [
        payment({
          id: 'heart-pending',
          direction: 'sent',
          method: 'spark',
          info: { purpose: 'gift', paymentHash },
        }),
      ],
    });

    const row = screen.getByRole('link');
    expect(row.textContent).toContain('Gift');
    expect(row.textContent).not.toContain('Sunday lunch');
    expect(row.querySelector('.min-w-0.truncate.text-sm.font-medium')?.textContent).toBe('Gift');
    expect(row.querySelector('.lucide-heart')).toBeNull();
    expect(row.querySelector('.lucide-arrow-up-right')).toBeTruthy();
  });

  it('loads the next page when the end of the list comes into view', () => {
    const { unmount } = show({ payments: [payment({})], hasMore: true });
    expect(observers).toHaveLength(1);
    observers[0]?.callback([{ isIntersecting: false }]);
    expect(loadMore).not.toHaveBeenCalled();
    observers[0]?.callback([{ isIntersecting: true }]);
    expect(loadMore).toHaveBeenCalledTimes(1);
    unmount();
    expect(observers[0]?.disconnect).toHaveBeenCalled();
  });

  it('watches the end of the list again after a reload with the same number of rows', () => {
    const first = [payment({ id: 'a' })];
    const { rerender } = show({ payments: first, hasMore: true });
    expect(observers).toHaveLength(1);
    vi.mocked(useWalletHistory).mockReturnValue({
      status: 'ready',
      payments: [payment({ id: 'a' })],
      hasMore: true,
      loadMore,
      retry,
    });
    rerender(<WalletHistory />);
    expect(observers).toHaveLength(2);
    expect(observers[0]?.disconnect).toHaveBeenCalled();
    observers[1]?.callback([{ isIntersecting: true }]);
    expect(loadMore).toHaveBeenCalledTimes(1);
  });

  it('watches the new end of the list after an error and a retry', () => {
    const rows = [payment({ id: 'a' })];
    const { rerender } = show({ payments: rows, hasMore: true });
    vi.mocked(useWalletHistory).mockReturnValue({
      status: 'error',
      payments: rows,
      hasMore: true,
      loadMore,
      retry,
    });
    rerender(<WalletHistory />);
    vi.mocked(useWalletHistory).mockReturnValue({
      status: 'ready',
      payments: rows,
      hasMore: true,
      loadMore,
      retry,
    });
    rerender(<WalletHistory />);
    const last = observers[observers.length - 1];
    expect(observers.length).toBeGreaterThanOrEqual(2);
    last?.callback([{ isIntersecting: true }]);
    expect(loadMore).toHaveBeenCalledTimes(1);
  });

  it('does not observe at the end of the list or without IntersectionObserver', () => {
    show({ payments: [payment({})], hasMore: false });
    expect(observers).toHaveLength(0);
    cleanup();
    vi.unstubAllGlobals();
    const original = globalThis.IntersectionObserver;
    // @ts-expect-error -- simulate a browser without the API
    delete globalThis.IntersectionObserver;
    try {
      const { container } = show({ payments: [payment({})], hasMore: true });
      expect(container.querySelectorAll('li')).toHaveLength(2);
      expect(screen.getAllByRole('listitem')).toHaveLength(1);
    } finally {
      if (original !== undefined) {
        globalThis.IntersectionObserver = original;
      }
    }
  });
});
