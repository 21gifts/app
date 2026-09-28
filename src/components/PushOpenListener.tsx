'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

/** Cache the service worker writes before it posts the open path. */
const PUSH_OPEN_CACHE = '21gifts-push-open';

/** Ignore a remembered path older than this. A later visit must not replay it. */
const PUSH_OPEN_MAX_AGE_MS = 60_000;

/**
 * Canonical in-app path for `url`, or `null` when it is not this origin.
 *
 * A query or hash may contain `://`. A protocol-relative path, a backslash,
 * or another origin may not.
 *
 * @param url - Candidate from a service-worker message or the stored record.
 * @returns `pathname` plus search and hash, or `null`.
 */
function canonicalPushPath(url: string): string | null {
  if (!url.startsWith('/') || url.includes('\\')) {
    return null;
  }
  try {
    const parsed = new URL(url, window.location.origin);
    if (parsed.origin !== window.location.origin) {
      return null;
    }
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return null;
  }
}

/**
 * Read the path the service worker stored for this click.
 *
 * An unusable record is deleted. A usable path stays until the page follows it.
 *
 * @param now - Clock in milliseconds, used to drop a stale or future record.
 * @returns The path and click id, or `null` when there is nothing safe to open.
 */
async function takePendingPushOpen(now: number): Promise<{ url: string; id: string } | null> {
  const storage = globalThis.caches;
  if (storage === undefined) {
    return null;
  }
  try {
    const cache = await storage.open(PUSH_OPEN_CACHE);
    const key = new URL('/push-open', window.location.origin).href;
    const cached = await cache.match(key);
    if (cached === undefined) {
      return null;
    }
    const parsed: unknown = await cached.json();
    if (parsed === null || typeof parsed !== 'object') {
      await cache.delete(key);
      return null;
    }
    const url = 'url' in parsed ? parsed.url : undefined;
    const at = 'at' in parsed ? parsed.at : undefined;
    if (typeof url !== 'string' || typeof at !== 'number' || !Number.isFinite(at)) {
      await cache.delete(key);
      return null;
    }
    if (now - at > PUSH_OPEN_MAX_AGE_MS || at > now) {
      await cache.delete(key);
      return null;
    }
    const path = canonicalPushPath(url);
    if (path === null) {
      await cache.delete(key);
      return null;
    }
    const id = 'id' in parsed && typeof parsed.id === 'string' ? parsed.id : '';
    return { url: path, id };
  } catch {
    return null;
  }
}

/** Drop a stored path after the page has followed that click. */
async function forgetPendingPushOpen(id: string): Promise<void> {
  const storage = globalThis.caches;
  if (storage === undefined) {
    return;
  }
  try {
    const cache = await storage.open(PUSH_OPEN_CACHE);
    const key = new URL('/push-open', window.location.origin).href;
    const cached = await cache.match(key);
    if (cached === undefined) {
      return;
    }
    const parsed: unknown = await cached.json();
    const stored = parsed !== null && typeof parsed === 'object' && 'id' in parsed ? parsed.id : '';
    if (stored !== id) {
      return;
    }
    await cache.delete(key);
  } catch {
    return;
  }
}

/**
 * Listens for `21gifts-push-open` from the service worker so an installed
 * phone app can `router.push` to the notification path (no WindowClient.navigate).
 * Also opens a path the worker stored, on load and again when the page
 * becomes visible or returns from the back-forward cache.
 *
 * @returns `null`.
 */
export function PushOpenListener(): null {
  const router = useRouter();

  useEffect(() => {
    if (typeof navigator.serviceWorker === 'undefined') {
      return;
    }
    const worker = navigator.serviceWorker;
    let cancelled = false;

    const onMessage = (event: MessageEvent): void => {
      const data: unknown = event.data;
      if (data === null || typeof data !== 'object') {
        return;
      }
      const type = 'type' in data ? data.type : undefined;
      const url = 'url' in data ? data.url : undefined;
      const path = typeof url === 'string' ? canonicalPushPath(url) : null;
      if (type !== '21gifts-push-open' || path === null) {
        return;
      }
      const id = 'id' in data && typeof data.id === 'string' ? data.id : '';
      if (!cancelled) {
        router.push(path);
        void forgetPendingPushOpen(id);
      }
      const port = event.ports[0];
      if (port !== undefined) {
        port.postMessage('21gifts-push-open-ack');
      }
    };

    const pull = (): void => {
      void takePendingPushOpen(Date.now()).then((pending) => {
        if (pending !== null && !cancelled) {
          router.push(pending.url);
          void forgetPendingPushOpen(pending.id);
        }
      });
    };

    const onVisibility = (): void => {
      if (document.visibilityState === 'visible') {
        pull();
      }
    };

    const onPageShow = (event: Event): void => {
      const persisted = (event as Event & { persisted?: boolean }).persisted;
      if (persisted === true) {
        pull();
      }
    };

    worker.addEventListener('message', onMessage);
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pageshow', onPageShow);
    pull();
    return () => {
      cancelled = true;
      worker.removeEventListener('message', onMessage);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pageshow', onPageShow);
    };
  }, [router]);

  return null;
}
