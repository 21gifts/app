'use client';

import type { ReactElement, ReactNode } from 'react';
import { useTranslations } from '@/components/LocaleProvider';
import { PreviousWalletsRow } from '@/components/PreviousWalletsRow';
import { ButtonLink, Card } from '@/components/ui';
import { useAuthStore } from '@/stores/auth-store';

/** Classes of a section's muted explanation. */
const BODY = 'text-center text-sm text-app-muted';

/**
 * One titled part of the screen.
 *
 * @param props - The section's id, its heading, and its content.
 * @returns The section.
 */
function SecuritySection(props: {
  id: string;
  heading: string;
  children: ReactNode;
}): ReactElement {
  return (
    <section
      id={props.id}
      aria-labelledby={`${props.id}-heading`}
      className="flex w-full scroll-mt-4 flex-col items-stretch gap-4 border-t border-app-border pt-6 first-of-type:border-t-0 first-of-type:pt-0"
    >
      <h2 id={`${props.id}-heading`} className="text-sm font-semibold text-app-muted">
        {props.heading}
      </h2>
      {props.children}
    </section>
  );
}

/**
 * `/security`: **Protect my account** (whether Social Recovery is set up for
 * the current wallet and **Secure my account**, primary until it is, hidden
 * without a verified wallet), **Help someone else** (**Shares I keep for
 * others**), and **More options** (the recovery phrase, or the add hint and
 * **Add recovery phrase**, and the previous wallets after a recovery).
 *
 * @returns The screen, or `null` before the account has loaded.
 */
export function SecurityScreen(): ReactElement | null {
  const { t } = useTranslations();
  const session = useAuthStore((state) => state.session);
  const account = useAuthStore((state) => state.account);
  if (session === null || account === null) {
    return null;
  }
  const verified = account.sparkWalletVerified === true;
  const setUp = verified && account.socialRecoverySetUp === true;
  const status = !verified
    ? t('socialRecovery.statusNoWallet')
    : setUp
      ? t('socialRecovery.statusOn')
      : t('socialRecovery.statusOff');
  const credentialId = account.passkeyCredentialId;
  const hasPhrase = typeof credentialId === 'string' && credentialId !== '';
  return (
    <Card surface={false}>
      <h1 className="text-center text-2xl font-semibold tracking-tight text-app-fg sm:text-3xl">
        {t('nav.security')}
      </h1>
      <SecuritySection id="protect" heading={t('security.protect')}>
        <p className={BODY}>{status}</p>
        {verified ? (
          <ButtonLink
            href="/settings/social-recovery"
            variant={setUp ? 'secondary' : 'primary'}
            size="lg"
          >
            {t('socialRecovery.secure')}
          </ButtonLink>
        ) : null}
      </SecuritySection>
      <SecuritySection id="help-others" heading={t('security.help')}>
        <p className={BODY}>{t('security.helpBody')}</p>
        <ButtonLink href="/settings/held-shares" variant="secondary" size="lg">
          {t('socialRecovery.heldLink')}
        </ButtonLink>
      </SecuritySection>
      <SecuritySection id="more" heading={t('security.more')}>
        {hasPhrase ? (
          <ButtonLink href="/wallet/phrase" variant="secondary" size="lg">
            {t('settings.recoveryPhrase')}
          </ButtonLink>
        ) : (
          <>
            <p className={BODY}>{t('wallet.addPhraseHint')}</p>
            <ButtonLink href="/wallet/phrase" size="lg">
              {t('wallet.addPhrase')}
            </ButtonLink>
          </>
        )}
        <PreviousWalletsRow />
      </SecuritySection>
    </Card>
  );
}
