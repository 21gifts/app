'use client';

import type { ReactElement } from 'react';
import { useTranslations } from '@/components/LocaleProvider';

/** Which shops body is on screen. */
export type ShopsView = 'post' | 'map' | 'table';

/** Props for the shops view pill. */
export interface ShopsViewSwitchProps {
  /** Selected view. */
  value: ShopsView;
  /** Switch the shops body. */
  onChange: (value: ShopsView) => void;
}

const VIEWS: readonly ShopsView[] = ['post', 'map', 'table'];

/**
 * Post / Map / Table pill under the shops lead.
 *
 * @param props - Selected view and change handler.
 * @returns The tab list.
 */
export function ShopsViewSwitch({ value, onChange }: ShopsViewSwitchProps): ReactElement {
  const { t } = useTranslations();
  const label: Record<ShopsView, string> = {
    post: t('shops.viewPost'),
    map: t('shops.viewMap'),
    table: t('shops.viewTable'),
  };

  return (
    <div
      role="tablist"
      aria-label={t('shops.viewLabel')}
      className="mx-auto mt-4 flex w-fit gap-1 rounded-full border border-app-border bg-app-card-muted p-1"
    >
      {VIEWS.map((view) => {
        const selected = view === value;
        return (
          <button
            key={view}
            type="button"
            role="tab"
            aria-selected={selected}
            className={`rounded-full px-4 py-1.5 text-sm ${
              selected ? 'bg-app-fg text-app-bg' : 'text-app-fg'
            }`}
            onClick={() => {
              onChange(view);
            }}
          >
            {label[view]}
          </button>
        );
      })}
    </div>
  );
}
