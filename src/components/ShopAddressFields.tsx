'use client';

import type { InputHTMLAttributes, ReactElement } from 'react';
import { useTranslations } from '@/components/LocaleProvider';
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

type ShopLabeledInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'id' | 'className'> & {
  label: string;
};

const CONTROL_CLASS = [
  'w-full min-h-11 rounded-2xl border border-app-border-strong bg-app-card',
  'px-4 py-2 text-base text-app-fg placeholder:text-app-subtle transition focus-visible:border-app-fg disabled:opacity-50',
].join(' ');

const SELECT_CLASS = [
  'w-full min-h-11 rounded-2xl border border-app-border-strong bg-app-card',
  'px-4 py-2 text-base text-app-fg transition focus-visible:border-app-fg disabled:opacity-50',
].join(' ');

const LABEL_WRAP_CLASS = 'flex flex-col gap-1 text-left text-sm text-app-fg';

function fieldIdFromLabel(label: string): string {
  return `field-${label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')}`;
}

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

/** Sibling `<label htmlFor>` plus input so the accessible name is the label text. */
function ShopLabeledInput(props: ShopLabeledInputProps): ReactElement {
  const { label, ...rest } = props;
  const fieldId = fieldIdFromLabel(label);
  return (
    <div className={LABEL_WRAP_CLASS}>
      <label htmlFor={fieldId}>{label}</label>
      <input id={fieldId} className={CONTROL_CLASS} {...rest} />
    </div>
  );
}

/**
 * Five native fields for a shop pin address. Country is a `<select>` with no
 * default; the first option is **Choose a country**.
 *
 * @param props - Current address (`null` = every field empty), disabled flag,
 * and a change handler that always receives the five draft strings.
 * @returns Labeled street, house number, postal code, city, and country.
 */
export function ShopAddressFields(props: {
  value: ForumPlaceAddress | null;
  disabled: boolean;
  onChange: (next: ForumPlaceAddressDraft) => void;
}): ReactElement {
  const { t, locale } = useTranslations();
  const draft = draftFrom(props.value);
  const options = countryOptions(locale);
  const countryId = 'field-shop-address-country';

  function patch(next: Partial<ForumPlaceAddressDraft>): void {
    props.onChange({ ...draft, ...next });
  }

  return (
    <div data-testid="shop-address-fields" className="flex flex-col gap-3">
      <ShopLabeledInput
        label={t('shops.addressStreet')}
        autoComplete="off"
        value={draft.street}
        disabled={props.disabled}
        onChange={(event) => {
          patch({ street: event.target.value });
        }}
      />
      <ShopLabeledInput
        label={t('shops.addressHouseNumber')}
        autoComplete="off"
        value={draft.houseNumber}
        disabled={props.disabled}
        onChange={(event) => {
          patch({ houseNumber: event.target.value });
        }}
      />
      <ShopLabeledInput
        label={t('shops.addressPostalCode')}
        autoComplete="postal-code"
        value={draft.postalCode}
        disabled={props.disabled}
        onChange={(event) => {
          patch({ postalCode: event.target.value });
        }}
      />
      <ShopLabeledInput
        label={t('shops.addressCity')}
        autoComplete="address-level2"
        value={draft.city}
        disabled={props.disabled}
        onChange={(event) => {
          patch({ city: event.target.value });
        }}
      />
      <div className={LABEL_WRAP_CLASS}>
        <label htmlFor={countryId}>{t('shops.addressCountry')}</label>
        <select
          id={countryId}
          autoComplete="country"
          className={SELECT_CLASS}
          value={draft.country}
          disabled={props.disabled}
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
      </div>
    </div>
  );
}
