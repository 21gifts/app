'use client';

import type { ReactElement } from 'react';
import { TrustChainDiagram } from '@/components/TrustChainDiagram';
import { useTranslations } from '@/components/LocaleProvider';
import { Button } from '@/components/ui';
import type { TrustChain } from '@/lib/api-types';

/**
 * Localized `/trust-chain` body: heading, load states, diagram, and role copy.
 *
 * @param props - Fetched graph plus loader status, hop expand, and retry.
 * @returns The signed-in Trust Chain screen.
 */
export function TrustChainScreen({
  chain,
  error,
  loading,
  expandingId = null,
  onRetry,
  onExpand,
}: {
  chain: TrustChain | null;
  error: string | null;
  loading: boolean;
  expandingId?: string | null;
  onRetry: () => void;
  onExpand: (accountId: string) => void;
}): ReactElement {
  const { t } = useTranslations();

  const hasNodes = chain !== null && chain.nodes.length > 0;
  let body: ReactElement;
  if (error !== null && !hasNodes) {
    body = (
      <div className="mt-12 space-y-4">
        <p role="alert" className="text-center text-sm text-app-danger">
          {t('trustChain.error')}
        </p>
        <Button type="button" variant="secondary" disabled={expandingId !== null} onClick={onRetry}>
          {t('trustChain.retry')}
        </Button>
      </div>
    );
  } else if (loading && !hasNodes) {
    body = <p className="mt-12 text-app-muted">{t('trustChain.loading')}</p>;
  } else if (chain === null || chain.nodes.length === 0) {
    body = <p className="mt-12 text-app-muted">{t('trustChain.empty')}</p>;
  } else {
    body = (
      <div className="mt-12 space-y-4">
        {error !== null ? (
          <div className="space-y-4">
            <p role="alert" className="text-center text-sm text-app-danger">
              {t('trustChain.error')}
            </p>
            <Button
              type="button"
              variant="secondary"
              disabled={expandingId !== null}
              onClick={onRetry}
            >
              {t('trustChain.retry')}
            </Button>
          </div>
        ) : null}
        <TrustChainDiagram chain={chain} expandingId={expandingId} onExpand={onExpand} />
      </div>
    );
  }

  return (
    <div className="w-full">
      <h1 className="text-2xl font-semibold tracking-tight text-app-fg sm:text-3xl">
        {t('trustChain.title')}
      </h1>
      <p className="mt-3 max-w-2xl text-lg text-app-muted">{t('trustChain.lead')}</p>
      {body}
      <section className="mt-16 space-y-8 text-app-fg">
        <div>
          <h2 className="text-xl font-semibold">{t('forum.role.verified')}</h2>
          <p className="mt-2 text-app-muted">{t('trustChain.explainVerified')}</p>
        </div>
        <div>
          <h2 className="text-xl font-semibold">{t('forum.role.moderator')}</h2>
          <p className="mt-2 text-app-muted">{t('trustChain.explainModerator')}</p>
        </div>
        <div>
          <h2 className="text-xl font-semibold">{t('forum.role.founder')}</h2>
          <p className="mt-2 text-app-muted">{t('trustChain.explainFounder')}</p>
        </div>
      </section>
    </div>
  );
}
