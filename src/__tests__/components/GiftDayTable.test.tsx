import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { GiftDayTable } from '@/components/GiftDayTable';
import type { GiftDay } from '@/lib/api-types';

afterEach(cleanup);

const FX_USD: GiftDay['fx'] = {
  quote: 'BTC-USD',
  dayBasis: 'utc',
  source: 'coinbase-exchange-daily-close',
  quotes: [{ code: 'USD', pair: 'BTC-USD', source: 'coinbase-exchange-daily-close' }],
};

const FX_ALL: GiftDay['fx'] = {
  quote: 'BTC-USD',
  dayBasis: 'utc',
  source: 'coinbase-exchange-daily-close',
  quotes: [
    { code: 'USD', pair: 'BTC-USD', source: 'coinbase-exchange-daily-close' },
    { code: 'CHF', pair: 'USD-CHF', source: 'ecb-daily' },
    { code: 'EUR', pair: 'USD-EUR', source: 'ecb-daily' },
    { code: 'PHP', pair: 'USD-PHP', source: 'ecb-daily' },
  ],
};

const EMPTY: GiftDay = {
  day: '2026-06-01',
  giftCount: 0,
  totalSats: 0,
  totalBtc: '0.00000000',
  totalUsd: '0.00',
  totalChf: '0.00',
  totalEur: '0.00',
  totalPhp: '0.00',
  gifts: [],
  fx: FX_USD,
};

const ALICE: GiftDay = {
  ...EMPTY,
  giftCount: 1,
  totalSats: 500,
  totalBtc: '0.00000500',
  totalUsd: '0.48',
  totalChf: '0.40',
  totalEur: '0.44',
  totalPhp: '27.00',
  gifts: [
    {
      paidAt: '2026-06-01T12:00:00.000Z',
      amountSats: 500,
      amountBtc: '0.00000500',
      amountUsd: '0.48',
      amountChf: '0.40',
      amountEur: '0.44',
      amountPhp: '27.00',
      recipient: 'alice',
    },
  ],
  fx: FX_ALL,
};

describe('GiftDayTable', () => {
  it('shows the empty copy', () => {
    render(<GiftDayTable day={EMPTY} fiat="USD" />);
    expect(screen.getByText('No gifts recorded on this day.')).toBeTruthy();
  });

  it('lists gifts', () => {
    render(<GiftDayTable day={ALICE} fiat="USD" />);
    expect(screen.getByText('alice')).toBeTruthy();
    expect(screen.getByText('₿500')).toBeTruthy();
    expect(screen.getByText('12:00:00 UTC')).toBeTruthy();
  });

  it('shows a CHF header and cell', () => {
    render(<GiftDayTable day={ALICE} fiat="CHF" />);
    expect(screen.getByText('CHF')).toBeTruthy();
    expect(screen.getByText('CHF 0.40')).toBeTruthy();
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
              amountChf: '0.01',
              amountEur: '0.01',
              amountPhp: '0.50',
              recipient: 'bob',
            },
          ],
        }}
        fiat="USD"
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
              amountChf: '0.01',
              amountEur: '0.01',
              amountPhp: '0.50',
              recipient: 'bob',
            },
          ],
        }}
        fiat="USD"
      />,
    );
    expect(screen.getByText('not-a-time')).toBeTruthy();
  });
});
