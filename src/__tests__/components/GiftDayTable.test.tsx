import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { GiftDayTable } from '@/components/GiftDayTable';
import type { GiftDay } from '@/lib/api-types';

afterEach(cleanup);

const EMPTY: GiftDay = {
  day: '2026-06-01',
  giftCount: 0,
  totalSats: 0,
  totalBtc: '0.00000000',
  totalUsd: '0.00',
  gifts: [],
  fx: {
    quote: 'BTC-USD',
    dayBasis: 'utc',
    source: 'coinbase-exchange-daily-close',
  },
};

describe('GiftDayTable', () => {
  it('shows the empty copy', () => {
    render(<GiftDayTable day={EMPTY} />);
    expect(screen.getByText('No gifts recorded on this day.')).toBeTruthy();
  });

  it('lists gifts', () => {
    render(
      <GiftDayTable
        day={{
          ...EMPTY,
          giftCount: 1,
          totalSats: 500,
          totalBtc: '0.00000500',
          totalUsd: '0.48',
          gifts: [
            {
              paidAt: '2026-06-01T12:00:00.000Z',
              amountSats: 500,
              amountBtc: '0.00000500',
              amountUsd: '0.48',
              recipient: 'alice',
            },
          ],
        }}
      />,
    );
    expect(screen.getByText('alice')).toBeTruthy();
    expect(screen.getByText('500')).toBeTruthy();
    expect(screen.getByText('12:00:00 UTC')).toBeTruthy();
  });

  it('shows UTC clock from an offset timestamp', () => {
    render(
      <GiftDayTable
        day={{
          ...EMPTY,
          giftCount: 1,
          gifts: [
            {
              paidAt: '2026-06-01T14:00:00+02:00',
              amountSats: 1,
              amountBtc: '0.00000001',
              amountUsd: '0.01',
              recipient: 'bob',
            },
          ],
        }}
      />,
    );
    expect(screen.getByText('12:00:00 UTC')).toBeTruthy();
  });

  it('shows the raw paidAt when the timestamp is not a date', () => {
    render(
      <GiftDayTable
        day={{
          ...EMPTY,
          giftCount: 1,
          gifts: [
            {
              paidAt: 'not-a-time',
              amountSats: 1,
              amountBtc: '0.00000001',
              amountUsd: '0.01',
              recipient: 'bob',
            },
          ],
        }}
      />,
    );
    expect(screen.getByText('not-a-time')).toBeTruthy();
  });
});
