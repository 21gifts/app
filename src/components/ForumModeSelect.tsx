'use client';

import { Check, ChevronDown, Globe } from 'lucide-react';
import {
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactElement,
} from 'react';
import { createPortal } from 'react-dom';
import { AppShellContext } from '@/components/AppShell';
import { fitBoxInFrame, type PlacedFrameBox } from '@/lib/page-frame';

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

const PLACED_BOX_FIELDS = ['left', 'width', 'maxHeight', 'top', 'bottom'] as const;

function samePlacedBox(a: PlacedFrameBox | null, b: PlacedFrameBox | null): boolean {
  if (a === null || b === null) {
    return a === b;
  }
  for (const field of PLACED_BOX_FIELDS) {
    if (a[field] !== b[field]) {
      return false;
    }
  }
  return true;
}

function placedBoxStyle(box: PlacedFrameBox, fill: boolean): CSSProperties {
  const style: CSSProperties = {
    left: box.left,
    width: box.width,
  };
  if (box.top !== null) {
    style.top = box.top;
  } else {
    style.bottom = box.bottom!;
  }
  /* v8 ignore else -- the chip listbox always fills its measured overlay box */
  if (fill) {
    const viewportHeight = window.innerHeight;
    if (box.top !== null) {
      style.bottom = viewportHeight - box.top - box.maxHeight;
    } else {
      style.top = viewportHeight - box.bottom! - box.maxHeight;
    }
  }
  return style;
}

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
 * Field trigger + absolute listbox. Not a pill grid. The shops feed has no
 * view filter; `/shops` mounts it once, as the country filter
 * (`ShopsCountryFilter`). Post/Ask stays a SegmentedControl.
 *
 * The `chip` variant is a compact pill for the app chrome row; its open
 * listbox is placed inside the app frame box via `fitBoxInFrame` and a fixed
 * portal, never sized from the viewport (viewport widths escape the rounded
 * frame). Below sm the chip trigger shows a globe icon instead of the label.
 *
 * @param props - Selected value, options, change handler, accessible name, and visual variant.
 * @returns The forum-mode select element.
 */
export function ForumModeSelect<T extends string>(props: {
  value: T;
  options: readonly ForumModeSelectOption<T>[];
  onChange: (value: T) => void;
  ariaLabel: string;
  variant?: 'field' | 'chip';
}): ReactElement {
  const { value, options, onChange, ariaLabel, variant = 'field' } = props;
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listboxRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState<T>(value);
  const ctx = useContext(AppShellContext);
  const frameEl = ctx?.frameEl ?? null;
  const [placed, setPlaced] = useState<PlacedFrameBox | null>(null);
  const placedRef = useRef<PlacedFrameBox | null>(null);
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
      const target = event.target as Node;
      if (
        rootRef.current?.contains(target) !== true &&
        listboxRef.current?.contains(target) !== true
      ) {
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
      const listbox = listboxRef.current;
      const target = event.target as Node;
      if (
        root !== null &&
        !root.contains(target) &&
        (listbox === null || !listbox.contains(target))
      ) {
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

  useLayoutEffect(() => {
    const commitPlaced = (next: PlacedFrameBox | null): void => {
      if (samePlacedBox(placedRef.current, next)) {
        return;
      }
      placedRef.current = next;
      setPlaced(next);
    };
    if (variant !== 'chip' || !open) {
      commitPlaced(null);
      return;
    }
    const measure = (): void => {
      const anchor = rootRef.current;
      /* v8 ignore next 4 -- the anchor stays mounted for the whole open effect */
      if (anchor === null) {
        commitPlaced(null);
        return;
      }
      if (frameEl === null) {
        commitPlaced(null);
        return;
      }
      const anchorRect = anchor.getBoundingClientRect();
      const raw = frameEl.getBoundingClientRect();
      const band = window.visualViewport;
      const viewTop = band?.offsetTop ?? 0;
      const viewBottom = viewTop + (band?.height ?? window.innerHeight);
      commitPlaced(
        fitBoxInFrame({
          frameLeft: Math.max(raw.left, 0),
          frameRight: Math.min(raw.right, window.innerWidth),
          frameTop: Math.max(raw.top, viewTop),
          frameBottom: Math.min(raw.bottom, viewBottom),
          anchorLeft: anchorRect.left,
          anchorTop: anchorRect.top,
          anchorBottom: anchorRect.bottom,
          gap: 8,
          preferredWidth: 320,
          inset: 16,
          viewportHeight: window.innerHeight,
        }),
      );
    };
    measure();
    const viewport = window.visualViewport;
    window.addEventListener('resize', measure);
    document.addEventListener('scroll', measure, true);
    viewport?.addEventListener('resize', measure);
    viewport?.addEventListener('scroll', measure);
    return () => {
      window.removeEventListener('resize', measure);
      document.removeEventListener('scroll', measure, true);
      viewport?.removeEventListener('resize', measure);
      viewport?.removeEventListener('scroll', measure);
    };
  }, [frameEl, open, variant]);

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

  const optionRows = options.map((opt) => {
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
        <span className="flex h-4 w-4 shrink-0 items-center justify-center" aria-hidden="true">
          {selected ? <Check className="h-4 w-4 shrink-0 text-app-fg" aria-hidden="true" /> : null}
        </span>
        {opt.label}
        {optionBadge(opt.badge)}
      </button>
    );
  });

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
        className={
          variant === 'field'
            ? 'flex w-full min-h-11 items-center justify-between gap-2 rounded-2xl border border-app-border bg-app-card px-4 py-2 text-left text-base text-app-fg'
            : 'flex min-h-11 max-w-48 items-center gap-1.5 rounded-full border border-app-border bg-app-card px-3 py-1 text-left text-sm text-app-fg hover:bg-app-hover'
        }
        onClick={onTriggerClick}
        onKeyDown={onTriggerKeyDown}
      >
        <span className="flex min-w-0 items-center">
          {variant === 'chip' ? (
            <>
              <Globe aria-hidden="true" className="h-4 w-4 shrink-0 text-app-muted sm:hidden" />
              <span className="hidden truncate sm:inline">
                {selectedLabel}
                {optionBadge(triggerBadge(options))}
              </span>
            </>
          ) : (
            <>
              {selectedLabel}
              {optionBadge(triggerBadge(options))}
            </>
          )}
        </span>
        <ChevronDown aria-hidden="true" className="h-4 w-4 shrink-0 text-app-muted" />
      </button>
      {open ? (
        variant === 'chip' ? (
          placed !== null ? (
            createPortal(
              <div
                className={
                  placed.top !== null
                    ? 'pointer-events-none fixed z-50 flex flex-col justify-start overflow-clip'
                    : 'pointer-events-none fixed z-50 flex flex-col justify-end overflow-clip'
                }
                style={placedBoxStyle(placed, true)}
              >
                <div
                  ref={listboxRef}
                  role="listbox"
                  id="forum-mode-listbox"
                  aria-label={ariaLabel}
                  aria-activedescendant={optionId(highlight)}
                  className="pointer-events-auto flex max-h-full min-h-0 w-full flex-col overflow-clip rounded-xl border border-app-border bg-app-card p-2 shadow-lg"
                >
                  {optionRows}
                </div>
              </div>,
              document.body,
            )
          ) : (
            <div
              ref={listboxRef}
              role="listbox"
              id="forum-mode-listbox"
              aria-label={ariaLabel}
              aria-activedescendant={optionId(highlight)}
              className="absolute left-0 z-50 mt-2 w-80 rounded-xl border border-app-border bg-app-card p-2 shadow-lg"
            >
              {optionRows}
            </div>
          )
        ) : (
          <div
            ref={listboxRef}
            role="listbox"
            id="forum-mode-listbox"
            aria-label={ariaLabel}
            aria-activedescendant={optionId(highlight)}
            className="absolute left-0 right-0 z-50 mt-2 rounded-xl border border-app-border bg-app-card p-2 shadow-lg"
          >
            {optionRows}
          </div>
        )
      ) : null}
    </div>
  );
}
