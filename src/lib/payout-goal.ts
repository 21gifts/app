import type { GiftStats } from '@/lib/api-types';

/** Daily official-payout target shown on the staff hub. */
export const PAYOUT_GOAL = 100;

/** How many UTC days the expanded chart covers, ending today. */
export const CHART_DAYS = 30;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * UTC calendar day `YYYY-MM-DD` for an instant.
 *
 * @param ms - Epoch milliseconds.
 * @returns UTC day string.
 */
export function utcDayFromMs(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/**
 * UTC calendar day immediately before `day`.
 *
 * @param day - UTC `YYYY-MM-DD`.
 * @returns Previous UTC day.
 */
export function previousUtcDay(day: string): string {
  return utcDayFromMs(Date.parse(`${day}T00:00:00.000Z`) - MS_PER_DAY);
}

/**
 * Person count on `yesterday` from `officialCount`. First matching day wins.
 * A missing day is 0. Any omitted `officialCount` is unusable (`null`).
 *
 * @param series - `spendOverTime` oldest-first.
 * @param yesterday - UTC day to look up.
 * @returns Person count, 0 when the day is missing, or `null` when any point
 *   omits `officialCount`.
 */
export function countOnDay(series: GiftStats['spendOverTime'], yesterday: string): number | null {
  let first: number | undefined;
  for (const point of series) {
    if (point.officialCount === undefined) {
      return null;
    }
    if (first === undefined && point.day === yesterday) {
      first = point.officialCount;
    }
  }
  return first === undefined ? 0 : first;
}

/**
 * Last `CHART_DAYS` UTC days ending on `today`, with person counts from `series`.
 *
 * Last write wins when a day appears twice. Days without a point stay 0.
 *
 * @param series - `spendOverTime` oldest-first.
 * @param today - UTC day of the clock.
 * @returns Oldest-first `{ day, count }` rows.
 */
export function chartRows(
  series: GiftStats['spendOverTime'],
  today: string,
): { day: string; count: number }[] {
  const byDay = new Map<string, number>();
  for (const point of series) {
    byDay.set(point.day, point.officialCount as number);
  }
  const todayMs = Date.parse(`${today}T00:00:00.000Z`);
  const rows: { day: string; count: number }[] = [];
  for (let i = CHART_DAYS - 1; i >= 0; i -= 1) {
    const day = utcDayFromMs(todayMs - i * MS_PER_DAY);
    rows.push({ day, count: byDay.get(day) ?? 0 });
  }
  return rows;
}

/**
 * Formats a UTC calendar day for the explanation sentence.
 *
 * @param day - UTC `YYYY-MM-DD`.
 * @param locale - Active UI locale.
 * @returns Locale date in the UTC zone.
 */
export function formatUtcDate(day: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  }).format(new Date(`${day}T00:00:00.000Z`));
}

/**
 * Axis tick label for a UTC day (`D.MM.`).
 *
 * @param day - UTC `YYYY-MM-DD`.
 * @returns Short day-month label.
 */
export function chartDayLabel(day: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${day}T00:00:00.000Z`));
}
