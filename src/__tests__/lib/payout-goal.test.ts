import { describe, expect, it } from 'vitest';
import type { GiftStats } from '@/lib/api-types';
import {
  utcDayFromMs,
  previousUtcDay,
  countOnDay,
  chartRows,
  formatUtcDate,
  chartDayLabel,
} from '@/lib/payout-goal';

function spendDay(day: string, officialCount?: number): GiftStats['spendOverTime'][number] {
  return {
    day,
    giftCount: 1,
    ...(officialCount !== undefined ? { officialCount } : {}),
    sats: 10,
    cumulativeSats: 10,
    btc: '0.00000010',
    cumulativeBtc: '0.00000010',
    usd: '0.01',
    cumulativeUsd: '0.01',
    chf: '0.01',
    eur: '0.01',
    php: '0.50',
    cumulativeChf: '0.01',
    cumulativeEur: '0.01',
    cumulativePhp: '0.50',
  };
}

describe('utcDayFromMs', () => {
  it('returns the UTC calendar day of a known noon', () => {
    expect(utcDayFromMs(Date.parse('2026-09-20T12:00:00.000Z'))).toBe('2026-09-20');
  });
});

describe('previousUtcDay', () => {
  it('returns the UTC day before 2026-09-20', () => {
    expect(previousUtcDay('2026-09-20')).toBe('2026-09-19');
  });
});

describe('countOnDay', () => {
  it('returns officialCount for a matching day', () => {
    expect(countOnDay([spendDay('2026-09-20', 12)], '2026-09-20')).toBe(12);
  });

  it('returns 0 when the day is missing', () => {
    expect(countOnDay([spendDay('2026-09-18', 4)], '2026-09-20')).toBe(0);
  });

  it('returns null when any point omits officialCount', () => {
    expect(
      countOnDay([spendDay('2026-09-20', 5), spendDay('2026-09-19')], '2026-09-20'),
    ).toBeNull();
  });

  it('keeps the first matching day when the same day appears twice', () => {
    expect(countOnDay([spendDay('2026-09-20', 5), spendDay('2026-09-20', 9)], '2026-09-20')).toBe(
      5,
    );
  });
});

describe('chartRows', () => {
  it('returns 30 oldest-first rows ending today', () => {
    const rows = chartRows([], '2026-09-20');
    expect(rows).toHaveLength(30);
    expect(rows[0]?.day).toBe('2026-08-22');
    expect(rows[29]?.day).toBe('2026-09-20');
    expect(rows.every((row) => row.count === 0)).toBe(true);
  });

  it('fills a missing day with 0 and lets the last write win', () => {
    const rows = chartRows(
      [spendDay('2026-09-19', 1), spendDay('2026-09-19', 7), spendDay('2026-09-20', 3)],
      '2026-09-20',
    );
    expect(rows).toHaveLength(30);
    expect(rows[0]?.day).toBe('2026-08-22');
    expect(rows[0]?.count).toBe(0);
    expect(rows[27]?.day).toBe('2026-09-18');
    expect(rows[27]?.count).toBe(0);
    expect(rows[28]).toEqual({ day: '2026-09-19', count: 7 });
    expect(rows[29]).toEqual({ day: '2026-09-20', count: 3 });
  });
});

describe('formatUtcDate', () => {
  it('returns a non-empty locale string containing the day', () => {
    const label = formatUtcDate('2026-09-19', 'en');
    expect(label.length).toBeGreaterThan(0);
    expect(label).toContain('19');
  });
});

describe('chartDayLabel', () => {
  it('returns a non-empty short axis label containing the day', () => {
    const longLabel = formatUtcDate('2026-09-20', 'en');
    const shortLabel = chartDayLabel('2026-09-20', 'en');
    expect(shortLabel.length).toBeGreaterThan(0);
    expect(shortLabel).toContain('20');
    expect(shortLabel).not.toBe(longLabel);
  });
});
