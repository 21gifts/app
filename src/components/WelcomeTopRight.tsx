'use client';

import type { ReactElement } from 'react';
import Link from 'next/link';
import { SignedInChrome } from '@/components/SignedInChrome';
import { useTranslations } from '@/components/LocaleProvider';
import { useAuthStore } from '@/stores/auth-store';

/**
 * Top-right chrome of `/welcome`: account chrome when signed in, otherwise a log-in link.
 *
 * Signed-out visitors reach the welcome screen as guests, so the slot must not
 * assume a session.
 *
 * @returns The signed-in chrome or the log-in link.
 */
export function WelcomeTopRight(): ReactElement {
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
