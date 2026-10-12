'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useActiveSession } from '@/hooks/useActiveSession';
import { fetchHeartPosts, type HeartPost } from '@/lib/wallet/heart-context';

const EMPTY_MAP: ReadonlyMap<string, HeartPost> = new Map();
const EMPTY_SET: ReadonlySet<string> = new Set();

interface HeartContextState {
  session: string;
  hashKey: string;
  byHash: ReadonlyMap<string, HeartPost>;
  pending: ReadonlySet<string>;
}

/**
 * Resolves wallet gift hashes to the forum posts whose filled hearts created
 * them. Settled hashes are kept for the mounted hook and session, and unresolved
 * hashes are read in sequential requests of at most 32; stale responses are ignored.
 *
 * @param hashes - Payment hashes used by the current wallet view.
 * @returns Resolved posts by lowercase hash and hashes still being looked up.
 */
export function useHeartContext(hashes: readonly string[]): {
  byHash: ReadonlyMap<string, HeartPost>;
  pending: ReadonlySet<string>;
} {
  const session = useActiveSession();
  const hashKey = JSON.stringify([...new Set(hashes.map((hash) => hash.toLowerCase()))]);
  const uniqueHashes = useMemo(() => JSON.parse(hashKey) as string[], [hashKey]);
  const cacheSession = useRef<string | null>(null);
  const cached = useRef(new Map<string, HeartPost>());
  const settled = useRef(new Set<string>());
  const [state, setState] = useState<HeartContextState | null>(null);

  useEffect(() => {
    if (cacheSession.current !== session) {
      cacheSession.current = session;
      cached.current = new Map();
      settled.current = new Set();
    }
    if (session === null || uniqueHashes.length === 0) {
      setState(null);
      return;
    }

    let active = true;
    const currentMap = (): ReadonlyMap<string, HeartPost> => {
      const result = new Map<string, HeartPost>();
      for (const hash of uniqueHashes) {
        const post = cached.current.get(hash);
        if (post !== undefined) {
          result.set(hash, post);
        }
      }
      return result;
    };
    const missing = uniqueHashes.filter((hash) => !settled.current.has(hash));
    let pending = new Set(missing);
    setState({ session, hashKey, byHash: currentMap(), pending });

    const load = async (): Promise<void> => {
      for (let offset = 0; offset < missing.length; offset += 32) {
        const chunk = missing.slice(offset, offset + 32);
        let posts: HeartPost[];
        try {
          posts = await fetchHeartPosts(session, chunk);
        } catch {
          posts = [];
        }
        if (!active) {
          return;
        }
        const chunkHashes = new Set(chunk);
        for (const post of posts) {
          if (chunkHashes.has(post.paymentHash)) {
            cached.current.set(post.paymentHash, post);
          }
        }
        for (const hash of chunk) {
          settled.current.add(hash);
          pending.delete(hash);
        }
        pending = new Set(pending);
        setState({ session, hashKey, byHash: currentMap(), pending });
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [hashKey, session, uniqueHashes]);

  if (session === null || uniqueHashes.length === 0) {
    return { byHash: EMPTY_MAP, pending: EMPTY_SET };
  }
  if (state?.session === session && state.hashKey === hashKey) {
    return { byHash: state.byHash, pending: state.pending };
  }
  if (cacheSession.current !== session) {
    return { byHash: EMPTY_MAP, pending: new Set(uniqueHashes) };
  }
  const byHash = new Map<string, HeartPost>();
  const pending = new Set<string>();
  for (const hash of uniqueHashes) {
    const post = cached.current.get(hash);
    if (post !== undefined) {
      byHash.set(hash, post);
    } else if (!settled.current.has(hash)) {
      pending.add(hash);
    }
  }
  return { byHash, pending };
}
