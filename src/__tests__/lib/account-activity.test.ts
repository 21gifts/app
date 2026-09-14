// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  activityMaxY,
  activityValue,
  alignActivitySeries,
  type ActivityPoint,
} from '@/lib/account-activity';
import type { AccountActivity } from '@/lib/api-types';

type SpendPoint = AccountActivity['receivedOverTime'][number];

function fiatFromUsd(usd: string): { chf: string; eur: string; php: string } {
  switch (usd) {
    case '0.00':
      return { chf: '0.00', eur: '0.00', php: '0.00' };
    case '0.02':
      return { chf: '0.02', eur: '0.02', php: '1.00' };
    case '0.04':
      return { chf: '0.03', eur: '0.04', php: '2.20' };
    case '0.05':
      return { chf: '0.04', eur: '0.05', php: '2.80' };
    case '0.10':
      return { chf: '0.08', eur: '0.09', php: '5.60' };
    case '0.20':
      return { chf: '0.17', eur: '0.18', php: '11.20' };
    case '0.30':
      return { chf: '0.25', eur: '0.27', php: '16.80' };
    case '0.48':
      return { chf: '0.40', eur: '0.44', php: '27.00' };
    case '1.43':
      return { chf: '1.20', eur: '1.30', php: '80.00' };
    default:
      return { chf: usd, eur: usd, php: usd };
  }
}

function day(day: string, cumulativeSats: number, cumulativeUsd: string, sats = 0): SpendPoint {
  const cumulative = fiatFromUsd(cumulativeUsd);
  return {
    day,
    sats,
    cumulativeSats,
    btc: '0.00000000',
    cumulativeBtc: '0.00000000',
    usd: '0.00',
    cumulativeUsd,
    chf: '0.00',
    eur: '0.00',
    php: '0.00',
    cumulativeChf: cumulative.chf,
    cumulativeEur: cumulative.eur,
    cumulativePhp: cumulative.php,
  };
}

const ZERO_FIAT = {
  cumulativeDonatedChf: 0,
  cumulativeReceivedChf: 0,
  cumulativeDonatedEur: 0,
  cumulativeReceivedEur: 0,
  cumulativeDonatedPhp: 0,
  cumulativeReceivedPhp: 0,
} as const;

describe('alignActivitySeries', () => {
  it('returns empty when both series are empty', () => {
    expect(alignActivitySeries([], [])).toEqual([]);
  });

  it('zeros donated cumulatives on received days only', () => {
    const received = [
      day('2026-06-01', 500, '0.48', 500),
      day('2026-06-02', 500, '0.48', 0),
      day('2026-06-03', 1500, '1.43', 1000),
    ];
    expect(alignActivitySeries(received, [])).toEqual([
      {
        day: '2026-06-01',
        cumulativeDonatedSats: 0,
        cumulativeReceivedSats: 500,
        cumulativeDonatedUsd: 0,
        cumulativeReceivedUsd: 0.48,
        cumulativeDonatedChf: 0,
        cumulativeReceivedChf: 0.4,
        cumulativeDonatedEur: 0,
        cumulativeReceivedEur: 0.44,
        cumulativeDonatedPhp: 0,
        cumulativeReceivedPhp: 27,
      },
      {
        day: '2026-06-02',
        cumulativeDonatedSats: 0,
        cumulativeReceivedSats: 500,
        cumulativeDonatedUsd: 0,
        cumulativeReceivedUsd: 0.48,
        cumulativeDonatedChf: 0,
        cumulativeReceivedChf: 0.4,
        cumulativeDonatedEur: 0,
        cumulativeReceivedEur: 0.44,
        cumulativeDonatedPhp: 0,
        cumulativeReceivedPhp: 27,
      },
      {
        day: '2026-06-03',
        cumulativeDonatedSats: 0,
        cumulativeReceivedSats: 1500,
        cumulativeDonatedUsd: 0,
        cumulativeReceivedUsd: 1.43,
        cumulativeDonatedChf: 0,
        cumulativeReceivedChf: 1.2,
        cumulativeDonatedEur: 0,
        cumulativeReceivedEur: 1.3,
        cumulativeDonatedPhp: 0,
        cumulativeReceivedPhp: 80,
      },
    ]);
  });

  it('zeros received cumulatives when only donated is present', () => {
    const donated = [day('2026-06-01', 21, '0.02', 21)];
    expect(alignActivitySeries([], donated)).toEqual([
      {
        day: '2026-06-01',
        cumulativeDonatedSats: 21,
        cumulativeReceivedSats: 0,
        cumulativeDonatedUsd: 0.02,
        cumulativeReceivedUsd: 0,
        cumulativeDonatedChf: 0.02,
        cumulativeReceivedChf: 0,
        cumulativeDonatedEur: 0.02,
        cumulativeReceivedEur: 0,
        cumulativeDonatedPhp: 1,
        cumulativeReceivedPhp: 0,
      },
    ]);
  });

  it('merges overlapping days from both series', () => {
    const received = [day('2026-06-01', 100, '0.10', 100), day('2026-06-02', 200, '0.20', 100)];
    const donated = [day('2026-06-01', 50, '0.05', 50), day('2026-06-02', 50, '0.05', 0)];
    expect(alignActivitySeries(received, donated)).toEqual([
      {
        day: '2026-06-01',
        cumulativeDonatedSats: 50,
        cumulativeReceivedSats: 100,
        cumulativeDonatedUsd: 0.05,
        cumulativeReceivedUsd: 0.1,
        cumulativeDonatedChf: 0.04,
        cumulativeReceivedChf: 0.08,
        cumulativeDonatedEur: 0.05,
        cumulativeReceivedEur: 0.09,
        cumulativeDonatedPhp: 2.8,
        cumulativeReceivedPhp: 5.6,
      },
      {
        day: '2026-06-02',
        cumulativeDonatedSats: 50,
        cumulativeReceivedSats: 200,
        cumulativeDonatedUsd: 0.05,
        cumulativeReceivedUsd: 0.2,
        cumulativeDonatedChf: 0.04,
        cumulativeReceivedChf: 0.17,
        cumulativeDonatedEur: 0.05,
        cumulativeReceivedEur: 0.18,
        cumulativeDonatedPhp: 2.8,
        cumulativeReceivedPhp: 11.2,
      },
    ]);
  });

  it('unions disjoint ranges and carries cumulatives forward', () => {
    const received = [day('2026-06-01', 100, '0.10', 100), day('2026-06-03', 300, '0.30', 200)];
    const donated = [day('2026-06-02', 40, '0.04', 40)];
    expect(alignActivitySeries(received, donated)).toEqual([
      {
        day: '2026-06-01',
        cumulativeDonatedSats: 0,
        cumulativeReceivedSats: 100,
        cumulativeDonatedUsd: 0,
        cumulativeReceivedUsd: 0.1,
        cumulativeDonatedChf: 0,
        cumulativeReceivedChf: 0.08,
        cumulativeDonatedEur: 0,
        cumulativeReceivedEur: 0.09,
        cumulativeDonatedPhp: 0,
        cumulativeReceivedPhp: 5.6,
      },
      {
        day: '2026-06-02',
        cumulativeDonatedSats: 40,
        cumulativeReceivedSats: 100,
        cumulativeDonatedUsd: 0.04,
        cumulativeReceivedUsd: 0.1,
        cumulativeDonatedChf: 0.03,
        cumulativeReceivedChf: 0.08,
        cumulativeDonatedEur: 0.04,
        cumulativeReceivedEur: 0.09,
        cumulativeDonatedPhp: 2.2,
        cumulativeReceivedPhp: 5.6,
      },
      {
        day: '2026-06-03',
        cumulativeDonatedSats: 40,
        cumulativeReceivedSats: 300,
        cumulativeDonatedUsd: 0.04,
        cumulativeReceivedUsd: 0.3,
        cumulativeDonatedChf: 0.03,
        cumulativeReceivedChf: 0.25,
        cumulativeDonatedEur: 0.04,
        cumulativeReceivedEur: 0.27,
        cumulativeDonatedPhp: 2.2,
        cumulativeReceivedPhp: 16.8,
      },
    ]);
  });
});

describe('activityMaxY', () => {
  it('returns 1 when empty or all zeros', () => {
    expect(activityMaxY([], 'sat')).toBe(1);
    const zeros: ActivityPoint[] = [
      {
        day: '2026-06-01',
        cumulativeDonatedSats: 0,
        cumulativeReceivedSats: 0,
        cumulativeDonatedUsd: 0,
        cumulativeReceivedUsd: 0,
        ...ZERO_FIAT,
      },
    ];
    expect(activityMaxY(zeros, 'sat')).toBe(1);
    expect(activityMaxY(zeros, 'fiat', 'USD')).toBe(1);
  });

  it('returns the max of both series', () => {
    const points: ActivityPoint[] = [
      {
        day: '2026-06-01',
        cumulativeDonatedSats: 100,
        cumulativeReceivedSats: 500,
        cumulativeDonatedUsd: 0.1,
        cumulativeReceivedUsd: 0.5,
        ...ZERO_FIAT,
      },
    ];
    expect(activityMaxY(points, 'sat')).toBe(500);
    expect(activityMaxY(points, 'fiat', 'USD')).toBe(0.5);
  });
});

describe('activityValue', () => {
  const point: ActivityPoint = {
    day: '2026-06-01',
    cumulativeDonatedSats: 10,
    cumulativeReceivedSats: 20,
    cumulativeDonatedUsd: 1.5,
    cumulativeReceivedUsd: 2.5,
    ...ZERO_FIAT,
  };

  it('reads sat and fiat cumulatives per series', () => {
    expect(activityValue(point, 'donated', 'sat')).toBe(10);
    expect(activityValue(point, 'received', 'sat')).toBe(20);
    expect(activityValue(point, 'donated', 'fiat', 'USD')).toBe(1.5);
    expect(activityValue(point, 'received', 'fiat', 'USD')).toBe(2.5);
    expect(activityValue(point, 'received', 'fiat')).toBe(2.5);
  });

  it('reads CHF from a received-only helper day', () => {
    const aligned = alignActivitySeries([day('2026-06-01', 500, '0.48', 500)], []);
    const first = aligned[0];
    expect(first && activityValue(first, 'received', 'fiat', 'CHF')).toBe(0.4);
    expect(first && activityValue(first, 'donated', 'fiat', 'CHF')).toBe(0);
    expect(first && activityValue(first, 'received', 'fiat', 'EUR')).toBe(0.44);
    expect(first && activityValue(first, 'received', 'fiat', 'PHP')).toBe(27);
    expect(first && activityMaxY(aligned, 'fiat', 'EUR')).toBe(0.44);
    expect(first && activityMaxY(aligned, 'fiat', 'PHP')).toBe(27);
  });

  it('maps a null CHF cumulative to 0 after align', () => {
    const received: SpendPoint[] = [
      { ...day('2026-06-01', 500, '0.48', 500), cumulativeChf: null },
    ];
    const aligned = alignActivitySeries(received, []);
    const first = aligned[0];
    expect(first?.cumulativeReceivedChf).toBe(0);
    expect(first && activityValue(first, 'received', 'fiat', 'CHF')).toBe(0);
  });
});
