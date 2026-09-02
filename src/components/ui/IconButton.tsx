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
  /** Painted size. Default `md`. `sm` keeps 24px paint with a 44px hit slop. */
  size?: 'sm' | 'md' | 'lg';
}

const VARIANT_CLASS: Record<IconButtonVariant, string> = {
  primary: 'bg-app-btn text-app-btn-fg hover:bg-app-btn-hover',
  secondary: 'border border-app-border-strong text-app-fg hover:bg-app-hover',
  ghost: 'text-app-muted hover:bg-app-hover hover:text-app-fg',
};

const SIZE_CLASS: Record<NonNullable<IconButtonProps['size']>, string> = {
  sm: "relative isolate h-6 w-6 before:absolute before:content-[''] before:block before:-inset-2.5 before:min-h-11 before:min-w-11 before:rounded-full",
  md: 'h-11 w-11',
  lg: 'h-12 w-12',
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
      <span className="relative z-10 inline-flex items-center justify-center">{children}</span>
    </button>
  );
}
