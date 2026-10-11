'use client';

import { useEffect, useState, type ReactElement } from 'react';
import { Check, Copy, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from '@/components/LocaleProvider';
import { QrCode } from '@/components/QrCode';
import { WalletSetupNote } from '@/components/WalletSetupNote';
import { Button, ButtonLink } from '@/components/ui';
import { useCopied } from '@/hooks/useCopied';
import { useWalletSetup } from '@/hooks/useWalletSetup';
import { giftsLightningAddress, openCryptoPayQrValue } from '@/lib/gifts-address';
import { requestMoveFunds } from '@/lib/move-funds';
import { profileQrLogo } from '@/lib/profile-qr-logo';
import { useAuthStore } from '@/stores/auth-store';

/**
 * Receive view of the wallet (on `/wallet` and over `/welcome`): the 21.gifts
 * address with a Copy control, its Open CryptoPay QR, and a link to `/pos` to
 * set an amount. Without a username it links to the address row of `/settings`
 * (`/settings#address`) instead. The view
 * opens also while the wallet's one-time setup still runs: until the address
 * is registered, **Opening your wallet…** stands where the address goes, and
 * a setup that gave up shows the inline setup note with **Try again**.
 * Under **Set an amount**, a member whose account once had an outside wallet
 * (`hadExternalWallet`) also gets the text button **Move Bitcoin from another
 * wallet**, which opens the move-funds flow (`requestMoveFunds`).
 *
 * @returns The receive block.
 */
export function WalletReceive(): ReactElement {
  const { t } = useTranslations();
  const account = useAuthStore((state) => state.account);
  const setup = useWalletSetup();
  const [showQr, setShowQr] = useState(false);
  const { copied, copy: copyAddress } = useCopied();
  useEffect(() => {
    setShowQr(true);
  }, []);
  /* v8 ignore next -- this client screen always runs in a browser */
  const host = typeof window === 'undefined' ? '21.gifts' : window.location.hostname;
  const username = account?.username ?? null;
  const address = giftsLightningAddress(username, host);
  const qr = openCryptoPayQrValue(username, host);
  return (
    <>
      <p className="text-center text-xs tracking-widest text-app-subtle uppercase">
        {t('wallet.receive')}
      </p>
      {setup.failed ? (
        <WalletSetupNote />
      ) : setup.due ? (
        <div className="flex flex-col items-center gap-2 py-6">
          <Loader2 aria-hidden="true" className="h-6 w-6 animate-spin text-app-subtle" />
          <p role="status" className="text-center text-sm text-app-muted">
            {t('wallet.connecting')}
          </p>
        </div>
      ) : address !== null ? (
        <div className="flex w-full flex-col items-center gap-4">
          {showQr && qr !== null ? (
            <QrCode value={qr} label={t('profile.giftsQr')} logo={profileQrLogo} />
          ) : null}
          <p className="text-center text-xs tracking-widest text-app-subtle uppercase">
            {t('profile.giftsHeading')}
          </p>
          <p className="w-full min-w-0 truncate text-center font-mono text-sm text-app-fg">
            {address}
          </p>
          <Button
            variant="secondary"
            icon={
              copied ? (
                <Check aria-hidden="true" className="h-4 w-4" />
              ) : (
                <Copy aria-hidden="true" className="h-4 w-4" />
              )
            }
            onClick={() => {
              void copyAddress(address);
            }}
          >
            {copied ? t('wallet.copied') : t('wallet.copy')}
          </Button>
        </div>
      ) : account !== null ? (
        <p className="text-center text-sm text-app-fg">
          <Link href="/settings#address" className="underline">
            {t('pos.needUsername')}
          </Link>
        </p>
      ) : null}
      <ButtonLink href="/pos">{t('wallet.setAmount')}</ButtonLink>
      {account?.hadExternalWallet === true ? (
        <button
          type="button"
          onClick={() => {
            requestMoveFunds('receive');
          }}
          className="min-h-11 text-sm text-app-muted underline underline-offset-2 hover:text-app-fg"
        >
          {t('moveFunds.open')}
        </button>
      ) : null}
    </>
  );
}
