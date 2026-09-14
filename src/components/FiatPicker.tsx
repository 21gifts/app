import type { ReactElement } from 'react';
import { SegmentedControl } from '@/components/ui';
import { FIAT_CODES, type FiatCode } from '@/lib/stats-money';

const OPTIONS = FIAT_CODES.map((code) => ({ value: code, label: code }));

/** Props for {@link FiatPicker}. */
export interface FiatPickerProps {
  /** Selected fiat. */
  value: FiatCode;
  /** Called when the visitor picks another code. */
  onChange: (value: FiatCode) => void;
  /** Defaults to `'dark'` (stats). Profile passes `'app'`. */
  shell?: 'app' | 'dark';
  /** Defaults to `'Fiat currency'` (stats English). Profile passes `t('profile.fiatCurrency')`. */
  ariaLabel?: string;
}

/**
 * Four-way CHF | EUR | USD | PHP control (no ₿).
 *
 * Stats keep the marketing-dark shell and English aria. Profile passes
 * `shell="app"` and a catalog `ariaLabel`.
 *
 * @param props - Selected code, change handler, optional shell and aria label.
 * @returns Segmented control labelled from `ariaLabel`.
 */
export function FiatPicker({
  value,
  onChange,
  shell = 'dark',
  ariaLabel = 'Fiat currency',
}: FiatPickerProps): ReactElement {
  return (
    <SegmentedControl
      value={value}
      options={OPTIONS}
      onChange={onChange}
      ariaLabel={ariaLabel}
      tone="gift"
      shell={shell}
    />
  );
}
