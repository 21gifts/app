import type { ButtonHTMLAttributes, ReactElement, ReactNode } from 'react';

/** Visual weight for {@link IconButton}. */
export type IconButtonVariant = 'primary' | 'secondary' | 'ghost';

/** Props for {@link IconButton}. */
export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Accessible name (required for icon-only controls). */
  'aria-label': string;
  /** Icon node (`aria-hidden` expected on the glyph). */
  children: ReactNode;
  /** Filled, bordered, or bare. Default `secondary`. */
  variant?: IconButtonVariant;
  /** Hit-target size. Default `md`. */
  size?: 'sm' | 'md' | 'lg';
}

const VARIANT_CLASS: Record<IconButtonVariant, string> = {
  primary: 'bg-app-btn text-app-btn-fg hover:bg-app-btn-hover',
  secondary: 'border border-app-border-strong text-app-fg hover:bg-app-hover',
  ghost: 'text-app-muted hover:bg-app-hover hover:text-app-fg',
};

const SIZE_CLASS: Record<NonNullable<IconButtonProps['size']>, string> = {
  sm: 'h-6 w-6',
  md: 'h-10 w-10',
  lg: 'h-11 w-11',
};

/**
 * Icon-only control with a required accessible name.
 *
 * @param props - Native button props plus variant/size.
 * @returns The icon button element.
 */
export function IconButton({
  children,
  variant = 'secondary',
  size = 'md',
  className,
  type = 'button',
  ...rest
}: IconButtonProps): ReactElement {
  const extra = className === undefined || className === '' ? '' : ` ${className}`;
  return (
    <button
      type={type}
      className={`inline-flex shrink-0 items-center justify-center rounded-full leading-none transition disabled:cursor-not-allowed disabled:opacity-50 ${SIZE_CLASS[size]} ${VARIANT_CLASS[variant]}${extra}`}
      {...rest}
    >
      {children}
    </button>
  );
}
