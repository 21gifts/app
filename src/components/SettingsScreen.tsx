'use client';

import type { ReactElement } from 'react';
import { useTranslations } from '@/components/LocaleProvider';
import { ButtonLink, Card } from '@/components/ui';
import { useAuthStore } from '@/stores/auth-store';

/**
 * Signed-in settings page. Its **Wallet** section opens the recovery phrase on
 * `/wallet/phrase`: **Recovery phrase** when the account has a
 * `passkeyCredentialId`, otherwise the add hint and **Add recovery phrase**.
 * Renders nothing without a session or before the account has loaded.
 *
 * @returns The settings card, or `null` without a session or account.
 */
export function SettingsScreen(): ReactElement | null {
  const { t } = useTranslations();
  const session = useAuthStore((state) => state.session);
  const account = useAuthStore((state) => state.account);
  if (session === null || account === null) {
    return null;
  }
  const credentialId = account.passkeyCredentialId;
  const hasPhrase = typeof credentialId === 'string' && credentialId !== '';
  return (
    <Card surface={false}>
      <h1 className="text-center text-2xl font-semibold tracking-tight text-app-fg sm:text-3xl">
        {t('settings.heading')}
      </h1>
      <section
        aria-labelledby="settings-wallet"
        className="flex w-full flex-col items-center gap-3"
      >
        <h2
          id="settings-wallet"
          className="text-center text-xs tracking-widest text-app-subtle uppercase"
        >
          {t('wallet.title')}
        </h2>
        {hasPhrase ? (
          <ButtonLink href="/wallet/phrase" variant="secondary" size="lg">
            {t('settings.recoveryPhrase')}
          </ButtonLink>
        ) : (
          <>
            <p className="text-center text-sm text-app-muted">{t('wallet.addPhraseHint')}</p>
            <ButtonLink href="/wallet/phrase" size="lg">
              {t('wallet.addPhrase')}
            </ButtonLink>
          </>
        )}
      </section>
    </Card>
  );
}
