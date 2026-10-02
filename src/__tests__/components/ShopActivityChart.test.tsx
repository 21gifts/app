import { cleanup, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { ShopActivityChart } from '@/components/ShopActivityChart';
import { renderWithLocale } from '@/__tests__/render-with-locale';

afterEach(() => {
  cleanup();
});

describe('ShopActivityChart', () => {
  it('omits a zero bar, labels today and the window max, and draws a mid tick', () => {
    renderWithLocale(
      <ShopActivityChart
        rows={[
          { day: '2026-09-17', count: 0 },
          { day: '2026-09-18', count: 5 },
          { day: '2026-09-19', count: 1 },
          { day: '2026-09-20', count: 2 },
        ]}
        today="2026-09-20"
        locale="en"
        ariaLabel="Shops by UTC day"
      />,
      'en',
    );

    const svg = screen.getByRole('img', { name: 'Shops by UTC day' });
    const bars = screen.getAllByTestId('shop-activity-chart-bar');
    expect(bars).toHaveLength(3);
    expect(bars[0]?.getAttribute('class')).toContain('fill-app-accent');
    expect(bars[1]?.getAttribute('class')).toContain('fill-app-accent');
    expect(bars[2]?.getAttribute('class')).toContain('fill-app-subtle');
    expect(within(svg).getAllByText('5')).toHaveLength(2);
    expect(within(svg).getAllByText('2')).toHaveLength(1);
    expect(within(svg).getByText('0')).toBeTruthy();
    expect(within(svg).getByText('3')).toBeTruthy();
    expect(within(svg).queryByText('1')).toBeNull();
    expect(within(svg).queryByText('100')).toBeNull();
    expect(svg.querySelector('line[class*="stroke-app-accent"]')).toBeNull();
  });

  it('draws ticks 0 and 1 when the window maximum is 1', () => {
    renderWithLocale(
      <ShopActivityChart
        rows={[
          { day: '2026-09-19', count: 0 },
          { day: '2026-09-20', count: 1 },
        ]}
        today="2026-09-20"
        locale="en"
        ariaLabel="Shops by UTC day"
      />,
      'en',
    );

    const svg = screen.getByRole('img', { name: 'Shops by UTC day' });
    expect(screen.getAllByTestId('shop-activity-chart-bar')).toHaveLength(1);
    expect(within(svg).getByText('0')).toBeTruthy();
    expect(within(svg).getAllByText('1').length).toBeGreaterThan(0);
  });

  it('draws ticks 0 and 1 and no bars when every count is 0', () => {
    renderWithLocale(
      <ShopActivityChart
        rows={[
          { day: '2026-09-19', count: 0 },
          { day: '2026-09-20', count: 0 },
        ]}
        today="2026-09-20"
        locale="en"
        ariaLabel="Shops by UTC day"
      />,
      'en',
    );

    expect(screen.queryAllByTestId('shop-activity-chart-bar')).toHaveLength(0);
    const svg = screen.getByRole('img', { name: 'Shops by UTC day' });
    expect(within(svg).getByText('0')).toBeTruthy();
    expect(within(svg).getByText('1')).toBeTruthy();
    expect(svg.querySelector('line[class*="stroke-app-accent"]')).toBeNull();
  });

  it('draws a bar of height 3 when the count is below the floor', () => {
    renderWithLocale(
      <ShopActivityChart
        rows={[
          { day: '2026-09-19', count: 100 },
          { day: '2026-09-20', count: 1 },
        ]}
        today="2026-09-20"
        locale="en"
        ariaLabel="Shops by UTC day"
      />,
      'en',
    );

    const bars = screen.getAllByTestId('shop-activity-chart-bar');
    expect(bars).toHaveLength(2);
    const subtle = bars.find((bar) => bar.getAttribute('class')?.includes('fill-app-subtle'));
    const accent = bars.find((bar) => bar !== subtle);
    expect(subtle?.getAttribute('height')).toBe('3');
    expect(accent?.getAttribute('class')).toContain('fill-app-accent');
    expect(accent?.getAttribute('height')).not.toBe('3');
  });
});
