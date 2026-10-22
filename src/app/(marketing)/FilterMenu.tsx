'use client';

import { useEffect, useId, useRef, useState } from 'react';
import type {
  KeyboardEvent as ReactKeyboardEvent,
  MouseEvent as ReactMouseEvent,
  ReactElement,
} from 'react';

/** One homepage filter option, with an optional decorative swatch. */
export type MenuOption = { value: string; label: string; swatch: string | null };

function selectedLabel(options: readonly MenuOption[], value: string, allLabel: string): string {
  for (const option of options) {
    if (option.value === value) return option.label;
  }
  return allLabel;
}

function inMenu(target: EventTarget | null, menuId: string): boolean {
  if (!(target instanceof Element)) return false;
  return target.closest(`[data-shops-menu="${menuId}"]`) !== null;
}

/**
 * Custom listbox for one homepage shop filter.
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
  const menuId = useId();
  const labelId = useId();
  const listboxId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);

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
    let chosen = '';
    let cursor = 0;
    for (const option of options) {
      if (cursor === index) chosen = option.value;
      cursor += 1;
    }
    return chosen;
  }

  function focusTrigger(): void {
    (triggerRef.current as HTMLButtonElement).focus();
  }

  function openAtCurrent(): void {
    setActiveIndex(highlightIndex());
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

  const optionClass = 'min-h-11 min-w-11 border-0 bg-transparent p-0 text-left font-inherit';

  return (
    <div data-shops-menu={menuId}>
      <span id={labelId}>{label}</span>
      <button
        ref={triggerRef}
        type="button"
        role="combobox"
        className="min-h-11 rounded-lg border border-[#ced1da] bg-[#fff] px-3"
        aria-controls={listboxId}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-labelledby={labelId}
        {...(open ? { 'aria-activedescendant': optionDomId(activeIndex) } : {})}
        onClick={toggle}
        onKeyDown={onTriggerKeyDown}
      >
        {selectedLabel(options, value, allLabel)}
      </button>
      {open ? (
        <div role="listbox" id={listboxId} aria-labelledby={labelId}>
          {options.map((option, index) => (
            <button
              key={option.value === '' ? 'all' : option.value}
              id={optionDomId(index)}
              type="button"
              role="option"
              tabIndex={-1}
              aria-selected={option.value === value}
              className={index === activeIndex ? `${optionClass} is-active` : optionClass}
              onClick={(event) => {
                event.stopPropagation();
                choose(event, option.value);
              }}
            >
              {option.swatch === null ? null : (
                <span className={option.swatch} aria-hidden="true" />
              )}
              {option.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
