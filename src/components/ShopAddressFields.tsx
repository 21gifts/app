'use client';

import { useId, useMemo, type ReactElement } from 'react';
import { useTranslations } from '@/components/LocaleProvider';
import { Field } from '@/components/ui';
import type { ForumPlaceAddress } from '@/lib/api-types';
import { countryOptions } from '@/lib/countries';

/** Draft of the five address fields; values may be partial or empty. */
export type ForumPlaceAddressDraft = {
  street: string;
  houseNumber: string;
  postalCode: string;
  city: string;
  country: string;
};

const SELECT_CLASS = [
  'w-full min-h-11 rounded-2xl border border-app-border-strong bg-app-card',
  'px-4 py-2 text-base text-app-fg transition focus-visible:border-app-fg disabled:opacity-50',
].join(' ');

const LABEL_WRAP_CLASS = 'flex flex-col gap-1 text-left text-sm text-app-fg';

function draftFrom(value: ForumPlaceAddress | null): ForumPlaceAddressDraft {
  if (value === null) {
    return { street: '', houseNumber: '', postalCode: '', city: '', country: '' };
  }
  return {
    street: value.street,
    houseNumber: value.houseNumber,
    postalCode: value.postalCode,
    city: value.city,
    country: value.country,
  };
}

/**
 * Five native fields for a shop pin address. Country is a `<select>` with no
 * default; the first option is **Choose a country**.
 *
 * @param props - Current address (`null` = every field empty), disabled flag,
 * a change handler that always receives the five draft strings, optional
 * visitor-facing `errors` per field, and an optional `onBlur` callback that
 * receives the field that lost focus.
 * @returns Labeled street, house number, postal code, city, and country.
 */
export function ShopAddressFields(props: {
  value: ForumPlaceAddress | null;
  disabled: boolean;
  onChange: (next: ForumPlaceAddressDraft) => void;
  errors?: Partial<Record<keyof ForumPlaceAddressDraft, string>>;
  onBlur?: (field: keyof ForumPlaceAddressDraft) => void;
}): ReactElement {
  const { t, locale } = useTranslations();
  const draft = draftFrom(props.value);
  const options = useMemo(() => countryOptions(locale), [locale]);
  const idPrefix = useId();
  const fieldId = (key: keyof ForumPlaceAddressDraft): string => `${idPrefix}-${key}`;
  const countryId = fieldId('country');

  function patch(next: Partial<ForumPlaceAddressDraft>): void {
    props.onChange({ ...draft, ...next });
  }

  const errorFor = (field: keyof ForumPlaceAddressDraft): string | undefined =>
    props.errors?.[field];
  const errorId = (field: keyof ForumPlaceAddressDraft): string => `${fieldId(field)}-error`;
  // A paired row shows its messages under the whole row, so a long message
  // never squeezes into the narrow house-number or postal-code column.
  const rowFieldProps = (
    field: keyof ForumPlaceAddressDraft,
  ): { 'aria-invalid'?: true; 'aria-describedby'?: string } =>
    errorFor(field) === undefined
      ? {}
      : { 'aria-invalid': true, 'aria-describedby': errorId(field) };
  const rowErrors = (fields: (keyof ForumPlaceAddressDraft)[]): ReactElement | null => {
    const shown = fields.filter((field) => errorFor(field) !== undefined);
    return shown.length === 0 ? null : (
      <div className="flex flex-col gap-1">
        {shown.map((field) => (
          <p key={field} id={errorId(field)} className="text-sm text-app-danger">
            {errorFor(field)}
          </p>
        ))}
      </div>
    );
  };

  return (
    <div data-testid="shop-address-fields" className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <div className="grid grid-cols-[minmax(0,1fr)_7rem] gap-3">
          <Field
            id={fieldId('street')}
            label={t('shops.addressStreet')}
            autoComplete="off"
            value={draft.street}
            disabled={props.disabled}
            {...rowFieldProps('street')}
            onBlur={() => props.onBlur?.('street')}
            onChange={(event) => {
              patch({ street: event.target.value });
            }}
          />
          <Field
            id={fieldId('houseNumber')}
            label={t('shops.addressHouseNumber')}
            autoComplete="off"
            value={draft.houseNumber}
            disabled={props.disabled}
            {...rowFieldProps('houseNumber')}
            onBlur={() => props.onBlur?.('houseNumber')}
            onChange={(event) => {
              patch({ houseNumber: event.target.value });
            }}
          />
        </div>
        {rowErrors(['street', 'houseNumber'])}
      </div>
      <div className="flex flex-col gap-1">
        <div className="grid grid-cols-[7rem_minmax(0,1fr)] gap-3">
          <Field
            id={fieldId('postalCode')}
            label={t('shops.addressPostalCode')}
            autoComplete="postal-code"
            value={draft.postalCode}
            disabled={props.disabled}
            {...rowFieldProps('postalCode')}
            onBlur={() => props.onBlur?.('postalCode')}
            onChange={(event) => {
              patch({ postalCode: event.target.value });
            }}
          />
          <Field
            id={fieldId('city')}
            label={t('shops.addressCity')}
            autoComplete="address-level2"
            value={draft.city}
            disabled={props.disabled}
            {...rowFieldProps('city')}
            onBlur={() => props.onBlur?.('city')}
            onChange={(event) => {
              patch({ city: event.target.value });
            }}
          />
        </div>
        {rowErrors(['postalCode', 'city'])}
      </div>
      <div className={LABEL_WRAP_CLASS}>
        <label htmlFor={countryId}>{t('shops.addressCountry')}</label>
        <select
          id={countryId}
          autoComplete="country"
          className={SELECT_CLASS}
          value={draft.country}
          disabled={props.disabled}
          aria-invalid={errorFor('country') === undefined ? undefined : true}
          aria-describedby={errorFor('country') === undefined ? undefined : errorId('country')}
          onBlur={() => props.onBlur?.('country')}
          onChange={(event) => {
            patch({ country: event.target.value });
          }}
        >
          <option value="">{t('shops.addressCountryChoose')}</option>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {errorFor('country') === undefined ? null : (
          <p id={errorId('country')} className="text-sm text-app-danger">
            {errorFor('country')}
          </p>
        )}
      </div>
    </div>
  );
}
