'use client';

import { useState, type ReactElement } from 'react';
import { Check, Copy } from 'lucide-react';
import { useTranslations } from '@/components/LocaleProvider';
import { QrCode } from '@/components/QrCode';
import { WalletOwnAddress } from '@/components/WalletOwnAddress';
import { IconButton, SegmentedControl } from '@/components/ui';
import { useCopied } from '@/hooks/useCopied';
import { isMainnetBitcoinAddress } from '@/lib/bitcoin-address';

/** Deposit method on the public Fond page. */
export type FondDepositMethod = 'lightning' | 'onchain';

/** Props for {@link FondDeposit}. */
export interface FondDepositProps {
  /** Fond handle; its 21.gifts address is the Lightning target. */
  username: string;
  /** The Fond wallet's on-chain deposit address from `GET /fond/summary`, or `null`. */
  onchainAddress: string | null;
}

/**
 * Deposit block of the public Fond page: **Instant payment** (Lightning: the
 * Fond's 21.gifts address through {@link WalletOwnAddress}) or **On-chain
 * deposit** (the Fond wallet's deposit address as a BIP21 QR). The labels are
 * the wallet's own names for those two methods.
 *
 * Instant payment is selected on every load. The selector appears only when the
 * summary carries an address that passes {@link isMainnetBitcoinAddress};
 * otherwise the block is Instant payment alone and nothing else is encoded.
 *
 * @param props - Fond handle and the summary's on-chain address.
 * @returns The deposit section.
 */
export function FondDeposit({ username, onchainAddress }: FondDepositProps): ReactElement {
  const { t } = useTranslations();
  const [method, setMethod] = useState<FondDepositMethod>('lightning');
  const { copied, copy } = useCopied();
  const onchain =
    onchainAddress !== null && isMainnetBitcoinAddress(onchainAddress) ? onchainAddress : null;
  return (
    <section
      aria-labelledby="fond-deposit-title"
      className="flex w-full flex-col items-center gap-3"
    >
      <h2 id="fond-deposit-title" className="text-lg font-semibold text-app-fg">
        {t('fond.depositTitle')}
      </h2>
      {onchain === null ? null : (
        <SegmentedControl
          tone="neutral"
          fullWidth={false}
          ariaLabel={t('fond.depositMethod')}
          value={method}
          onChange={setMethod}
          options={[
            { value: 'lightning', label: t('wallet.payment.method.lightning') },
            { value: 'onchain', label: t('wallet.payment.method.deposit') },
          ]}
        />
      )}
      {onchain !== null && method === 'onchain' ? (
        <>
          <p className="text-center text-sm text-app-muted">{t('fond.depositOnchainHint')}</p>
          <p className="w-full max-w-[266px] break-all text-center font-mono text-sm text-app-fg">
            {onchain}
          </p>
          <div className="w-full max-w-[266px] [&_svg]:h-auto [&_svg]:w-full">
            <QrCode value={`bitcoin:${onchain}`} label={t('fond.depositOnchainQr')} />
          </div>
          <IconButton
            type="button"
            variant="ghost"
            size="sm"
            aria-label={copied ? t('wallet.copied') : t('wallet.copy')}
            onClick={() => {
              void copy(onchain);
            }}
          >
            {copied ? (
              <Check aria-hidden="true" className="h-3.5 w-3.5 text-app-success" />
            ) : (
              <Copy aria-hidden="true" className="h-3.5 w-3.5" />
            )}
          </IconButton>
          <p className="max-w-sm text-center text-xs text-app-muted">
            {t('fond.depositOnchainConfirmations')}
          </p>
        </>
      ) : (
        <WalletOwnAddress username={username} copy hint="fond.depositLightningHint" />
      )}
    </section>
  );
}
