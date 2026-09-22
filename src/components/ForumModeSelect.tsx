'use client';

import { Check, ChevronDown } from 'lucide-react';
import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactElement,
} from 'react';

/** One option in {@link ForumModeSelect}. */
export type ForumModeSelectOption<T extends string> = {
  /** Option value reported to `onChange`. */
  value: T;
  /** Visible label. */
  label: string;
  /** Numeric chip; omitted from the DOM when undefined or ≤ 0. */
  badge?: number;
  /** Accessible name when `badge` \> 0. */
  badgeAriaLabel?: string;
};

const BADGE_CLASS =
  'ml-1 inline-flex min-w-5 items-center justify-center rounded-full bg-app-btn px-1.5 text-xs font-semibold leading-5 text-app-btn-fg';

const OPTION_ROW_CLASS =
  'flex min-h-11 w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-app-fg hover:bg-app-hover';

/**
 * Stable DOM id for a forum-mode option row.
 *
 * @param value - Option value.
 * @returns Option element id.
 */
function optionId<T extends string>(value: T): string {
  return `forum-mode-option-${value}`;
}

/**
 * Option value at a wrapped index into `options`.
 *
 * @param options - Option list.
 * @param index - Possibly negative or out-of-range index.
 * @returns The value at the wrapped position.
 */
function optionAt<T extends string>(
  options: readonly ForumModeSelectOption<T>[],
  index: number,
): T {
  const length = options.length;
  const wrapped = ((index % length) + length) % length;
  return options[wrapped]!.value;
}

/**
 * Chip for an option whose `badge` is a positive count, or `null` when omitted.
 *
 * @param badge - Optional count from the option.
 * @returns The chip element, or `null`.
 */
function optionBadge(badge: number | undefined): ReactElement | null {
  if (badge === undefined || badge <= 0) {
    return null;
  }
  return (
    <span aria-hidden="true" className={BADGE_CLASS}>
      {badge}
    </span>
  );
}

/**
 * Button `aria-label` when a positive badge has a non-empty accessible name.
 *
 * @param badge - Optional count from the option.
 * @param badgeAriaLabel - Optional accessible name for the badged option.
 * @returns The label, or `undefined` so the visible text remains the name.
 */
function optionBadgeAriaLabel(
  badge: number | undefined,
  badgeAriaLabel: string | undefined,
): string | undefined {
  if (badge === undefined || badge <= 0) {
    return undefined;
  }
  if (badgeAriaLabel === undefined || badgeAriaLabel === '') {
    return undefined;
  }
  return badgeAriaLabel;
}

/**
 * First positive option badge, or `undefined` when none are shown.
 *
 * @param options - Option list.
 * @returns The first badge \> 0, if any.
 */
function triggerBadge<T extends string>(
  options: readonly ForumModeSelectOption<T>[],
): number | undefined {
  for (const opt of options) {
    if (opt.badge !== undefined && opt.badge > 0) {
      return opt.badge;
    }
  }
  return undefined;
}

/**
 * Closed full-width combobox for the living-room forum view.
 *
 * Public forum only: field trigger + absolute listbox. Not a pill grid.
 * Shops does not mount it. Post/Ask stays a SegmentedControl.
 *
 * @param props - Selected value, options, change handler, and accessible name.
 * @returns The forum-mode select element.
 */
export function ForumModeSelect<T extends string>(props: {
  value: T;
  options: readonly ForumModeSelectOption<T>[];
  onChange: (value: T) => void;
  ariaLabel: string;
}): ReactElement {
  const { value, options, onChange, ariaLabel } = props;
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState<T>(value);
  const selectedLabel = options.find((opt) => opt.value === value)!.label;

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
      const currentIndex = options.findIndex((opt) => opt.value === highlight);
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setHighlight(optionAt(options, currentIndex + 1));
        return;
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setHighlight(optionAt(options, currentIndex - 1));
        return;
      }
      if (event.key === 'Home') {
        event.preventDefault();
        setHighlight(optionAt(options, 0));
        return;
      }
      if (event.key === 'End') {
        event.preventDefault();
        setHighlight(optionAt(options, options.length - 1));
        return;
      }
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        setOpen(false);
        onChange(highlight);
        triggerRef.current?.focus();
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
  }, [open, highlight, options, onChange]);

  const openListbox = (): void => {
    setHighlight(value);
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

  const selectOption = (next: T): void => {
    setOpen(false);
    onChange(next);
    triggerRef.current?.focus();
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls="forum-mode-listbox"
        aria-label={ariaLabel}
        {...(open ? { 'aria-activedescendant': optionId(highlight) } : {})}
        className="flex w-full min-h-11 items-center justify-between gap-2 rounded-2xl border border-app-border bg-app-card px-4 py-2 text-left text-base text-app-fg"
        onClick={onTriggerClick}
        onKeyDown={onTriggerKeyDown}
      >
        <span className="flex min-w-0 items-center">
          {selectedLabel}
          {optionBadge(triggerBadge(options))}
        </span>
        <ChevronDown aria-hidden="true" className="h-4 w-4 shrink-0 text-app-muted" />
      </button>
      {open ? (
        <div
          role="listbox"
          id="forum-mode-listbox"
          aria-label={ariaLabel}
          aria-activedescendant={optionId(highlight)}
          className="absolute left-0 right-0 z-50 mt-2 rounded-xl border border-app-border bg-app-card p-2 shadow-lg"
        >
          {options.map((opt) => {
            const selected = value === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                role="option"
                id={optionId(opt.value)}
                tabIndex={-1}
                aria-selected={selected}
                aria-label={optionBadgeAriaLabel(opt.badge, opt.badgeAriaLabel)}
                className={`${OPTION_ROW_CLASS}${selected ? ' font-medium' : ''}`}
                onMouseDown={(event) => {
                  event.preventDefault();
                }}
                onClick={() => {
                  selectOption(opt.value);
                }}
                onMouseEnter={() => {
                  setHighlight(opt.value);
                }}
              >
                <span
                  className="flex h-4 w-4 shrink-0 items-center justify-center"
                  aria-hidden="true"
                >
                  {selected ? (
                    <Check className="h-4 w-4 shrink-0 text-app-fg" aria-hidden="true" />
                  ) : null}
                </span>
                {opt.label}
                {optionBadge(opt.badge)}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
