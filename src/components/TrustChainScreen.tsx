'use client';

import type { ReactElement } from 'react';
import { TrustChainDiagram } from '@/components/TrustChainDiagram';
import { useTranslations } from '@/components/LocaleProvider';
import { Button } from '@/components/ui';
import type { TrustChain } from '@/lib/api-types';

/**
 * Localized `/trust-chain` body: heading, load states, diagram, and role copy.
 *
 * @param props - Fetched graph plus loader status and retry.
 * @returns The marketing Trust Chain screen.
 */
export function TrustChainScreen({
  chain,
  error,
  loading,
  onRetry,
}: {
  chain: TrustChain | null;
  error: string | null;
  loading: boolean;
  onRetry: () => void;
}): ReactElement {
  const { t } = useTranslations();

  let body: ReactElement;
  if (error !== null) {
    body = (
      <div className="mt-12 space-y-4">
        <p className="text-paper/80">{error}</p>
        <Button type="button" variant="accent" tone="dark" onClick={onRetry}>
          {t('trustChain.retry')}
        </Button>
      </div>
    );
  } else if (loading) {
    body = <p className="mt-12 text-paper/60">{t('trustChain.loading')}</p>;
  } else if (chain === null || chain.nodes.length === 0) {
    body = <p className="mt-12 text-paper/60">{t('trustChain.empty')}</p>;
  } else {
    body = (
      <div className="mt-12">
        <TrustChainDiagram chain={chain} />
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-4xl font-semibold tracking-tight sm:text-6xl">{t('trustChain.title')}</h1>
      <p className="mt-3 max-w-2xl text-lg text-paper/60">{t('trustChain.lead')}</p>
      {body}
      <section className="mt-16 space-y-8 text-paper">
        <div>
          <h2 className="text-xl font-semibold">{t('forum.role.verified')}</h2>
          <p className="mt-2 text-paper/70">{t('trustChain.explainVerified')}</p>
        </div>
        <div>
          <h2 className="text-xl font-semibold">{t('forum.role.moderator')}</h2>
          <p className="mt-2 text-paper/70">{t('trustChain.explainModerator')}</p>
        </div>
        <div>
          <h2 className="text-xl font-semibold">{t('forum.role.founder')}</h2>
          <p className="mt-2 text-paper/70">{t('trustChain.explainFounder')}</p>
        </div>
      </section>
    </div>
  );
}
