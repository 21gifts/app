import { cleanup, fireEvent, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LoanBlock } from '@/components/LoanBlock';
import { renderWithLocale } from '@/__tests__/render-with-locale';
import type { RepaymentLedger, RepaymentLine } from '@/lib/api';

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

afterEach(cleanup);

function line(
  dayIndex: number,
  status: RepaymentLine['status'],
  sats: number | null,
): RepaymentLine {
  return {
    dayIndex,
    dueOn: null,
    accountId: '11111111-1111-4111-8111-111111111111',
    name: 'Bea',
    username: 'bea',
    amount: null,
    sats,
    dueSats: null,
    status,
    via: 'lightning',
  };
}

function ledgerOf(
  repayments: RepaymentLine[],
  currency: RepaymentLedger['currency'] = 'BTC',
): RepaymentLedger {
  return {
    currency,
    fundedAt: '2026-09-26T12:00:00.000Z',
    termDays: repayments.length,
    daysDue: 0,
    daysPaid: 0,
    unassignedSats: 0,
    givers: [],
    repayments,
    next: null,
  };
}

function block(props: Partial<Parameters<typeof LoanBlock>[0]> = {}): void {
  renderWithLocale(
    <LoanBlock
      messageId="m1"
      ask={<span>{"₿21'000 · $21.00"}</span>}
      collected="₿10'500 · $10.50"
      goal="₿21'000 · $21.00"
      percent={50}
      ledger={null}
      ledgerLink
      {...props}
    />,
  );
}

function section(): HTMLElement {
  return screen.getByRole('region', { name: 'Loan request' });
}

describe('LoanBlock', () => {
  it('shows the ask, the accent bar, and what is lent while it collects', () => {
    block();
    expect(section().getAttribute('data-loan-block')).toBe('collecting');
    expect(screen.getByText("₿21'000 · $21.00", { selector: 'span' })).toBeTruthy();
    expect(screen.getByRole('img', { name: 'Goal progress 50 percent' })).toBeTruthy();
    expect(screen.getByText('50%')).toBeTruthy();
    expect(document.querySelector('rect.fill-app-accent')?.getAttribute('width')).toBe('50');
    expect(screen.getByText("₿10'500 · $10.50")).toBeTruthy();
    expect(screen.getByText("of ₿21'000 · $21.00 lent")).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Repayment list' }).getAttribute('href')).toBe(
      '/messages/m1/repayment-list',
    );
    expect(screen.queryByRole('button', { name: 'Lend' })).toBeNull();
  });

  it('draws no fill at 0% or below', () => {
    block({ percent: 0 });
    expect(document.querySelector('rect.fill-app-accent')).toBeNull();
    cleanup();
    block({ percent: -5 });
    expect(document.querySelector('rect.fill-app-accent')).toBeNull();
  });

  it('offers Lend while it collects and calls it without toggling the card', () => {
    const onLend = vi.fn();
    const onCard = vi.fn();
    renderWithLocale(
      <div onClick={onCard}>
        <LoanBlock
          messageId="m1"
          ask="₿21'000"
          collected="₿0"
          goal="₿21'000"
          percent={0}
          ledger={null}
          ledgerLink={false}
          onLend={onLend}
        />
      </div>,
    );
    expect(screen.queryByRole('link', { name: 'Repayment list' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Lend' }));
    expect(onLend).toHaveBeenCalledTimes(1);
    expect(onCard).not.toHaveBeenCalled();
  });

  it('stops a Repayment list click from toggling the card', () => {
    block();
    const click = new MouseEvent('click', { bubbles: true, cancelable: true });
    const stop = vi.spyOn(click, 'stopPropagation');
    fireEvent(screen.getByRole('link', { name: 'Repayment list' }), click);
    expect(stop).toHaveBeenCalled();
  });

  it('reads Fully funded without a ledger and hides Lend', () => {
    block({ percent: 120, onLend: vi.fn(), ledgerLink: false });
    expect(section().getAttribute('data-loan-block')).toBe('funded');
    expect(screen.getByText('Fully funded')).toBeTruthy();
    expect(screen.getByText('120%')).toBeTruthy();
    expect(document.querySelector('rect.fill-app-accent')?.getAttribute('width')).toBe('100');
    expect(screen.queryByRole('button', { name: 'Lend' })).toBeNull();
    expect(screen.queryByText(/lent$/)).toBeNull();
    expect(section().querySelector('.justify-between.mt-1')).toBeNull();
  });

  it('shows the paid-back share in green while it is being repaid', () => {
    block({
      percent: 100,
      ledger: ledgerOf([line(0, 'paid', 30), line(1, 'due', 30), line(2, 'scheduled', 40)]),
    });
    expect(section().getAttribute('data-loan-block')).toBe('repaying');
    expect(screen.getByText('Fully funded · being repaid')).toBeTruthy();
    expect(screen.getByRole('img', { name: '30% paid back' })).toBeTruthy();
    expect(screen.getByText('30%')).toBeTruthy();
    expect(document.querySelector('rect.fill-app-success')?.getAttribute('width')).toBe('30');
    expect(document.querySelector('rect.fill-app-accent')).toBeNull();
  });

  it('counts a fiat ledger in cents and skips rows without an amount', () => {
    const paid = { ...line(0, 'paid', null), amount: '1.00' };
    const open = { ...line(1, 'due', null), amount: '9.00' };
    const empty = { ...line(2, 'scheduled', null), amount: null };
    const broken = { ...line(3, 'scheduled', null), amount: 'x' };
    block({ percent: 100, ledger: ledgerOf([paid, open, empty, broken], 'USD') });
    expect(screen.getByRole('img', { name: '10% paid back' })).toBeTruthy();
  });

  it('shows 0% paid back when the ledger has no amounts yet', () => {
    block({ percent: 100, ledger: ledgerOf([line(0, 'due', null)]) });
    expect(screen.getByRole('img', { name: '0% paid back' })).toBeTruthy();
    expect(document.querySelector('rect.fill-app-success')).toBeNull();
  });

  it('shows Paid back with a check once every share is paid', () => {
    block({ percent: 100, ledger: ledgerOf([line(0, 'paid', 50), line(1, 'paid', 50)]) });
    expect(section().getAttribute('data-loan-block')).toBe('repaid');
    const status = screen.getByText('Paid back');
    expect(status.className).toContain('text-app-success');
    expect(status.querySelector('svg')).toBeTruthy();
    expect(screen.getByRole('img', { name: '100% paid back' })).toBeTruthy();
  });

  it('keeps an empty ledger in the being-repaid state', () => {
    block({ percent: 100, ledger: ledgerOf([]) });
    expect(section().getAttribute('data-loan-block')).toBe('repaying');
  });

  it('stays collecting below 100% even when a ledger is passed', () => {
    block({ percent: 99, ledger: ledgerOf([line(0, 'paid', 50)]) });
    expect(section().getAttribute('data-loan-block')).toBe('collecting');
  });
});
