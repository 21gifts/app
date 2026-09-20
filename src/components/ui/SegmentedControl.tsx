import type { ReactElement } from 'react';

/** Visual tone for {@link SegmentedControl}. */
export type SegmentedControlTone = 'gift' | 'neutral';

/** Shell for gift tone (ignored for neutral). Default `app`. */
export type SegmentedControlShell = 'app' | 'dark';

/** One option in {@link SegmentedControl}. */
export type SegmentedControlOption<T extends string> = {
  /** Option value reported to `onChange`. */
  value: T;
  /** Visible label. */
  label: string;
  /** Numeric chip; omitted from the DOM when undefined or ≤ 0. */
  badge?: number;
  /** Accessible name when `badge` \> 0. */
  badgeAriaLabel?: string;
};

/** Props for {@link SegmentedControl}. */
export interface SegmentedControlProps<T extends string> {
  /** Active option value. */
  value: T;
  /** Options to render as pressed buttons. */
  options: readonly SegmentedControlOption<T>[];
  /** Called with the next value when an option is pressed. */
  onChange: (value: T) => void;
  /** Accessible name for the group. */
  ariaLabel: string;
  /** Gift (compact ₿|USD) or neutral (full-width forum pills). */
  tone: SegmentedControlTone;
  /** Gift on marketing-dark. Default `app`. Ignored for `neutral`. */
  shell?: SegmentedControlShell;
  /** Extra classes on the group. */
  className?: string;
}

const BADGE_CLASS =
  'ml-1 inline-flex min-w-5 items-center justify-center rounded-full bg-app-btn px-1.5 text-xs font-semibold leading-5 text-app-btn-fg';

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
 * @param badgeAriaLabel - Optional accessible name for the badged button.
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
 * Mutually exclusive option group (forum mode, ₿|USD chart scales). Neutral is
 * a single `role="group"` pill; Forum `!grid` still lays out the option buttons
 * via `className` on the group.
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
              aria-label={optionBadgeAriaLabel(opt.badge, opt.badgeAriaLabel)}
              onClick={() => onChange(opt.value)}
              className={`flex-1 rounded-full px-3 py-1.5 text-sm font-medium ${
                selected ? 'bg-app-btn text-app-btn-fg' : 'text-app-muted'
              }`}
            >
              {opt.label}
              {optionBadge(opt.badge)}
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
            aria-label={optionBadgeAriaLabel(opt.badge, opt.badgeAriaLabel)}
            onClick={() => onChange(opt.value)}
            className={`min-h-11 min-w-11 px-2 py-1 ${selected ? selectedClass : unselectedClass}`}
          >
            {opt.label}
            {optionBadge(opt.badge)}
          </button>
        );
      })}
    </div>
  );
}
