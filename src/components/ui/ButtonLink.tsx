import Link from 'next/link';
import type { ReactElement, ReactNode } from 'react';

/** Visual weight for {@link ButtonLink}. */
export type ButtonLinkVariant = 'primary' | 'secondary' | 'accent';

/** Padding scale for {@link ButtonLink}. */
export type ButtonLinkSize = 'chrome' | 'sm' | 'md' | 'lg';

/** Shell for secondary-on-ink vs app tokens. */
export type ButtonLinkTone = 'app' | 'dark';

/** Props for {@link ButtonLink}. */
export interface ButtonLinkProps {
  /** Destination. */
  href: string;
  /** Filled primary, bordered secondary, or accent fill. Default `primary`. */
  variant?: ButtonLinkVariant;
  /**
   * Hit-target size. Default `md`. `lg` is full width. `chrome` is the compact
   * page-chrome pill (12px text on phones, 14px from `sm`).
   */
  size?: ButtonLinkSize;
  /** App tokens or marketing ink. Default `app`. */
  tone?: ButtonLinkTone;
  /** Optional leading icon. */
  icon?: ReactNode;
  /** Visible label. */
  children: ReactNode;
  /** Extra classes. */
  className?: string;
  /** Accessible name when the visible label is not enough. */
  'aria-label'?: string;
  /** Optional action before an internal or external link is followed. */
  onClick?: () => void;
}

const SIZE_CLASS: Record<ButtonLinkSize, string> = {
  chrome: 'min-h-11 gap-1 px-1.5 py-1 text-xs sm:gap-1.5 sm:px-3 sm:text-sm',
  sm: 'min-h-11 gap-2 px-4 py-2 text-sm',
  md: 'min-h-11 gap-2 px-6 py-3 text-sm',
  lg: 'min-h-11 w-full gap-2 px-6 py-3 text-sm',
};

/**
 * Class list for a {@link ButtonLink} variant on a given shell.
 *
 * @param variant - Fill style.
 * @param tone - App or marketing-dark shell.
 * @returns Tailwind classes.
 */
function variantClass(variant: ButtonLinkVariant, tone: ButtonLinkTone): string {
  if (tone === 'dark') {
    if (variant === 'accent') {
      return 'bg-accent text-ink hover:opacity-90';
    }
    if (variant === 'secondary') {
      return 'border border-paper/20 text-paper hover:bg-paper/10';
    }
    return 'bg-paper text-ink hover:opacity-90';
  }
  if (variant === 'accent') {
    return 'bg-app-accent text-app-accent-fg hover:opacity-90';
  }
  if (variant === 'secondary') {
    return 'border border-app-border-strong bg-app-card text-app-fg hover:bg-app-hover';
  }
  return 'bg-app-btn text-app-btn-fg hover:bg-app-btn-hover';
}

/**
 * Labeled pill link that matches {@link Button} anatomy.
 *
 * @param props - See {@link ButtonLinkProps}.
 * @returns The link element.
 */
export function ButtonLink({
  href,
  variant = 'primary',
  size = 'md',
  tone = 'app',
  icon,
  children,
  className,
  onClick,
  'aria-label': ariaLabel,
}: ButtonLinkProps): ReactElement {
  const extra = className === undefined || className === '' ? '' : ` ${className}`;
  const classes = `inline-flex items-center justify-center rounded-full font-medium no-underline transition ${SIZE_CLASS[size]} ${variantClass(variant, tone)}${extra}`;
  const internal = href.startsWith('#') || (href.startsWith('/') && !href.startsWith('//'));
  const named = ariaLabel === undefined ? {} : { 'aria-label': ariaLabel };
  if (!internal) {
    return (
      <a href={href} className={classes} {...(onClick === undefined ? {} : { onClick })} {...named}>
        {icon}
        {children}
      </a>
    );
  }
  return (
    <Link
      href={href}
      className={classes}
      {...(onClick === undefined ? {} : { onClick })}
      {...named}
    >
      {icon}
      {children}
    </Link>
  );
}
