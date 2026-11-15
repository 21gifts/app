import { cleanup, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PosHistory } from '@/components/PosHistory';
import { useSpotRate } from '@/hooks/useSpotRate';
import { formatForumTime } from '@/lib/forum-time';
import type { PosCharge, PosReceived } from '@/lib/pos';
import type { FiatRateDay } from '@/lib/stats-money';
import { DEFAULT_NUMBER_FORMAT } from '@/lib/number-format';
import { formatBitcoin } from '@/lib/stats-money';
import { renderWithLocale } from '@/__tests__/render-with-locale';

function row(overrides: Partial<PosCharge> & Pick<PosCharge, 'id'>): PosCharge {
  return {
    amountSats: 21,
    status: 'paid',
    createdAt: '2026-09-20T12:00:00.000Z',
    expiresAt: '2026-09-20T12:05:00.000Z',
    paidAt: null,
    amountCurrency: null,
    amount: null,
    amountUsd: null,
    amountChf: null,
    amountEur: null,
    amountPhp: null,
    ...overrides,
  };
}

vi.mock('@/hooks/useSpotRate', () => ({ useSpotRate: vi.fn() }));

const RATE_DAY: FiatRateDay = {
  sats: 100_000_000,
  usd: '100000.00',
  chf: '80000.00',
  eur: '90000.00',
  php: '5600000.00',
};

function received(overrides: Partial<PosReceived> & Pick<PosReceived, 'id'>): PosReceived {
  return {
    amountSats: 2_100,
    receivedAt: '2026-09-20T12:03:10.000Z',
    kind: 'lightning',
    ...overrides,
  };
}

beforeEach(() => {
  vi.mocked(useSpotRate).mockReset().mockReturnValue(null);
});

function clock(iso: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { timeStyle: 'short' }).format(new Date(iso));
}

afterEach(() => {
  cleanup();
});

describe('PosHistory', () => {
  it('says there are no payments yet when the history is empty', () => {
    renderWithLocale(<PosHistory received={[]} history={[]} openChargeId={null} />);
    const history = screen.getByRole('region', { name: 'History' });
    expect(within(history).getByRole('heading', { name: 'History' })).toBeTruthy();
    expect(within(history).getByText('No payments yet.')).toBeTruthy();
    expect(within(history).queryByRole('list')).toBeNull();
  });

  it('leaves out the open charge, so an open charge alone is an empty history', () => {
    const open = row({ id: 'open', status: 'pending' });
    renderWithLocale(<PosHistory received={[]} history={[open]} openChargeId="open" />);
    expect(screen.getByText('No payments yet.')).toBeTruthy();
    expect(screen.queryByText('₿21')).toBeNull();
  });

  it('lists paid, expired, and cancelled rows newest first with fiat and creation time', () => {
    const paidAt = '2026-09-20T12:00:40.000Z';
    const history = [
      row({
        id: 'p',
        amountSats: 2_100,
        paidAt,
        amountCurrency: 'PHP',
        amount: '12.00',
        amountUsd: '1.00',
      }),
      row({ id: 'e', amountSats: 500, status: 'expired', createdAt: '2026-09-19T08:30:00.000Z' }),
      row({
        id: 'c',
        amountSats: 42,
        status: 'cancelled',
        createdAt: '2026-09-18T17:45:00.000Z',
        amountCurrency: 'USD',
        amount: '0.04',
      }),
    ];
    renderWithLocale(<PosHistory received={[]} history={history} openChargeId={null} />);
    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(3);
    const [paid, expired, cancelled] = items as [HTMLElement, HTMLElement, HTMLElement];

    const paidLabel = within(paid).getByText(`Paid ✓ ${clock(paidAt, 'en')}`);
    expect(paidLabel.className).toContain('text-app-success');
    expect(within(paid).getByText(formatBitcoin(2_100, DEFAULT_NUMBER_FORMAT))).toBeTruthy();
    expect(within(paid).getByText('₱12.00')).toBeTruthy();
    expect(within(paid).queryByText('$1.00')).toBeNull();
    const paidTime = paid.querySelector('time');
    expect(paidTime?.getAttribute('dateTime')).toBe('2026-09-20T12:00:00.000Z');
    expect(paidTime?.textContent).toBe(formatForumTime('2026-09-20T12:00:00.000Z', 'en'));

    const expiredLabel = within(expired).getByText('Expired');
    expect(expiredLabel.className).toContain('text-app-subtle');
    expect(within(expired).getByText('₿500')).toBeTruthy();
    expect(expired.textContent).not.toContain('$');
    expect(expired.querySelector('time')?.textContent).toBe(
      formatForumTime('2026-09-19T08:30:00.000Z', 'en'),
    );

    expect(within(cancelled).getByText('Cancelled').className).toContain('text-app-subtle');
    expect(within(cancelled).getByText('₿42')).toBeTruthy();
    expect(within(cancelled).getByText('$0.04')).toBeTruthy();
    expect(screen.queryByText('No payments yet.')).toBeNull();
  });

  it('shows a pending row that is not the open charge as expired', () => {
    renderWithLocale(
      <PosHistory
        received={[]}
        history={[row({ id: 'stale', status: 'pending' })]}
        openChargeId="other"
      />,
    );
    expect(screen.getByText('Expired')).toBeTruthy();
  });

  it('says Paid ✓ without a time when the paid time is missing or not a valid instant', () => {
    renderWithLocale(
      <PosHistory
        received={[]}
        history={[row({ id: 'a' }), row({ id: 'b', paidAt: 'not a time' })]}
        openChargeId={null}
      />,
    );
    expect(screen.getAllByText('Paid ✓')).toHaveLength(2);
  });

  it('shows an empty stored PHP amount as ₱0.00', () => {
    renderWithLocale(
      <PosHistory
        received={[]}
        history={[row({ id: 'empty', amountCurrency: 'PHP', amount: '', amountUsd: '1.00' })]}
        openChargeId={null}
      />,
      'en',
      'ch',
      'USD',
    );
    const item = screen.getByRole('listitem');
    expect(within(item).getByText('₱0.00')).toBeTruthy();
    expect(within(item).queryByText('$1.00')).toBeNull();
    expect(item.textContent).not.toContain('$');
  });

  it('shows the visitor snapshot when the charge has no typed pair', () => {
    renderWithLocale(
      <PosHistory
        received={[]}
        history={[row({ id: 's', amountSats: 21_000, amountUsd: '5.00' })]}
        openChargeId={null}
      />,
      'en',
      'ch',
      'USD',
    );
    const item = screen.getByRole('listitem');
    expect(within(item).getByText("₿21'000")).toBeTruthy();
    expect(within(item).getByText('$5.00')).toBeTruthy();
  });

  it('shows bitcoin and no fiat when the charge stored none', () => {
    renderWithLocale(<PosHistory received={[]} history={[row({ id: 'a' })]} openChargeId={null} />);
    const item = screen.getByRole('listitem');
    expect(within(item).getByText('₿21')).toBeTruthy();
    expect(item.textContent).not.toContain('$');
  });

  it('uses the German catalog and the member fiat', () => {
    const paidAt = '2026-09-20T12:00:40.000Z';
    renderWithLocale(
      <PosHistory
        received={[]}
        history={[
          row({
            id: 'p',
            amountSats: 2_100,
            paidAt,
            amountCurrency: 'PHP',
            amount: '12.00',
          }),
          row({ id: 'e', status: 'expired' }),
          row({ id: 'c', status: 'cancelled' }),
        ]}
        openChargeId={null}
      />,
      'de',
    );
    const history = screen.getByRole('region', { name: 'Verlauf' });
    expect(within(history).getByText(`Bezahlt ✓ ${clock(paidAt, 'de')}`)).toBeTruthy();
    expect(within(history).getByText('Abgelaufen')).toBeTruthy();
    expect(within(history).getByText('Abgebrochen')).toBeTruthy();
    expect(within(history).getByText('₱12.00')).toBeTruthy();
    expect(within(history).queryByText(/CHF/)).toBeNull();
  });

  it('shows the German empty sentence', () => {
    renderWithLocale(<PosHistory received={[]} history={[]} openChargeId={null} />, 'de');
    expect(screen.getByText('Noch keine Zahlungen.')).toBeTruthy();
  });

  it('lists received payments among the charges by time, each marked Received with its kind', () => {
    vi.mocked(useSpotRate).mockReturnValue(RATE_DAY);
    renderWithLocale(
      <PosHistory
        history={[
          row({ id: 'p', amountSats: 21_000, createdAt: '2026-09-20T12:00:00.000Z' }),
          row({ id: 'e', status: 'expired', createdAt: '2026-09-19T08:30:00.000Z' }),
        ]}
        received={[
          received({ id: 'r1', amountSats: 2_100, receivedAt: '2026-09-20T12:03:10.000Z' }),
          received({
            id: 'r2',
            amountSats: 500,
            receivedAt: '2026-09-19T09:00:00.000Z',
            kind: 'spark',
          }),
          received({ id: 'r3', amountSats: 42, receivedAt: '2026-09-18T07:00:00.000Z' }),
        ]}
        openChargeId={null}
      />,
      'en',
      'ch',
      'USD',
    );
    const items = screen.getAllByRole('listitem');
    expect(items.map((item) => item.textContent)).toEqual([
      expect.stringContaining("₿2'100"),
      expect.stringContaining("₿21'000"),
      expect.stringContaining('₿500'),
      expect.stringContaining('Expired'),
      expect.stringContaining('₿42'),
    ]);
    const [first, , spark] = items as [HTMLElement, HTMLElement, HTMLElement];
    const label = within(first).getByText('Received');
    expect(label.className).toContain('text-app-success');
    expect(label.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
    // No figure is stored with a received payment: the current spot stands beside the bitcoin.
    expect(within(first).getByText('$2.10')).toBeTruthy();
    expect(within(first).getByText('Instant payment')).toBeTruthy();
    const time = first.querySelector('time');
    expect(time?.getAttribute('dateTime')).toBe('2026-09-20T12:03:10.000Z');
    expect(time?.textContent).toBe(formatForumTime('2026-09-20T12:03:10.000Z', 'en'));
    expect(within(spark).getByText('Wallet transfer')).toBeTruthy();
    expect(within(spark).getByText('$0.50')).toBeTruthy();
    expect(screen.queryByText('No payments yet.')).toBeNull();
  });

  it('shows received payments without a charge, and bitcoin alone while no spot is loaded', () => {
    renderWithLocale(
      <PosHistory history={[]} received={[received({ id: 'r' })]} openChargeId={null} />,
    );
    const item = screen.getByRole('listitem');
    expect(within(item).getByText('Received')).toBeTruthy();
    expect(item.textContent).not.toContain('$');
    expect(screen.queryByText('No payments yet.')).toBeNull();
  });

  it('keeps a received payment and an open charge apart: only the payment is listed', () => {
    renderWithLocale(
      <PosHistory
        history={[row({ id: 'open', status: 'pending' })]}
        received={[received({ id: 'r', receivedAt: '2026-09-19T12:00:00.000Z' })]}
        openChargeId="open"
      />,
    );
    expect(screen.getAllByRole('listitem')).toHaveLength(1);
    expect(screen.getByText('Received')).toBeTruthy();
  });

  it('eases in only a payment that arrives after the list first showed', () => {
    const first = received({ id: 'old', receivedAt: '2026-09-20T11:00:00.000Z' });
    const view = renderWithLocale(
      <PosHistory history={[]} received={[first]} openChargeId={null} />,
    );
    expect(screen.getByRole('listitem').className).not.toContain('animate-fade-in');
    view.rerender(
      <PosHistory
        history={[]}
        received={[received({ id: 'new', amountSats: 777 }), first]}
        openChargeId={null}
      />,
    );
    const [arrived, kept] = screen.getAllByRole('listitem') as [HTMLElement, HTMLElement];
    expect(arrived.textContent).toContain('₿777');
    expect(arrived.className).toContain('animate-fade-in');
    expect(kept.className).not.toContain('animate-fade-in');
  });

  it('uses the German catalog for a received payment', () => {
    renderWithLocale(
      <PosHistory
        history={[]}
        received={[received({ id: 'l' }), received({ id: 's', kind: 'spark' })]}
        openChargeId={null}
      />,
      'de',
    );
    expect(screen.getAllByText('Erhalten')).toHaveLength(2);
    expect(screen.getByText('Sofortzahlung')).toBeTruthy();
    expect(screen.getByText('Wallet-Überweisung')).toBeTruthy();
  });

  it('orders by time also when the till puts an older remembered charge first', () => {
    renderWithLocale(
      <PosHistory
        history={[
          // A lost create the till remembers is listed first, though it is older than the api rows.
          row({ id: 'remembered', amountSats: 7, createdAt: '2026-09-18T09:00:00.000Z' }),
          row({ id: 'new', amountSats: 21_000, createdAt: '2026-09-20T12:00:00.000Z' }),
          row({
            id: 'old',
            amountSats: 500,
            status: 'expired',
            createdAt: '2026-09-19T08:30:00.000Z',
          }),
        ]}
        received={[
          received({ id: 'r1', amountSats: 1_000, receivedAt: '2026-09-20T12:06:00.000Z' }),
          received({ id: 'r2', amountSats: 250, receivedAt: '2026-09-19T10:15:00.000Z' }),
        ]}
        openChargeId={null}
      />,
    );
    const amounts = screen
      .getAllByRole('listitem')
      .map((item) => item.querySelector('span.tabular-nums > span')?.textContent);
    expect(amounts).toEqual(["₿1'000", "₿21'000", '₿250', '₿500', '₿7']);
  });

  it('keeps the till order of the charges while no payment was received', () => {
    renderWithLocale(
      <PosHistory
        history={[
          row({ id: 'remembered', amountSats: 7, createdAt: '2026-09-18T09:00:00.000Z' }),
          row({ id: 'new', amountSats: 21_000, createdAt: '2026-09-20T12:00:00.000Z' }),
        ]}
        received={[]}
        openChargeId={null}
      />,
    );
    const amounts = screen
      .getAllByRole('listitem')
      .map((item) => item.querySelector('span.tabular-nums > span')?.textContent);
    expect(amounts).toEqual(['₿7', "₿21'000"]);
  });

  it('puts a charge before a payment of the same instant, and a charge with no readable time last', () => {
    const at = '2026-09-20T12:00:00.000Z';
    renderWithLocale(
      <PosHistory
        history={[
          row({ id: 'broken', amountSats: 3, createdAt: 'not a time' }),
          row({ id: 'same', amountSats: 21, createdAt: at }),
        ]}
        received={[
          received({ id: 'a', amountSats: 100, receivedAt: at }),
          received({ id: 'b', amountSats: 200, receivedAt: at }),
          received({ id: 'later', amountSats: 300, receivedAt: '2026-09-20T13:00:00.000Z' }),
        ]}
        openChargeId={null}
      />,
    );
    const amounts = screen
      .getAllByRole('listitem')
      .map((item) => item.querySelector('span.tabular-nums > span')?.textContent);
    expect(amounts).toEqual(['₿300', '₿21', '₿100', '₿200', '₿3']);
  });
});
