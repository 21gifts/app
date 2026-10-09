'use client';

import type { ReactElement } from 'react';
import Link from 'next/link';
import { SignedInChrome } from '@/components/SignedInChrome';
import { useTranslations } from '@/components/LocaleProvider';
import { useAuthStore } from '@/stores/auth-store';

/**
 * Top-right of `/habit-tracker`: the signed-in menu, or Log in. A held-back
 * session shows neither (the login card is in the page).
 *
 * This is the client boundary. The page itself does not read the auth store.
 *
 * @returns Signed-in chrome (empty while the wallet is not open), or a link to `/login`.
 */
export function HabitTrackerTopRight(): ReactElement {
  const { t } = useTranslations();
  const session = useAuthStore((state) => state.session);
  const lockedSession = useAuthStore((state) => state.lockedSession);
  // A held-back session gets the login card in the page, not a Log in link.
  if (session !== null || lockedSession !== null) {
    return <SignedInChrome />;
  }
  return (
    <Link href="/login" className="text-sm font-medium text-app-fg underline underline-offset-2">
      {t('nav.login')}
    </Link>
  );
}
