import { cleanup, fireEvent, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LoanBalanceChart } from '@/components/LoanBalanceChart';
import type { AccountActivity } from '@/lib/api-types';
import { formatBitcoin, formatFiatTick } from '@/lib/stats-money';
import { useAuthStore } from '@/stores/auth-store';
import { renderWithLocale } from '@/__tests__/render-with-locale';

let hydrateReady = true;

vi.mock('@/hooks/useHydrateSession', () => ({
  useHydrateSession: (): { ready: boolean } => ({ ready: hydrateReady }),
}));

beforeEach(() => {
  hydrateReady = true;
  useAuthStore.setState({ session: null, account: null });
});

afterEach(() => {
  cleanup();
  useAuthStore.setState({ session: null, account: null });
});

type LoanPoint = NonNullable<AccountActivity['owedOverTime']>[number];

function loanDay(day: string, cumulativeSats: number, cumulativeUsd: string, sats = 0): LoanPoint {
  const absBtc = Math.abs(cumulativeSats) / 1e8;
  const btcSign = cumulativeSats < 0 ? '-' : '';
  const cumulativeBtc = `${btcSign}${absBtc.toFixed(8)}`;
  return {
    day,
    sats,
    cumulativeSats,
    btc: cumulativeBtc,
    cumulativeBtc,
    usd: cumulativeUsd,
    cumulativeUsd,
    chf: cumulativeUsd,
    eur: cumulativeUsd,
    php: cumulativeUsd,
    cumulativeChf: cumulativeUsd,
    cumulativeEur: cumulativeUsd,
    cumulativePhp: cumulativeUsd,
  };
}

function clickChartScale(name: string): void {
  fireEvent.click(
    within(screen.getByRole('group', { name: 'Chart scale' })).getByRole('button', { name }),
  );
}

describe('LoanBalanceChart', () => {
  it('renders empty copy with FiatPicker when unsigned and ready', () => {
    renderWithLocale(<LoanBalanceChart />);
    expect(screen.getByRole('status').textContent).toBe('No loans yet.');
    expect(screen.getByRole('group', { name: 'Fiat currency' })).toBeTruthy();
    expect(screen.queryByRole('img', { name: 'Debt and credit in ₿' })).toBeNull();
    expect(screen.queryByRole('group', { name: 'Chart scale' })).toBeNull();
  });

  it('hides the fiat switcher when a session is set and still shows empty copy', () => {
    useAuthStore.setState({ session: 'tok', account: null });
    renderWithLocale(<LoanBalanceChart />);
    expect(screen.queryByRole('group', { name: 'Fiat currency' })).toBeNull();
    expect(screen.getByRole('status').textContent).toBe('No loans yet.');
  });

  it('hides the fiat switcher while hydration is not ready and still shows empty copy', () => {
    hydrateReady = false;
    renderWithLocale(<LoanBalanceChart />);
    expect(screen.queryByRole('group', { name: 'Fiat currency' })).toBeNull();
    expect(screen.getByRole('status').textContent).toBe('No loans yet.');
  });

  it('renders chart error copy when failed and the series is empty', () => {
    renderWithLocale(<LoanBalanceChart failed={true} />);
    expect(screen.getByRole('alert').textContent).toBe('Could not load loans.');
    expect(screen.queryByText('No loans yet.')).toBeNull();
    expect(screen.getByRole('group', { name: 'Fiat currency' })).toBeTruthy();
  });

  it('draws the chart when failed and cumulative sats are non-zero', () => {
    renderWithLocale(
      <LoanBalanceChart owed={[loanDay('2026-06-01', 100, '0.10', 100)]} failed={true} />,
    );
    expect(screen.getByRole('img', { name: 'Debt and credit in ₿' })).toBeTruthy();
    expect(screen.queryByText('Could not load loans.')).toBeNull();
  });

  it('places a decline circle lower than the prior rise', () => {
    const { container } = renderWithLocale(
      <LoanBalanceChart
        owed={[loanDay('2026-06-01', 100, '0.10', 100), loanDay('2026-06-02', 40, '0.04', -60)]}
      />,
    );
    const owedCircles = [...container.querySelectorAll('circle')].filter(
      (c) => c.getAttribute('fill') === 'var(--color-app-chart-given)',
    );
    expect(owedCircles).toHaveLength(2);
    const cy1 = Number(owedCircles[0]!.getAttribute('cy'));
    const cy2 = Number(owedCircles[1]!.getAttribute('cy'));
    expect(cy2).toBeGreaterThan(cy1);
  });

  it('places a negative balance below the zero gridline', () => {
    const { container } = renderWithLocale(
      <LoanBalanceChart owed={[loanDay('2026-06-01', -60, '-0.06', -60)]} />,
    );
    const zeroLabel = formatBitcoin(0);
    const zeroText = [...container.querySelectorAll('text')].find(
      (el) => el.textContent === zeroLabel,
    );
    expect(zeroText).toBeTruthy();
    const zeroLine = zeroText!.previousElementSibling as SVGLineElement;
    const zeroY = Number(zeroLine.getAttribute('y1'));
    const circles = [...container.querySelectorAll('circle')];
    expect(circles).toHaveLength(1);
    expect(Number(circles[0]!.getAttribute('cy'))).toBeGreaterThan(zeroY);
  });

  it('omits a step-hold circle and marks each series change', () => {
    const { container } = renderWithLocale(
      <LoanBalanceChart
        owed={[loanDay('2026-06-01', 100, '0.10', 100)]}
        credit={[loanDay('2026-06-02', 50, '0.05', 50)]}
      />,
    );
    const owedCircles = [...container.querySelectorAll('circle')].filter(
      (c) => c.getAttribute('fill') === 'var(--color-app-chart-given)',
    );
    const creditCircles = [...container.querySelectorAll('circle')].filter(
      (c) => c.getAttribute('fill') === 'var(--color-app-chart-received)',
    );
    expect(owedCircles).toHaveLength(1);
    expect(creditCircles).toHaveLength(1);
  });

  it('draws the chart when a series falls from 100 to 0', () => {
    renderWithLocale(
      <LoanBalanceChart
        owed={[loanDay('2026-06-01', 100, '0.10', 100), loanDay('2026-06-02', 0, '0.00', -100)]}
      />,
    );
    expect(screen.getByRole('img', { name: 'Debt and credit in ₿' })).toBeTruthy();
    expect(screen.queryByText('No loans yet.')).toBeNull();
  });

  it('ticks minY and 0 when all values are negative', () => {
    const { container } = renderWithLocale(
      <LoanBalanceChart owed={[loanDay('2026-06-01', -60, '-0.06', -60)]} />,
    );
    expect(screen.getAllByText(formatBitcoin(0))).toHaveLength(1);
    expect(screen.getByText(formatBitcoin(-60))).toBeTruthy();
    const zeroLabel = formatBitcoin(0);
    const zeroText = [...container.querySelectorAll('text')].find(
      (el) => el.textContent === zeroLabel,
    );
    const zeroY = Number((zeroText!.previousElementSibling as SVGLineElement).getAttribute('y1'));
    const cy = Number(container.querySelector('circle')!.getAttribute('cy'));
    expect(cy).toBeGreaterThan(zeroY);
  });

  it('uses start, middle, and end x-anchors on a three-day non-negative series', () => {
    const { container } = renderWithLocale(
      <LoanBalanceChart
        owed={[
          loanDay('2026-06-01', 100, '0.10', 100),
          loanDay('2026-06-02', 200, '0.20', 100),
          loanDay('2026-06-03', 300, '0.30', 100),
        ]}
      />,
    );
    const dayTexts = [...container.querySelectorAll('text')].filter((el) =>
      /^2026-06-0[123]$/.test(el.textContent ?? ''),
    );
    expect(dayTexts.map((el) => el.getAttribute('text-anchor'))).toEqual([
      'start',
      'middle',
      'end',
    ]);
    expect(screen.getByText(formatBitcoin(0))).toBeTruthy();
    expect(screen.getByText(formatBitcoin(300))).toBeTruthy();
    expect(screen.getByText(formatBitcoin(150))).toBeTruthy();
  });

  it('draws a horizontal line and one circle for a single non-zero day', () => {
    const { container } = renderWithLocale(
      <LoanBalanceChart owed={[loanDay('2026-06-01', 21, '0.02', 21)]} />,
    );
    const owedLine = [...container.querySelectorAll('polyline')].find(
      (line) => line.getAttribute('stroke') === 'var(--color-app-chart-given)',
    );
    expect(owedLine).toBeTruthy();
    const coords = owedLine!.getAttribute('points')!.split(' ');
    expect(coords).toHaveLength(2);
    const y0 = coords[0]!.split(',')[1];
    const y1 = coords[1]!.split(',')[1];
    expect(y0).toBe(y1);
    const owedCircles = [...container.querySelectorAll('circle')].filter(
      (c) => c.getAttribute('fill') === 'var(--color-app-chart-given)',
    );
    expect(owedCircles).toHaveLength(1);
  });

  it('uses start and end x-anchors on a two-day series', () => {
    const { container } = renderWithLocale(
      <LoanBalanceChart
        owed={[loanDay('2026-06-01', 100, '0.10', 100), loanDay('2026-06-02', 200, '0.20', 100)]}
      />,
    );
    const dayTexts = [...container.querySelectorAll('text')].filter((el) =>
      /^2026-06-0[12]$/.test(el.textContent ?? ''),
    );
    expect(dayTexts.map((el) => el.getAttribute('text-anchor'))).toEqual(['start', 'end']);
  });

  it('switches aria to USD when USD is pressed', () => {
    renderWithLocale(<LoanBalanceChart owed={[loanDay('2026-06-01', 100, '0.10', 100)]} />);
    clickChartScale('USD');
    expect(screen.getByRole('img', { name: 'Debt and credit in USD' })).toBeTruthy();
  });

  it('shows CHF ticks when preferred fiat is CHF then Chart scale CHF', () => {
    renderWithLocale(
      <LoanBalanceChart owed={[loanDay('2026-06-01', 100, '1.20', 100)]} />,
      'en',
      'ch',
      'CHF',
    );
    clickChartScale('CHF');
    expect(screen.getByRole('img', { name: 'Debt and credit in CHF' })).toBeTruthy();
    expect(screen.getByText(formatFiatTick(1.2, 'CHF'))).toBeTruthy();
  });

  it('skips a duplicate y-tick when mid rounds to the same label as max', () => {
    renderWithLocale(<LoanBalanceChart owed={[loanDay('2026-06-01', 1, '0.01', 1)]} />);
    expect(formatBitcoin(0.5)).toBe(formatBitcoin(1));
    expect(screen.getAllByText(formatBitcoin(1))).toHaveLength(1);
    expect(screen.getByText(formatBitcoin(0))).toBeTruthy();
  });

  it('ticks only 0 on fiat when cumulatives are zero but sats are not', () => {
    renderWithLocale(<LoanBalanceChart owed={[loanDay('2026-06-01', 100, '0.00', 100)]} />);
    clickChartScale('USD');
    expect(screen.getByRole('img', { name: 'Debt and credit in USD' })).toBeTruthy();
    expect(screen.getAllByText('$0')).toHaveLength(1);
  });

  it('ticks minY, 0, and maxY when series cross below and above zero', () => {
    renderWithLocale(
      <LoanBalanceChart
        owed={[loanDay('2026-06-01', -60, '-0.06', -60)]}
        credit={[loanDay('2026-06-01', 40, '0.04', 40)]}
      />,
    );
    expect(screen.getByText(formatBitcoin(-60))).toBeTruthy();
    expect(screen.getByText(formatBitcoin(0))).toBeTruthy();
    expect(screen.getByText(formatBitcoin(40))).toBeTruthy();
  });

  it('draws the chart when there is credit and no debt', () => {
    renderWithLocale(<LoanBalanceChart credit={[loanDay('2026-06-01', 100, '0.10', 100)]} />);
    expect(screen.getByRole('img', { name: 'Debt and credit in ₿' })).toBeTruthy();
    expect(screen.queryByText('No loans yet.')).toBeNull();
  });
});
