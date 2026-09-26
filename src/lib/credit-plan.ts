/** Longest stored credit term. Ten years of days. */
export const CREDIT_TERM_MAX_DAYS = 3650;

/** Preset terms: 30 days, one year, two years, or a typed day count. */
export type CreditTermPreset = 30 | 365 | 730 | 'custom';

/** Whole-unit split of a credit across its days. */
export type CreditPlanSplit = {
  perDay: bigint;
  last: bigint;
  days: number;
  remainder: bigint;
};

/**
 * Days for a preset, or a custom whole number from 1 to {@link CREDIT_TERM_MAX_DAYS}.
 *
 * @param preset - Selected term.
 * @param custom - Raw custom field. Ignored unless `preset` is `custom`.
 * @returns The day count, or `null` when custom is not a usable integer.
 */
export function parseCreditTermDays(preset: CreditTermPreset, custom: string): number | null {
  if (preset === 30 || preset === 365 || preset === 730) {
    return preset;
  }
  if (!/^\d+$/.test(custom)) {
    return null;
  }
  const days = Number(custom);
  if (!Number.isInteger(days) || days < 1 || days > CREDIT_TERM_MAX_DAYS) {
    return null;
  }
  return days;
}

/**
 * Smallest units of a typed ask. Bitcoin is whole sats. Fiat is cents.
 *
 * @param amount - Draft from the amount field.
 * @param bitcoin - True when the draft is sats.
 * @returns Units, or `null` when the draft is not that shape.
 */
export function creditSmallestUnits(amount: string, bitcoin: boolean): bigint | null {
  const trimmed = amount.trim();
  if (bitcoin) {
    if (!/^\d+$/.test(trimmed)) {
      return null;
    }
    return BigInt(trimmed);
  }
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) {
    return null;
  }
  const parts = trimmed.split('.');
  const whole = parts[0] as string;
  const frac = parts[1] ?? '';
  return BigInt(whole) * 100n + BigInt(frac.padEnd(2, '0'));
}

/**
 * Split a total into equal daily units. The last day keeps any remainder
 * so the days add back to the total.
 *
 * @param total - Sats or cents, never negative.
 * @param days - Whole days from 1 to {@link CREDIT_TERM_MAX_DAYS}.
 * @returns The split, or `null` when `days` is outside that range.
 */
export function splitCreditPlan(total: bigint, days: number): CreditPlanSplit | null {
  if (total < 0n || !Number.isInteger(days) || days < 1 || days > CREDIT_TERM_MAX_DAYS) {
    return null;
  }
  const span = BigInt(days);
  const perDay = total / span;
  const remainder = total % span;
  return { perDay, last: perDay + remainder, days, remainder };
}
