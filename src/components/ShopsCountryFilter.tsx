'use client';

import { useEffect, useState, type ReactElement } from 'react';
import { ForumModeSelect } from '@/components/ForumModeSelect';
import { useTranslations } from '@/components/LocaleProvider';
import { fetchPlaces } from '@/lib/api';
import type { ForumPlaceRow } from '@/lib/api-types';
import { shopCountryOptions } from '@/lib/shop-country';
import { useAuthStore } from '@/stores/auth-store';

/** Option value of All countries; a country is always two upper-case letters. */
const ALL = 'all';

/** Props for the Shops country filter. */
export interface ShopsCountryFilterProps {
  /** Selected ISO 3166-1 alpha-2 code, or null for All countries. */
  value: string | null;
  /** Choose a country, or null for All countries. */
  onChange: (value: string | null) => void;
}

/**
 * Country filter above the Post / Map / Table pill on `/shops`.
 *
 * Loads the pins once (`GET /forum/messages/places`) and offers All countries
 * plus every country that has a shop, each with its name in the UI language
 * and its shop count, sorted by name. While the pins load, or when they
 * cannot be loaded, the selected country is still listed, without a count.
 * Reuses {@link ForumModeSelect}, the closed full-width select of the forum.
 *
 * @param props - Selected code and change handler.
 * @returns The select, or null without a session.
 */
export function ShopsCountryFilter({
  value,
  onChange,
}: ShopsCountryFilterProps): ReactElement | null {
  const session = useAuthStore((state) => state.session);
  const { t, locale } = useTranslations();
  const [places, setPlaces] = useState<ForumPlaceRow[] | null>(null);

  useEffect(() => {
    if (session === null) {
      return;
    }
    let cancelled = false;
    void fetchPlaces(session)
      .then((rows) => {
        if (!cancelled) {
          setPlaces(rows);
        }
      })
      .catch(() => {
        /* The lists below show their own error; the filter keeps its choice. */
      });
    return () => {
      cancelled = true;
    };
  }, [session]);

  if (session === null) {
    return null;
  }

  const options = [
    { value: ALL, label: t('shops.countryAll') },
    ...shopCountryOptions(places, locale, value).map((option) => ({
      value: option.code,
      label:
        option.count === null
          ? option.name
          : t('shops.countryOption', { name: option.name, count: option.count }),
    })),
  ];

  return (
    <div className="mt-4 w-full">
      <ForumModeSelect
        value={value ?? ALL}
        options={options}
        onChange={(next) => {
          onChange(next === ALL ? null : next);
        }}
        ariaLabel={t('shops.countryLabel')}
      />
    </div>
  );
}
