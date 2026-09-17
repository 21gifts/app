'use client';

import { useEffect, useState, type ReactElement } from 'react';
import { TrustChainScreen } from '@/components/TrustChainScreen';
import { fetchTrustChain } from '@/lib/api';
import type { TrustChain } from '@/lib/api-types';
import { mergeTrustChain } from '@/lib/trust-chain';
import { useAuthStore } from '@/stores/auth-store';

/**
 * Client loader for signed-in `/trust-chain`: founder seeds first, then one hop per click.
 *
 * Reads the session from the auth store. Renders nothing when there is no
 * session; OnboardingGate owns the redirect.
 *
 * @returns The Trust Chain screen, including loading and error states, or `null`
 *   without a session.
 */
export function TrustChainLoader(): ReactElement | null {
  const session = useAuthStore((s) => s.session);
  const [chain, setChain] = useState<TrustChain | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandingId, setExpandingId] = useState<string | null>(null);
  const [failedHopId, setFailedHopId] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (session === null) {
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    void (async () => {
      try {
        const next = await fetchTrustChain(session);
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
  }, [session, attempt]);

  if (session === null) {
    return null;
  }

  return (
    <TrustChainScreen
      chain={chain}
      error={error}
      loading={loading}
      expandingId={expandingId}
      onRetry={() => {
        /* v8 ignore next 3 -- retry button is disabled while expandingId is set */
        if (expandingId !== null) {
          return;
        }
        if (failedHopId !== null) {
          const retryId = failedHopId;
          setFailedHopId(null);
          setError(null);
          setExpandingId(retryId);
          void (async () => {
            try {
              const hop = await fetchTrustChain(session, retryId);
              setChain((current) => {
                /* v8 ignore next 3 — hop retry starts from a visible node */
                if (current === null) {
                  return hop;
                }
                return mergeTrustChain(current, hop);
              });
              setError(null);
            } catch {
              setFailedHopId(retryId);
              setError('Could not load the Trust Chain. Please try again.');
            } finally {
              setExpandingId(null);
            }
          })();
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
            const hop = await fetchTrustChain(session, accountId);
            setChain((current) => {
              /* v8 ignore next 3 — hop only starts from a visible node */
              if (current === null) {
                return hop;
              }
              return mergeTrustChain(current, hop);
            });
            setFailedHopId(null);
            setError(null);
          } catch {
            setFailedHopId(accountId);
            setError('Could not load the Trust Chain. Please try again.');
          } finally {
            setExpandingId(null);
          }
        })();
      }}
    />
  );
}
