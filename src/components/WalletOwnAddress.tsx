'use client';

import { useEffect, useState, type ReactElement } from 'react';
import { Check, Copy } from 'lucide-react';
import { useTranslations } from '@/components/LocaleProvider';
import { QrCode } from '@/components/QrCode';
import { Button } from '@/components/ui';
import { giftsLightningAddress, openCryptoPayQrValue } from '@/lib/gifts-address';
import { profileQrLogo } from '@/lib/profile-qr-logo';

/** Props for {@link WalletOwnAddress}. */
export interface WalletOwnAddressProps {
  /** Member username used for the 21.gifts address. */
  username: string;
  /** Whether to show the Copy / Copied control below the QR. */
  copy?: boolean;
}

/**
 * The member's own 21.gifts address and its Open CryptoPay QR.
 *
 * @param props - Username and optional Copy control.
 * @returns The address block, or `null` before the page host is known.
 */
export function WalletOwnAddress({
  username,
  copy = false,
}: WalletOwnAddressProps): ReactElement | null {
  const { t } = useTranslations();
  const [host, setHost] = useState<string | null>(null);
  const [copies, setCopies] = useState(0);
  const copied = copies > 0;
  useEffect(() => {
    setHost(window.location.hostname);
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
  if (host === null) {
    return null;
  }
  const address = giftsLightningAddress(username, host);
  const qr = openCryptoPayQrValue(username, host);
  /* v8 ignore next 3 -- callers render this only when the username gives an address */
  if (address === null || qr === null) {
    return null;
  }
  const copyAddress = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(address);
      setCopies((count) => count + 1);
    } catch {
      // The address remains readable when clipboard access is unavailable.
    }
  };
  return (
    <>
      <p className="text-center text-sm text-app-muted">{t('wallet.payAddFunds')}</p>
      <p className="min-w-0 max-w-full truncate text-center font-mono text-sm text-app-fg">
        {address}
      </p>
      <div className="w-full max-w-[266px] [&_svg]:h-auto [&_svg]:w-full">
        <QrCode value={qr} label={t('profile.giftsQr')} logo={profileQrLogo} />
      </div>
      {copy ? (
        <Button
          variant="secondary"
          size="sm"
          icon={
            copied ? (
              <Check aria-hidden="true" className="h-4 w-4" />
            ) : (
              <Copy aria-hidden="true" className="h-4 w-4" />
            )
          }
          onClick={() => {
            void copyAddress();
          }}
        >
          {copied ? t('wallet.copied') : t('wallet.copy')}
        </Button>
      ) : null}
    </>
  );
}
