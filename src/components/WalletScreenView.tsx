'use client';

import { useState, useEffect, type ReactElement } from 'react';
import { ArrowDownLeft, ArrowUpRight, Check, Copy, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { AppShellFooter, AppShellTopLeft } from '@/components/AppShell';
import { useTranslations } from '@/components/LocaleProvider';
import { QrCode } from '@/components/QrCode';
import { ProfileChromeLeft } from '@/components/ProfileChromeLeft';
import { WalletBalance } from '@/components/WalletBalance';
import { WalletHistory } from '@/components/WalletHistory';
import { WalletSend } from '@/components/WalletSend';
import { Button, ButtonLink, Card } from '@/components/ui';
import type { UseWalletResult } from '@/hooks/useWallet';
import type { UseWalletPhraseResult } from '@/hooks/useWalletPhrase';
import type { UseWalletSendResult } from '@/hooks/useWalletSend';
import { giftsLightningAddress, openCryptoPayQrValue } from '@/lib/gifts-address';
import { profileQrLogo } from '@/lib/profile-qr-logo';
import { useAuthStore } from '@/stores/auth-store';

/**
 * Whether the Send view must stay on screen: while a send is in flight, its
 * Sent line shows, or an alert is up, so neither Back nor a wallet that stops
 * being ready hides a payment that may already have left or the alert of one
 * that failed.
 *
 * @param send - Send flow state.
 * @returns Whether the Send view is pinned.
 */
function isSendPinned(send: UseWalletSendResult): boolean {
  return (
    send.busy ||
    send.state.step === 'sent' ||
    (send.state.step === 'input' && send.state.error !== null)
  );
}

/**
 * Receive view: the 21.gifts address with a Copy control, its Open CryptoPay
 * QR, and a link to `/pos` to set an amount.
 *
 * @returns The receive block.
 */
function WalletReceive(): ReactElement {
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

/** Which wallet body to render. `entry` is `/wallet`. `phrase` is `/wallet/phrase`. */
export type WalletSurface = 'entry' | 'phrase';

/** Props for {@link WalletScreenView}. */
export type WalletScreenViewProps = UseWalletPhraseResult & {
  /** Wallet home or the recovery subpage. Default `entry`. */
  surface?: WalletSurface;
  /** Balance block state. Entry surface only. */
  wallet?: UseWalletResult;
  /**
   * Send flow state. Its view opens from Send while the wallet is ready and
   * stays while a send is in flight, its Sent line shows, or a send alert is
   * up. Entry surface only.
   */
  send?: UseWalletSendResult;
};

/**
 * `/wallet` home shows the large balance and, while the wallet is ready, the
 * payment list, with Send and Receive side by side in the shell footer and the
 * recovery entry below them. Send opens the send flow while the wallet is
 * ready; Receive opens the address, QR, and Set an amount. The Send view stays
 * while a send is in flight, its Sent line shows, or a send alert is up, and
 * Done returns home. Back first closes an open send step (or is held while a
 * send is in flight), then returns from Send or Receive to home. The 12 words
 * and recovery errors render only on `/wallet/phrase`.
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
  const [homeView, setHomeView] = useState<'home' | 'send' | 'receive'>('home');
  const busy = status === 'busy';
  const showGrid = view === 'phrase' && words.length === 12;
  const walletReady = wallet?.status === 'ready';
  const sendStep = send?.state.step;
  // Leaving the Sent line (Done or Back) returns home, and a chosen Send view
  // closes when the wallet stops being ready. Both adjust during render, so no
  // commit shows the Send input (and its camera) in between.
  const [seen, setSeen] = useState({ sendStep, walletReady });
  if (seen.sendStep !== sendStep || seen.walletReady !== walletReady) {
    setSeen({ sendStep, walletReady });
    if (
      (seen.sendStep === 'sent' && sendStep !== 'sent') ||
      (!walletReady && homeView === 'send')
    ) {
      setHomeView('home');
    }
  }
  const shown =
    send !== undefined && isSendPinned(send)
      ? 'send'
      : homeView === 'send' && !walletReady
        ? 'home'
        : homeView;
  const stepBack = (): boolean => {
    if (surface === 'phrase') {
      if (showGrid) {
        hidePhrase();
        return true;
      }
      return false;
    }
    if (shown === 'send' && send !== undefined) {
      if (!send.cancel() && !send.busy) {
        send.setText('');
        setHomeView('home');
      }
      return true;
    }
    if (shown === 'receive') {
      setHomeView('home');
      return true;
    }
    return false;
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
  if (shown === 'send' && send !== undefined) {
    return (
      <Card surface={false}>
        {chrome}
        <h1 className="sr-only">{t('wallet.title')}</h1>
        <WalletSend send={send} walletReady={walletReady} />
      </Card>
    );
  }
  if (shown === 'receive') {
    return (
      <Card surface={false}>
        {chrome}
        <h1 className="sr-only">{t('wallet.title')}</h1>
        <WalletReceive />
      </Card>
    );
  }
  const actionIconClass = 'h-5 w-5';
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
            />
          </div>
        )}
      </Card>
      {walletReady ? <WalletHistory /> : null}
      <AppShellFooter>
        <div className="mx-auto flex w-full max-w-sm flex-col items-stretch gap-4">
          <div className="grid grid-cols-2 gap-3">
            <Button
              size="lg"
              className="min-h-14 text-base"
              icon={<ArrowUpRight aria-hidden="true" className={actionIconClass} />}
              disabled={send === undefined || !walletReady}
              onClick={() => {
                setHomeView('send');
              }}
            >
              {t('wallet.sendButton')}
            </Button>
            <Button
              size="lg"
              className="min-h-14 text-base"
              icon={<ArrowDownLeft aria-hidden="true" className={actionIconClass} />}
              onClick={() => {
                setHomeView('receive');
              }}
            >
              {t('wallet.receive')}
            </Button>
          </div>
          {view === 'activate' ? (
            <p className="text-center text-xs text-app-muted">
              {t('wallet.addPhraseHint')}{' '}
              <Link href="/wallet/phrase" className="text-app-fg underline">
                {t('wallet.addPhrase')}
              </Link>
            </p>
          ) : (
            <Link
              href="/wallet/phrase"
              className="self-center text-xs text-app-muted underline hover:text-app-fg"
            >
              {t('wallet.showPhrase')}
            </Link>
          )}
        </div>
      </AppShellFooter>
    </div>
  );
}
