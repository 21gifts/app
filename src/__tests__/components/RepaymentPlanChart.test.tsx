import { cleanup, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { RepaymentPlanChart } from '@/components/RepaymentPlanChart';
import { renderWithLocale } from '@/__tests__/render-with-locale';

afterEach(() => {
  cleanup();
});

describe('RepaymentPlanChart', () => {
  it('draws nothing when every day is empty', () => {
    const { container } = renderWithLocale(
      <RepaymentPlanChart amounts={[]} from="Day 1" to="Day 1" totalText="₿0" />,
    );
    expect(container.querySelector('svg')).toBeNull();
    cleanup();
    const zero = renderWithLocale(
      <RepaymentPlanChart amounts={[0, Number.NaN]} from="Day 1" to="Day 2" totalText="₿0" />,
    );
    expect(zero.container.querySelector('svg')).toBeNull();
  });

  it('draws one bar per day and a debt line from the whole amount to zero', () => {
    renderWithLocale(
      <RepaymentPlanChart amounts={[1, 2]} from="Sep 27" to="Sep 28" totalText="₿3" />,
    );
    expect(screen.getByRole('img', { name: /Sep 27/ })).toBeTruthy();
    expect(screen.getAllByTestId('repayment-plan-bar')).toHaveLength(2);
    expect(screen.getByTestId('repayment-plan-debt')).toBeTruthy();
    expect(screen.getByText('Per day')).toBeTruthy();
    expect(screen.getByText('Still owed')).toBeTruthy();
  });
});
