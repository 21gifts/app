import { cleanup, fireEvent, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { AccountActivityChart } from '@/components/AccountActivityChart';
import type { GiftStats } from '@/lib/api-types';
import { formatUsdTick } from '@/lib/stats-money';
import { renderWithLocale } from '@/__tests__/render-with-locale';

afterEach(cleanup);

type SpendPoint = GiftStats['spendOverTime'][number];

function day(day: string, cumulativeSats: number, cumulativeUsd: string, sats = 0): SpendPoint {
  return {
    day,
    sats,
    cumulativeSats,
    btc: '0.00000000',
    cumulativeBtc: '0.00000000',
    usd: '0.00',
    cumulativeUsd,
  };
}

const MULTI_DAY: SpendPoint[] = [
  day('2026-06-01', 500, '0.48', 500),
  day('2026-06-02', 500, '0.48', 0),
  day('2026-06-03', 1500, '1.43', 1000),
];

describe('AccountActivityChart', () => {
  it('renders empty copy instead of an axis when there is no data', () => {
    renderWithLocale(<AccountActivityChart received={[]} />);
    expect(screen.getByRole('status').textContent).toBe('No gifts yet.');
    expect(screen.queryByRole('img', { name: 'Given and received in ₿' })).toBeNull();
    expect(screen.queryByRole('group', { name: 'Given and received' })).toBeNull();
  });

  it('draws the received polyline and keeps ₿ pressed with grouped ticks', () => {
    const { container } = renderWithLocale(<AccountActivityChart received={MULTI_DAY} />);
    const polylines = [...container.querySelectorAll('polyline')];
    expect(
      polylines.some((line) => line.getAttribute('stroke') === 'var(--color-app-chart-received)'),
    ).toBe(true);
    expect(screen.getByText('Given')).toBeTruthy();
    expect(screen.getByRole('button', { name: '₿' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByText('₿1,500')).toBeTruthy();
    expect(screen.getByText('2026-06-01')).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Given and received' })).toBeNull();
  });

  it('switches aria and USD ticks when USD is pressed', () => {
    renderWithLocale(<AccountActivityChart received={MULTI_DAY} />);
    fireEvent.click(screen.getByRole('button', { name: 'USD' }));
    expect(screen.getByRole('img', { name: 'Given and received in USD' })).toBeTruthy();
    expect(screen.getByText(formatUsdTick(1.43))).toBeTruthy();
    expect(screen.getByRole('button', { name: 'USD' }).getAttribute('aria-pressed')).toBe('true');
  });

  it('draws two polylines when donated is non-empty', () => {
    const donated = [day('2026-06-01', 100, '0.10', 100), day('2026-06-03', 200, '0.20', 100)];
    const { container } = renderWithLocale(
      <AccountActivityChart received={MULTI_DAY} donated={donated} />,
    );
    const polylines = [...container.querySelectorAll('polyline')];
    expect(
      polylines.some((line) => line.getAttribute('stroke') === 'var(--color-app-chart-received)'),
    ).toBe(true);
    expect(
      polylines.some((line) => line.getAttribute('stroke') === 'var(--color-app-chart-given)'),
    ).toBe(true);
  });

  it('renders a single-day series', () => {
    const { container } = renderWithLocale(
      <AccountActivityChart received={[day('2026-06-01', 21, '0.02', 21)]} />,
    );
    expect(container.querySelectorAll('polyline').length).toBeGreaterThan(0);
    expect(screen.getByText('2026-06-01')).toBeTruthy();
  });

  it('skips duplicate USD y-tick labels when max is 0.01', () => {
    renderWithLocale(<AccountActivityChart received={[day('2026-06-01', 1000, '0.01', 1000)]} />);
    fireEvent.click(screen.getByRole('button', { name: 'USD' }));
    expect(formatUsdTick(0.005)).toBe(formatUsdTick(0.01));
    expect(screen.getAllByText(formatUsdTick(0.01))).toHaveLength(1);
    expect(screen.getByText(formatUsdTick(0))).toBeTruthy();
  });

  it('switches back to ₿ aria when ₿ is pressed after USD', () => {
    renderWithLocale(<AccountActivityChart received={MULTI_DAY} />);
    fireEvent.click(screen.getByRole('button', { name: 'USD' }));
    fireEvent.click(screen.getByRole('button', { name: '₿' }));
    expect(screen.getByRole('img', { name: 'Given and received in ₿' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '₿' }).getAttribute('aria-pressed')).toBe('true');
  });
});
