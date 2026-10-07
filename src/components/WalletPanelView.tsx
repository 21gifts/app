'use client';

import type { ReactElement } from 'react';
import { useTranslations } from '@/components/LocaleProvider';
import { WalletReceive } from '@/components/WalletReceive';
import { WalletSend } from '@/components/WalletSend';
import { Card } from '@/components/ui';
import type { UseWalletSendResult } from '@/hooks/useWalletSend';

/** Props for {@link WalletPanelView}. */
export interface WalletPanelViewProps {
  /** The open view. */
  panel: 'receive' | 'send';
  /** Send flow state; the Send view needs it. */
  send: UseWalletSendResult | undefined;
  /** Whether the wallet is ready. */
  walletReady: boolean;
  /** Whether the Send input step shows its manual-entry sheet. */
  manualEntry: boolean;
  /** Opens or closes the manual-entry sheet. */
  onManualEntry: (open: boolean) => void;
}

/**
 * The open Receive or Send view as the page body (on `/wallet` and over
 * `/welcome`), with an `sr-only` **h1** **Wallet**. The Send input step's
 * camera fills the page port itself (see {@link WalletSend}).
 *
 * @param props - The open view, send flow, wallet readiness, and the manual-entry sheet.
 * @returns The view's column, or `null` for Send without a send flow.
 */
export function WalletPanelView({
  panel,
  send,
  walletReady,
  manualEntry,
  onManualEntry,
}: WalletPanelViewProps): ReactElement | null {
  const { t } = useTranslations();
  if (panel === 'send') {
    if (send === undefined) {
      return null;
    }
    return (
      <Card surface={false}>
        <h1 className="sr-only">{t('wallet.title')}</h1>
        <WalletSend
          send={send}
          walletReady={walletReady}
          manualEntry={manualEntry}
          onManualEntry={onManualEntry}
        />
      </Card>
    );
  }
  return (
    <Card surface={false}>
      <h1 className="sr-only">{t('wallet.title')}</h1>
      <WalletReceive />
    </Card>
  );
}
