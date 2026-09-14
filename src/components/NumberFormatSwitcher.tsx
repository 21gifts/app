'use client';

import { type ReactElement } from 'react';
import { useTranslations } from '@/components/LocaleProvider';
import { useNumberFormat } from '@/components/NumberFormatProvider';
import { SegmentedControl } from '@/components/ui';
import { NUMBER_FORMATS, formatGroupedNumber, type NumberFormatStyle } from '@/lib/number-format';

/**
 * Sample string shown as the option label (the format itself, not catalog copy).
 *
 * @param style - Number-format style.
 * @returns Grouped sample for that style.
 */
function sampleFor(style: NumberFormatStyle): string {
  switch (style) {
    case 'ch':
      return formatGroupedNumber(10000.23, 'ch', 2);
    case 'us':
      return formatGroupedNumber(10000.23, 'us', 2);
    case 'de':
      return formatGroupedNumber(23000.33, 'de', 2);
  }
}

/**
 * Profile identity-card section: number grouping via SegmentedControl.
 *
 * Always visible on the signed-in Profile card. Not page chrome.
 *
 * @returns The number-format settings section.
 */
export function NumberFormatSwitcher(): ReactElement {
  const { t } = useTranslations();
  const { numberFormat, setNumberFormat } = useNumberFormat();

  return (
    <div className="flex w-full flex-col items-stretch gap-3 border-t border-app-border pt-6">
      <p className="text-center text-xs tracking-widest text-app-subtle uppercase">
        {t('numberFormat.label')}
      </p>
      <SegmentedControl
        tone="neutral"
        value={numberFormat}
        options={NUMBER_FORMATS.map((style) => ({
          value: style,
          label: sampleFor(style),
        }))}
        onChange={setNumberFormat}
        ariaLabel={t('aria.numberFormat')}
      />
    </div>
  );
}
