'use client';

import { Delete } from 'lucide-react';
import { useEffect, useRef, useState, type ReactElement } from 'react';
import { useFiatPreference } from '@/components/FiatPreferenceProvider';
import { useTranslations } from '@/components/LocaleProvider';
import { useNumberFormat } from '@/components/NumberFormatProvider';
import { Button, SegmentedControl } from '@/components/ui';
import { setAmountUnit } from '@/lib/api';
import type { AmountUnit } from '@/lib/api-types';
import { separatorsFor } from '@/lib/number-format';
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
  /**
   * `field` stacks the label, switch, and input. `composer` puts the switch
   * beside the input for the inbox. `inline` puts the amount before the
   * switch on one line for a forum reply, so the text row stays full width.
   * `composer` and `inline` keep the label for assistive tech only.
   */
  layout?: 'field' | 'composer' | 'inline';
  /**
   * Till keypad. No text field. Other screens omit this and keep the input.
   */
  keypad?: boolean;
}

/**
 * Next till draft after one keypad or keyboard edit.
 * A lone `0` is replaced by the next digit. A second decimal and a ninth
 * fractional digit do nothing. Delete drops the last character.
 *
 * @param current - Draft shown now.
 * @param key - A digit, `decimal`, or `delete`.
 * @param decimal - Decimal mark from the number format.
 * @returns The next draft.
 */
function nextKeypadDraft(current: string, key: string, decimal: string): string {
  if (key === 'delete') {
    return current.slice(0, -1);
  }
  if (key === 'decimal') {
    if (current.includes('.') || current.includes(',')) {
      return current;
    }
    return `${current}${decimal}`;
  }
  if (current === '0') {
    return key;
  }
  const sep = current.search(/[.,]/);
  if (sep >= 0 && current.length - sep - 1 >= 8) {
    return current;
  }
  return `${current}${key}`;
}

const FIAT_DRAFT = /^\d+([.,]\d{0,8})?$/;

/** Shared across fields so a slower save cannot overwrite a later choice. */
let unitRequest = 0;
let unitRequestOpen = false;
let confirmedRequest = 0;
let savedUnit: AmountUnit = 'btc';
let unitRequestSession: string | null = null;

/**
 * Starts one account-wide amount-unit save.
 * A different session drops the previous burst so its unit cannot leak.
 *
 * @param current - Unit already stored before this click's optimistic update.
 * @param sessionToken - Session that owns this save.
 * @returns Id of this save. Higher ids happened later.
 */
function beginUnitRequest(current: AmountUnit, sessionToken: string): number {
  if (unitRequestSession !== sessionToken) {
    unitRequestSession = sessionToken;
    unitRequestOpen = false;
    savedUnit = current;
  } else if (!unitRequestOpen) {
    savedUnit = current;
  }
  unitRequestOpen = true;
  unitRequest += 1;
  return unitRequest;
}

/**
 * Whether this save is still the latest one.
 *
 * @param request - Id from {@link beginUnitRequest}.
 * @returns True when no newer save has started.
 */
function isLatestUnitRequest(request: number): boolean {
  return request === unitRequest;
}

/**
 * Marks the latest save finished so the next click starts a new burst.
 *
 * @param request - Id from {@link beginUnitRequest}.
 */
function finishUnitRequest(request: number): void {
  if (request === unitRequest) {
    unitRequestOpen = false;
  }
}

/**
 * Records a successful save. A newer success replaces an older one.
 * An older success still counts after a later failure, so the rollback
 * keeps the unit the server already stored.
 *
 * @param request - Id from {@link beginUnitRequest}.
 * @param chosen - Unit the server stored.
 * @returns True when the account should show `chosen` now.
 */
function confirmUnitRequest(request: number, chosen: AmountUnit): boolean {
  if (request <= confirmedRequest) {
    return false;
  }
  confirmedRequest = request;
  savedUnit = chosen;
  const apply = request === unitRequest || !unitRequestOpen;
  finishUnitRequest(request);
  return apply;
}

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
  layout = 'field',
  keypad = false,
}: AmountEntryProps): ReactElement {
  const { t } = useTranslations();
  const { fiat } = useFiatPreference();
  const { numberFormat } = useNumberFormat();
  const decimal = separatorsFor(numberFormat).decimal;
  const session = useAuthStore((state) => state.session);
  const account = useAuthStore((state) => state.account);
  const setAccount = useAuthStore((state) => state.setAccount);
  const [localUnit, setLocalUnit] = useState<AmountUnit>('btc');
  const rateRef = useRef(rateDay);
  rateRef.current = rateDay;
  const fiatRef = useRef(fiat);
  fiatRef.current = fiat;
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

  const draftForUnit = (
    from: AmountUnit,
    to: AmountUnit,
    draft: string,
    day: FiatRateDay | null,
    code: FiatCode,
  ): string => {
    const converted = convertAmountDraft(from, to, draft, day, code);
    if (!keypad || to !== 'fiat' || decimal === '.') {
      return converted;
    }
    return converted.replaceAll('.', decimal);
  };

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
    const converted = draftForUnit(from, unit, value, rateDay, fiat);
    if (value.trim() !== '' && converted === '') {
      return;
    }
    applied.current = unit;
    setShownUnit(unit);
    onUnitChange?.(unit);
    if (converted !== value) {
      onValueChange(converted);
    }
  }, [decimal, fiat, keypad, locked, onUnitChange, onValueChange, rateDay, unit, value]);

  useEffect(() => {
    if (!keypad || disabled || locked) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }
      const target = event.target;
      if (target instanceof HTMLElement) {
        const tag = target.tagName;
        if (
          tag === 'INPUT' ||
          tag === 'TEXTAREA' ||
          tag === 'SELECT' ||
          target.contentEditable === 'true'
        ) {
          return;
        }
      }
      let key: string | null = null;
      if (/^[0-9]$/.test(event.key)) {
        key = event.key;
      } else if (
        event.key === '.' ||
        event.key === ',' ||
        event.key === 'Decimal' ||
        event.code === 'NumpadDecimal'
      ) {
        key = 'decimal';
      } else if (event.key === 'Backspace' || event.key === 'Delete') {
        key = 'delete';
      }
      if (key === null) {
        return;
      }
      event.preventDefault();
      const next = nextKeypadDraft(value, key, decimal);
      if (next === value) {
        return;
      }
      draftRef.current = next;
      onValueChange(next);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [decimal, disabled, keypad, locked, onValueChange, value]);

  const changeUnit = (next: AmountUnit): void => {
    if (disabled || locked || posting.current || next === shownUnit) {
      return;
    }
    const previousDraft = value;
    const previousUnit = shownUnit;
    const converted = draftForUnit(previousUnit, next, value, rateDay, fiat);
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
    const request = beginUnitRequest(currentAccount.amountUnit ?? 'btc', token);
    posting.current = true;
    setAccount({ ...currentAccount, amountUnit: next });
    if (converted !== value) {
      onValueChange(converted);
    }
    void setAmountUnit(token, next)
      .then((updated) => {
        if (useAuthStore.getState().session !== token) {
          finishUnitRequest(request);
          return;
        }
        const chosen = updated.amountUnit ?? next;
        if (!confirmUnitRequest(request, chosen)) {
          return;
        }
        const current = useAuthStore.getState().account;
        if (current === null) {
          return;
        }
        setAccount({ ...current, amountUnit: savedUnit });
      })
      .catch(() => {
        if (useAuthStore.getState().session !== token) {
          finishUnitRequest(request);
          return;
        }
        if (!isLatestUnitRequest(request)) {
          return;
        }
        const rollback = savedUnit;
        finishUnitRequest(request);
        const current = useAuthStore.getState().account;
        if (current !== null) {
          setAccount({ ...current, amountUnit: rollback });
        }
        const live = draftRef.current;
        const restored =
          rollback === previousUnit && live === converted
            ? previousDraft
            : draftForUnit(next, rollback, live, rateRef.current, fiatRef.current);
        const keepTyped = restored === '' && live.trim() !== '';
        applied.current = keepTyped ? next : rollback;
        setShownUnit(keepTyped ? next : rollback);
        onUnitChange?.(keepTyped ? next : rollback);
        if (!keepTyped) {
          onValueChange(restored);
        }
      })
      .finally(() => {
        posting.current = false;
      });
  };

  const shown = locked ? String(lockedSats) : value;
  const entryUnit: AmountUnit = locked ? 'btc' : shownUnit;
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
  const switchClass =
    `${layout === 'inline' ? 'shrink-0' : ''}${disabled || locked ? ' pointer-events-none opacity-50' : ''}`.trim();
  const unitSwitch = (
    <div className={switchClass === '' ? undefined : switchClass}>
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
  );
  const amountClass =
    layout === 'inline'
      ? 'h-12 min-w-0 flex-1 rounded-2xl border border-app-border-strong bg-app-card px-4 text-base tabular-nums lining-nums text-app-fg placeholder:text-app-subtle transition focus-visible:border-app-fg disabled:opacity-50'
      : 'w-full min-h-11 min-w-0 flex-1 rounded-2xl border border-app-border-strong bg-app-card px-4 py-2 text-base tabular-nums lining-nums text-app-fg placeholder:text-app-subtle transition focus-visible:border-app-fg disabled:opacity-50';
  const pushKey = (key: string): void => {
    const next = nextKeypadDraft(shown, key, decimal);
    if (next === shown) {
      return;
    }
    draftRef.current = next;
    onValueChange(next);
  };
  if (keypad) {
    const digits = ['1', '2', '3', '4', '5', '6', '7', '8', '9', decimal, '0'];
    return (
      <div className={`flex flex-col gap-2${extra}`}>
        <div className="flex items-center justify-end gap-2">{unitSwitch}</div>
        <p id={fieldId} aria-label={label} className={`${amountClass} text-center`}>
          {shown === '' ? (placeholder ?? '') : shown}
        </p>
        {counter !== null ? (
          <p className="text-sm tabular-nums lining-nums text-app-muted">{counter}</p>
        ) : null}
        <div className="grid w-full grid-cols-3 gap-2">
          {digits.map((digit) => (
            <Button
              key={digit}
              variant="secondary"
              size="sm"
              type="button"
              className="w-full"
              disabled={disabled || locked}
              aria-label={digit}
              onClick={() => {
                pushKey(digit === decimal ? 'decimal' : digit);
              }}
            >
              {digit}
            </Button>
          ))}
          <Button
            variant="secondary"
            size="sm"
            type="button"
            className="w-full"
            disabled={disabled || locked}
            aria-label={t('pos.keypadDelete')}
            onClick={() => {
              pushKey('delete');
            }}
          >
            <Delete aria-hidden="true" className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }
  const amountInput = (
    <input
      id={fieldId}
      aria-label={label}
      type="text"
      inputMode={entryUnit === 'btc' ? 'numeric' : 'decimal'}
      autoComplete="off"
      autoCorrect="off"
      spellCheck={false}
      placeholder={placeholder}
      value={shown}
      disabled={disabled || locked}
      onChange={(event) => {
        if (!locked) {
          draftRef.current = event.target.value;
          onValueChange(event.target.value);
        }
      }}
      className={amountClass}
    />
  );
  if (layout === 'composer') {
    return (
      <div className={`flex min-w-0 flex-col gap-1${extra}`}>
        <label htmlFor={fieldId} className="sr-only">
          {label}
        </label>
        <div className="flex min-w-0 items-center gap-2">
          {unitSwitch}
          {amountInput}
        </div>
        {counter !== null ? (
          <p className="ps-24 text-xs tabular-nums lining-nums text-app-muted">{counter}</p>
        ) : null}
      </div>
    );
  }

  if (layout === 'inline') {
    return (
      <div className={`flex min-w-0 flex-col gap-1${extra}`}>
        <div className="flex items-center gap-2">
          <label htmlFor={fieldId} className="sr-only">
            {label}
          </label>
          {amountInput}
          {unitSwitch}
        </div>
        {counter !== null ? (
          <p className="text-sm tabular-nums lining-nums text-app-muted">{counter}</p>
        ) : null}
      </div>
    );
  }

  return (
    <div className={`flex flex-col gap-1${extra}`}>
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={fieldId} className="text-sm text-app-fg">
          {label}
        </label>
        {unitSwitch}
      </div>
      {amountInput}
      {counter !== null ? (
        <p className="text-sm tabular-nums lining-nums text-app-muted">{counter}</p>
      ) : null}
    </div>
  );
}
