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
  /** Defaults to `'dark'`. Profile passes `'app'`. */
  shell?: 'app' | 'dark';
  /** Required. Profile and the activity chart pass `t('profile.fiatCurrency')`. */
  ariaLabel: string;
}

/**
 * Four-way CHF | EUR | USD | PHP control (no ₿).
 *
 * Production mounts: Profile `FiatPreferenceSwitcher` and
 * {@link AccountActivityChart} (`shell="app"`), plus StatsDashboard and
 * DayLoader (marketing `dark`). Forum and the pay sheet do not mount it.
 *
 * @param props - Selected code, change handler, optional shell and required aria label.
 * @returns Segmented control labelled from `ariaLabel`.
 */
export function FiatPicker({
  value,
  onChange,
  shell = 'dark',
  ariaLabel,
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
