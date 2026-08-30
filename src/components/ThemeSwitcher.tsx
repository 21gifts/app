'use client';

import { Check, ChevronDown, Monitor, Moon, Sun } from 'lucide-react';
import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactElement,
} from 'react';
import { useTranslations } from '@/components/LocaleProvider';
import { useTheme } from '@/components/ThemeProvider';
import type { ThemePreference } from '@/lib/theme';

const PREFERENCES: readonly ThemePreference[] = ['system', 'light', 'dark'];

/**
 * Stable DOM id for a theme option row.
 *
 * @param preference - Theme preference.
 * @returns Option element id.
 */
function optionId(preference: ThemePreference): string {
  return `theme-option-${preference}`;
}

/**
 * Preference at a wrapped index into {@link PREFERENCES}.
 *
 * @param index - Possibly negative or out-of-range index.
 * @returns The preference at the wrapped position.
 */
function preferenceAt(index: number): ThemePreference {
  const wrapped = ((index % PREFERENCES.length) + PREFERENCES.length) % PREFERENCES.length;
  switch (wrapped) {
    case 0:
      return 'system';
    case 1:
      return 'light';
    default:
      return 'dark';
  }
}

/**
 * Lucide glyph for a preference (inline helper, not a second component).
 *
 * @param preference - Theme preference.
 * @returns Icon element.
 */
function preferenceIcon(preference: ThemePreference): ReactElement {
  const className = 'h-3.5 w-3.5 shrink-0';
  switch (preference) {
    case 'system':
      return <Monitor aria-hidden="true" className={className} />;
    case 'light':
      return <Sun aria-hidden="true" className={className} />;
    case 'dark':
      return <Moon aria-hidden="true" className={className} />;
  }
}

/**
 * Catalog label for a preference.
 *
 * @param preference - Theme preference.
 * @param t - Bound translator.
 * @returns Localized label.
 */
function preferenceLabel(
  preference: ThemePreference,
  t: (key: 'theme.system' | 'theme.light' | 'theme.dark') => string,
): string {
  switch (preference) {
    case 'system':
      return t('theme.system');
    case 'light':
      return t('theme.light');
    case 'dark':
      return t('theme.dark');
  }
}

/**
 * System / Light / Dark control. Colors come from semantic app tokens so the
 * control follows the resolved theme; marketing never hosts this switcher.
 *
 * Standalone (`embedded` false): compact pill next to {@link LanguageSwitcher}
 * on unsigned app pages. Embedded: Menu-row disclosure beside language.
 *
 * @param props - Optional `embedded` when shown inside the signed-in Menu.
 * @returns The theme switcher element.
 */
export function ThemeSwitcher(props: { embedded?: boolean }): ReactElement {
  const { embedded = false } = props;
  const { t } = useTranslations();
  const { preference, setPreference } = useTheme();
  const label = t('theme.label');
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState<ThemePreference>(preference);

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
      const currentIndex = PREFERENCES.indexOf(highlight);
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setHighlight(preferenceAt(currentIndex + 1));
        return;
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setHighlight(preferenceAt(currentIndex - 1));
        return;
      }
      if (event.key === 'Home') {
        event.preventDefault();
        setHighlight(preferenceAt(0));
        return;
      }
      if (event.key === 'End') {
        event.preventDefault();
        setHighlight(preferenceAt(PREFERENCES.length - 1));
        return;
      }
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        setOpen(false);
        setPreference(highlight);
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
  }, [open, highlight, setPreference]);

  const openListbox = (): void => {
    setHighlight(preference);
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

  const selectPreference = (next: ThemePreference): void => {
    setOpen(false);
    setPreference(next);
    triggerRef.current?.focus();
  };

  const listboxOptions = (rowClass: string, check: string): ReactElement => (
    <>
      {PREFERENCES.map((code) => {
        const selected = code === preference;
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
              selectPreference(code);
            }}
            onMouseEnter={() => {
              setHighlight(code);
            }}
          >
            <span className="flex h-4 w-4 shrink-0 items-center justify-center" aria-hidden="true">
              {selected ? <Check className={check} aria-hidden="true" /> : null}
            </span>
            {preferenceIcon(code)}
            {preferenceLabel(code, t)}
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
          aria-controls="theme-listbox"
          aria-label={t('aria.theme')}
          {...(open
            ? { role: 'combobox' as const, 'aria-activedescendant': optionId(highlight) }
            : {})}
          className="inline-flex w-full items-center gap-1.5 rounded-lg px-3 py-2 text-left text-sm text-app-muted transition hover:bg-app-hover hover:text-app-fg"
          onClick={onTriggerClick}
          onKeyDown={onTriggerKeyDown}
        >
          {preferenceIcon(preference)}
          {label}
          <ChevronDown aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
        </button>
        {open ? (
          <div
            role="listbox"
            id="theme-listbox"
            aria-label={label}
            aria-activedescendant={optionId(highlight)}
            className="flex flex-col"
          >
            {listboxOptions(
              'flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-app-fg hover:bg-app-hover',
              'h-4 w-4 shrink-0 text-app-fg',
            )}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div ref={rootRef} className="relative inline-flex">
      <button
        ref={triggerRef}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls="theme-listbox"
        aria-label={t('aria.theme')}
        {...(open ? { 'aria-activedescendant': optionId(highlight) } : {})}
        className="inline-flex items-center gap-1.5 rounded-full border border-app-border px-3 py-1.5 text-sm text-app-fg transition hover:bg-app-hover"
        onClick={onTriggerClick}
        onKeyDown={onTriggerKeyDown}
      >
        {preferenceIcon(preference)}
        {preferenceLabel(preference, t)}
        <ChevronDown aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
      </button>
      {open ? (
        <div
          role="listbox"
          id="theme-listbox"
          aria-label={label}
          aria-activedescendant={optionId(highlight)}
          className="absolute right-0 z-50 mt-2 min-w-[12rem] rounded-xl border border-app-border bg-app-card p-2 shadow-lg"
        >
          {listboxOptions(
            'flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-app-fg hover:bg-app-hover',
            'h-4 w-4 shrink-0 text-app-fg',
          )}
        </div>
      ) : null}
    </div>
  );
}
