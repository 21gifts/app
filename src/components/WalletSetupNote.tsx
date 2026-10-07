'use client';

import type { ReactElement } from 'react';
import { useTranslations } from '@/components/LocaleProvider';
import { useWalletSetup } from '@/hooks/useWalletSetup';

/**
 * Small inline note on a money screen (the `/wallet` balance, the pay slot,
 * and the point of sale) after the background wallet setup gave up: one
 * sentence that the wallet could not be set up, and an inline **Try again**
 * that starts the setup again. It never blocks the screen and has no dialog.
 *
 * @returns The note.
 */
export function WalletSetupNote(): ReactElement {
  const { t } = useTranslations();
  const { retry } = useWalletSetup();
  return (
    <p role="alert" className="px-6 text-center text-sm text-app-muted">
      {t('walletSetup.error')}{' '}
      <button type="button" onClick={retry} className="text-app-fg underline">
        {t('login.retry')}
      </button>
    </p>
  );
}
