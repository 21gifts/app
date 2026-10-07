'use client';

import type { ReactElement } from 'react';
import { Loader2 } from 'lucide-react';
import { AppShellTopLeft } from '@/components/AppShell';
import { useTranslations } from '@/components/LocaleProvider';
import { ProfileChromeLeft } from '@/components/ProfileChromeLeft';
import { WalletBalance } from '@/components/WalletBalance';
import { WalletFooterActions } from '@/components/WalletFooterActions';
import { WalletHistory } from '@/components/WalletHistory';
import { WalletPanelView } from '@/components/WalletPanelView';
import { Button, Card } from '@/components/ui';
import type { UseWalletResult } from '@/hooks/useWallet';
import { useWalletPanel } from '@/hooks/useWalletPanel';
import type { UseWalletPhraseResult } from '@/hooks/useWalletPhrase';
import type { UseWalletSendResult } from '@/hooks/useWalletSend';

/** Which wallet body to render. `entry` is `/wallet`. `phrase` is `/wallet/phrase`. */
export type WalletSurface = 'entry' | 'phrase';

/** Props for {@link WalletScreenView}. */
export type WalletScreenViewProps = UseWalletPhraseResult & {
  /** Wallet home or the recovery subpage. Default `entry`. */
  surface?: WalletSurface;
  /** Balance block state. Entry surface only. */
  wallet?: UseWalletResult;
  /**
   * Send flow state. Its view opens from Send while the wallet is ready (or
   * after the unlock Send runs while it is locked) and stays while a send is
   * in flight, its Sent line shows, or a send alert is up. Entry surface only.
   */
  send?: UseWalletSendResult;
};

/**
 * `/wallet` home shows the large balance and, while the wallet is ready, the
 * payment list, with Receive and Send side by side in the shell footer
 * (`WalletFooterActions`, Receive on the left). Recovery-phrase access lives
 * on `/settings`. The views and their Back steps come from `useWalletPanel`,
 * shared with `/welcome`: Send opens the send flow while the wallet is ready
 * (while it is locked, after the existing unlock); Receive opens the address,
 * QR, and Set an amount. The Send view stays while a send is in flight, its
 * Sent line shows, or a send alert is up, and Done returns home. Back first
 * closes the manual-entry sheet or an open send step (or is held while a send
 * is in flight), then returns from Send or Receive to home. The 12 words and
 * recovery errors render only on `/wallet/phrase`.
 *
 * @param props - Phrase state, surface, and optional wallet balance and send state.
 * @returns The card, and the one-step Back registered through `AppShellTopLeft`.
 */
export function WalletScreenView({
  surface = 'entry',
  view,
  status,
  error,
  words,
  activate,
  showPhrase,
  hidePhrase,
  retry,
  wallet,
  send,
}: WalletScreenViewProps): ReactElement {
  const { t } = useTranslations();
  const busy = status === 'busy';
  const showGrid = view === 'phrase' && words.length === 12;
  const walletReady = wallet?.status === 'ready';
  const panel = useWalletPanel({ send, wallet });
  const shown = panel.shown;
  const stepBack = (): boolean => {
    if (surface === 'phrase') {
      if (showGrid) {
        hidePhrase();
        return true;
      }
      return false;
    }
    return panel.stepBack();
  };
  const hasError = error === 'prfUnsupported' || error === 'timeout' || error === 'generic';
  const errorCopy =
    error === 'prfUnsupported'
      ? t('wallet.prfUnsupported')
      : error === 'timeout'
        ? t('wallet.timeout')
        : t('wallet.errorGeneric');
  const spinner = busy ? (
    <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
  ) : undefined;
  const phraseBody = hasError ? (
    <>
      <p role="alert" className="text-center text-sm text-app-danger">
        {errorCopy}
      </p>
      <p className="text-center text-sm text-app-muted">{t('wallet.errorHint')}</p>
      <Button type="button" onClick={retry} disabled={busy} icon={spinner}>
        {t('login.retry')}
      </Button>
    </>
  ) : showGrid ? (
    <>
      <ol className="grid w-full grid-cols-2 gap-2">
        {words.map((word, index) => (
          <li
            key={`${index}-${word}`}
            className="flex gap-2 rounded-lg border border-app-border bg-app-card px-3 py-2 text-sm"
          >
            <span className="tabular-nums text-app-muted">{index + 1}</span>
            <span className="font-medium">{word}</span>
          </li>
        ))}
      </ol>
      <p className="text-sm text-app-muted">{t('wallet.onlyBackup')}</p>
    </>
  ) : view === 'activate' ? (
    <>
      <p className="text-center text-sm text-app-muted">{t('wallet.addPhraseHint')}</p>
      <Button
        variant="primary"
        onClick={() => {
          void activate();
        }}
        disabled={busy}
        icon={spinner}
      >
        {t('wallet.addPhrase')}
      </Button>
    </>
  ) : (
    <Button
      variant="secondary"
      onClick={() => {
        void showPhrase();
      }}
      disabled={busy}
      icon={spinner}
    >
      {t('wallet.showPhrase')}
    </Button>
  );
  const chrome = (
    <AppShellTopLeft>
      <ProfileChromeLeft onBackClick={stepBack} />
    </AppShellTopLeft>
  );
  if (surface === 'phrase') {
    return (
      <div className="flex w-full flex-col items-center gap-6">
        <Card surface={false}>
          {chrome}
          <h1 className="text-center text-2xl font-semibold tracking-tight sm:text-3xl">
            {t('wallet.title')}
          </h1>
          {phraseBody}
        </Card>
      </div>
    );
  }
  if (shown !== 'none') {
    return (
      <>
        {chrome}
        <WalletPanelView
          panel={shown}
          send={send}
          walletReady={walletReady}
          manualEntry={panel.manualEntry}
          onManualEntry={panel.setManualEntry}
        />
      </>
    );
  }
  return (
    <div className="flex w-full flex-col items-center gap-6">
      <Card surface={false}>
        {chrome}
        <h1 className="sr-only">{t('wallet.title')}</h1>
        {wallet === undefined || wallet.status === 'disabled' ? null : (
          <div className="flex min-h-48 w-full flex-col items-center justify-center py-6">
            <WalletBalance
              status={wallet.status}
              balanceSats={wallet.balanceSats}
              onUnlock={wallet.unlock}
              onRetry={wallet.retry}
              prfUnsupported={wallet.prfUnsupported}
            />
          </div>
        )}
      </Card>
      {walletReady ? <WalletHistory /> : null}
      <WalletFooterActions
        onReceive={panel.openReceive}
        onSend={panel.openSend}
        sendDisabled={panel.sendDisabled}
        focus={panel.returnFocus}
      />
    </div>
  );
}
