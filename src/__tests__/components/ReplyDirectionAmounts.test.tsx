import { cleanup, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { renderWithLocale } from '@/__tests__/render-with-locale';
import {
  ReplyDirectionAmounts,
  type ReplyDirectionAmountsProps,
} from '@/components/ReplyDirectionAmounts';
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

function renderAmounts(overrides: Partial<ReplyDirectionAmountsProps> = {}): void {
  renderWithLocale(
    <ReplyDirectionAmounts
      text="You got it right."
      sats={0}
      rateDay={null}
      fiat="USD"
      numberFormat={DEFAULT_NUMBER_FORMAT}
      {...overrides}
    />,
  );
}

describe('ReplyDirectionAmounts', () => {
  it('renders nothing when the reply sent nothing and received nothing', () => {
    const { container } = renderWithLocale(
      <ReplyDirectionAmounts
        text="You got it right."
        sats={0}
        rateDay={null}
        fiat="USD"
        numberFormat={DEFAULT_NUMBER_FORMAT}
      />,
    );
    expect(container.textContent).toBe('');
  });

  it('renders nothing when receivedSats is 0 and nothing was sent', () => {
    renderAmounts({ text: '', sats: 0, receivedSats: 0 });
    expect(screen.queryByText(/₿/)).toBeNull();
  });

  it('labels a gift-only reply as sent and does not invent a received line', () => {
    renderAmounts({ text: '', sats: 21000 });
    expect(screen.getByText("send ₿21'000")).toBeTruthy();
    expect(screen.queryByText(/received/)).toBeNull();
    expect(screen.queryByText("₿21'100")).toBeNull();
  });

  it('shows a bare sent amount when the reply has text and no later receipt', () => {
    renderAmounts({ sats: 21000 });
    const amount = screen.getByText("₿21'000");
    expect(amount.className).toContain('text-app-muted');
    expect(screen.queryByText(/sent /)).toBeNull();
    expect(screen.queryByText(/received/)).toBeNull();
  });

  it('omits the received line when receivedSats is 0', () => {
    renderAmounts({ sats: 21000, receivedSats: 0 });
    expect(screen.getByText("₿21'000")).toBeTruthy();
    expect(screen.queryByText('received ₿0')).toBeNull();
    expect(screen.queryByText("₿21'100")).toBeNull();
  });

  it('keeps sent and received as two labeled lines and never adds them', () => {
    renderAmounts({
      sats: 21000,
      receivedSats: 100,
      rateDay: RATE_DAY,
      sent: { amountUsd: '18.14' },
      received: { amountUsd: '0.09' },
    });
    const sent = screen.getByText("sent ₿21'000");
    const received = screen.getByText('received ₿100');
    const pair = sent.closest('div');
    expect(pair?.className).toContain('border-l-2');
    expect(received.closest('div')).toBe(pair);
    expect(sent.className).toContain('text-app-fg');
    expect(received.className).toContain('text-app-subtle');
    expect(screen.getAllByText('$18.14')).toHaveLength(1);
    expect(screen.getByText('$0.09')).toBeTruthy();
    expect(screen.queryByText("₿21'000")).toBeNull();
    expect(screen.queryByText("₿21'100")).toBeNull();
    expect(screen.queryByText('$18.23')).toBeNull();
  });

  it('shows only the received line when the reply sent nothing', () => {
    renderAmounts({ sats: 0, receivedSats: 100 });
    const received = screen.getByText('received ₿100');
    expect(received.parentElement?.className ?? '').not.toContain('border-l-2');
    expect(screen.queryByText(/sent /)).toBeNull();
    expect(screen.queryByText("₿21'100")).toBeNull();
  });

  it('shows a gift and a later receipt as separate lines without the sent-pair rule', () => {
    renderAmounts({ text: '', sats: 21000, receivedSats: 100 });
    const sent = screen.getByText("send ₿21'000");
    const received = screen.getByText('received ₿100');
    expect(sent.parentElement).toBe(received.parentElement);
    expect(sent.parentElement?.className ?? '').not.toContain('border-l-2');
    expect(screen.queryByText("₿21'100")).toBeNull();
  });
});
