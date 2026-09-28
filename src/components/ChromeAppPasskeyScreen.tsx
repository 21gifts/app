'use client';

import type { ReactElement } from 'react';
import { useTranslations } from '@/components/LocaleProvider';

/**
 * The explanation page for the installed macOS Chrome app.
 *
 * @returns Heading and body.
 */
export function ChromeAppPasskeyScreen(): ReactElement {
  const { t } = useTranslations();
  return (
    <div className="flex w-full max-w-md flex-col items-center gap-3">
      <h1 className="text-center text-lg font-medium text-app-fg">{t('passkey.macAppHeading')}</h1>
      <p className="text-center text-sm text-app-muted">{t('passkey.macAppBody')}</p>
    </div>
  );
}
