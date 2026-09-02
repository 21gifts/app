import type { ReactElement } from 'react';

/** Visual tone for {@link SegmentedControl}. */
export type SegmentedControlTone = 'gift' | 'neutral';

/** Shell for gift tone (ignored for neutral). Default `app`. */
export type SegmentedControlShell = 'app' | 'dark';

/** Props for {@link SegmentedControl}. */
export interface SegmentedControlProps<T extends string> {
  /** Active option value. */
  value: T;
  /** Options to render as pressed buttons. */
  options: readonly { value: T; label: string }[];
  /** Called with the next value when an option is pressed. */
  onChange: (value: T) => void;
  /** Accessible name for the group. */
  ariaLabel: string;
  /** Gift (compact ₿|USD) or neutral (full-width forum pills). */
  tone: SegmentedControlTone;
  /** Gift on marketing-dark. Default `app`. Ignored for `neutral`. */
  shell?: SegmentedControlShell;
  /** Extra classes on the outer track. */
  className?: string;
}

/**
 * Mutually exclusive option group (forum mode, ₿|USD chart scales).
 *
 * @param props - See {@link SegmentedControlProps}.
 * @returns The group element.
 */
export function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
  tone,
  shell = 'app',
  className,
}: SegmentedControlProps<T>): ReactElement {
  const extra = className === undefined || className === '' ? '' : ` ${className}`;

  if (tone === 'neutral') {
    return (
      <div
        role="group"
        aria-label={ariaLabel}
        className={`flex w-full rounded-full border border-app-border bg-app-card-muted p-1${extra}`}
      >
        {options.map((opt) => {
          const selected = value === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              aria-pressed={selected}
              onClick={() => onChange(opt.value)}
              className={`flex-1 rounded-full px-3 py-1.5 text-sm font-medium ${
                selected ? 'bg-app-btn text-app-btn-fg' : 'text-app-muted'
              }`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    );
  }

  const dark = shell === 'dark';
  const track = dark
    ? 'inline-flex overflow-hidden rounded-md border border-paper/20 text-xs'
    : 'inline-flex overflow-hidden rounded-md border border-app-border text-xs';
  const selectedClass = dark ? 'bg-accent text-ink' : 'bg-app-accent text-app-accent-fg';
  const unselectedClass = dark ? 'text-paper/70' : 'text-app-muted';

  return (
    <div role="group" aria-label={ariaLabel} className={`${track}${extra}`}>
      {options.map((opt) => {
        const selected = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(opt.value)}
            className={`min-h-11 min-w-11 px-2 py-1 ${selected ? selectedClass : unselectedClass}`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
