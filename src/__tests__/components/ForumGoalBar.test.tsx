import { cleanup, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { ForumGoalBar } from '@/components/ForumGoalBar';
import { renderWithLocale } from '@/__tests__/render-with-locale';
import type { FiatRateDay } from '@/lib/stats-money';

const RATE_DAY: FiatRateDay = {
  sats: 100_000_000,
  usd: '100000.00',
  chf: '80000.00',
  eur: '90000.00',
  php: '5600000.00',
};

afterEach(cleanup);

describe('ForumGoalBar', () => {
  it('renders nothing when goalSats is 0 or negative', () => {
    const { rerender } = renderWithLocale(<ForumGoalBar sats={21000} goalSats={0} />);
    expect(screen.queryByRole('img')).toBeNull();
    expect(screen.queryByText('0%')).toBeNull();
    rerender(<ForumGoalBar sats={21000} goalSats={-1} />);
    expect(screen.queryByRole('img')).toBeNull();
  });

  it('shows 0% with an empty track and no overflow fill', () => {
    const { container } = renderWithLocale(<ForumGoalBar sats={0} goalSats={21000} />);
    expect(screen.getByText('Ask')).toBeTruthy();
    expect(screen.getByText("₿21'000")).toBeTruthy();
    expect(screen.getByText('0%')).toBeTruthy();
    expect(screen.getByRole('img', { name: 'Goal progress 0 percent' })).toBeTruthy();
    expect(container.querySelector('[class*="fill-app-success"]')).toBeNull();
    expect(container.querySelector('[class*="fill-app-accent"]')).toBeNull();
    expect(screen.getByRole('img').querySelector('[style]')).toBeNull();
    expect(screen.getByRole('img').getAttribute('style')).toBeNull();
  });

  it('shows 100% with orange fill and no overflow fill', () => {
    const { container } = renderWithLocale(<ForumGoalBar sats={21000} goalSats={21000} />);
    expect(screen.getByText('100%')).toBeTruthy();
    expect(screen.getByRole('img', { name: 'Goal progress 100 percent' })).toBeTruthy();
    expect(container.querySelector('[class*="fill-app-accent"]')).not.toBeNull();
    expect(container.querySelector('[class*="fill-app-success"]')).toBeNull();
    expect(screen.getByRole('img').querySelector('[style]')).toBeNull();
  });

  it('keeps a floored 100% label orange with no green sliver', () => {
    const { container } = renderWithLocale(<ForumGoalBar sats={21001} goalSats={21000} />);
    expect(screen.getByText('100%')).toBeTruthy();
    expect(container.querySelector('[class*="fill-app-success"]')).toBeNull();
  });

  it('shows the visitor fiat beside a legacy bitcoin ask', () => {
    renderWithLocale(<ForumGoalBar sats={23100} goalSats={21000} rateDay={RATE_DAY} />);
    expect(screen.getByText('Ask')).toBeTruthy();
    expect(screen.getByText("₿21'000")).toBeTruthy();
    expect(screen.getByText('$21.00')).toBeTruthy();
    expect(screen.getByText('110%')).toBeTruthy();
  });

  it('shows bitcoin and the viewer snapshot on a BTC ask without a second defined fiat', () => {
    renderWithLocale(
      <ForumGoalBar
        sats={23100}
        goalSats={21000}
        goalCurrency="BTC"
        goalAmountUsd="21.00"
        rateDay={RATE_DAY}
      />,
    );
    expect(screen.getByText('Ask')).toBeTruthy();
    expect(screen.getByText("₿21'000")).toBeTruthy();
    expect(screen.getByText('$21.00')).toBeTruthy();
    expect(screen.queryByText('CHF')).toBeNull();
    expect(screen.queryByText(/EUR|PHP/)).toBeNull();
  });

  it('shows the defined USD amount and fiat percent, not the snapshot or sats percent', () => {
    renderWithLocale(
      <ForumGoalBar
        sats={21000}
        goalSats={21000}
        goalCurrency="USD"
        goalAmount="200"
        goalAmountUsd="1.99"
        amountUsd="100.00"
      />,
    );
    expect(screen.getByText('$200.00')).toBeTruthy();
    expect(screen.getByText("₿21'000")).toBeTruthy();
    expect(screen.queryByText('$1.99')).toBeNull();
    expect(screen.getByText('50%')).toBeTruthy();
    expect(screen.queryByText('100%')).toBeNull();
  });

  it('shows PHP defined amount, bitcoin, and the USD snapshot', () => {
    renderWithLocale(
      <ForumGoalBar
        sats={0}
        goalSats={21000}
        goalCurrency="PHP"
        goalAmount="10.125"
        goalAmountUsd="1.00"
      />,
    );
    expect(screen.getByText('PHP 10.125')).toBeTruthy();
    expect(screen.getByText("₿21'000")).toBeTruthy();
    expect(screen.getByText('$1.00')).toBeTruthy();
  });

  it('uses the live viewer rate when the USD snapshot is missing on a PHP ask', () => {
    renderWithLocale(
      <ForumGoalBar
        sats={0}
        goalSats={21000}
        rateDay={RATE_DAY}
        goalCurrency="PHP"
        goalAmount="10.125"
        goalAmountUsd={null}
      />,
    );
    expect(screen.getByText('PHP 10.125')).toBeTruthy();
    expect(screen.getByText("₿21'000")).toBeTruthy();
    expect(screen.getByText('$21.00')).toBeTruthy();
  });

  it('shows 0% when the defined amount is zero', () => {
    renderWithLocale(
      <ForumGoalBar
        sats={21000}
        goalSats={21000}
        goalCurrency="USD"
        goalAmount="0"
        amountUsd="1.00"
      />,
    );
    expect(screen.getByText('0%')).toBeTruthy();
  });

  it('shows 0% when the USD collected snapshot is missing, not the sats percent', () => {
    renderWithLocale(
      <ForumGoalBar
        sats={21000}
        goalSats={21000}
        goalCurrency="USD"
        goalAmount="10"
        amountUsd={null}
      />,
    );
    expect(screen.getByText('0%')).toBeTruthy();
    expect(screen.queryByText('100%')).toBeNull();
  });

  it('shows an uncapped 250% fiat label with overflow fill', () => {
    const { container } = renderWithLocale(
      <ForumGoalBar
        sats={21000}
        goalSats={21000}
        goalCurrency="USD"
        goalAmount="10"
        amountUsd="25.00"
      />,
    );
    expect(screen.getByText('250%')).toBeTruthy();
    const img = screen.getByRole('img', { name: 'Goal progress 250 percent' });
    expect(img.getAttribute('viewBox')).toBe('0 0 200 8');
    const overflow = container.querySelector('[class*="fill-app-success"]');
    expect(overflow).not.toBeNull();
    expect(overflow?.getAttribute('x')).toBe('100');
    expect(overflow?.getAttribute('width')).toBe('100');
  });

  it('shows 110% with overflow fill', () => {
    const { container } = renderWithLocale(<ForumGoalBar sats={23100} goalSats={21000} />);
    expect(screen.getByText('Ask')).toBeTruthy();
    expect(screen.getByText("₿21'000")).toBeTruthy();
    expect(screen.getByText('110%')).toBeTruthy();
    const img = screen.getByRole('img', { name: 'Goal progress 110 percent' });
    expect(img.getAttribute('viewBox')).toBe('0 0 110 8');
    expect(container.querySelector('[class*="fill-app-success"]')).not.toBeNull();
    expect(img.querySelector('[style]')).toBeNull();
    const overflow = container.querySelector('[class*="fill-app-success"]');
    expect(overflow?.getAttribute('x')).toBe('100');
    expect(overflow?.getAttribute('width')).toBe('10');
    expect(container.querySelector('svg[aria-hidden="true"]')).toBeNull();
  });

  it('shows an uncapped 250% label while painted overflow stays capped', () => {
    const { container } = renderWithLocale(<ForumGoalBar sats={52500} goalSats={21000} />);
    expect(screen.getByText('250%')).toBeTruthy();
    const img = screen.getByRole('img', { name: 'Goal progress 250 percent' });
    expect(img.getAttribute('viewBox')).toBe('0 0 200 8');
    const overflow = container.querySelector('[class*="fill-app-success"]');
    expect(overflow).not.toBeNull();
    expect(overflow?.getAttribute('x')).toBe('100');
    expect(overflow?.getAttribute('width')).toBe('100');
    expect(img.querySelector('[style]')).toBeNull();
    expect(container.querySelector('svg[aria-hidden="true"]')).toBeNull();
  });
});
