import type { ButtonHTMLAttributes, ReactElement, ReactNode } from 'react';

/** Visual weight for {@link Button}. */
export type ButtonVariant = 'primary' | 'secondary';

/** Props for {@link Button}. */
export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Filled primary or bordered secondary. Default `primary`. */
  variant?: ButtonVariant;
  /** Optional leading icon (decorative; button name comes from children). */
  icon?: ReactNode;
  /** Button label. */
  children: ReactNode;
}

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary:
    'rounded-full bg-app-btn px-6 py-3 text-sm font-medium text-app-btn-fg transition hover:bg-app-btn-hover disabled:opacity-50',
  secondary:
    'rounded-full border border-app-border-strong bg-app-card px-6 py-3 text-sm font-medium text-app-fg transition hover:bg-app-hover disabled:opacity-50',
};

/**
 * Labeled app button (primary filled or secondary bordered).
 *
 * @param props - Native button props plus {@link ButtonVariant}.
 * @returns The button element.
 */
export function Button({
  variant = 'primary',
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
      className={`inline-flex items-center justify-center gap-2 ${VARIANT_CLASS[variant]}${extra}`}
      {...rest}
    >
      {icon}
      {children}
    </button>
  );
}
