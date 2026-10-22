import { describe, expect, it } from 'vitest';
import { committedFiatFigure, storedTypedFiat, type StoredFiat } from '@/lib/committed-fiat';

const EMPTY: StoredFiat = {
  amountCurrency: null,
  amount: null,
  amountUsd: null,
  amountChf: null,
  amountEur: null,
  amountPhp: null,
};

describe('storedTypedFiat', () => {
  it('is absent for bitcoin and a typed pair with empty snapshots for fiat', () => {
    expect(storedTypedFiat(undefined)).toBeUndefined();
    expect(storedTypedFiat({ code: 'USD', amount: '12' })).toEqual({
      amountCurrency: 'USD',
      amount: '12',
      amountUsd: null,
      amountChf: null,
      amountEur: null,
      amountPhp: null,
    });
  });
});

describe('committedFiatFigure', () => {
  it('returns the typed pair and ignores the viewer and the other strings', () => {
    expect(
      committedFiatFigure(
        {
          ...EMPTY,
          amountCurrency: 'PHP',
          amount: '12.00',
          amountUsd: '1.00',
        },
        'USD',
      ),
    ).toEqual({ code: 'PHP', amount: '12.00' });
  });

  it('returns the preferred snapshot only when no typed pair is stored', () => {
    expect(committedFiatFigure({ ...EMPTY, amountChf: '5.00' }, 'CHF')).toEqual({
      code: 'CHF',
      amount: '5.00',
    });
  });

  it('returns the PHP snapshot when no typed pair is stored', () => {
    expect(
      committedFiatFigure(
        {
          amountCurrency: null,
          amount: null,
          amountUsd: null,
          amountChf: null,
          amountEur: null,
          amountPhp: '12.00',
        },
        'PHP',
      ),
    ).toEqual({ code: 'PHP', amount: '12.00' });
  });

  it('returns the EUR snapshot when no typed pair is stored', () => {
    expect(
      committedFiatFigure(
        {
          amountCurrency: null,
          amount: null,
          amountUsd: null,
          amountChf: null,
          amountEur: '12.00',
          amountPhp: null,
        },
        'EUR',
      ),
    ).toEqual({ code: 'EUR', amount: '12.00' });
  });

  it('returns null when that snapshot is missing, even if another code is stored', () => {
    expect(committedFiatFigure({ ...EMPTY, amountChf: '5.00' }, 'USD')).toBeNull();
    expect(committedFiatFigure({ ...EMPTY, amountUsd: null }, 'USD')).toBeNull();
    expect(committedFiatFigure(EMPTY, null)).toBeNull();
    expect(committedFiatFigure(EMPTY)).toBeNull();
  });

  it('returns null for an incomplete object instead of an undefined pair', () => {
    expect(committedFiatFigure({} as StoredFiat)).toBeNull();
    expect(committedFiatFigure({ ...EMPTY, amountCurrency: 'USD' }, 'USD')).toBeNull();
  });
});
