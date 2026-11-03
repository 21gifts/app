'use client';

import { Check, ChevronDown } from 'lucide-react';
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import type {
  KeyboardEvent as ReactKeyboardEvent,
  MouseEvent as ReactMouseEvent,
  ReactElement,
} from 'react';

/** One homepage filter option, with an optional decorative swatch. */
export type MenuOption = { value: string; label: string; swatch: string | null };

type MenuAlign = 'start' | 'end';
type MenuVertical = 'below' | 'above';

const COLUMN_CLASS = [
  'grid-cols-1',
  'grid-cols-1',
  'grid-cols-2',
  'grid-cols-3',
  'grid-cols-4',
  'grid-cols-5',
  'grid-cols-6',
  'grid-cols-7',
  'grid-cols-8',
  'grid-cols-9',
  'grid-cols-10',
  'grid-cols-11',
  'grid-cols-12',
] as const;

const ROW_CLASS =
  'flex h-10 w-full items-center gap-2 rounded-lg px-3 text-left text-sm font-inherit';

const VIEWPORT_INSET = 8;
const COLUMN_MIN_PX = 96;

type MenuPin = { left: number; top: number; width: number };

/**
 * Column count that keeps the open list within eight rows when the window is
 * wide enough. Eight options stay one column. The All row counts toward the
 * eight. At most twelve columns, and only as many as fit the viewport.
 *
 * @param total - Option count, including All.
 * @param viewportWidth - Window width in CSS pixels.
 * @param viewportHeight - Window height in CSS pixels.
 * @returns A column count from 1 to 12.
 */
function columnCount(total: number, viewportWidth: number, viewportHeight: number): number {
  if (total <= 8) return 1;
  const rest = total - 1;
  const row = 40;
  const chrome = 56;
  const availableHeight = Math.max(row, viewportHeight - VIEWPORT_INSET * 2 - chrome);
  const rowsThatFit = Math.max(1, Math.floor(availableHeight / row));
  const rowBudget = Math.min(7, rowsThatFit);
  const wanted = Math.max(1, Math.ceil(rest / rowBudget));
  const fit = Math.max(1, Math.floor((viewportWidth - VIEWPORT_INSET * 2) / COLUMN_MIN_PX));
  return Math.min(COLUMN_CLASS.length - 1, wanted, fit);
}

/**
 * Box that keeps a still-overflowing panel inside the 8px window inset.
 *
 * @param rect - Panel rect after the candidate alignment is applied.
 * @returns The pinned box, or null when the rect already fits.
 */
function pinFor(rect: DOMRect): MenuPin | null {
  const maxRight = window.innerWidth - VIEWPORT_INSET;
  const maxBottom = window.innerHeight - VIEWPORT_INSET;
  if (
    rect.left >= VIEWPORT_INSET &&
    rect.top >= VIEWPORT_INSET &&
    rect.right <= maxRight &&
    rect.bottom <= maxBottom
  ) {
    return null;
  }
  const maxWidth = Math.max(0, window.innerWidth - VIEWPORT_INSET * 2);
  const width = Math.min(rect.width, maxWidth);
  let left = rect.left;
  if (left < VIEWPORT_INSET) left = VIEWPORT_INSET;
  if (left + width > maxRight) left = maxRight - width;
  let top = rect.top;
  if (top < VIEWPORT_INSET) top = VIEWPORT_INSET;
  if (top > maxBottom) top = VIEWPORT_INSET;
  return { left, top, width };
}

function samePin(current: MenuPin | null, next: MenuPin | null): boolean {
  if (current === null || next === null) return current === next;
  return current.left === next.left && current.top === next.top && current.width === next.width;
}

function clearPinStyle(panel: HTMLElement): void {
  panel.style.left = '';
  panel.style.top = '';
  panel.style.right = '';
  panel.style.bottom = '';
  panel.style.width = '';
}

/**
 * Label shown on the closed pill for the committed value.
 *
 * @param options - Options, including All.
 * @param value - Committed value. Empty string is All.
 * @param allLabel - All label.
 * @returns The matching option label, or the All label.
 */
function selectedLabel(options: readonly MenuOption[], value: string, allLabel: string): string {
  for (const option of options) {
    if (option.value === value) return option.label;
  }
  return allLabel;
}

/**
 * Whether a pointer event started inside this menu.
 *
 * @param target - Event target.
 * @param menuId - Menu root id.
 * @returns True when the target is inside the menu.
 */
function inMenu(target: EventTarget | null, menuId: string): boolean {
  if (!(target instanceof Element)) return false;
  return target.closest(`[data-shops-menu="${menuId}"]`) !== null;
}

/**
 * Whether the pill sits fully outside the window.
 *
 * @param trigger - The combobox button.
 * @returns True when the pill does not intersect the window.
 */
function triggerOutsideWindow(trigger: HTMLElement): boolean {
  const rect = trigger.getBoundingClientRect();
  return rect.bottom < 0 || rect.top >= window.innerHeight;
}

/**
 * Custom listbox for one homepage shop filter.
 *
 * The closed control is a pill: the label sits on the left and the chosen value
 * sits directly before the chevron. An open list floats under the pill, flips
 * inward when it would leave the window, and wraps into columns. If the flipped
 * panel still crosses an 8px inset, its left, top, and width are pinned inside
 * the window. The list is measured when it opens and when the window resizes.
 * Scrolling does not measure it again, and a resize while the pill is outside
 * the window does not measure it again, so the list stays on the pill. The list
 * stays on the page scrollport.
 * Country, name, blockchain, asset, and activity all use it.
 *
 * @param props - Visible label, committed value, All label, options, and change handler.
 * @returns The combobox and, while open, its listbox.
 */
export function FilterMenu({
  label,
  value,
  allLabel,
  options,
  onChange,
}: {
  label: string;
  value: string;
  allLabel: string;
  options: readonly MenuOption[];
  onChange: (next: string) => void;
}): ReactElement {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [align, setAlign] = useState<MenuAlign>('start');
  const [vertical, setVertical] = useState<MenuVertical>('below');
  const [columns, setColumns] = useState(() => columnCount(options.length, 4096, 4096));
  const [pin, setPin] = useState<MenuPin | null>(null);
  const menuId = useId();
  const labelId = useId();
  const listboxId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const chosen = selectedLabel(options, value, allLabel);
  const inverted = value !== '';

  useEffect(() => {
    if (!open) return undefined;
    function onPointerDown(event: MouseEvent): void {
      if (inMenu(event.target, menuId)) return;
      setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent): void {
      if (event.key !== 'Escape') return;
      setOpen(false);
    }
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open, menuId]);

  useLayoutEffect(() => {
    if (!open) return undefined;
    function place(): void {
      const panel = panelRef.current;
      const trigger = triggerRef.current;
      /* v8 ignore next -- the open panel is committed before this layout effect reads it */
      if (panel === null) return;
      /* v8 ignore next -- the trigger stays mounted while the list is open */
      if (trigger === null) return;
      if (triggerOutsideWindow(trigger)) return;
      const nextColumns = columnCount(options.length, window.innerWidth, window.innerHeight);
      const grid = panel.querySelector('.grid');
      if (grid !== null) {
        for (const name of COLUMN_CLASS) grid.classList.remove(name);
        const columnClass = COLUMN_CLASS[nextColumns];
        /* v8 ignore next -- columnCount returns only indexes of COLUMN_CLASS */
        if (columnClass === undefined) return;
        grid.classList.add(columnClass);
      }
      const previous = panel.className;
      const previousStyle = panel.getAttribute('style');
      panel.classList.remove(
        'fixed',
        'absolute',
        'right-0',
        'left-0',
        'bottom-full',
        'top-full',
        'mb-1.5',
        'mt-1.5',
      );
      panel.classList.add('absolute', 'left-0', 'top-full', 'mt-1.5');
      clearPinStyle(panel);
      const natural = panel.getBoundingClientRect();
      const nextAlign: MenuAlign =
        natural.right > window.innerWidth - VIEWPORT_INSET ? 'end' : 'start';
      const nextVertical: MenuVertical =
        natural.bottom > window.innerHeight - VIEWPORT_INSET ? 'above' : 'below';
      panel.classList.remove('left-0', 'top-full', 'mt-1.5');
      panel.classList.add(
        nextAlign === 'end' ? 'right-0' : 'left-0',
        nextVertical === 'above' ? 'bottom-full' : 'top-full',
        nextVertical === 'above' ? 'mb-1.5' : 'mt-1.5',
      );
      const flipped = panel.getBoundingClientRect();
      const nextPin = pinFor(flipped);
      panel.className = previous;
      if (previousStyle === null) panel.removeAttribute('style');
      else panel.setAttribute('style', previousStyle);
      setColumns((current) => (current === nextColumns ? current : nextColumns));
      setAlign((current) => (current === nextAlign ? current : nextAlign));
      setVertical((current) => (current === nextVertical ? current : nextVertical));
      setPin((current) => (samePin(current, nextPin) ? current : nextPin));
    }
    place();
    window.addEventListener('resize', place);
    return () => {
      window.removeEventListener('resize', place);
    };
  }, [open, options.length]);

  function optionDomId(index: number): string {
    return `${listboxId}-option-${String(index)}`;
  }

  function highlightIndex(): number {
    let index = 0;
    let cursor = 0;
    for (const option of options) {
      if (option.value === value) index = cursor;
      cursor += 1;
    }
    return index;
  }

  function clampIndex(next: number): number {
    if (next < 0) return 0;
    const last = options.length - 1;
    if (next > last) return last;
    return next;
  }

  function valueAt(index: number): string {
    let chosenValue = '';
    let cursor = 0;
    for (const option of options) {
      if (cursor === index) chosenValue = option.value;
      cursor += 1;
    }
    return chosenValue;
  }

  function focusTrigger(): void {
    (triggerRef.current as HTMLButtonElement).focus();
  }

  function openAtCurrent(): void {
    setActiveIndex(highlightIndex());
    setAlign('start');
    setVertical('below');
    setOpen(true);
  }

  function commit(next: string): void {
    if (next !== value) onChange(next);
    setOpen(false);
    focusTrigger();
  }

  function choose(event: ReactMouseEvent<HTMLButtonElement>, next: string): void {
    event.stopPropagation();
    commit(next);
  }

  function toggle(): void {
    if (open) {
      setOpen(false);
      return;
    }
    openAtCurrent();
  }

  function move(delta: number): void {
    setActiveIndex(clampIndex(activeIndex + delta));
  }

  function onTriggerKeyDown(event: ReactKeyboardEvent<HTMLButtonElement>): void {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!open) {
        openAtCurrent();
        return;
      }
      move(event.key === 'ArrowDown' ? 1 : -1);
      return;
    }
    if (event.key === 'Home' || event.key === 'End') {
      if (!open) return;
      event.preventDefault();
      setActiveIndex(event.key === 'Home' ? 0 : options.length - 1);
      return;
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      event.stopPropagation();
      if (!open) {
        openAtCurrent();
        return;
      }
      commit(valueAt(activeIndex));
      return;
    }
    if (event.key === 'Escape') {
      if (!open) return;
      setOpen(false);
      focusTrigger();
    }
  }

  const rest = options.slice(1);
  const edge = align === 'end' ? 'right-0' : 'left-0';
  const stack = vertical === 'above' ? 'bottom-full mb-1.5' : 'top-full mt-1.5';
  const triggerTone = inverted
    ? open
      ? 'border-ink/35 bg-ink text-paper'
      : 'border-ink bg-ink text-paper'
    : open
      ? 'border-ink/35 bg-paper text-ink'
      : 'border-ink/12 bg-paper text-ink';
  const labelTone = inverted ? 'text-paper/60' : 'text-ink/55';
  const chevronTone = inverted ? 'text-paper' : 'text-ink';

  return (
    <div data-shops-menu={menuId} className="relative w-full min-w-0 sm:w-auto">
      <button
        ref={triggerRef}
        type="button"
        role="combobox"
        data-value={value}
        className={`flex h-10 w-full min-w-0 items-center gap-6 rounded-full border py-0 pr-4 pl-4 ${triggerTone}`}
        aria-controls={listboxId}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-labelledby={labelId}
        {...(open ? { 'aria-activedescendant': optionDomId(activeIndex) } : {})}
        onClick={toggle}
        onKeyDown={onTriggerKeyDown}
      >
        <span id={labelId} className={`shrink-0 text-sm ${labelTone}`}>
          {label}
        </span>
        <span className="ml-auto flex min-w-0 items-center gap-2">
          <span data-shop-value="" className="truncate text-sm font-semibold">
            {chosen}
          </span>
          <ChevronDown
            aria-hidden="true"
            className={`h-3.5 w-3.5 shrink-0 ${chevronTone} ${open ? 'rotate-180' : ''}`}
          />
        </span>
      </button>
      {open ? (
        <div
          ref={panelRef}
          role="listbox"
          id={listboxId}
          aria-labelledby={labelId}
          className={`shop-menu-in z-30 flex min-w-[max(100%,14.5rem)] flex-col gap-0.5 rounded-xl border border-ink/10 bg-paper p-1.5 shadow-lg ${pin === null ? `absolute ${edge} ${stack}` : 'fixed'} max-w-[18rem] sm:max-w-[36rem] md:max-w-[44rem]`}
          style={pin === null ? undefined : { left: pin.left, top: pin.top, width: pin.width }}
        >
          {options[0] !== undefined ? (
            <FilterOption
              option={options[0]}
              index={0}
              activeIndex={activeIndex}
              value={value}
              optionDomId={optionDomId}
              onChoose={choose}
            />
          ) : null}
          {rest.length > 0 ? <div className="border-t border-ink/10" /> : null}
          {rest.length > 0 ? (
            <div className={`grid gap-0.5 ${COLUMN_CLASS[columns]}`}>
              {rest.map((option, index) => (
                <FilterOption
                  key={option.value === '' ? 'all' : option.value}
                  option={option}
                  index={index + 1}
                  activeIndex={activeIndex}
                  value={value}
                  optionDomId={optionDomId}
                  onChoose={choose}
                />
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/**
 * One listbox row: swatch, label, and a check when it is the committed value.
 *
 * @param props - Option, indexes, committed value, id builder, and choose handler.
 * @returns The option button.
 */
function FilterOption({
  option,
  index,
  activeIndex,
  value,
  optionDomId,
  onChoose,
}: {
  option: MenuOption;
  index: number;
  activeIndex: number;
  value: string;
  optionDomId: (index: number) => string;
  onChoose: (event: ReactMouseEvent<HTMLButtonElement>, next: string) => void;
}): ReactElement {
  const active = index === activeIndex;
  const selected = option.value === value;
  return (
    <button
      id={optionDomId(index)}
      type="button"
      role="option"
      tabIndex={-1}
      data-value={option.value}
      aria-selected={selected}
      className={
        active
          ? `${ROW_CLASS} is-active bg-home-why ${selected ? 'font-semibold' : ''}`
          : `${ROW_CLASS} hover:bg-home-why ${selected ? 'font-semibold' : ''}`
      }
      onClick={(event) => {
        event.stopPropagation();
        onChoose(event, option.value);
      }}
    >
      {option.swatch === null ? null : <span className={option.swatch} aria-hidden="true" />}
      <span className="min-w-0 flex-1 truncate">{option.label}</span>
      {selected ? <Check aria-hidden="true" className="h-4 w-4 shrink-0" /> : null}
    </button>
  );
}
