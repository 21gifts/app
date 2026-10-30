'use client';

import { Loader2, QrCode as QrCodeIcon, Trash2 } from 'lucide-react';
import type { ReactElement } from 'react';
import { AppShellTopLeft } from '@/components/AppShell';
import { BusyLine } from '@/components/BusyLine';
import { InlineConfirm } from '@/components/InlineConfirm';
import { useTranslations } from '@/components/LocaleProvider';
import { ProfileChromeLeft } from '@/components/ProfileChromeLeft';
import { QrCode } from '@/components/QrCode';
import { QrScanner } from '@/components/QrScanner';
import { Button, Card, IconButton } from '@/components/ui';
import { useHeldShares, type HeldSharesNotice } from '@/hooks/useHeldShares';
import type { WalletPhraseErrorKind } from '@/hooks/useWalletPhrase';
import type { MessageKey } from '@/lib/messages';
import { useAuthStore } from '@/stores/auth-store';

/** Catalog key of each refusal notice. */
const REFUSAL_COPY: Record<Exclude<HeldSharesNotice['kind'], 'stored'>, MessageKey> = {
  invalid: 'shareCode.invalid',
  own: 'heldShares.own',
  duplicate: 'heldShares.duplicate',
  saveError: 'heldShares.saveError',
  deleteError: 'heldShares.deleteError',
};

/** Catalog key of each passkey failure of **Open my shares**, as on the recovery phrase. */
const UNLOCK_ERROR_COPY: Record<WalletPhraseErrorKind, MessageKey> = {
  prfUnsupported: 'wallet.prfUnsupported',
  timeout: 'wallet.timeout',
  generic: 'wallet.errorGeneric',
};

/** Classes of the screen's muted centred lines. */
const BODY = 'text-center text-sm text-app-muted';

/** Classes of one row of the list. */
const ROW = 'flex flex-col gap-3 rounded-lg border border-app-border p-3';

/**
 * `/settings/held-shares`: the shares the signed-in member keeps for other
 * members' social recovery ({@link useHeldShares}). Every state shows the
 * title and the intro. While the boxes open, a status line says so. When no
 * words are in tab memory, the muted passkey hint and **Open my shares** ask
 * for the passkey; a failed prompt shows the recovery phrase's wording above
 * the button. Boxes that cannot be read give an alert with **Try again**. The
 * list shows the notice of the last scan (`role="status"` when a share was
 * kept, `role="alert"` when it was refused or a delete failed), **Keep a
 * share** (a status line while a scanned share is kept), then either the
 * empty line or one card per share with the owner's username and two
 * icon-only ghost buttons: the QR icon shows that share's code, and the trash
 * icon opens a confirm (check deletes, X keeps). When boxes do not open with
 * the current words, one neutral row says how many, with a trash icon and the
 * same confirm. **Keep a share** fills the page with the camera layer of the
 * wallet Send view, with the share wording of {@link QrScanner}. The code view
 * shows whose share it is, that it is only shown to its owner in person, and
 * the QR without a logo. The one top-left arrow steps from the camera or a
 * code back to the list, otherwise it returns to the previous view.
 *
 * @returns The screen, or `null` before the account has loaded.
 */
export function HeldSharesScreen(): ReactElement | null {
  const { t } = useTranslations();
  const signedIn = useAuthStore((state) => state.account !== null);
  const held = useHeldShares();
  if (!signedIn) {
    return null;
  }
  const chrome = (
    <AppShellTopLeft>
      <ProfileChromeLeft onBackClick={held.back} />
    </AppShellTopLeft>
  );
  const title = <h1 className="sr-only">{t('heldShares.title')}</h1>;

  if (held.view === 'scan') {
    return (
      <>
        {chrome}
        {title}
        <section
          aria-label={t('heldShares.keep')}
          data-port-fill=""
          className="absolute inset-0 overflow-hidden rounded-b-[calc(1.5rem-1px)] bg-black text-white"
        >
          <QrScanner
            onResult={held.onScanResult}
            copy={{
              hint: 'heldShares.scanHint',
              denied: 'heldShares.cameraDenied',
              unavailable: 'heldShares.cameraUnavailable',
            }}
          />
        </section>
      </>
    );
  }

  if (held.view !== 'list') {
    const { code, ownerUsername: username } = held.view.qr;
    return (
      <Card surface={false}>
        {chrome}
        {title}
        <h2 className="text-center text-xl font-semibold tracking-tight text-app-fg">
          {t('heldShares.qrTitle', { username })}
        </h2>
        <p className="text-center text-sm text-app-muted">{t('heldShares.qrBody', { username })}</p>
        <QrCode value={code} label={t('heldShares.qrLabel')} />
      </Card>
    );
  }

  const heading = (
    <>
      {chrome}
      <h1 className="text-center text-2xl font-semibold tracking-tight text-app-fg sm:text-3xl">
        {t('heldShares.title')}
      </h1>
      <p className={BODY}>{t('heldShares.intro')}</p>
    </>
  );

  if (held.load === 'opening') {
    return (
      <Card surface={false}>
        {heading}
        <BusyLine label={t('heldShares.opening')} />
      </Card>
    );
  }

  if (held.load === 'unlock') {
    return (
      <Card surface={false}>
        {heading}
        <p className={BODY}>{t('heldShares.unlockHint')}</p>
        {held.unlockError === null ? null : (
          <p role="alert" className="text-center text-sm text-app-danger">
            {t(UNLOCK_ERROR_COPY[held.unlockError])}
          </p>
        )}
        <Button
          type="button"
          size="lg"
          onClick={held.unlock}
          disabled={held.unlocking}
          icon={
            held.unlocking ? (
              <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
            ) : undefined
          }
        >
          {t('heldShares.unlock')}
        </Button>
      </Card>
    );
  }

  if (held.load === 'loadError') {
    return (
      <Card surface={false}>
        {heading}
        <p role="alert" className="text-center text-sm text-app-danger">
          {t('heldShares.loadError')}
        </p>
        <Button type="button" onClick={held.reload}>
          {t('login.retry')}
        </Button>
      </Card>
    );
  }

  const notice = held.notice;
  const noticeVars = { username: notice?.username ?? '' };
  const lockedCount = held.lockedCount;
  return (
    <Card surface={false}>
      {heading}
      {notice === null ? null : notice.kind === 'stored' ? (
        <p role="status" className="text-center text-sm font-medium text-app-success">
          {t('heldShares.stored', noticeVars)}
        </p>
      ) : (
        <p role="alert" className="text-center text-sm text-app-danger">
          {t(REFUSAL_COPY[notice.kind], noticeVars)}
        </p>
      )}
      {held.saving ? (
        <BusyLine label={t('heldShares.saving')} />
      ) : (
        <Button type="button" size="lg" onClick={held.scan}>
          {t('heldShares.keep')}
        </Button>
      )}
      {held.shares.length === 0 && lockedCount === 0 ? (
        <p className={BODY}>{t('heldShares.empty')}</p>
      ) : (
        <ul className="flex w-full flex-col gap-3">
          {held.shares.map((share) => {
            const username = share.ownerUsername;
            const confirming = held.confirmDelete === share.boxId;
            return (
              <li key={share.boxId} className={ROW}>
                <div className="flex items-center justify-between gap-3">
                  <p className="min-w-0 truncate text-sm font-medium text-app-fg">
                    {t('heldShares.owner', { username })}
                  </p>
                  <div className="flex shrink-0 items-center gap-1">
                    <IconButton
                      type="button"
                      variant="ghost"
                      aria-label={t('heldShares.show', { username })}
                      onClick={() => {
                        held.showQr(share);
                      }}
                    >
                      <QrCodeIcon aria-hidden="true" className="h-4 w-4" />
                    </IconButton>
                    {confirming ? null : (
                      <IconButton
                        type="button"
                        variant="ghost"
                        aria-label={t('heldShares.delete', { username })}
                        onClick={() => {
                          held.askDelete(share);
                        }}
                      >
                        <Trash2 aria-hidden="true" className="h-4 w-4 text-app-danger" />
                      </IconButton>
                    )}
                  </div>
                </div>
                {confirming ? (
                  <InlineConfirm
                    label={t('heldShares.deleteConfirm', { username })}
                    confirmLabel={t('heldShares.deleteYes')}
                    cancelLabel={t('heldShares.deleteNo')}
                    onConfirm={() => {
                      held.remove(share);
                    }}
                    onCancel={held.cancel}
                  />
                ) : null}
              </li>
            );
          })}
          {lockedCount === 0 ? null : (
            <li className={ROW}>
              <div className="flex items-center justify-between gap-3">
                <p className="min-w-0 text-sm text-app-muted">
                  {lockedCount === 1
                    ? t('heldShares.lockedOne')
                    : t('heldShares.lockedMany', { count: lockedCount })}
                </p>
                {held.confirmDeleteLocked ? null : (
                  <IconButton
                    type="button"
                    variant="ghost"
                    aria-label={t('heldShares.deleteLocked')}
                    onClick={held.askDeleteLocked}
                  >
                    <Trash2 aria-hidden="true" className="h-4 w-4 text-app-danger" />
                  </IconButton>
                )}
              </div>
              {held.confirmDeleteLocked ? (
                <InlineConfirm
                  label={t('heldShares.deleteLockedConfirm')}
                  confirmLabel={t('heldShares.deleteYes')}
                  cancelLabel={t('heldShares.deleteNo')}
                  onConfirm={held.removeLocked}
                  onCancel={held.cancel}
                />
              ) : null}
            </li>
          )}
        </ul>
      )}
    </Card>
  );
}
