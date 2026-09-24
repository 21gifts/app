import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { preferredFiatSuffix } from '@/components/PreferredFiatSuffix';
import { DEFAULT_NUMBER_FORMAT } from '@/lib/number-format';
import type { FiatRateDay } from '@/lib/stats-money';

afterEach(cleanup);

const RATE_DAY: FiatRateDay = {
  sats: 100_000_000,
  usd: '100000.00',
  chf: '80000.00',
  eur: '90000.00',
  php: '5600000.00',
};

describe('preferredFiatSuffix', () => {
  it('renders nothing when rateDay is null', () => {
    const { container } = render(
      <p>{preferredFiatSuffix(21, null, 'USD', DEFAULT_NUMBER_FORMAT)}</p>,
    );
    expect(container.textContent).toBe('');
  });

  it('renders nothing when the conversion is unusable', () => {
    const { container } = render(
      <p>{preferredFiatSuffix(21, { ...RATE_DAY, chf: null }, 'CHF', DEFAULT_NUMBER_FORMAT)}</p>,
    );
    expect(container.textContent).toBe('');
  });

  it('renders a hidden separator and the formatted fiat when the conversion is usable', () => {
    const { container } = render(
      <p>{preferredFiatSuffix(21, RATE_DAY, 'USD', DEFAULT_NUMBER_FORMAT)}</p>,
    );
    expect(screen.getByText('$0.02')).toBeTruthy();
    const hidden = container.querySelector('[aria-hidden="true"]');
    expect(hidden?.textContent).toBe(' · ');
    expect(hidden?.getAttribute('aria-hidden')).toBe('true');
  });

  it('renders the stored USD amount even when the live rate would differ', () => {
    const { container } = render(
      <p>
        {preferredFiatSuffix(21, RATE_DAY, 'USD', DEFAULT_NUMBER_FORMAT, { amountUsd: '5.00' })}
      </p>,
    );
    expect(screen.getByText('$5.00')).toBeTruthy();
    expect(screen.queryByText('$0.02')).toBeNull();
    expect(container.querySelector('[aria-hidden="true"]')?.textContent).toBe(' · ');
  });

  it('renders no fiat when the stored field is null', () => {
    const { container } = render(
      <p>{preferredFiatSuffix(21, RATE_DAY, 'USD', DEFAULT_NUMBER_FORMAT, { amountUsd: null })}</p>,
    );
    expect(container.textContent).toBe('');
    expect(screen.queryByText('$0.02')).toBeNull();
  });

  it('renders no fiat when stored is passed without the viewer field', () => {
    const { container } = render(
      <p>
        {preferredFiatSuffix(21, RATE_DAY, 'USD', DEFAULT_NUMBER_FORMAT, { amountChf: '5.00' })}
      </p>,
    );
    expect(container.textContent).toBe('');
    expect(screen.queryByText('$0.02')).toBeNull();
    expect(container.textContent).not.toContain('5.00');
  });

  it('maps CHF to amountChf and ignores amountUsd', () => {
    const { container } = render(
      <p>
        {preferredFiatSuffix(21, RATE_DAY, 'CHF', DEFAULT_NUMBER_FORMAT, {
          amountUsd: '9.00',
          amountChf: '5.00',
        })}
      </p>,
    );
    expect(container.textContent).toContain('5.00');
    expect(container.textContent).not.toContain('9.00');
    expect(container.textContent).not.toContain('$');
  });
});
