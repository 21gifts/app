/** Supported visitor number-format styles (Swiss, US, German). */
export const NUMBER_FORMATS = ['ch', 'us', 'de'] as const;

/** A supported number-format style. */
export type NumberFormatStyle = (typeof NUMBER_FORMATS)[number];

/** Default when the cookie is absent or invalid. 21.gifts is Swiss. */
export const DEFAULT_NUMBER_FORMAT: NumberFormatStyle = 'ch';

/** Cookie name written only when the visitor picks a format in the switcher. */
export const NUMBER_FORMAT_COOKIE = 'numberFormat';

/** Grouping and decimal separators for one {@link NumberFormatStyle}. */
export interface NumberFormatSeparators {
  /** Thousands grouping character (`'` / `,` / `.`). */
  grouping: string;
  /** Decimal separator (`.` / `,`). */
  decimal: string;
}

/**
 * Returns `value` if it is exactly one of {@link NUMBER_FORMATS}; otherwise
 * {@link DEFAULT_NUMBER_FORMAT}. Case-sensitive; `'CH'` and `'de-CH'` are
 * invalid.
 *
 * @param value - Raw cookie or option value, or undefined when absent.
 * @returns A supported number-format style.
 */
export function parseNumberFormat(value: string | undefined): NumberFormatStyle {
  if (value === undefined) {
    return DEFAULT_NUMBER_FORMAT;
  }
  for (const style of NUMBER_FORMATS) {
    if (style === value) {
      return style;
    }
  }
  return DEFAULT_NUMBER_FORMAT;
}

/**
 * Separators used to group integers and emit a decimal part.
 *
 * @param style - Number-format style.
 * @returns Grouping and decimal characters for `style`.
 */
export function separatorsFor(style: NumberFormatStyle): NumberFormatSeparators {
  switch (style) {
    case 'ch':
      return { grouping: "'", decimal: '.' };
    case 'us':
      return { grouping: ',', decimal: '.' };
    case 'de':
      return { grouping: '.', decimal: ',' };
  }
}

/**
 * Groups the integer part of `value` in threes from the right and emits
 * `fractionDigits` decimal digits using {@link separatorsFor}. Non-finite
 * values are treated as 0. Rounding uses `Math.round` at `fractionDigits`.
 *
 * @param value - Number to format.
 * @param style - Grouping and decimal style.
 * @param fractionDigits - Decimal digits to emit (`0` omits the decimal part).
 * @returns Grouped numeric string without a currency or ₿ prefix.
 */
export function formatGroupedNumber(
  value: number,
  style: NumberFormatStyle,
  fractionDigits: number,
): string {
  const finite = Number.isFinite(value) ? value : 0;
  const negative = finite < 0;
  const abs = Math.abs(finite);
  const factor = 10 ** fractionDigits;
  const rounded = Math.round(abs * factor);
  const intValue = fractionDigits === 0 ? rounded : Math.floor(rounded / factor);
  const fracValue = fractionDigits === 0 ? 0 : rounded % factor;
  const { grouping, decimal } = separatorsFor(style);
  const intDigits = String(intValue);
  const parts: string[] = [];
  let remaining = intDigits;
  while (remaining.length > 3) {
    parts.unshift(remaining.slice(-3));
    remaining = remaining.slice(0, -3);
  }
  parts.unshift(remaining);
  let result = parts.join(grouping);
  if (fractionDigits > 0) {
    result += decimal + String(fracValue).padStart(fractionDigits, '0');
  }
  return negative ? `-${result}` : result;
}
