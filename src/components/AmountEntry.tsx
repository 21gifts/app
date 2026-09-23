'use client';

import { useEffect, useRef, useState, type ReactElement } from 'react';
import { useFiatPreference } from '@/components/FiatPreferenceProvider';
import { useTranslations } from '@/components/LocaleProvider';
import { useNumberFormat } from '@/components/NumberFormatProvider';
import { SegmentedControl } from '@/components/ui';
import { setAmountUnit } from '@/lib/api';
import type { AmountUnit } from '@/lib/api-types';
import {
  fiatDraftForSats,
  formatBitcoin,
  formatFiatDisplay,
  parseAmountDraft,
  satsToFiatAmount,
  type FiatCode,
  type FiatRateDay,
} from '@/lib/stats-money';
import { useAuthStore } from '@/stores/auth-store';

/** Props for {@link AmountEntry}. */
export interface AmountEntryProps {
  /** Input id. Generated from the label when omitted. */
  id?: string;
  /** Visible label and accessible name. */
  label: string;
  /** Draft in the active unit. Ignored while `lockedSats` is set. */
  value: string;
  /** Called with the next draft, including after a unit conversion. */
  onValueChange: (value: string) => void;
  /** Disables the input and refuses a unit change. */
  disabled?: boolean;
  /** Native placeholder. */
  placeholder?: string;
  /** Extra classes on the outer wrapper. */
  className?: string;
  /**
   * When set, the field shows this many sats, is not editable, and the switch
   * is disabled. Used after an invoice is minted.
   */
  lockedSats?: number | null;
  /** Latest gift day for the counter and for conversion. */
  rateDay: FiatRateDay | null;
  /**
   * Unit the current `value` is written in, when that differs from the
   * account. The field keeps showing this unit until conversion succeeds.
   */
  valueUnit?: AmountUnit;
  /**
   * Fired when this field is actually showing a unit, not when the account
   * changes before the draft can convert. A signed-out pay link stores this
   * because it has no account.
   */
  onUnitChange?: (unit: AmountUnit) => void;
}

const FIAT_DRAFT = /^\d+([.,]\d{0,8})?$/;

/**
 * Converts a draft from one typing unit to the other.
 *
 * @param from - Unit the draft is written in.
 * @param to - Unit to write.
 * @param draft - Current field value.
 * @param day - Gift day, or `null`.
 * @param code - Preferred fiat.
 * @returns The converted draft, or `''` when empty, unparseable, or without a rate.
 */
function convertAmountDraft(
  from: AmountUnit,
  to: AmountUnit,
  draft: string,
  day: FiatRateDay | null,
  code: FiatCode,
): string {
  const parsed = parseAmountDraft(from, draft, day, code);
  if (parsed.kind !== 'sats') {
    return '';
  }
  if (to === 'btc') {
    return String(parsed.sats);
  }
  return fiatDraftForSats(parsed.sats, day, code) ?? '';
}

/**
 * Bitcoin / fiat amount field with the gift switch and the other unit under it.
 *
 * A signed-in unit is `account.amountUnit`; missing means bitcoin. Toggling
 * posts `/me/amount-unit` and writes the account back. With no session the
 * unit stays here, starts at bitcoin, and is not stored.
 *
 * @param props - Label, draft, rate, and optional locked sat amount.
 * @returns The labeled field, switch, and counter.
 */
export function AmountEntry({
  id,
  label,
  value,
  onValueChange,
  disabled = false,
  placeholder,
  className,
  lockedSats = null,
  rateDay,
  valueUnit,
  onUnitChange,
}: AmountEntryProps): ReactElement {
  const { t } = useTranslations();
  const { fiat } = useFiatPreference();
  const { numberFormat } = useNumberFormat();
  const session = useAuthStore((state) => state.session);
  const account = useAuthStore((state) => state.account);
  const setAccount = useAuthStore((state) => state.setAccount);
  const [localUnit, setLocalUnit] = useState<AmountUnit>('btc');
  const storedUnit: AmountUnit = account?.amountUnit ?? 'btc';
  const unit: AmountUnit = session === null ? localUnit : storedUnit;
  const locked = typeof lockedSats === 'number' && Number.isFinite(lockedSats);
  const [shownUnit, setShownUnit] = useState<AmountUnit>(valueUnit ?? unit);
  const applied = useRef(shownUnit);
  const posting = useRef(false);
  const draftRef = useRef(value);
  if (!posting.current) {
    draftRef.current = value;
  }
  const fieldId =
    id ??
    `amount-${label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')}`;

  useEffect(() => {
    if (locked) {
      applied.current = unit;
      setShownUnit(unit);
      onUnitChange?.(unit);
      return;
    }
    if (applied.current === unit) {
      onUnitChange?.(applied.current);
      return;
    }
    const from = applied.current;
    const converted = convertAmountDraft(from, unit, value, rateDay, fiat);
    if (value.trim() !== '' && converted === '') {
      return;
    }
    applied.current = unit;
    setShownUnit(unit);
    onUnitChange?.(unit);
    if (converted !== value) {
      onValueChange(converted);
    }
  }, [fiat, locked, onUnitChange, onValueChange, rateDay, unit, value]);

  const changeUnit = (next: AmountUnit): void => {
    if (disabled || locked || posting.current || next === shownUnit) {
      return;
    }
    const previousDraft = value;
    const previousUnit = shownUnit;
    const converted = convertAmountDraft(previousUnit, next, value, rateDay, fiat);
    if (value.trim() !== '' && converted === '') {
      return;
    }
    draftRef.current = converted;
    applied.current = next;
    setShownUnit(next);
    onUnitChange?.(next);
    if (session === null || account === null) {
      if (session === null) {
        setLocalUnit(next);
      }
      if (converted !== value) {
        onValueChange(converted);
      }
      return;
    }
    const token = session;
    const currentAccount = account;
    posting.current = true;
    setAccount({ ...currentAccount, amountUnit: next });
    if (converted !== value) {
      onValueChange(converted);
    }
    void setAmountUnit(token, next)
      .then((updated) => {
        if (useAuthStore.getState().session !== token) {
          return;
        }
        const current = useAuthStore.getState().account;
        if (current === null) {
          return;
        }
        setAccount({ ...current, amountUnit: updated.amountUnit ?? next });
      })
      .catch(() => {
        if (useAuthStore.getState().session !== token) {
          return;
        }
        applied.current = previousUnit;
        setShownUnit(previousUnit);
        onUnitChange?.(previousUnit);
        const current = useAuthStore.getState().account;
        if (current !== null) {
          setAccount({ ...current, amountUnit: previousUnit });
        }
        const live = draftRef.current;
        const restored =
          live === converted
            ? previousDraft
            : convertAmountDraft(next, previousUnit, live, rateDay, fiat);
        onValueChange(restored === '' && live.trim() !== '' ? live : restored);
      })
      .finally(() => {
        posting.current = false;
      });
  };

  const shown = locked ? String(lockedSats) : value;
  const entryUnit: AmountUnit = locked ? 'btc' : shownUnit;
  const prefix = entryUnit === 'btc' ? '\u20BF' : fiat;
  const shownPlaceholder =
    placeholder !== undefined && entryUnit === 'fiat' && /^\d+$/.test(placeholder)
      ? (fiatDraftForSats(Number(placeholder), rateDay, fiat) ?? undefined)
      : placeholder;
  let counter: string | null = null;
  if (locked) {
    const fiatAmount = satsToFiatAmount(lockedSats, rateDay, fiat);
    counter =
      fiatAmount === null ? t('amount.noRate') : formatFiatDisplay(fiatAmount, fiat, numberFormat);
  } else if (value.trim() !== '') {
    const parsed = parseAmountDraft(entryUnit, value, rateDay, fiat);
    if (entryUnit === 'btc' && parsed.kind === 'sats') {
      const fiatAmount = satsToFiatAmount(parsed.sats, rateDay, fiat);
      counter = fiatAmount === null ? null : formatFiatDisplay(fiatAmount, fiat, numberFormat);
    } else if (entryUnit === 'fiat' && parsed.kind === 'sats') {
      counter = formatBitcoin(parsed.sats, numberFormat);
    } else if (entryUnit === 'fiat' && FIAT_DRAFT.test(value.trim())) {
      counter = t('amount.noRate');
    }
  }
  const extra = className === undefined || className === '' ? '' : ` ${className}`;

  return (
    <div className={`flex flex-col gap-1${extra}`}>
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={fieldId} className="text-sm text-app-fg">
          {label}
        </label>
        <div className={disabled || locked ? 'pointer-events-none opacity-50' : undefined}>
          <SegmentedControl
            tone="gift"
            shell="app"
            value={entryUnit}
            options={[
              { value: 'btc', label: '\u20BF' },
              { value: 'fiat', label: fiat },
            ]}
            onChange={changeUnit}
            ariaLabel={t('amount.unit')}
          />
        </div>
      </div>
      <span className="flex min-h-11 items-center gap-2 rounded-2xl border border-app-border-strong px-4 py-2 text-base">
        <span aria-hidden="true" className="text-app-muted">
          {prefix}
        </span>
        <input
          id={fieldId}
          aria-label={label}
          type="text"
          inputMode={entryUnit === 'btc' ? 'numeric' : 'decimal'}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          placeholder={shownPlaceholder}
          value={shown}
          disabled={disabled || locked}
          onChange={(event) => {
            if (!locked) {
              draftRef.current = event.target.value;
              onValueChange(event.target.value);
            }
          }}
          className="min-w-0 flex-1 bg-transparent text-base text-app-fg outline-none"
        />
      </span>
      {counter !== null ? (
        <p className="text-sm tabular-nums lining-nums text-app-muted">{counter}</p>
      ) : null}
    </div>
  );
}
