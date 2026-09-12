'use client';

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
}

/**
 * Four-way CHF | EUR | USD | PHP control for public stats (no ₿).
 *
 * @param props - Selected code and change handler.
 * @returns Segmented control labelled "Fiat currency".
 */
export function FiatPicker({ value, onChange }: FiatPickerProps): ReactElement {
  return (
    <SegmentedControl
      value={value}
      options={OPTIONS}
      onChange={onChange}
      ariaLabel="Fiat currency"
      tone="gift"
      shell="dark"
    />
  );
}
