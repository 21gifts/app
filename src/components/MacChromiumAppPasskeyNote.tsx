'use client';

import Link from 'next/link';
import type { ReactElement } from 'react';
import { useTranslations } from '@/components/LocaleProvider';

/**
 * One sentence and a link to `/login/chrome-app`, shown only in the installed
 * macOS Chrome app next to a passkey action. The explanation itself is that page.
 *
 * @returns The note.
 */
export function MacChromiumAppPasskeyNote(): ReactElement {
  const { t } = useTranslations();
  return (
    <p className="text-center text-sm text-app-muted">
      {t('passkey.macAppNote')}{' '}
      <Link href="/login/chrome-app" className="text-app-fg underline">
        {t('passkey.macAppHeading')}
      </Link>
    </p>
  );
}
