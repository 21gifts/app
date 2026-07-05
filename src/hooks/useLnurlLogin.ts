'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { pollSession, startLnurlAuth } from '@/lib/api';
import { useAuthStore } from '@/stores/auth-store';

/** Milliseconds between session polls while a challenge is outstanding. */
const POLL_INTERVAL_MS = 2000;

/** Discrete states of the LNURL-auth login flow. */
export type LoginStatus = 'idle' | 'starting' | 'waiting' | 'expired' | 'error';

/** The outstanding challenge being polled. */
interface ActiveChallenge {
  /** The LNURL to render as a QR / deep link. */
  lnurl: string;
  /** The secret token used to poll for the session. */
  pollToken: string;
}

/** Public surface returned by {@link useLnurlLogin}. */
export interface UseLnurlLogin {
  /** Where the flow currently is. */
  status: LoginStatus;
  /** The LNURL string to render as a QR, once known; `null` before then. */
  lnurl: string | null;
  /** Begins the flow, or restarts it after an `expired`/`error` outcome. */
  start: () => void;
}

/**
 * Drives the LNURL-auth login flow as a small state machine.
 *
 * `start()` requests a challenge and shows its `lnurl` (`waiting`). Polling runs
 * in an effect keyed to the active challenge, so React tears the interval down
 * on unmount and whenever the challenge changes — there is no interval to leak.
 * `authenticated` records the session in the auth store and resets to `idle` (so
 * a later logout returns to the start view); `expired`/`used` end in `expired`; a
 * thrown request or malformed response ends in `error`.
 *
 * Each `start()` bumps a run id so a superseded request (rapid restart) that
 * resolves late is ignored rather than overwriting a newer challenge, and each
 * poll checks a per-interval `cancelled` flag so an in-flight poll that resolves
 * after teardown does not mutate state.
 *
 * @returns The current `status`, the `lnurl` to render, and `start`.
 */
export function useLnurlLogin(): UseLnurlLogin {
  const [status, setStatus] = useState<LoginStatus>('idle');
  const [challenge, setChallenge] = useState<ActiveChallenge | null>(null);
  const runIdRef = useRef(0);
  const setAuth = useAuthStore((state) => state.setAuth);

  const start = useCallback((): void => {
    const runId = ++runIdRef.current;
    setChallenge(null);
    setStatus('starting');

    startLnurlAuth()
      .then((result) => {
        if (runId !== runIdRef.current) {
          return; // A newer start() superseded this one.
        }
        setChallenge({ lnurl: result.lnurl, pollToken: result.pollToken });
        setStatus('waiting');
      })
      .catch(() => {
        if (runId !== runIdRef.current) {
          return;
        }
        setStatus('error');
      });
  }, []);

  useEffect(() => {
    if (challenge === null) {
      return;
    }
    let cancelled = false;
    const id = setInterval(() => {
      pollSession(challenge.pollToken)
        .then((result) => {
          if (cancelled) {
            return;
          }
          if (result.status === 'authenticated') {
            setAuth(result.token, result.account);
            setChallenge(null);
            setStatus('idle');
          } else if (result.status === 'expired' || result.status === 'used') {
            setChallenge(null);
            setStatus('expired');
          }
          // 'pending' — keep polling.
        })
        .catch(() => {
          if (cancelled) {
            return;
          }
          setChallenge(null);
          setStatus('error');
        });
    }, POLL_INTERVAL_MS);

    return (): void => {
      cancelled = true;
      clearInterval(id);
    };
  }, [challenge, setAuth]);

  return { status, lnurl: challenge?.lnurl ?? null, start };
}
