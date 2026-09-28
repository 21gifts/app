'use client';

import type { ReactElement } from 'react';
import { useTranslations } from '@/components/LocaleProvider';

/**
 * Info shown in the installed macOS Chrome app. The passkey buttons stay.
 *
 * @returns The heading and body copy.
 */
export function MacChromiumAppPasskeyNote(): ReactElement {
  const { t } = useTranslations();
  return (
    <div className="flex w-full flex-col items-center gap-2">
      <h2 className="text-center text-lg font-medium text-app-fg">{t('passkey.macAppHeading')}</h2>
      <p className="text-center text-sm text-app-muted">{t('passkey.macAppBody')}</p>
    </div>
  );
}
