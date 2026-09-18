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
   */
  backLabelKey?: 'profile.back' | 'inbox.back' | 'moderate.heading';
}

/**
 * Shared signed-in top-left chrome: icon-only back plus wordmark to `/welcome`.
 *
 * Back stays a link (navigation), with IconButton `md` geometry. Optional
 * `backHref` and `backLabelKey` change the back target and aria-label; defaults
 * remain `/welcome` and `profile.back`.
 *
 * @param props - Optional back target and catalog key.
 * @returns The back link and wordmark.
 */
export function ProfileChromeLeft({
  backHref = '/welcome',
  backLabelKey = 'profile.back',
}: ProfileChromeLeftProps = {}): ReactElement {
  const { t } = useTranslations();
  return (
    <>
      <Link
        href={backHref}
        aria-label={t(backLabelKey)}
        className="inline-flex h-11 w-11 items-center justify-center rounded-full text-app-muted transition hover:bg-app-hover hover:text-app-fg"
      >
        <ArrowLeft aria-hidden="true" className="h-5 w-5" />
      </Link>
      <Wordmark href="/welcome" />
    </>
  );
}
