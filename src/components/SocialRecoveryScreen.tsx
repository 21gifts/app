'use client';

import { Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import type { ReactElement } from 'react';
import { AppShellTopLeft } from '@/components/AppShell';
import { useTranslations } from '@/components/LocaleProvider';
import { ProfileChromeLeft } from '@/components/ProfileChromeLeft';
import { QrCode } from '@/components/QrCode';
import { Button, Card } from '@/components/ui';
import {
  useSocialRecoverySetup,
  type SocialRecoverySetupError,
} from '@/hooks/useSocialRecoverySetup';
import type { MessageKey } from '@/lib/messages';
import { returnToView } from '@/lib/view-history';
import { useAuthStore } from '@/stores/auth-store';

/** Catalog key of each error. */
const ERROR_COPY: Record<SocialRecoverySetupError, MessageKey> = {
  mismatch: 'secure.walletMismatch',
  wallet: 'secure.walletError',
  save: 'secure.saveError',
  changed: 'secure.walletChanged',
};

/** Centred muted body line. */
const BODY = 'text-center text-sm text-app-muted';

/** Step heading under the page title. */
const STEP_HEADING = 'text-center text-xl font-semibold tracking-tight text-app-fg';

/**
 * Spinner line in place of the step's action while it runs.
 *
 * @param props - `label`, the translated sentence.
 * @returns The status line.
 */
function BusyLine({ label }: { label: string }): ReactElement {
  return (
    <p role="status" className="flex items-center justify-center gap-2 text-sm text-app-muted">
      <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
      {label}
    </p>
  );
}

/**
 * `/settings/social-recovery`, **Secure my account**: the owner splits the
 * 12 words of the open wallet into Social Recovery shares
 * ({@link useSocialRecoverySetup}). Every step keeps the page title. The
 * intro explains the two people and the 21.gifts backup, warns that both
 * people together can take over the account, says that both need their own
 * account and that a video call must never show both codes, adds that old
 * parts stay valid when the account already has a setup, and offers
 * **Continue**, which turns into **Checking your wallet…** while the wallet
 * is checked. Person 1 and person 2 each get a step with what to do, their
 * code as a QR without a logo, a button saying that this person has scanned
 * it, and **Start again with new codes** for an app that refused the code;
 * person 2's step adds that it must be someone else. Then **Saving the
 * 21.gifts backup…**, and the done step whose **Done** returns to `/settings`
 * without a second copy of it in the history ({@link returnToView}). An error
 * replaces the step with its alert and **Try again**, except a wallet that is
 * not the account's, where only the arrow leaves. The one top-left arrow
 * steps from person 2 to person 1 to the intro, otherwise it returns to the
 * previous view.
 *
 * @returns The screen, or `null` before the account has loaded.
 */
export function SocialRecoveryScreen(): ReactElement | null {
  const { t } = useTranslations();
  const router = useRouter();
  const account = useAuthStore((state) => state.account);
  const setup = useSocialRecoverySetup();
  if (account === null) {
    return null;
  }

  let body: ReactElement;
  if (setup.error !== null) {
    body = (
      <>
        <p role="alert" className="text-center text-sm text-app-danger">
          {t(ERROR_COPY[setup.error])}
        </p>
        {setup.error === 'mismatch' ? null : (
          <Button type="button" onClick={setup.retry}>
            {t('login.retry')}
          </Button>
        )}
      </>
    );
  } else if (setup.codes !== null) {
    const n = setup.step === 'share2' ? 2 : 1;
    const code = n === 2 ? setup.codes[1] : setup.codes[0];
    body = (
      <>
        <h2 className={STEP_HEADING}>{t('secure.shareHeading', { n })}</h2>
        <div className="flex w-full flex-col gap-3">
          <p className={BODY}>{t('secure.shareBody', { n })}</p>
          {n === 2 ? (
            <p className="text-center text-sm font-medium text-app-fg">
              {t('secure.shareDifferent')}
            </p>
          ) : null}
        </div>
        <QrCode value={code} label={t('secure.shareQr', { n })} />
        <Button type="button" size="lg" onClick={setup.scanned}>
          {t('secure.scanned', { n })}
        </Button>
        <div className="flex w-full flex-col gap-3">
          <p className={BODY}>{t('secure.refusedHint')}</p>
          <Button type="button" variant="secondary" size="lg" onClick={setup.resplit}>
            {t('secure.resplit')}
          </Button>
        </div>
      </>
    );
  } else if (setup.step === 'saving') {
    body = <BusyLine label={t('secure.saving')} />;
  } else if (setup.step === 'done') {
    body = (
      <>
        <h2 className={STEP_HEADING}>{t('secure.doneTitle')}</h2>
        <p className={BODY}>{t('secure.doneBody')}</p>
        <Button
          type="button"
          size="lg"
          onClick={() => {
            returnToView('/settings', router);
          }}
        >
          {t('secure.done')}
        </Button>
      </>
    );
  } else {
    body = (
      <>
        <div className="flex w-full flex-col gap-3">
          <p className={BODY}>{t('secure.introBody')}</p>
          <p className="text-center text-sm font-medium text-app-fg">{t('secure.introWarning')}</p>
          <p className={BODY}>{t('secure.introAccounts')}</p>
          <p className={BODY}>{t('secure.introRemote')}</p>
          {account.socialRecoverySetUp === true ? (
            <p className={BODY}>{t('secure.introRenew')}</p>
          ) : null}
        </div>
        {setup.step === 'checking' ? (
          <BusyLine label={t('secure.checking')} />
        ) : (
          <Button type="button" size="lg" onClick={setup.start}>
            {t('secure.start')}
          </Button>
        )}
      </>
    );
  }

  return (
    <Card surface={false}>
      <AppShellTopLeft>
        <ProfileChromeLeft onBackClick={setup.back} />
      </AppShellTopLeft>
      <h1 className="text-center text-2xl font-semibold tracking-tight text-app-fg sm:text-3xl">
        {t('secure.title')}
      </h1>
      {body}
    </Card>
  );
}
