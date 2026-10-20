import type { ReactElement } from 'react';
import { SegmentedControl, type SegmentedControlTone } from '@/components/ui';
import { FIAT_CODES, type FiatCode } from '@/lib/stats-money';

const OPTIONS = FIAT_CODES.map((code) => ({ value: code, label: code }));

/** Props for {@link FiatPicker}. */
export interface FiatPickerProps {
  /** Selected fiat. */
  value: FiatCode;
  /** Called when the visitor picks another code. */
  onChange: (value: FiatCode) => void;
  /** Defaults to `'dark'`. Settings pass `'app'`. */
  shell?: 'app' | 'dark';
  /** SegmentedControl tone. Default `'gift'` (unsigned stats and day). The Settings Display row passes `'neutral'`. */
  tone?: SegmentedControlTone;
  /** Required. Settings pass `t('profile.fiatCurrency')`. Unsigned stats and day pass `Fiat currency`. */
  ariaLabel: string;
}

/**
 * Four-way CHF | EUR | USD | PHP control (no ₿).
 *
 * Production mounts: the Settings `FiatPreferenceSwitcher` always
 * (`tone="neutral"`); StatsDashboard and DayLoader (marketing `dark`, default
 * `tone="gift"`) only when unsigned (hydration ready and session is null).
 * Profile charts do not mount it.
 * Forum, the public thread (`PublicMessageLoader`), and the pay sheet do not
 * mount it.
 *
 * @param props - Selected code, change handler, optional shell/tone and required aria label.
 * @returns Segmented control labelled from `ariaLabel`.
 */
export function FiatPicker({
  value,
  onChange,
  shell = 'dark',
  tone = 'gift',
  ariaLabel,
}: FiatPickerProps): ReactElement {
  return (
    <SegmentedControl
      value={value}
      options={OPTIONS}
      onChange={onChange}
      ariaLabel={ariaLabel}
      tone={tone}
      shell={shell}
    />
  );
}
