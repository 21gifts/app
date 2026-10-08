'use client';

import type { ReactElement } from 'react';
import Link from 'next/link';
import { SignedInChrome } from '@/components/SignedInChrome';
import { useTranslations } from '@/components/LocaleProvider';
import { useAuthStore } from '@/stores/auth-store';

/**
 * Top-right of `/habit-tracker`: the signed-in menu, or Log in.
 *
 * This is the client boundary. The page itself does not read the auth store.
 *
 * @returns Signed-in chrome, or a link to `/login`.
 */
export function HabitTrackerTopRight(): ReactElement {
  const { t } = useTranslations();
  const session = useAuthStore((state) => state.session);
  if (session !== null) {
    return <SignedInChrome />;
  }
  return (
    <Link href="/login" className="text-sm font-medium text-app-fg underline underline-offset-2">
      {t('nav.login')}
    </Link>
  );
}
