'use client';

import { useRef, type ReactElement } from 'react';
import { Loader2 } from 'lucide-react';
import { AppShellTopLeft } from '@/components/AppShell';
import { useTranslations } from '@/components/LocaleProvider';
import { PosTill } from '@/components/PosScreen';
import { ProfileChromeLeft } from '@/components/ProfileChromeLeft';
import { Button, Card } from '@/components/ui';
import { WALLET_BACK_FALLBACK } from '@/lib/wallet-return';
import type { UseWalletPhraseResult } from '@/hooks/useWalletPhrase';

/** Props for {@link WalletScreenView} — the public {@link UseWalletPhraseResult}. */
export type WalletScreenViewProps = UseWalletPhraseResult;

/**
 * Wallet card and the header Back for that page. Tokens match ProfileScreen
 * (`Card surface={false}`). Back takes one step: hide the words, close
 * Advanced functions, `history.back()`, or open `/welcome`.
 *
 * @param props - State from {@link useWalletPhrase}.
 * @returns The card, and the one-step Back registered through `AppShellTopLeft`.
 */
export function WalletScreenView({
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
    if (showGrid) {
      hidePhrase();
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
  const showPhraseButton = (
    <Button
      variant="secondary"
      size="lg"
      onClick={() => {
        void showPhrase();
      }}
      disabled={busy}
      icon={busy ? <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> : undefined}
    >
      {t('wallet.showPhrase')}
    </Button>
  );

  return (
    <div className="flex w-full flex-col items-center gap-6">
      <Card surface={false}>
        <AppShellTopLeft>
          <ProfileChromeLeft backHref="/wallet" backLabelKey="nav.back" onBackClick={stepBack} />
        </AppShellTopLeft>
        <h1 className="text-center text-2xl font-semibold tracking-tight sm:text-3xl">
          {t('wallet.title')}
        </h1>
        {hasError ? (
          <>
            <p role="alert" className="text-center text-sm text-app-danger">
              {errorCopy}
            </p>
            <p className="text-center text-sm text-app-muted">{t('wallet.errorHint')}</p>
            <Button
              type="button"
              onClick={retry}
              disabled={busy}
              icon={
                busy ? <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> : undefined
              }
            >
              {t('login.retry')}
            </Button>
          </>
        ) : showGrid ? (
          <>
            <ol className="grid grid-cols-2 gap-2">
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
            <p className="text-sm text-app-muted">{t('wallet.addPhraseHint')}</p>
            <Button
              variant="primary"
              size="lg"
              onClick={() => {
                void activate();
              }}
              disabled={busy}
              icon={
                busy ? <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> : undefined
              }
            >
              {t('wallet.addPhrase')}
            </Button>
          </>
        ) : (
          <details
            ref={detailsRef}
            className="w-full rounded-lg border border-app-border bg-app-card px-3 py-2"
          >
            <summary className="cursor-pointer text-sm text-app-muted">
              {t('wallet.advanced')}
            </summary>
            <div className="mt-3">{showPhraseButton}</div>
          </details>
        )}
      </Card>
      <PosTill />
    </div>
  );
}
