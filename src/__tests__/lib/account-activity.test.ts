// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  activityMaxY,
  activityValue,
  alignActivitySeries,
  type ActivityPoint,
} from '@/lib/account-activity';
import type { GiftStats } from '@/lib/api-types';

type SpendPoint = GiftStats['spendOverTime'][number];

function day(day: string, cumulativeSats: number, cumulativeUsd: string, sats = 0): SpendPoint {
  return {
    day,
    sats,
    cumulativeSats,
    btc: '0.00000000',
    cumulativeBtc: '0.00000000',
    usd: '0.00',
    cumulativeUsd,
  };
}

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
      },
      {
        day: '2026-06-02',
        cumulativeDonatedSats: 0,
        cumulativeReceivedSats: 500,
        cumulativeDonatedUsd: 0,
        cumulativeReceivedUsd: 0.48,
      },
      {
        day: '2026-06-03',
        cumulativeDonatedSats: 0,
        cumulativeReceivedSats: 1500,
        cumulativeDonatedUsd: 0,
        cumulativeReceivedUsd: 1.43,
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
      },
      {
        day: '2026-06-02',
        cumulativeDonatedSats: 50,
        cumulativeReceivedSats: 200,
        cumulativeDonatedUsd: 0.05,
        cumulativeReceivedUsd: 0.2,
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
      },
      {
        day: '2026-06-02',
        cumulativeDonatedSats: 40,
        cumulativeReceivedSats: 100,
        cumulativeDonatedUsd: 0.04,
        cumulativeReceivedUsd: 0.1,
      },
      {
        day: '2026-06-03',
        cumulativeDonatedSats: 40,
        cumulativeReceivedSats: 300,
        cumulativeDonatedUsd: 0.04,
        cumulativeReceivedUsd: 0.3,
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
      },
    ];
    expect(activityMaxY(zeros, 'sat')).toBe(1);
    expect(activityMaxY(zeros, 'usd')).toBe(1);
  });

  it('returns the max of both series', () => {
    const points: ActivityPoint[] = [
      {
        day: '2026-06-01',
        cumulativeDonatedSats: 100,
        cumulativeReceivedSats: 500,
        cumulativeDonatedUsd: 0.1,
        cumulativeReceivedUsd: 0.5,
      },
    ];
    expect(activityMaxY(points, 'sat')).toBe(500);
    expect(activityMaxY(points, 'usd')).toBe(0.5);
  });
});

describe('activityValue', () => {
  const point: ActivityPoint = {
    day: '2026-06-01',
    cumulativeDonatedSats: 10,
    cumulativeReceivedSats: 20,
    cumulativeDonatedUsd: 1.5,
    cumulativeReceivedUsd: 2.5,
  };

  it('reads sat and usd cumulatives per series', () => {
    expect(activityValue(point, 'donated', 'sat')).toBe(10);
    expect(activityValue(point, 'received', 'sat')).toBe(20);
    expect(activityValue(point, 'donated', 'usd')).toBe(1.5);
    expect(activityValue(point, 'received', 'usd')).toBe(2.5);
  });
});
