import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { StatsDashboard } from '@/components/StatsDashboard';
import type { GiftStats } from '@/lib/api-types';

afterEach(cleanup);

const SAMPLE: GiftStats = {
  totalSats: 1_500_000,
  giftCount: 3,
  recipientCount: 2,
  firstPaidAt: '2026-06-01T00:00:00.000Z',
  lastPaidAt: '2026-06-03T00:00:00.000Z',
  spendOverTime: [
    { day: '2026-06-01', sats: 500_000, cumulativeSats: 500_000 },
    { day: '2026-06-02', sats: 0, cumulativeSats: 500_000 },
    { day: '2026-06-03', sats: 1_000_000, cumulativeSats: 1_500_000 },
  ],
  byRecipient: [
    { recipient: 'alice', giftCount: 2, sats: 1_000_000 },
    { recipient: 'bob', giftCount: 1, sats: 500_000 },
  ],
  byMonth: [{ month: '2026-06', giftCount: 3, sats: 1_500_000 }],
};

const EMPTY: GiftStats = {
  totalSats: 0,
  giftCount: 0,
  recipientCount: 0,
  firstPaidAt: null,
  lastPaidAt: null,
  spendOverTime: [],
  byRecipient: [],
  byMonth: [],
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
    expect(screen.getByText('0 sats')).toBeTruthy();
    expect(screen.getByText('— – —')).toBeTruthy();
  });

  it('renders KPIs and the three diagrams', () => {
    render(
      <StatsDashboard stats={SAMPLE} error={null} loading={false} onRetry={() => undefined} />,
    );
    expect(screen.getByText('Total spend over time')).toBeTruthy();
    expect(screen.getByLabelText('Total spend over time')).toBeTruthy();
    expect(screen.getByLabelText('Spend by person')).toBeTruthy();
    expect(screen.getByLabelText('Spend by month')).toBeTruthy();
    expect(screen.getByText('alice')).toBeTruthy();
    expect(screen.getByText('1,500,000 sats')).toBeTruthy();
  });

  it('uses compact axis labels for thousands and millions', () => {
    const large: GiftStats = {
      ...SAMPLE,
      totalSats: 15_000_000,
      spendOverTime: [{ day: '2026-01-01', sats: 15_000_000, cumulativeSats: 15_000_000 }],
      byMonth: [{ month: '2026-01', giftCount: 1, sats: 15_000_000 }],
    };
    render(<StatsDashboard stats={large} error={null} loading={false} onRetry={() => undefined} />);
    expect(screen.getByLabelText('Total spend over time').textContent).toMatch(/M/);
  });

  it('uses compact k labels for mid-size totals', () => {
    const mid: GiftStats = {
      ...SAMPLE,
      totalSats: 12_000,
      spendOverTime: [{ day: '2026-01-01', sats: 12_000, cumulativeSats: 12_000 }],
      byMonth: [{ month: '2026-01', giftCount: 1, sats: 12_000 }],
    };
    render(<StatsDashboard stats={mid} error={null} loading={false} onRetry={() => undefined} />);
    expect(screen.getByLabelText('Total spend over time').textContent).toMatch(/k/);
  });

  it('keeps one-decimal k labels under ten thousand', () => {
    const mid: GiftStats = {
      ...SAMPLE,
      totalSats: 4_000,
      spendOverTime: [{ day: '2026-01-01', sats: 4_000, cumulativeSats: 4_000 }],
      byMonth: [{ month: '2026-01', giftCount: 1, sats: 4_000 }],
    };
    render(<StatsDashboard stats={mid} error={null} loading={false} onRetry={() => undefined} />);
    expect(screen.getByLabelText('Total spend over time').textContent).toMatch(/4k/);
  });

  it('keeps small totals as plain numbers on the axis', () => {
    const small: GiftStats = {
      ...SAMPLE,
      totalSats: 80,
      spendOverTime: [{ day: '2026-01-01', sats: 80, cumulativeSats: 80 }],
      byMonth: [{ month: '2026-01', giftCount: 1, sats: 80 }],
    };
    render(<StatsDashboard stats={small} error={null} loading={false} onRetry={() => undefined} />);
    expect(screen.getByLabelText('Total spend over time').textContent).toContain('80');
  });
});
