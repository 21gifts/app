'use client';

import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { type ReactElement } from 'react';
import { useTranslations } from '@/components/LocaleProvider';
import { Wordmark } from '@/components/ui';

/** Props for {@link ProfileChromeLeft}. */
export interface ProfileChromeLeftProps {
  /** Back link target. Default `/welcome`. */
  backHref?: string;
  /**
   * Catalog key for the icon-only back aria-label. Default `profile.back`;
   * `/moderate/group` passes `moderate.heading` with `backHref="/moderate"`.
   * `/wallet` passes `nav.back` when returning to a non-forum in-app page.
   */
  backLabelKey?: 'profile.back' | 'inbox.back' | 'moderate.heading' | 'nav.back';
  /**
   * Unmodified primary click. The link does not follow `backHref`. Modified
   * clicks still do. Wallet uses this for one step: hide the words, close
   * Advanced functions, go back, or open the forum.
   */
  onBackClick?: () => void;
}

/**
 * Shared signed-in top-left chrome: icon-only back plus wordmark to `/welcome`.
 *
 * Back stays a link, with IconButton `md` geometry. Optional `backHref` and
 * `backLabelKey` change the target and aria-label; defaults remain `/welcome`
 * and `profile.back`. An unmodified click with `onBackClick` runs that handler
 * and does not follow `backHref`.
 *
 * @param props - Optional back target, catalog key, and plain-click handler.
 * @returns The back link and wordmark.
 */
export function ProfileChromeLeft({
  backHref = '/welcome',
  backLabelKey = 'profile.back',
  onBackClick,
}: ProfileChromeLeftProps = {}): ReactElement {
  const { t } = useTranslations();
  return (
    <>
      <Link
        href={backHref}
        aria-label={t(backLabelKey)}
        className="inline-flex h-11 w-11 items-center justify-center rounded-full text-app-muted transition hover:bg-app-hover hover:text-app-fg"
        onClick={(event) => {
          if (onBackClick === undefined) {
            return;
          }
          if (
            event.metaKey ||
            event.ctrlKey ||
            event.shiftKey ||
            event.altKey ||
            event.button !== 0
          ) {
            return;
          }
          event.preventDefault();
          onBackClick();
        }}
      >
        <ArrowLeft aria-hidden="true" className="h-5 w-5" />
      </Link>
      <Wordmark href="/welcome" />
    </>
  );
}
