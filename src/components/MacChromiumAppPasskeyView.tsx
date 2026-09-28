'use client';

import type { ReactElement } from 'react';
import { useTranslations } from '@/components/LocaleProvider';

/**
 * Notice when a passkey ceremony cannot run in the installed macOS Chrome app.
 *
 * @returns The heading and body copy.
 */
export function MacChromiumAppPasskeyView(): ReactElement {
  const { t } = useTranslations();
  return (
    <>
      <h2 className="text-center text-lg font-medium text-app-fg">{t('passkey.macAppHeading')}</h2>
      <p className="text-center text-sm text-app-muted">{t('passkey.macAppBody')}</p>
    </>
  );
}
