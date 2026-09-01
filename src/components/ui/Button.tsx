import type { ButtonHTMLAttributes, ReactElement, ReactNode } from 'react';

/** Visual weight for {@link Button}. */
export type ButtonVariant = 'primary' | 'secondary' | 'accent';

/** Padding scale for {@link Button}. */
export type ButtonSize = 'sm' | 'md' | 'lg';

/** Props for {@link Button}. */
export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Filled primary, bordered secondary, or accent fill. Default `primary`. */
  variant?: ButtonVariant;
  /** Hit-target size. Default `md`. `lg` is full width. */
  size?: ButtonSize;
  /** Optional leading icon (decorative; button name comes from children). */
  icon?: ReactNode;
  /** Button label. */
  children: ReactNode;
}

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary: 'bg-app-btn text-app-btn-fg hover:bg-app-btn-hover disabled:opacity-50',
  secondary:
    'border border-app-border-strong bg-app-card text-app-fg hover:bg-app-hover disabled:opacity-50',
  accent: 'bg-app-accent text-app-accent-fg hover:opacity-90 disabled:opacity-50',
};

const SIZE_CLASS: Record<ButtonSize, string> = {
  sm: 'min-h-11 px-4 py-2',
  md: 'min-h-11 px-6 py-3',
  lg: 'min-h-11 w-full px-6 py-3',
};

/**
 * Labeled app button (primary filled, secondary bordered, or accent fill).
 *
 * @param props - Native button props plus {@link ButtonVariant} and size.
 * @returns The button element.
 */
export function Button({
  variant = 'primary',
  size = 'md',
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
      className={`inline-flex items-center justify-center gap-2 rounded-full text-sm font-medium transition ${SIZE_CLASS[size]} ${VARIANT_CLASS[variant]}${extra}`}
      {...rest}
    >
      {icon}
      {children}
    </button>
  );
}
