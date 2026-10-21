import { cleanup, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { PosHistory } from '@/components/PosHistory';
import { formatForumTime } from '@/lib/forum-time';
import type { PosCharge } from '@/lib/pos';
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

function clock(iso: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { timeStyle: 'short' }).format(new Date(iso));
}

afterEach(() => {
  cleanup();
});

describe('PosHistory', () => {
  it('says there are no payments yet when the history is empty', () => {
    renderWithLocale(<PosHistory history={[]} openChargeId={null} />);
    const history = screen.getByRole('region', { name: 'History' });
    expect(within(history).getByRole('heading', { name: 'History' })).toBeTruthy();
    expect(within(history).getByText('No payments yet.')).toBeTruthy();
    expect(within(history).queryByRole('list')).toBeNull();
  });

  it('leaves out the open charge, so an open charge alone is an empty history', () => {
    const open = row({ id: 'open', status: 'pending' });
    renderWithLocale(<PosHistory history={[open]} openChargeId="open" />);
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
    renderWithLocale(<PosHistory history={history} openChargeId={null} />);
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
      <PosHistory history={[row({ id: 'stale', status: 'pending' })]} openChargeId="other" />,
    );
    expect(screen.getByText('Expired')).toBeTruthy();
  });

  it('says Paid ✓ without a time when the paid time is missing or not a valid instant', () => {
    renderWithLocale(
      <PosHistory
        history={[row({ id: 'a' }), row({ id: 'b', paidAt: 'not a time' })]}
        openChargeId={null}
      />,
    );
    expect(screen.getAllByText('Paid ✓')).toHaveLength(2);
  });

  it('shows the visitor snapshot when the charge has no typed pair', () => {
    renderWithLocale(
      <PosHistory
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
    renderWithLocale(<PosHistory history={[row({ id: 'a' })]} openChargeId={null} />);
    const item = screen.getByRole('listitem');
    expect(within(item).getByText('₿21')).toBeTruthy();
    expect(item.textContent).not.toContain('$');
  });

  it('uses the German catalog and the member fiat', () => {
    const paidAt = '2026-09-20T12:00:40.000Z';
    renderWithLocale(
      <PosHistory
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
    renderWithLocale(<PosHistory history={[]} openChargeId={null} />, 'de');
    expect(screen.getByText('Noch keine Zahlungen.')).toBeTruthy();
  });
});
