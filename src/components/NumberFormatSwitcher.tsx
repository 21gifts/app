'use client';

import { Check, ChevronDown, Hash } from 'lucide-react';
import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactElement,
} from 'react';
import { useTranslations } from '@/components/LocaleProvider';
import { useNumberFormat } from '@/components/NumberFormatProvider';
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
 * Stable DOM id for a number-format option row.
 *
 * @param style - Number-format style.
 * @returns Option element id.
 */
function optionId(style: NumberFormatStyle): string {
  return `number-format-option-${style}`;
}

/**
 * Style at a wrapped index into {@link NUMBER_FORMATS}.
 *
 * @param index - Possibly negative or out-of-range index.
 * @returns The style at the wrapped position.
 */
function styleAt(index: number): NumberFormatStyle {
  const wrapped = ((index % NUMBER_FORMATS.length) + NUMBER_FORMATS.length) % NUMBER_FORMATS.length;
  switch (wrapped) {
    case 0:
      return 'ch';
    case 1:
      return 'us';
    default:
      return 'de';
  }
}

/**
 * Custom listbox that persists the visitor's number-format choice in a cookie.
 * Grouping is independent of UI language.
 *
 * Standalone (`embedded` false): Hash pill trigger + absolute popover listbox.
 * Embedded: Menu-row disclosure; format options appear only after clicking
 * Number format.
 *
 * Production mounts only `SignedInChrome` (`tone="light"`, `embedded`).
 * `tone="dark"` and the standalone Hash pill exist for tests; marketing
 * never mounts this control.
 *
 * @param props - `tone` for the trigger (`light` in production Menu;
 *   `dark` is test-only) and optional `embedded` for the signed-in Menu row.
 * @returns The number-format switcher element.
 */
export function NumberFormatSwitcher(props: {
  tone: 'dark' | 'light';
  embedded?: boolean;
}): ReactElement {
  const { tone, embedded = false } = props;
  const { t } = useTranslations();
  const { numberFormat, setNumberFormat } = useNumberFormat();
  const label = t('numberFormat.label');
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState<NumberFormatStyle>(numberFormat);

  useEffect(() => {
    if (!open) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setOpen(false);
        triggerRef.current?.focus();
        return;
      }
      if (event.key === 'Tab') {
        setOpen(false);
        return;
      }
      if (rootRef.current?.contains(event.target as Node) !== true) {
        return;
      }
      const currentIndex = NUMBER_FORMATS.indexOf(highlight);
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setHighlight(styleAt(currentIndex + 1));
        return;
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setHighlight(styleAt(currentIndex - 1));
        return;
      }
      if (event.key === 'Home') {
        event.preventDefault();
        setHighlight(styleAt(0));
        return;
      }
      if (event.key === 'End') {
        event.preventDefault();
        setHighlight(styleAt(NUMBER_FORMATS.length - 1));
        return;
      }
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        setOpen(false);
        setNumberFormat(highlight);
      }
    };
    const onMouseDown = (event: MouseEvent): void => {
      const root = rootRef.current;
      if (root !== null && !root.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('mousedown', onMouseDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('mousedown', onMouseDown);
    };
  }, [open, highlight, setNumberFormat]);

  const openListbox = (): void => {
    setHighlight(numberFormat);
    setOpen(true);
  };

  const onTriggerKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>): void => {
    if (open) {
      return;
    }
    if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      openListbox();
    }
  };

  const onTriggerClick = (): void => {
    if (open) {
      setOpen(false);
    } else {
      openListbox();
    }
  };

  const selectStyle = (next: NumberFormatStyle): void => {
    setOpen(false);
    setNumberFormat(next);
    triggerRef.current?.focus();
  };

  const optionRowClass =
    tone === 'dark'
      ? 'flex min-h-11 w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-paper hover:bg-paper/10'
      : 'flex min-h-11 w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-app-fg hover:bg-app-hover';

  const checkClass =
    tone === 'dark' ? 'h-4 w-4 shrink-0 text-accent' : 'h-4 w-4 shrink-0 text-app-fg';

  const embeddedOptionRowClass =
    'flex min-h-11 w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-app-fg hover:bg-app-hover';

  const listboxOptions = (rowClass: string, check: string): ReactElement => (
    <>
      {NUMBER_FORMATS.map((code) => {
        const selected = code === numberFormat;
        return (
          <button
            key={code}
            type="button"
            role="option"
            id={optionId(code)}
            tabIndex={-1}
            aria-selected={selected}
            className={`${rowClass}${selected ? ' font-medium' : ''}`}
            onMouseDown={(event) => {
              event.preventDefault();
            }}
            onClick={() => {
              selectStyle(code);
            }}
            onMouseEnter={() => {
              setHighlight(code);
            }}
          >
            <span className="flex h-4 w-4 shrink-0 items-center justify-center" aria-hidden="true">
              {selected ? <Check className={check} aria-hidden="true" /> : null}
            </span>
            {sampleFor(code)}
          </button>
        );
      })}
    </>
  );

  if (embedded) {
    return (
      <div ref={rootRef} className="flex w-full flex-col">
        <button
          ref={triggerRef}
          type="button"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls="number-format-listbox"
          aria-label={t('aria.numberFormat')}
          {...(open
            ? { role: 'combobox' as const, 'aria-activedescendant': optionId(highlight) }
            : {})}
          className="inline-flex min-h-11 w-full items-center gap-1.5 rounded-lg px-3 py-2 text-left text-sm text-app-muted hover:bg-app-hover hover:text-app-fg"
          onClick={onTriggerClick}
          onKeyDown={onTriggerKeyDown}
        >
          <Hash aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
          {label}
          <ChevronDown aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
        </button>
        {open ? (
          <div
            role="listbox"
            id="number-format-listbox"
            aria-label={label}
            aria-activedescendant={optionId(highlight)}
            className="flex flex-col"
          >
            {listboxOptions(embeddedOptionRowClass, 'h-4 w-4 shrink-0 text-app-fg')}
          </div>
        ) : null}
      </div>
    );
  }

  const triggerClass =
    tone === 'dark'
      ? 'inline-flex min-h-11 items-center gap-1.5 rounded-full border border-paper/20 px-3 py-1.5 text-sm text-paper hover:bg-paper/10'
      : 'inline-flex min-h-11 items-center gap-1.5 rounded-full border border-app-border-strong px-3 py-1.5 text-sm text-app-fg hover:bg-app-hover';

  const panelClass =
    tone === 'dark'
      ? 'absolute right-0 z-50 mt-2 min-w-[12rem] rounded-xl border border-paper/10 bg-ink p-2 shadow-lg'
      : 'absolute right-0 z-50 mt-2 min-w-[12rem] rounded-xl border border-app-border bg-app-card p-2 shadow-lg';

  return (
    <div ref={rootRef} className="relative inline-flex">
      <button
        ref={triggerRef}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls="number-format-listbox"
        aria-label={t('aria.numberFormat')}
        {...(open ? { 'aria-activedescendant': optionId(highlight) } : {})}
        className={triggerClass}
        onClick={onTriggerClick}
        onKeyDown={onTriggerKeyDown}
      >
        <Hash aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
        {sampleFor(numberFormat)}
        <ChevronDown aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
      </button>
      {open ? (
        <div
          role="listbox"
          id="number-format-listbox"
          aria-label={label}
          aria-activedescendant={optionId(highlight)}
          className={panelClass}
        >
          {listboxOptions(optionRowClass, checkClass)}
        </div>
      ) : null}
    </div>
  );
}
