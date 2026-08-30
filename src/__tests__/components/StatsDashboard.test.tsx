import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
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
    expect(screen.getByText('₿0')).toBeTruthy();
    expect(screen.getByText('$0.00')).toBeTruthy();
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
    expect(screen.getByLabelText('Spend over time in ₿')).toBeTruthy();
    expect(screen.getByLabelText('Spend over time in ₿').getAttribute('role')).toBe('img');
    expect(screen.queryByLabelText('Spend over time in USD')).toBeNull();
    expect(screen.getByLabelText('Spend by person in ₿')).toBeTruthy();
    expect(screen.getByLabelText('Spend by month in ₿')).toBeTruthy();
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
    const svg = screen.getByLabelText('Spend over time in ₿');
    expect(within(svg).getByText('2026-06-01')).toBeTruthy();
    expect(within(svg).getByText('2026-06-02')).toBeTruthy();
    expect(within(svg).getAllByText('2026-06-01')).toHaveLength(1);
    expect(within(svg).getAllByText('2026-06-02')).toHaveLength(1);
    expect(within(svg).getByRole('link', { name: '2026-06-01' }).getAttribute('href')).toBe(
      '/stats/2026-06-01',
    );
    expect(within(svg).getByRole('link', { name: '2026-06-02' }).getAttribute('href')).toBe(
      '/stats/2026-06-02',
    );
    expect(
      screen
        .getByRole('heading', { name: 'Total spend over time' })
        .closest('section')
        ?.querySelector('p a'),
    ).toBeNull();
  });

  it('renders KPIs, footnote, BTC/USD charts, and person labels', () => {
    render(
      <StatsDashboard stats={SAMPLE} error={null} loading={false} onRetry={() => undefined} />,
    );
    expect(screen.getAllByText('₿1,500,000')).toHaveLength(3);
    expect(screen.getAllByText('$1,425.00')).toHaveLength(2);
    expect(
      screen.getByText("USD is the BTC-USD daily close (UTC) on each gift's day."),
    ).toBeTruthy();
    expect(screen.getByText('Total spend over time')).toBeTruthy();
    expect(screen.getByLabelText('Spend over time in ₿')).toBeTruthy();
    expect(screen.queryByLabelText('Spend over time in USD')).toBeNull();
    expect(screen.getByLabelText('Spend by person in ₿')).toBeTruthy();
    expect(screen.getByLabelText('Spend by month in ₿')).toBeTruthy();
    expect(screen.getByText('alice')).toBeTruthy();
    expect(screen.getByText('₿1,000,000 · $950.00')).toBeTruthy();
    const svg = screen.getByLabelText('Spend over time in ₿');
    expect(svg.getAttribute('role')).toBe('group');
    expect(within(svg).getByRole('link', { name: '2026-06-01' }).getAttribute('href')).toBe(
      '/stats/2026-06-01',
    );
    expect(within(svg).queryByRole('link', { name: '2026-06-02' })).toBeNull();
    expect(within(svg).getByRole('link', { name: '2026-06-03' }).getAttribute('href')).toBe(
      '/stats/2026-06-03',
    );
    expect(
      screen
        .getByRole('heading', { name: 'Total spend over time' })
        .closest('section')
        ?.querySelector('p a'),
    ).toBeNull();
  });

  it('keeps over-time day hit strips from overlapping on a long series', () => {
    const spendOverTime = Array.from({ length: 40 }, (_, i) => {
      const utc = new Date(Date.UTC(2026, 5, 1 + i));
      const day = utc.toISOString().slice(0, 10);
      const sats = (i + 1) * 100;
      return {
        day,
        sats,
        cumulativeSats: sats,
        btc: '0.00000100',
        cumulativeBtc: '0.00000100',
        usd: '1.00',
        cumulativeUsd: '1.00',
      };
    });
    const longSeries: GiftStats = {
      ...SAMPLE,
      spendOverTime,
    };
    render(
      <StatsDashboard stats={longSeries} error={null} loading={false} onRetry={() => undefined} />,
    );
    const svg = screen.getByLabelText('Spend over time in ₿');
    expect(svg.getAttribute('role')).toBe('group');
    const rects = [...svg.querySelectorAll('a rect')];
    expect(rects).toHaveLength(40);
    expect(
      [...svg.querySelectorAll('a circle')].every(
        (el) => el.getAttribute('pointer-events') === 'none',
      ),
    ).toBe(true);
    for (let i = 1; i < rects.length; i += 1) {
      const prev = rects[i - 1];
      const cur = rects[i];
      const prevRight = Number(prev?.getAttribute('x')) + Number(prev?.getAttribute('width'));
      const x = Number(cur?.getAttribute('x'));
      expect(x).toBeGreaterThanOrEqual(prevRight - 0.01);
    }
  });

  it('anchors the first and last spend-over-time dates so full YYYY-MM-DD labels stay in view', () => {
    render(
      <StatsDashboard stats={SAMPLE} error={null} loading={false} onRetry={() => undefined} />,
    );
    const svg = screen.getByLabelText('Spend over time in ₿');
    const first = [...svg.querySelectorAll('text')].find((el) => el.textContent === '2026-06-01');
    const last = [...svg.querySelectorAll('text')].find((el) => el.textContent === '2026-06-03');
    expect(first?.getAttribute('text-anchor')).toBe('start');
    expect(last?.getAttribute('text-anchor')).toBe('end');
    expect(last?.textContent).toBe('2026-06-03');
  });

  it('shows BIP-177 ₿ ticks on the over-time chart', () => {
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
    expect(screen.getByLabelText('Spend over time in ₿').textContent).toContain('₿15,000,000');
    fireEvent.click(
      within(screen.getByRole('group', { name: 'Over time scale' })).getByRole('button', {
        name: 'USD',
      }),
    );
    expect(screen.getByLabelText('Spend over time in USD').textContent).toMatch(/\$14,250/);
  });

  it('does not duplicate the zero ₿ y tick when the series is tiny', () => {
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
    const svg = screen.getByLabelText('Spend over time in ₿');
    const zeros = [...svg.querySelectorAll('text')].filter((el) => el.textContent === '₿0');
    expect(zeros).toHaveLength(1);
    const maxLabels = [...svg.querySelectorAll('text')].filter((el) => el.textContent === '₿1');
    expect(maxLabels).toHaveLength(1);
    expect(Number(maxLabels[0]?.getAttribute('y'))).toBe(20);
    fireEvent.click(
      within(screen.getByRole('group', { name: 'Over time scale' })).getByRole('button', {
        name: 'USD',
      }),
    );
    const usdSvg = screen.getByLabelText('Spend over time in USD');
    const usdTickTexts = [...usdSvg.querySelectorAll('text')].map((el) => el.textContent);
    expect(usdTickTexts.filter((t) => t === '$0')).toHaveLength(1);
    expect(usdTickTexts.some((t) => t === '$1' || t === '$0.5')).toBe(false);
  });

  it('keeps month labels on the by-month chart', () => {
    render(
      <StatsDashboard stats={SAMPLE} error={null} loading={false} onRetry={() => undefined} />,
    );
    expect(screen.getByLabelText('Spend by month in ₿').textContent).toContain('2026-06');
  });

  it('shows BIP-177 and USD amounts on the by-month chart', () => {
    render(
      <StatsDashboard stats={SAMPLE} error={null} loading={false} onRetry={() => undefined} />,
    );
    const svg = screen.getByLabelText('Spend by month in ₿');
    expect(svg.textContent).toContain('₿1,500,000');
    expect(svg.textContent).toContain('$1,425.00');
  });

  it('labels zero-amount months on the by-month chart', () => {
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
    const svg = screen.getByLabelText('Spend by month in ₿');
    expect(svg.textContent).toContain('2026-02');
    expect(svg.textContent).toContain('2026-03');
    expect(svg.textContent).toContain('₿0');
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
    const svg = screen.getByLabelText('Spend by month in ₿');
    const rects = [...svg.querySelectorAll('rect')];
    expect(rects).toHaveLength(2);
    const y0 = Number(rects[0]?.getAttribute('y'));
    const h0 = Number(rects[0]?.getAttribute('height'));
    expect(h0).toBeGreaterThanOrEqual(1);
    expect(y0 + h0).toBe(184);
  });

  it('sizes by-month bars by USD after clicking the USD scale', () => {
    const inverted: GiftStats = {
      ...SAMPLE,
      byMonth: [
        { month: '2026-06', giftCount: 1, sats: 1_000_000, btc: '0.01000000', usd: '50.00' },
        { month: '2026-07', giftCount: 1, sats: 100_000, btc: '0.00100000', usd: '900.00' },
      ],
    };
    render(
      <StatsDashboard stats={inverted} error={null} loading={false} onRetry={() => undefined} />,
    );
    const btcSvg = screen.getByLabelText('Spend by month in ₿');
    const btcRects = [...btcSvg.querySelectorAll('rect')];
    expect(Number(btcRects[0]?.getAttribute('height'))).toBeGreaterThan(
      Number(btcRects[1]?.getAttribute('height')),
    );
    const group = screen.getByRole('group', { name: 'By month bar scale' });
    fireEvent.click(within(group).getByRole('button', { name: 'USD' }));
    expect(within(group).getByRole('button', { name: 'USD' }).getAttribute('aria-pressed')).toBe(
      'true',
    );
    const usdSvg = screen.getByLabelText('Spend by month in USD');
    const usdRects = [...usdSvg.querySelectorAll('rect')];
    expect(Number(usdRects[1]?.getAttribute('height'))).toBeGreaterThan(
      Number(usdRects[0]?.getAttribute('height')),
    );
    fireEvent.click(within(group).getByRole('button', { name: '₿' }));
    expect(within(group).getByRole('button', { name: '₿' }).getAttribute('aria-pressed')).toBe(
      'true',
    );
    expect(screen.getByLabelText('Spend by person in ₿')).toBeTruthy();
  });

  it('sizes by-person bars by USD independently of the month scale', () => {
    const mixed: GiftStats = {
      ...SAMPLE,
      byRecipient: [
        { recipient: 'alice', giftCount: 1, sats: 1_000_000, btc: '0.01000000', usd: '50.00' },
        { recipient: 'bob', giftCount: 1, sats: 100_000, btc: '0.00100000', usd: '900.00' },
        { recipient: 'carol', giftCount: 0, sats: 0, btc: '0.00000000', usd: '0.00' },
      ],
      byMonth: [
        { month: '2026-06', giftCount: 1, sats: 1_000_000, btc: '0.01000000', usd: '50.00' },
        { month: '2026-07', giftCount: 1, sats: 100_000, btc: '0.00100000', usd: '900.00' },
      ],
    };
    render(<StatsDashboard stats={mixed} error={null} loading={false} onRetry={() => undefined} />);
    const personBtc = [...screen.getByLabelText('Spend by person in ₿').querySelectorAll('rect')];
    expect(personBtc).toHaveLength(2);
    expect(Number(personBtc[0]?.getAttribute('width'))).toBeGreaterThan(
      Number(personBtc[1]?.getAttribute('width')),
    );
    fireEvent.click(
      within(screen.getByRole('group', { name: 'By month bar scale' })).getByRole('button', {
        name: 'USD',
      }),
    );
    expect(screen.getByLabelText('Spend by person in ₿')).toBeTruthy();
    const personStillBtc = [
      ...screen.getByLabelText('Spend by person in ₿').querySelectorAll('rect'),
    ];
    expect(Number(personStillBtc[0]?.getAttribute('width'))).toBeGreaterThan(
      Number(personStillBtc[1]?.getAttribute('width')),
    );
    fireEvent.click(
      within(screen.getByRole('group', { name: 'By person bar scale' })).getByRole('button', {
        name: 'USD',
      }),
    );
    const personUsd = [...screen.getByLabelText('Spend by person in USD').querySelectorAll('rect')];
    expect(Number(personUsd[1]?.getAttribute('width'))).toBeGreaterThan(
      Number(personUsd[0]?.getAttribute('width')),
    );
  });

  it('switches over-time series independently of the month scale', () => {
    render(
      <StatsDashboard stats={SAMPLE} error={null} loading={false} onRetry={() => undefined} />,
    );
    expect(screen.getByLabelText('Spend over time in ₿')).toBeTruthy();
    fireEvent.click(
      within(screen.getByRole('group', { name: 'Over time scale' })).getByRole('button', {
        name: 'USD',
      }),
    );
    expect(screen.getByLabelText('Spend over time in USD')).toBeTruthy();
    expect(screen.queryByLabelText('Spend over time in ₿')).toBeNull();
    expect(screen.getByLabelText('Spend by person in ₿')).toBeTruthy();
    expect(screen.getByLabelText('Spend by month in ₿')).toBeTruthy();
    fireEvent.click(
      within(screen.getByRole('group', { name: 'Over time scale' })).getByRole('button', {
        name: '₿',
      }),
    );
    expect(screen.getByLabelText('Spend over time in ₿')).toBeTruthy();
    expect(screen.queryByLabelText('Spend over time in USD')).toBeNull();
    fireEvent.click(
      within(screen.getByRole('group', { name: 'By person bar scale' })).getByRole('button', {
        name: 'USD',
      }),
    );
    fireEvent.click(
      within(screen.getByRole('group', { name: 'By month bar scale' })).getByRole('button', {
        name: 'USD',
      }),
    );
    expect(screen.getByLabelText('Spend by person in USD')).toBeTruthy();
    expect(screen.getByLabelText('Spend by month in USD')).toBeTruthy();
    expect(screen.getByLabelText('Spend over time in ₿')).toBeTruthy();
  });
});
