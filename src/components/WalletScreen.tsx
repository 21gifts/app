'use client';

import { useEffect, type ReactElement } from 'react';
import { useTranslations } from '@/components/LocaleProvider';
import { Button, Card } from '@/components/ui';
import { useWalletPhrase, type UseWalletPhraseResult } from '@/hooks/useWalletPhrase';

export type WalletScreenViewProps = UseWalletPhraseResult;

/**
 * Presentational recovery-phrase UI. Tokens match ProfileScreen (Card, heading).
 *
 * @param props - State from {@link useWalletPhrase}.
 * @returns The card.
 */
export function WalletScreenView({
  view,
  status,
  error,
  words,
  activate,
  confirmSaved,
  showPhrase,
  retry,
}: WalletScreenViewProps): ReactElement {
  const { t } = useTranslations();
  const busy = status === 'busy';
  const showGrid = (view === 'confirm' || view === 'phrase') && words.length === 12;

  return (
    <Card>
      <h1 className="text-center text-2xl font-semibold tracking-tight sm:text-3xl">
        {t('wallet.title')}
      </h1>
      {error === 'prfUnsupported' ? (
        <p className="text-sm text-app-danger">{t('wallet.prfUnsupported')}</p>
      ) : null}
      {error === 'timeout' || error === 'generic' ? (
        <Button variant="secondary" size="lg" onClick={retry} disabled={busy}>
          {t('login.retry')}
        </Button>
      ) : null}
      {showGrid ? (
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
          {view === 'confirm' ? (
            <Button
              variant="primary"
              size="lg"
              onClick={() => {
                void confirmSaved();
              }}
              disabled={busy}
            >
              {t('wallet.confirmSaved')}
            </Button>
          ) : null}
        </>
      ) : view === 'activate' ? (
        <>
          <p className="text-sm text-app-muted">{t('wallet.activateHint')}</p>
          <Button
            variant="primary"
            size="lg"
            onClick={() => {
              void activate();
            }}
            disabled={busy}
          >
            {t('wallet.activate')}
          </Button>
        </>
      ) : (
        <Button
          variant="secondary"
          size="lg"
          onClick={() => {
            void showPhrase();
          }}
          disabled={busy}
        >
          {t('wallet.showPhrase')}
        </Button>
      )}
    </Card>
  );
}

/**
 * Signed-in wallet screen: recovery phrase confirm / activate / reveal.
 *
 * @returns The wallet card.
 */
export function WalletScreen(): ReactElement {
  const phrase = useWalletPhrase();
  const { view, words, showPhrase, status } = phrase;

  useEffect(() => {
    if (view === 'confirm' && words.length !== 12 && status === 'idle') {
      void showPhrase();
    }
  }, [view, words.length, status, showPhrase]);

  return <WalletScreenView {...phrase} />;
}
