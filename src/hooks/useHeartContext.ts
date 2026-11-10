'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useActiveSession } from '@/hooks/useActiveSession';
import { visualPin } from '@/lib/visual-pin';
import {
  fetchHeartPosts,
  type HeartLookup,
  type HeartPost,
  type RepaymentContext,
} from '@/lib/wallet/heart-context';
import {
  HEART_VISUAL_AUTHOR,
  HEART_VISUAL_HASH,
  HEART_VISUAL_MESSAGE_ID,
  HEART_VISUAL_TEXT,
  REPAYMENT_VISUAL_CONTEXTS,
} from '@/lib/wallet/payment-fixtures';

/** Resolved heart posts and loan repayments of a wallet view, and the hashes still being looked up. */
export interface HeartContextResult {
  /** Heart posts by lowercase payment hash. */
  byHash: ReadonlyMap<string, HeartPost>;
  /** Loan repayments by lowercase payment hash. */
  repaymentsByHash: ReadonlyMap<string, RepaymentContext>;
  /** Hashes whose lookup has not returned yet. */
  pending: ReadonlySet<string>;
}

const EMPTY_MAP: ReadonlyMap<string, HeartPost> = new Map();
const EMPTY_REPAYMENTS: ReadonlyMap<string, RepaymentContext> = new Map();
const EMPTY_SET: ReadonlySet<string> = new Set();
const HEART_VISUAL_POST: HeartPost = {
  paymentHash: HEART_VISUAL_HASH,
  messageId: HEART_VISUAL_MESSAGE_ID,
  authorName: HEART_VISUAL_AUTHOR,
  text: HEART_VISUAL_TEXT,
  deleted: false,
};
const HEART_VISUAL_MAP: ReadonlyMap<string, HeartPost> = new Map([
  [HEART_VISUAL_HASH, HEART_VISUAL_POST],
]);
const HEART_PENDING_SET: ReadonlySet<string> = new Set([HEART_VISUAL_HASH]);
const REPAYMENT_VISUAL_MAP: ReadonlyMap<string, RepaymentContext> = new Map(
  REPAYMENT_VISUAL_CONTEXTS.map((row) => [row.paymentHash, row]),
);

interface HeartContextState extends HeartContextResult {
  session: string;
  hashKey: string;
}

/**
 * Resolves wallet payment hashes to the forum posts whose filled hearts
 * created them and to the credit notes whose loan repayments they are.
 * Settled hashes are kept for the mounted hook and session, and unresolved
 * hashes are read in sequential requests of at most 32; stale responses are ignored.
 *
 * @param hashes - Payment hashes used by the current wallet view.
 * @returns Resolved posts and repayments by lowercase hash, and hashes still being looked up.
 */
export function useHeartContext(hashes: readonly string[]): HeartContextResult {
  const session = useActiveSession();
  const pin = visualPin();
  const visualHeart = pin === 'heart-payment' || pin === 'history-heart';
  const visualHeartPending = pin === 'heart-payment-pending' || pin === 'history-heart-pending';
  const visualRepayment = pin === 'repayment-payment' || pin === 'history-repayment';
  const pinned = visualHeart || visualHeartPending || visualRepayment;
  const hashKey = JSON.stringify([...new Set(hashes.map((hash) => hash.toLowerCase()))]);
  const uniqueHashes = useMemo(() => JSON.parse(hashKey) as string[], [hashKey]);
  const cacheSession = useRef<string | null>(null);
  const cached = useRef(new Map<string, HeartPost>());
  const cachedRepayments = useRef(new Map<string, RepaymentContext>());
  const settled = useRef(new Set<string>());
  const [state, setState] = useState<HeartContextState | null>(null);

  useEffect(() => {
    if (pinned) {
      return;
    }
    if (cacheSession.current !== session) {
      cacheSession.current = session;
      cached.current = new Map();
      cachedRepayments.current = new Map();
      settled.current = new Set();
    }
    if (session === null || uniqueHashes.length === 0) {
      setState(null);
      return;
    }

    let active = true;
    const currentMaps = (): Pick<HeartContextResult, 'byHash' | 'repaymentsByHash'> => {
      const byHash = new Map<string, HeartPost>();
      const repaymentsByHash = new Map<string, RepaymentContext>();
      for (const hash of uniqueHashes) {
        const post = cached.current.get(hash);
        if (post !== undefined) {
          byHash.set(hash, post);
        }
        const repayment = cachedRepayments.current.get(hash);
        if (repayment !== undefined) {
          repaymentsByHash.set(hash, repayment);
        }
      }
      return { byHash, repaymentsByHash };
    };
    const missing = uniqueHashes.filter((hash) => !settled.current.has(hash));
    let pending = new Set(missing);
    setState({ session, hashKey, ...currentMaps(), pending });

    const load = async (): Promise<void> => {
      for (let offset = 0; offset < missing.length; offset += 32) {
        const chunk = missing.slice(offset, offset + 32);
        let found: HeartLookup;
        try {
          found = await fetchHeartPosts(session, chunk);
        } catch {
          found = { hearts: [], repayments: [] };
        }
        if (!active) {
          return;
        }
        const chunkHashes = new Set(chunk);
        for (const post of found.hearts) {
          if (chunkHashes.has(post.paymentHash)) {
            cached.current.set(post.paymentHash, post);
          }
        }
        for (const repayment of found.repayments) {
          // A hash is in at most one array; a heart that already claimed it wins.
          if (
            chunkHashes.has(repayment.paymentHash) &&
            !cached.current.has(repayment.paymentHash)
          ) {
            cachedRepayments.current.set(repayment.paymentHash, repayment);
          }
        }
        for (const hash of chunk) {
          settled.current.add(hash);
          pending.delete(hash);
        }
        pending = new Set(pending);
        setState({ session, hashKey, ...currentMaps(), pending });
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [hashKey, session, uniqueHashes, pinned]);

  if (visualHeart) {
    return { byHash: HEART_VISUAL_MAP, repaymentsByHash: EMPTY_REPAYMENTS, pending: EMPTY_SET };
  }
  if (visualHeartPending) {
    return { byHash: EMPTY_MAP, repaymentsByHash: EMPTY_REPAYMENTS, pending: HEART_PENDING_SET };
  }
  if (visualRepayment) {
    return { byHash: EMPTY_MAP, repaymentsByHash: REPAYMENT_VISUAL_MAP, pending: EMPTY_SET };
  }

  if (session === null || uniqueHashes.length === 0) {
    return { byHash: EMPTY_MAP, repaymentsByHash: EMPTY_REPAYMENTS, pending: EMPTY_SET };
  }
  if (state?.session === session && state.hashKey === hashKey) {
    return {
      byHash: state.byHash,
      repaymentsByHash: state.repaymentsByHash,
      pending: state.pending,
    };
  }
  if (cacheSession.current !== session) {
    return {
      byHash: EMPTY_MAP,
      repaymentsByHash: EMPTY_REPAYMENTS,
      pending: new Set(uniqueHashes),
    };
  }
  const byHash = new Map<string, HeartPost>();
  const repaymentsByHash = new Map<string, RepaymentContext>();
  const pending = new Set<string>();
  for (const hash of uniqueHashes) {
    const post = cached.current.get(hash);
    const repayment = cachedRepayments.current.get(hash);
    if (post !== undefined) {
      byHash.set(hash, post);
    } else if (repayment !== undefined) {
      repaymentsByHash.set(hash, repayment);
    } else if (!settled.current.has(hash)) {
      pending.add(hash);
    }
  }
  return { byHash, repaymentsByHash, pending };
}
