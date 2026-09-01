'use client';

import { Check, ChevronDown, Globe } from 'lucide-react';
import { useRouter } from 'next/navigation';
import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactElement,
} from 'react';
import { useTranslations } from '@/components/LocaleProvider';
import { LOCALES, LOCALE_COOKIE, type Locale } from '@/lib/locale';

/**
 * Native-language label for a locale option (not routed through the catalog).
 *
 * @param locale - Supported locale.
 * @returns The option label in that language.
 */
function nativeLabel(locale: Locale): string {
  switch (locale) {
    case 'en':
      return 'English';
    case 'de':
      return 'Deutsch';
    case 'es':
      return 'Español';
    case 'fil':
      return 'Filipino';
  }
}

/**
 * Stable DOM id for a language option row.
 *
 * @param locale - Supported locale.
 * @returns Option element id.
 */
function optionId(locale: Locale): string {
  return `language-option-${locale}`;
}

/**
 * Locale at a wrapped index into {@link LOCALES}.
 *
 * @param index - Possibly negative or out-of-range index.
 * @returns The locale at the wrapped position.
 */
function localeAt(index: number): Locale {
  const wrapped = ((index % LOCALES.length) + LOCALES.length) % LOCALES.length;
  switch (wrapped) {
    case 0:
      return 'en';
    case 1:
      return 'de';
    case 2:
      return 'es';
    default:
      return 'fil';
  }
}

/**
 * Writes the locale cookie and refreshes when `next` differs from `current`.
 *
 * @param next - Locale the visitor chose.
 * @param current - Locale currently active in the tree.
 * @param refresh - App Router refresh callback.
 */
function persistLocale(next: Locale, current: Locale, refresh: () => void): void {
  if (next === current) {
    return;
  }
  const secure = globalThis.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${LOCALE_COOKIE}=${next}; Path=/; Max-Age=31536000; SameSite=Lax${secure}`;
  refresh();
}

/**
 * Custom listbox that persists the visitor's language choice in a cookie and
 * refreshes the App Router tree so server components re-negotiate locale.
 *
 * Standalone (`embedded` false): Globe pill trigger + absolute popover listbox.
 * Embedded: Menu-row disclosure; locale options appear only after clicking Language.
 *
 * Marketing passes `tone="dark"` (hardcoded). App pages pass `tone="light"` so
 * chrome follows semantic theme tokens.
 *
 * @param props - Visual tone for marketing (`dark`) or app chrome (`light`),
 *   and optional `embedded` when shown inside the signed-in Menu dropdown.
 * @returns The language switcher element.
 */
export function LanguageSwitcher(props: {
  tone: 'dark' | 'light';
  embedded?: boolean;
}): ReactElement {
  const { tone, embedded = false } = props;
  const { locale, t } = useTranslations();
  const router = useRouter();
  const label = t('language.label');
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState<Locale>(locale);

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
      const currentIndex = LOCALES.indexOf(highlight);
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setHighlight(localeAt(currentIndex + 1));
        return;
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setHighlight(localeAt(currentIndex - 1));
        return;
      }
      if (event.key === 'Home') {
        event.preventDefault();
        setHighlight(localeAt(0));
        return;
      }
      if (event.key === 'End') {
        event.preventDefault();
        setHighlight(localeAt(LOCALES.length - 1));
        return;
      }
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        setOpen(false);
        persistLocale(highlight, locale, () => {
          router.refresh();
        });
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
  }, [open, highlight, locale, router]);

  const openListbox = (): void => {
    setHighlight(locale);
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

  const selectLocale = (code: Locale): void => {
    setOpen(false);
    persistLocale(code, locale, () => {
      router.refresh();
    });
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
      {LOCALES.map((code) => {
        const selected = code === locale;
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
              selectLocale(code);
            }}
            onMouseEnter={() => {
              setHighlight(code);
            }}
          >
            <span className="flex h-4 w-4 shrink-0 items-center justify-center" aria-hidden="true">
              {selected ? <Check className={check} aria-hidden="true" /> : null}
            </span>
            {nativeLabel(code)}
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
          aria-controls="language-listbox"
          aria-label={label}
          {...(open
            ? { role: 'combobox' as const, 'aria-activedescendant': optionId(highlight) }
            : {})}
          className="inline-flex w-full items-center gap-1.5 rounded-lg px-3 py-2 text-left text-sm text-app-muted hover:bg-app-hover hover:text-app-fg"
          onClick={onTriggerClick}
          onKeyDown={onTriggerKeyDown}
        >
          <Globe aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
          {label}
          <ChevronDown aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
        </button>
        {open ? (
          <div
            role="listbox"
            id="language-listbox"
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
        aria-controls="language-listbox"
        aria-label={label}
        {...(open ? { 'aria-activedescendant': optionId(highlight) } : {})}
        className={triggerClass}
        onClick={onTriggerClick}
        onKeyDown={onTriggerKeyDown}
      >
        <Globe aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
        {nativeLabel(locale)}
        <ChevronDown aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
      </button>
      {open ? (
        <div
          role="listbox"
          id="language-listbox"
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
