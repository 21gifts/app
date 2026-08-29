import type { GiftStats } from '@/lib/api-types';

/** Money unit for the profile activity chart. */
export type ActivityScale = 'sat' | 'usd';

/** One aligned UTC day on the dual Given/Received series. */
export interface ActivityPoint {
  /** Calendar day `YYYY-MM-DD`. */
  day: string;
  /** Cumulative given sats through this day. */
  cumulativeDonatedSats: number;
  /** Cumulative received sats through this day. */
  cumulativeReceivedSats: number;
  /** Cumulative given USD through this day (parsed from `cumulativeUsd`). */
  cumulativeDonatedUsd: number;
  /** Cumulative received USD through this day. */
  cumulativeReceivedUsd: number;
}

/**
 * Align receive + donate series onto one UTC-day axis.
 *
 * v1 profile passes `donated=[]` and `received=spendOverTime` from filtered stats.
 * Empty donated → donated cumulatives are 0 on every received day (same days, no fake
 * extra calendar). Empty received and empty donated → `[]`. When donated is later
 * non-empty, days are the sorted union; cumulatives step-hold on gap days (a day
 * present in only one series contributes 0 that day to the other; cumulative carries
 * forward).
 *
 * @param received - Cumulative receive series (`spendOverTime`).
 * @param donated - Cumulative give series (`spendOverTime`), often empty in v1.
 * @returns Aligned points sorted by day, or `[]` when both inputs are empty.
 */
export function alignActivitySeries(
  received: GiftStats['spendOverTime'],
  donated: GiftStats['spendOverTime'],
): ActivityPoint[] {
  if (received.length === 0 && donated.length === 0) {
    return [];
  }
  const receivedByDay = new Map(received.map((point) => [point.day, point]));
  const donatedByDay = new Map(donated.map((point) => [point.day, point]));
  const days = [...new Set([...receivedByDay.keys(), ...donatedByDay.keys()])].sort();

  let cumulativeDonatedSats = 0;
  let cumulativeReceivedSats = 0;
  let cumulativeDonatedUsd = 0;
  let cumulativeReceivedUsd = 0;

  return days.map((day) => {
    const donatedPoint = donatedByDay.get(day);
    const receivedPoint = receivedByDay.get(day);
    if (donatedPoint !== undefined) {
      cumulativeDonatedSats = donatedPoint.cumulativeSats;
      cumulativeDonatedUsd = Number(donatedPoint.cumulativeUsd);
    }
    if (receivedPoint !== undefined) {
      cumulativeReceivedSats = receivedPoint.cumulativeSats;
      cumulativeReceivedUsd = Number(receivedPoint.cumulativeUsd);
    }
    return {
      day,
      cumulativeDonatedSats,
      cumulativeReceivedSats,
      cumulativeDonatedUsd,
      cumulativeReceivedUsd,
    };
  });
}

/**
 * Numeric chart value for one series at one aligned point.
 *
 * @param point - Aligned activity point.
 * @param series - Which cumulative series to read.
 * @param scale - Sat or USD axis.
 * @returns The cumulative value for that series and scale.
 */
export function activityValue(
  point: ActivityPoint,
  series: 'donated' | 'received',
  scale: ActivityScale,
): number {
  if (scale === 'sat') {
    return series === 'donated' ? point.cumulativeDonatedSats : point.cumulativeReceivedSats;
  }
  return series === 'donated' ? point.cumulativeDonatedUsd : point.cumulativeReceivedUsd;
}

/**
 * Y max used for scale: max of both series, or `1` when all zeros (or empty).
 *
 * @param points - Aligned activity points.
 * @param scale - Sat or USD axis.
 * @returns Positive max used to place polylines.
 */
export function activityMaxY(points: ActivityPoint[], scale: ActivityScale): number {
  if (points.length === 0) {
    return 1;
  }
  let max = 0;
  for (const point of points) {
    max = Math.max(
      max,
      activityValue(point, 'donated', scale),
      activityValue(point, 'received', scale),
    );
  }
  return max === 0 ? 1 : max;
}
