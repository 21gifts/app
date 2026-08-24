import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { StatsDashboard } from '@/components/StatsDashboard';
import type { GiftStats } from '@/lib/api-types';

afterEach(cleanup);

const FX: GiftStats['fx'] = {
  quote: 'BTC-USD',
  dayBasis: 'utc',
  source: 'coinbase-exchange-daily-close',
};

const SAMPLE: GiftStats = {
  totalSats: 1_500_000,
  totalBtc: '0.01500000',
  totalUsd: '1425.00',
  giftCount: 3,
  recipientCount: 2,
  firstPaidAt: '2026-06-01T00:00:00.000Z',
  lastPaidAt: '2026-06-03T00:00:00.000Z',
  spendOverTime: [
    {
      day: '2026-06-01',
      sats: 500_000,
      cumulativeSats: 500_000,
      btc: '0.00500000',
      cumulativeBtc: '0.00500000',
      usd: '475.00',
      cumulativeUsd: '475.00',
    },
    {
      day: '2026-06-02',
      sats: 0,
      cumulativeSats: 500_000,
      btc: '0.00000000',
      cumulativeBtc: '0.00500000',
      usd: '0.00',
      cumulativeUsd: '475.00',
    },
    {
      day: '2026-06-03',
      sats: 1_000_000,
      cumulativeSats: 1_500_000,
      btc: '0.01000000',
      cumulativeBtc: '0.01500000',
      usd: '950.00',
      cumulativeUsd: '1425.00',
    },
  ],
  byRecipient: [
    { recipient: 'alice', giftCount: 2, sats: 1_000_000, btc: '0.01000000', usd: '950.00' },
    { recipient: 'bob', giftCount: 1, sats: 500_000, btc: '0.00500000', usd: '475.00' },
  ],
  byMonth: [{ month: '2026-06', giftCount: 3, sats: 1_500_000, btc: '0.01500000', usd: '1425.00' }],
  fx: FX,
};

const EMPTY: GiftStats = {
  totalSats: 0,
  totalBtc: '0.00000000',
  totalUsd: '0.00',
  giftCount: 0,
  recipientCount: 0,
  firstPaidAt: null,
  lastPaidAt: null,
  spendOverTime: [],
  byRecipient: [],
  byMonth: [],
  fx: FX,
};

describe('StatsDashboard', () => {
  it('shows loading copy', () => {
    render(<StatsDashboard stats={null} error={null} loading={true} onRetry={() => undefined} />);
    expect(screen.getByText('Loading…')).toBeTruthy();
  });

  it('shows a fallback loading line when nothing is loaded', () => {
    render(<StatsDashboard stats={null} error={null} loading={false} onRetry={() => undefined} />);
    expect(screen.getByText('Loading…')).toBeTruthy();
  });

  it('shows an error and retries', () => {
    const onRetry = vi.fn();
    render(
      <StatsDashboard
        stats={null}
        error="Could not load gift stats. Please try again."
        loading={false}
        onRetry={onRetry}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('shows the empty copy', () => {
    render(<StatsDashboard stats={EMPTY} error={null} loading={false} onRetry={() => undefined} />);
    expect(screen.getByText('No gifts recorded yet.')).toBeTruthy();
    expect(screen.getByText('₿ 0.00000000')).toBeTruthy();
    expect(screen.getByText('$0.00')).toBeTruthy();
    expect(screen.getByText('0 sats')).toBeTruthy();
    expect(screen.getByText('— – —')).toBeTruthy();
  });

  it('does not crash when giftCount is set but series are empty', () => {
    const odd: GiftStats = {
      ...EMPTY,
      giftCount: 1,
      totalSats: 10,
      totalBtc: '0.00000010',
      totalUsd: '0.01',
      recipientCount: 1,
      firstPaidAt: '2026-06-01T00:00:00.000Z',
      lastPaidAt: '2026-06-01T00:00:00.000Z',
    };
    render(<StatsDashboard stats={odd} error={null} loading={false} onRetry={() => undefined} />);
    expect(screen.getByRole('heading', { name: 'Total spend over time' })).toBeTruthy();
    expect(screen.getByLabelText('BTC over time')).toBeTruthy();
    expect(screen.getByLabelText('USD over time')).toBeTruthy();
    expect(screen.getByLabelText('Spend by person')).toBeTruthy();
    expect(screen.getByLabelText('Spend by month')).toBeTruthy();
  });

  it('labels two-day series without duplicate ticks', () => {
    const two: GiftStats = {
      ...SAMPLE,
      spendOverTime: [
        {
          day: '2026-06-01',
          sats: 10,
          cumulativeSats: 10,
          btc: '0.00000010',
          cumulativeBtc: '0.00000010',
          usd: '0.01',
          cumulativeUsd: '0.01',
        },
        {
          day: '2026-06-02',
          sats: 20,
          cumulativeSats: 30,
          btc: '0.00000020',
          cumulativeBtc: '0.00000030',
          usd: '0.02',
          cumulativeUsd: '0.03',
        },
      ],
    };
    render(<StatsDashboard stats={two} error={null} loading={false} onRetry={() => undefined} />);
    expect(screen.getAllByText('2026-06-01')).toHaveLength(2);
    expect(screen.getAllByText('2026-06-02')).toHaveLength(2);
  });

  it('renders KPIs, footnote, BTC/USD charts, and person labels', () => {
    render(
      <StatsDashboard stats={SAMPLE} error={null} loading={false} onRetry={() => undefined} />,
    );
    expect(screen.getByText('₿ 0.01500000')).toBeTruthy();
    expect(screen.getAllByText('$1,425.00')).toHaveLength(2);
    expect(screen.getByText('1,500,000 sats')).toBeTruthy();
    expect(
      screen.getByText("USD is the BTC-USD daily close (UTC) on each gift's day."),
    ).toBeTruthy();
    expect(screen.getByText('Total spend over time')).toBeTruthy();
    expect(screen.getByLabelText('BTC over time')).toBeTruthy();
    expect(screen.getByLabelText('USD over time')).toBeTruthy();
    expect(screen.getByLabelText('Spend by person')).toBeTruthy();
    expect(screen.getByLabelText('Spend by month')).toBeTruthy();
    expect(screen.getByText('alice')).toBeTruthy();
    expect(screen.getByText('0.01000000 ₿ · $950.00')).toBeTruthy();
  });

  it('anchors the first and last spend-over-time dates so full YYYY-MM-DD labels stay in view', () => {
    render(
      <StatsDashboard stats={SAMPLE} error={null} loading={false} onRetry={() => undefined} />,
    );
    const svg = screen.getByLabelText('BTC over time');
    const first = [...svg.querySelectorAll('text')].find((el) => el.textContent === '2026-06-01');
    const last = [...svg.querySelectorAll('text')].find((el) => el.textContent === '2026-06-03');
    expect(first?.getAttribute('text-anchor')).toBe('start');
    expect(last?.getAttribute('text-anchor')).toBe('end');
    expect(last?.textContent).toBe('2026-06-03');
  });

  it('shows trimmed BTC ticks on the over-time chart', () => {
    const large: GiftStats = {
      ...SAMPLE,
      totalSats: 15_000_000,
      totalBtc: '0.15000000',
      totalUsd: '14250.00',
      spendOverTime: [
        {
          day: '2026-01-01',
          sats: 15_000_000,
          cumulativeSats: 15_000_000,
          btc: '0.15000000',
          cumulativeBtc: '0.15000000',
          usd: '14250.00',
          cumulativeUsd: '14250.00',
        },
      ],
      byMonth: [
        { month: '2026-01', giftCount: 1, sats: 15_000_000, btc: '0.15000000', usd: '14250.00' },
      ],
    };
    render(<StatsDashboard stats={large} error={null} loading={false} onRetry={() => undefined} />);
    expect(screen.getByLabelText('BTC over time').textContent).toContain('0.15');
    expect(screen.getByLabelText('USD over time').textContent).toMatch(/\$14,250/);
  });

  it('does not duplicate the zero BTC y tick when the series is tiny', () => {
    const one: GiftStats = {
      ...SAMPLE,
      totalSats: 1,
      totalBtc: '0.00000001',
      totalUsd: '0.00',
      spendOverTime: [
        {
          day: '2026-01-01',
          sats: 1,
          cumulativeSats: 1,
          btc: '0.00000001',
          cumulativeBtc: '0.00000001',
          usd: '0.00',
          cumulativeUsd: '0.00',
        },
      ],
      byMonth: [{ month: '2026-01', giftCount: 1, sats: 1, btc: '0.00000001', usd: '0.00' }],
    };
    render(<StatsDashboard stats={one} error={null} loading={false} onRetry={() => undefined} />);
    const svg = screen.getByLabelText('BTC over time');
    const zeros = [...svg.querySelectorAll('text')].filter((el) => el.textContent === '0');
    expect(zeros).toHaveLength(1);
    const maxLabels = [...svg.querySelectorAll('text')].filter(
      (el) => el.textContent === '0.00000001',
    );
    expect(maxLabels).toHaveLength(1);
    expect(Number(maxLabels[0]?.getAttribute('y'))).toBe(20);
    const usdSvg = screen.getByLabelText('USD over time');
    const usdTickTexts = [...usdSvg.querySelectorAll('text')].map((el) => el.textContent);
    expect(usdTickTexts.filter((t) => t === '$0')).toHaveLength(1);
    expect(usdTickTexts.some((t) => t === '$1' || t === '$0.5')).toBe(false);
  });

  it('keeps month labels on the by-month chart', () => {
    render(
      <StatsDashboard stats={SAMPLE} error={null} loading={false} onRetry={() => undefined} />,
    );
    expect(screen.getByLabelText('Spend by month').textContent).toContain('2026-06');
  });

  it('shows BTC and USD amounts on the by-month chart', () => {
    render(
      <StatsDashboard stats={SAMPLE} error={null} loading={false} onRetry={() => undefined} />,
    );
    const svg = screen.getByLabelText('Spend by month');
    expect(svg.textContent).toContain('0.01500000 ₿');
    expect(svg.textContent).toContain('$1,425.00');
  });

  it('labels zero-sats months on the by-month chart', () => {
    const withZero: GiftStats = {
      ...SAMPLE,
      byMonth: [
        { month: '2026-02', giftCount: 0, sats: 0, btc: '0.00000000', usd: '0.00' },
        { month: '2026-03', giftCount: 1, sats: 500_000, btc: '0.00500000', usd: '475.00' },
      ],
    };
    render(
      <StatsDashboard stats={withZero} error={null} loading={false} onRetry={() => undefined} />,
    );
    const svg = screen.getByLabelText('Spend by month');
    expect(svg.textContent).toContain('2026-02');
    expect(svg.textContent).toContain('2026-03');
    expect(svg.textContent).toContain('0.00000000 ₿');
    expect(svg.textContent).toContain('$0.00');
    expect(svg.querySelectorAll('rect')).toHaveLength(1);
  });

  it('keeps a one-pixel floor for tiny positive months', () => {
    const tiny: GiftStats = {
      ...SAMPLE,
      byMonth: [
        { month: '2026-01', giftCount: 1, sats: 1, btc: '0.00000001', usd: '0.00' },
        { month: '2026-02', giftCount: 1, sats: 1_000_000, btc: '0.01000000', usd: '950.00' },
      ],
    };
    render(<StatsDashboard stats={tiny} error={null} loading={false} onRetry={() => undefined} />);
    const svg = screen.getByLabelText('Spend by month');
    const rects = [...svg.querySelectorAll('rect')];
    expect(rects).toHaveLength(2);
    expect(Number(rects[0]?.getAttribute('height'))).toBeGreaterThanOrEqual(1);
  });
});
