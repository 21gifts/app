'use client';

import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { type ReactElement } from 'react';
import { useTranslations } from '@/components/LocaleProvider';
import { Wordmark } from '@/components/ui';

/**
 * Icon-only forum back plus wordmark for `/profile` `AppShell` `topLeft`.
 *
 * Back stays a link (navigation), with IconButton `md` geometry.
 *
 * @returns The profile top-left chrome.
 */
export function ProfileChromeLeft(): ReactElement {
  const { t } = useTranslations();
  return (
    <>
      <Link
        href="/welcome"
        aria-label={t('profile.back')}
        className="inline-flex h-11 w-11 items-center justify-center rounded-full text-app-muted transition hover:bg-app-hover hover:text-app-fg"
      >
        <ArrowLeft aria-hidden="true" className="h-5 w-5" />
      </Link>
      <Wordmark href="/welcome" />
    </>
  );
}
