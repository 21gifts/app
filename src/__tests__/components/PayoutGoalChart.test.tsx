import { cleanup, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { PayoutGoalChart } from '@/components/PayoutGoalChart';
import { chartDayLabel } from '@/lib/payout-goal';
import { renderWithLocale } from '@/__tests__/render-with-locale';

afterEach(() => {
  cleanup();
});

describe('PayoutGoalChart', () => {
  it('omits a zero bar, accents other days, and lightens today', () => {
    renderWithLocale(
      <PayoutGoalChart
        rows={[
          { day: '2026-09-18', count: 0 },
          { day: '2026-09-19', count: 40 },
          { day: '2026-09-20', count: 3 },
        ]}
        today="2026-09-20"
        locale="en"
        ariaLabel="People by UTC day"
      />,
      'en',
    );

    const svg = screen.getByRole('img', { name: 'People by UTC day' });
    const bars = screen.getAllByTestId('payout-goal-chart-bar');
    expect(bars).toHaveLength(2);
    expect(bars[0]?.getAttribute('class')).toContain('fill-app-accent');
    expect(bars[1]?.getAttribute('class')).toContain('fill-app-subtle');
    expect(screen.getByText('100')).toBeTruthy();
    expect(svg.querySelector('line[class*="stroke-app-accent"]')).toBeTruthy();
    const lastLabel = chartDayLabel('2026-09-20', 'en');
    expect(lastLabel).toContain('20');
    expect(screen.getByText(lastLabel)).toBeTruthy();
  });

  it('skips an axis label that is not first, middle, or last', () => {
    renderWithLocale(
      <PayoutGoalChart
        rows={[
          { day: '2026-09-17', count: 0 },
          { day: '2026-09-18', count: 1 },
          { day: '2026-09-19', count: 2 },
          { day: '2026-09-20', count: 3 },
        ]}
        today="2026-09-20"
        locale="en"
        ariaLabel="People by UTC day"
      />,
      'en',
    );

    expect(screen.getAllByTestId('payout-goal-chart-bar')).toHaveLength(3);
    expect(screen.queryByText(chartDayLabel('2026-09-19', 'en'))).toBeNull();
  });
});
