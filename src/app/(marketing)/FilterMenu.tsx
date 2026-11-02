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

const COLUMN_CLASS: Record<number, string> = {
  1: 'grid-cols-1',
  2: 'grid-cols-2',
  3: 'grid-cols-3',
  4: 'grid-cols-4',
  5: 'grid-cols-5',
  6: 'grid-cols-6',
};

const ROW_CLASS =
  'flex h-10 w-full items-center gap-2 rounded-lg px-3 text-left text-sm font-inherit';

/**
 * Column count for a list that must not scroll. Lists of at most 8 options stay
 * one column. Longer lists wrap into as many columns of 8 as fit, at most 6.
 *
 * @param total - Option count, including All.
 * @returns A column count from 1 to 6.
 */
function columnCount(total: number): 1 | 2 | 3 | 4 | 5 | 6 {
  if (total <= 8) return 1;
  const columns = Math.ceil(total / 8);
  if (columns >= 6) return 6;
  if (columns === 5) return 5;
  if (columns === 4) return 4;
  if (columns === 3) return 3;
  return 2;
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
 * Custom listbox for one homepage shop filter.
 *
 * The closed control is a pill: the label sits on the left and the chosen value
 * sits directly before the chevron. An open list floats under the pill, flips
 * inward when it would leave the window, and wraps into columns instead of
 * scrolling. Country, name, blockchain, asset, and activity all use it.
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
  const menuId = useId();
  const labelId = useId();
  const listboxId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const columns = columnCount(options.length);
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
      /* v8 ignore next -- the open panel is committed before this layout effect reads it */
      if (panel === null) return;
      const previous = panel.className;
      panel.classList.remove('right-0', 'left-0', 'bottom-full', 'top-full', 'mb-1.5', 'mt-1.5');
      panel.classList.add('left-0', 'top-full', 'mt-1.5');
      const rect = panel.getBoundingClientRect();
      panel.className = previous;
      const nextAlign: MenuAlign = rect.right > window.innerWidth - 8 ? 'end' : 'start';
      const nextVertical: MenuVertical = rect.bottom > window.innerHeight - 8 ? 'above' : 'below';
      setAlign((current) => (current === nextAlign ? current : nextAlign));
      setVertical((current) => (current === nextVertical ? current : nextVertical));
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
        className={`flex h-10 w-full min-w-0 items-center rounded-full border py-0 pr-4 pl-4 ${triggerTone}`}
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
          className={`shop-menu-in absolute z-30 flex min-w-[max(100%,14.5rem)] flex-col gap-0.5 rounded-xl border border-ink/10 bg-paper p-1.5 shadow-lg ${edge} ${stack} max-w-[18rem] sm:max-w-[36rem] md:max-w-[44rem]`}
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
