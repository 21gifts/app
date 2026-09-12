'use client';

import { useEffect, useState, type ReactElement } from 'react';
import { TrustChainScreen } from '@/components/TrustChainScreen';
import { fetchTrustChain } from '@/lib/api';
import type { TrustChain } from '@/lib/api-types';

/**
 * Client loader for `/trust-chain`: fetches the graph and renders the screen.
 *
 * @returns The Trust Chain screen, including loading and error states.
 */
export function TrustChainLoader(): ReactElement {
  const [chain, setChain] = useState<TrustChain | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
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
      onRetry={() => {
        setAttempt((n) => n + 1);
      }}
    />
  );
}
