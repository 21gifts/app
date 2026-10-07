'use client';

import type { ReactElement } from 'react';
import { useTranslations } from '@/components/LocaleProvider';
import { Button } from '@/components/ui';
import { useWalletSetup } from '@/hooks/useWalletSetup';

/**
 * Small note on a money screen (the `/wallet` balance, the pay slot, and the
 * point of sale) after the background wallet setup gave up: one sentence that
 * the wallet could not be set up, and a secondary **Try again** under it that
 * starts the setup again, the same shape as the pay slot's retry. It never
 * blocks the screen and has no dialog.
 *
 * @returns The note.
 */
export function WalletSetupNote(): ReactElement {
  const { t } = useTranslations();
  const { retry } = useWalletSetup();
  return (
    <div className="flex flex-col items-center gap-3">
      <p role="alert" className="px-6 text-center text-sm text-app-muted">
        {t('walletSetup.error')}
      </p>
      <Button type="button" variant="secondary" onClick={retry}>
        {t('login.retry')}
      </Button>
    </div>
  );
}
