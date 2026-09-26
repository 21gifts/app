'use client';

import { useRef, useState, useEffect, type ReactElement } from 'react';
import { Loader2 } from 'lucide-react';
import Link from 'next/link';
import { AppShellTopLeft } from '@/components/AppShell';
import { useTranslations } from '@/components/LocaleProvider';
import { QrCode } from '@/components/QrCode';
import { ProfileChromeLeft } from '@/components/ProfileChromeLeft';
import { Button, ButtonLink, Card } from '@/components/ui';
import { giftsLightningAddress, openCryptoPayQrValue } from '@/lib/gifts-address';
import { profileQrLogo } from '@/lib/profile-qr-logo';
import { WALLET_BACK_FALLBACK } from '@/lib/wallet-return';
import { useAuthStore } from '@/stores/auth-store';
import type { UseWalletPhraseResult } from '@/hooks/useWalletPhrase';

/**
 * Receive handle: the 21.gifts address and Open CryptoPay QR, plus a link
 * to `/pos`. No keypad and no charge. The button is content width, like the
 * other centered actions, not a full-width bar.
 *
 * @returns The receive block.
 */
function WalletReceive(): ReactElement {
  const { t } = useTranslations();
  const account = useAuthStore((state) => state.account);
  const [showQr, setShowQr] = useState(false);
  useEffect(() => {
    setShowQr(true);
  }, []);
  /* v8 ignore next -- this client screen always runs in a browser */
  const host = typeof window === 'undefined' ? '21.gifts' : window.location.hostname;
  const username = account?.username ?? null;
  const address = giftsLightningAddress(username, host);
  const qr = openCryptoPayQrValue(username, host);
  return (
    <Card surface={false}>
      {address !== null ? (
        <div className="flex flex-col items-stretch gap-3">
          <p className="text-center text-xs tracking-widest text-app-subtle uppercase">
            {t('profile.giftsHeading')}
          </p>
          <p className="min-w-0 truncate text-center font-mono text-sm text-app-fg">{address}</p>
          {showQr && qr !== null ? (
            <div className="flex justify-center">
              <QrCode value={qr} label={t('profile.giftsQr')} logo={profileQrLogo} />
            </div>
          ) : null}
        </div>
      ) : account !== null ? (
        <p className="text-center text-sm text-app-fg">
          <Link href="/profile" className="underline">
            {t('pos.needUsername')}
          </Link>
        </p>
      ) : null}
      <ButtonLink href="/pos">{t('wallet.setAmount')}</ButtonLink>
    </Card>
  );
}

/** Which wallet body to render. `entry` is `/wallet`. `phrase` is `/wallet/phrase`. */
export type WalletSurface = 'entry' | 'phrase';

/** Props for {@link WalletScreenView}. */
export type WalletScreenViewProps = UseWalletPhraseResult & {
  /** Receive page or the recovery subpage. Default `entry`. */
  surface?: WalletSurface;
};

/**
 * `/wallet` shows the receive address above the recovery entry. The 12 words
 * and recovery errors render only on `/wallet/phrase`.
 *
 * @param props - State from {@link useWalletPhrase}, plus the surface.
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
}: WalletScreenViewProps): ReactElement {
  const { t } = useTranslations();
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const busy = status === 'busy';
  const showGrid = view === 'phrase' && words.length === 12;
  const stepBack = (): void => {
    if (surface === 'phrase') {
      if (showGrid) {
        hidePhrase();
        return;
      }
      if (window.history.length > 1) {
        window.history.back();
        return;
      }
      window.location.assign('/wallet');
      return;
    }
    if (detailsRef.current?.open === true) {
      detailsRef.current.open = false;
      return;
    }
    if (window.history.length > 1) {
      window.history.back();
      return;
    }
    window.location.assign(WALLET_BACK_FALLBACK);
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
  const entryBody =
    view === 'activate' ? (
      <>
        <p className="text-center text-sm text-app-muted">{t('wallet.addPhraseHint')}</p>
        <ButtonLink href="/wallet/phrase">{t('wallet.addPhrase')}</ButtonLink>
      </>
    ) : (
      <details
        ref={detailsRef}
        className="w-full rounded-lg border border-app-border bg-app-card px-3 py-2"
      >
        <summary className="cursor-pointer text-sm text-app-muted">{t('wallet.advanced')}</summary>
        <div className="mt-3 flex justify-center">
          <ButtonLink href="/wallet/phrase" variant="secondary">
            {t('wallet.showPhrase')}
          </ButtonLink>
        </div>
      </details>
    );
  const card = (
    <Card surface={false}>
      <AppShellTopLeft>
        <ProfileChromeLeft backHref="/wallet" backLabelKey="nav.back" onBackClick={stepBack} />
      </AppShellTopLeft>
      <h1 className="text-center text-2xl font-semibold tracking-tight sm:text-3xl">
        {t('wallet.title')}
      </h1>
      {surface === 'phrase' ? phraseBody : entryBody}
    </Card>
  );
  if (surface === 'phrase') {
    return <div className="flex w-full flex-col items-center gap-6">{card}</div>;
  }
  return (
    <div className="flex w-full flex-col items-center gap-6">
      <WalletReceive />
      {card}
    </div>
  );
}
