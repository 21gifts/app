'use client';

import { useEffect, useState, type ReactElement } from 'react';
import { TrustChainScreen } from '@/components/TrustChainScreen';
import { fetchTrustChain } from '@/lib/api';
import type { TrustChain } from '@/lib/api-types';
import { mergeTrustChain } from '@/lib/trust-chain';

/**
 * Client loader for `/trust-chain`: founder seeds first, then one hop per click.
 *
 * @returns The Trust Chain screen, including loading and error states.
 */
export function TrustChainLoader(): ReactElement {
  const [chain, setChain] = useState<TrustChain | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandingId, setExpandingId] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void (async () => {
      try {
        const next = await fetchTrustChain();
        if (!cancelled) {
          setChain(next);
        }
      } catch (cause) {
        if (!cancelled) {
          setChain(null);
          setError(
            cause instanceof Error
              ? cause.message
              : 'Could not load the Trust Chain. Please try again.',
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  return (
    <TrustChainScreen
      chain={chain}
      error={error}
      loading={loading}
      expandingId={expandingId}
      onRetry={() => {
        if (chain !== null && chain.nodes.length > 0) {
          setError(null);
          return;
        }
        setAttempt((n) => n + 1);
      }}
      onExpand={(accountId) => {
        /* v8 ignore next 3 — diagram already skips clicks while aria-busy */
        if (expandingId !== null) {
          return;
        }
        setExpandingId(accountId);
        void (async () => {
          try {
            const hop = await fetchTrustChain(accountId);
            setChain((current) => {
              /* v8 ignore next 3 — hop only starts from a visible node */
              if (current === null) {
                return hop;
              }
              return mergeTrustChain(current, hop);
            });
          } catch {
            setError('Could not load the Trust Chain. Please try again.');
          } finally {
            setExpandingId(null);
          }
        })();
      }}
    />
  );
}
