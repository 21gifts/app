'use client';

import type { ReactElement } from 'react';
import { useTranslations } from '@/components/LocaleProvider';
import { SegmentedControl } from '@/components/ui';

/** Which shops body is on screen. */
export type ShopsView = 'list' | 'post' | 'map' | 'table';

/** Props for the shops view pill. */
export interface ShopsViewSwitchProps {
  /** Selected view. */
  value: ShopsView;
  /** Switch the shops body. */
  onChange: (value: ShopsView) => void;
}

const VIEWS: readonly ShopsView[] = ['list', 'map', 'table', 'post'];

/**
 * List / Map / Table / Post pill under the shops lead.
 *
 * @param props - Selected view and change handler.
 * @returns The view switch.
 */
export function ShopsViewSwitch({ value, onChange }: ShopsViewSwitchProps): ReactElement {
  const { t } = useTranslations();
  const label: Record<ShopsView, string> = {
    list: t('shops.viewList'),
    post: t('shops.viewPost'),
    map: t('shops.viewMap'),
    table: t('shops.viewTable'),
  };

  return (
    <SegmentedControl
      value={value}
      options={VIEWS.map((view) => ({ value: view, label: label[view] }))}
      onChange={onChange}
      ariaLabel={t('shops.viewLabel')}
      tone="neutral"
      className="mt-4"
    />
  );
}
