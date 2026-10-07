'use client';

import { useEffect, useState, type ReactElement } from 'react';
import { Check, Copy } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from '@/components/LocaleProvider';
import { QrCode } from '@/components/QrCode';
import { Button, ButtonLink } from '@/components/ui';
import { giftsLightningAddress, openCryptoPayQrValue } from '@/lib/gifts-address';
import { profileQrLogo } from '@/lib/profile-qr-logo';
import { useAuthStore } from '@/stores/auth-store';

/**
 * Receive view of the wallet (on `/wallet` and over `/welcome`): the 21.gifts
 * address with a Copy control, its Open CryptoPay QR, and a link to `/pos` to
 * set an amount. Without a username it links to `/profile` instead.
 *
 * @returns The receive block.
 */
export function WalletReceive(): ReactElement {
  const { t } = useTranslations();
  const account = useAuthStore((state) => state.account);
  const [showQr, setShowQr] = useState(false);
  /** Successful copies so far; each one restarts the two-second Copied label. */
  const [copies, setCopies] = useState(0);
  const copied = copies > 0;
  useEffect(() => {
    setShowQr(true);
  }, []);
  useEffect(() => {
    if (copies === 0) {
      return;
    }
    const timer = window.setTimeout(() => {
      setCopies(0);
    }, 2000);
    return () => window.clearTimeout(timer);
  }, [copies]);
  const copyAddress = async (text: string): Promise<void> => {
    try {
      await navigator.clipboard.writeText(text);
      setCopies((count) => count + 1);
    } catch {
      // No clipboard here (an insecure page, or a refused write): the address stays readable.
    }
  };
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
      {address !== null ? (
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
          <Link href="/profile" className="underline">
            {t('pos.needUsername')}
          </Link>
        </p>
      ) : null}
      <ButtonLink href="/pos">{t('wallet.setAmount')}</ButtonLink>
    </>
  );
}
