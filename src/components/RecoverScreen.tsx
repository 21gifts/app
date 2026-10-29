'use client';

import { Check, Fingerprint, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import type { ReactElement } from 'react';
import { AppShellTopLeft } from '@/components/AppShell';
import { BusyLine } from '@/components/BusyLine';
import { HomeWordmark } from '@/components/HomeWordmark';
import { LoginBlockedNotice } from '@/components/LoginBlockedNotice';
import { useTranslations } from '@/components/LocaleProvider';
import { OldWordsInput } from '@/components/OldWordsInput';
import { ProfileChromeLeft } from '@/components/ProfileChromeLeft';
import { Button, ButtonLink, Card } from '@/components/ui';
import { useRecoveryFlow } from '@/hooks/useRecoveryFlow';
import type { MessageKey } from '@/lib/messages';
import { returnToView } from '@/lib/view-history';
import type { RecoveryDone, RecoveryView } from '@/stores/recovery-store';

/** Catalog key of each refusal. */
const REFUSED_COPY: Record<Extract<RecoveryView, { step: 'refused' }>['reason'], MessageKey> = {
  not_found: 'recover.notFound',
  done: 'recover.alreadyDone',
  operator: 'recover.operator',
  otherAccount: 'shareCode.otherAccount',
  noWallet: 'recover.noWallet',
};

/** Catalog key of each passkey or wallet error on `found`. */
const FOUND_ERROR_COPY: Record<
  NonNullable<Extract<RecoveryView, { step: 'found' }>['error']>,
  MessageKey
> = {
  cancelled: 'recover.passkeyCancelled',
  timeout: 'wallet.timeout',
  prf: 'wallet.prfUnsupported',
  wallet: 'recover.walletError',
};

/** The three parts of the move in the checklist, in order. */
const MOVE_ROWS: ReadonlyArray<{ part: keyof RecoveryDone; label: MessageKey }> = [
  { part: 'account', label: 'recover.stepAccount' },
  { part: 'address', label: 'profile.giftsHeading' },
  { part: 'balance', label: 'wallet.balanceHeading' },
];

/** Centred muted body line. */
const BODY = 'text-center text-sm text-app-muted';

/** Step heading under the page title. */
const STEP_HEADING = 'text-center text-xl font-semibold tracking-tight text-app-fg';

/** Centred alert line. */
const ALERT = 'text-center text-sm text-app-danger';

/**
 * `/recover`: the signed-out social recovery of an account whose passkey is
 * lost ({@link useRecoveryFlow}), in the `/login` card's place and chrome.
 * Every view keeps the title **Recover your account**.
 *
 * - **Start:** what to have ready, **Scan two codes**, and **Type my 12 words**.
 * - **Scan / type:** {@link OldWordsInput}; the camera fills the page.
 * - **Opening:** **Opening the old wallet…**, or, while the address service is
 *   asked again after a pause, **Checking the account. This can take a few
 *   minutes.**
 * - **Blocked:** the login card's {@link LoginBlockedNotice}.
 * - **Refused:** the reason as an alert and **Start over**; an account that is
 *   already recovered also offers **Log in**, which returns to `/login`.
 * - **Retry:** the reason, **Try again**, and **Start over**.
 * - **Found:** the account's username as found, the note after a restart, what
 *   the new passkey is, an alert of the last try, and **Create new passkey**.
 * - **Transfer:** what moves, a checklist (account, 21.gifts address,
 *   balance) with a check for each part done, the waiting note, the error,
 *   and **Transfer**; after a `generic` error **Start over**, after a
 *   `balance` error **Move the balance later**.
 * - **Done:** the account is back, its new words, that Social Recovery must be
 *   set up again, the note about a balance that stayed, **Show new 12 words**,
 *   and **Secure my account**.
 *
 * The one top-left arrow steps from the camera or the words field back to the
 * start; otherwise it returns to the previous in-app view, and the recovery
 * stays in memory, so coming back resumes it.
 *
 * @returns The recovery screen.
 */
export function RecoverScreen(): ReactElement {
  const { t } = useTranslations();
  const router = useRouter();
  const recovery = useRecoveryFlow();
  const { view } = recovery;
  const chrome = (
    <AppShellTopLeft>
      <ProfileChromeLeft wordmark={<HomeWordmark />} onBackClick={recovery.back} />
    </AppShellTopLeft>
  );
  const title = (
    <h1 className="text-center text-lg font-medium text-app-fg">{t('recover.title')}</h1>
  );

  if (view.step === 'scan') {
    return (
      <>
        {chrome}
        <h1 className="sr-only">{t('recover.title')}</h1>
        <OldWordsInput mode="scan" onWords={recovery.onWords} />
      </>
    );
  }

  let body: ReactElement;
  switch (view.step) {
    case 'start':
      body = (
        <>
          <p className={BODY}>{t('recover.intro')}</p>
          <Button type="button" onClick={recovery.scan}>
            {t('recover.scan')}
          </Button>
          <Button type="button" variant="secondary" onClick={recovery.type}>
            {t('recover.type')}
          </Button>
        </>
      );
      break;
    case 'type':
      body = <OldWordsInput mode="type" onWords={recovery.onWords} />;
      break;
    case 'opening':
      body = <BusyLine label={t(view.waiting ? 'recover.openingWait' : 'recover.opening')} />;
      break;
    case 'blocked':
      body = <LoginBlockedNotice kind={view.kind} />;
      break;
    case 'refused':
      body = (
        <>
          <p role="alert" className={ALERT}>
            {t(REFUSED_COPY[view.reason])}
          </p>
          {view.reason === 'done' ? (
            <Button
              type="button"
              onClick={() => {
                recovery.startOver();
                returnToView('/login', router);
              }}
              icon={<Fingerprint aria-hidden="true" className="h-4 w-4" />}
            >
              {t('login.submit')}
            </Button>
          ) : null}
          <Button type="button" variant="secondary" onClick={recovery.startOver}>
            {t('recover.again')}
          </Button>
        </>
      );
      break;
    case 'retry':
      body = (
        <>
          <p role="alert" className={ALERT}>
            {t(view.reason === 'unavailable' ? 'recover.unavailable' : 'recover.walletError')}
          </p>
          <Button type="button" onClick={recovery.retry}>
            {t('login.retry')}
          </Button>
          <Button type="button" variant="secondary" onClick={recovery.startOver}>
            {t('recover.again')}
          </Button>
        </>
      );
      break;
    case 'found':
      body = (
        <>
          <h2 className={STEP_HEADING}>{t('recover.found', { username: view.username })}</h2>
          {view.restart ? (
            <p className="text-center text-sm font-medium text-app-fg">{t('recover.restart')}</p>
          ) : null}
          <p className={BODY}>{t('recover.foundBody')}</p>
          {view.error === null ? null : (
            <p role="alert" className={ALERT}>
              {t(FOUND_ERROR_COPY[view.error])}
            </p>
          )}
          <Button
            type="button"
            disabled={view.busy}
            onClick={recovery.createPasskey}
            icon={
              view.busy ? (
                <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
              ) : (
                <Fingerprint aria-hidden="true" className="h-4 w-4" />
              )
            }
          >
            {t('recover.createPasskey')}
          </Button>
        </>
      );
      break;
    case 'transfer':
      body = (
        <>
          <h2 className={STEP_HEADING}>{t('recover.transferTitle')}</h2>
          <p className={BODY}>{t('recover.transferBody')}</p>
          <ol className="flex w-full flex-col gap-2">
            {MOVE_ROWS.map(({ part, label }) => (
              <li
                key={part}
                className="flex min-h-11 items-center justify-between gap-3 rounded-lg border border-app-border px-3 py-2 text-sm text-app-fg"
              >
                {t(label)}
                {view.done[part] ? (
                  <Check
                    role="img"
                    aria-label={t('recover.stepDone')}
                    className="h-4 w-4 shrink-0 text-app-success"
                  />
                ) : null}
              </li>
            ))}
          </ol>
          {view.waiting ? (
            <p role="status" className={BODY}>
              {t('recover.transferWait')}
            </p>
          ) : null}
          {view.error === null ? null : (
            <p role="alert" className={ALERT}>
              {t(view.error === 'generic' ? 'recover.transferError' : 'recover.balanceError')}
            </p>
          )}
          <Button
            type="button"
            disabled={view.busy}
            onClick={recovery.transfer}
            {...(view.busy
              ? { icon: <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> }
              : {})}
          >
            {t('recover.transfer')}
          </Button>
          {view.error === 'generic' ? (
            <Button type="button" variant="secondary" onClick={recovery.startOver}>
              {t('recover.again')}
            </Button>
          ) : null}
          {view.error === 'balance' ? (
            <Button type="button" variant="secondary" onClick={recovery.balanceLater}>
              {t('recover.balanceLater')}
            </Button>
          ) : null}
        </>
      );
      break;
    case 'done':
      body = (
        <>
          <h2 className={STEP_HEADING}>{t('recover.doneTitle')}</h2>
          <p className={BODY}>{t('recover.doneBody')}</p>
          <p className="text-center text-sm font-medium text-app-fg">{t('recover.doneShares')}</p>
          {view.balanceMissing ? <p className={BODY}>{t('recover.balanceMissing')}</p> : null}
          <ButtonLink href="/wallet/phrase">{t('recover.showWords')}</ButtonLink>
          <ButtonLink href="/settings/social-recovery" variant="secondary">
            {t('socialRecovery.secure')}
          </ButtonLink>
        </>
      );
      break;
  }

  return (
    <Card surface={false}>
      {chrome}
      {title}
      {body}
    </Card>
  );
}
