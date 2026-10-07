import type { ButtonHTMLAttributes, ReactElement, ReactNode, Ref } from 'react';

/** Visual weight for {@link Button}. */
export type ButtonVariant = 'primary' | 'secondary' | 'accent' | 'overlay';

/** Padding scale for {@link Button}. */
export type ButtonSize = 'sm' | 'md' | 'lg';

/** Shell for secondary-on-ink vs app tokens. */
export type ButtonTone = 'app' | 'dark';

/** Props for {@link Button}. */
export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /**
   * Filled primary, bordered secondary, accent fill, or `overlay` (a dark
   * translucent pill with white text over a camera picture). Default `primary`.
   */
  variant?: ButtonVariant;
  /** Hit-target size. Default `md`. `lg` is full width. */
  size?: ButtonSize;
  /** App tokens or marketing ink. Default `app`. */
  tone?: ButtonTone;
  /** Optional leading icon (decorative; button name comes from children). */
  icon?: ReactNode;
  /** Button label. */
  children: ReactNode;
  /** The rendered `<button>` (to move focus to it). */
  ref?: Ref<HTMLButtonElement>;
}

const SIZE_CLASS: Record<ButtonSize, string> = {
  sm: 'min-h-11 px-4 py-2',
  md: 'min-h-11 px-6 py-3',
  lg: 'min-h-11 w-full px-6 py-3',
};

/**
 * Class list for a {@link Button} variant on a given shell.
 *
 * @param variant - Fill style.
 * @param tone - App or marketing-dark shell.
 * @returns Tailwind classes.
 */
function variantClass(variant: ButtonVariant, tone: ButtonTone): string {
  if (variant === 'overlay') {
    return 'bg-black/55 text-white backdrop-blur-md hover:bg-black/70 disabled:cursor-not-allowed disabled:opacity-50';
  }
  if (tone === 'dark') {
    if (variant === 'accent') {
      return 'bg-accent text-ink hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50';
    }
    if (variant === 'secondary') {
      return 'border border-paper/20 text-paper hover:bg-paper/10 disabled:cursor-not-allowed disabled:opacity-50';
    }
    return 'bg-paper text-ink hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50';
  }
  if (variant === 'accent') {
    return 'bg-app-accent text-app-accent-fg hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50';
  }
  if (variant === 'secondary') {
    return 'border border-app-border-strong bg-app-card text-app-fg hover:bg-app-hover disabled:cursor-not-allowed disabled:opacity-50';
  }
  return 'bg-app-btn text-app-btn-fg hover:bg-app-btn-hover disabled:cursor-not-allowed disabled:opacity-50';
}

/**
 * Labeled app button (primary filled, secondary bordered, accent fill, or a
 * dark translucent overlay pill over a camera picture).
 *
 * @param props - Native button props plus {@link ButtonVariant}, size, and {@link ButtonTone}.
 * @returns The button element.
 */
export function Button({
  variant = 'primary',
  size = 'md',
  tone = 'app',
  icon,
  children,
  className,
  type = 'button',
  ...rest
}: ButtonProps): ReactElement {
  const extra = className === undefined || className === '' ? '' : ` ${className}`;
  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center gap-2 rounded-full text-sm font-medium transition disabled:cursor-not-allowed ${SIZE_CLASS[size]} ${variantClass(variant, tone)}${extra}`}
      {...rest}
    >
      {icon}
      {children}
    </button>
  );
}
