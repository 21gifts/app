'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

/** Cache the service worker writes before it posts the open path. */
const PUSH_OPEN_CACHE = '21gifts-push-open';

/** Ignore a remembered path older than this. A later visit must not replay it. */
const PUSH_OPEN_MAX_AGE_MS = 60_000;

/**
 * Whether `url` is an in-app path the router may open.
 *
 * @param url - Candidate path from a service-worker message.
 * @returns True when it starts with a single `/` and has no protocol or backslash.
 */
function isPushOpenPath(url: string): boolean {
  return (
    url.startsWith('/') && !url.startsWith('//') && !url.includes('://') && !url.includes('\\')
  );
}

/**
 * Read and delete the path the service worker stored for this click.
 *
 * @param now - Clock in milliseconds, used to drop a stale or future record.
 * @returns The path, or `null` when there is nothing safe to open.
 */
async function takePendingPushOpen(now: number): Promise<string | null> {
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
    await cache.delete(key);
    const parsed: unknown = await cached.json();
    if (parsed === null || typeof parsed !== 'object') {
      return null;
    }
    const url = 'url' in parsed ? parsed.url : undefined;
    const at = 'at' in parsed ? parsed.at : undefined;
    if (typeof url !== 'string' || typeof at !== 'number' || !Number.isFinite(at)) {
      return null;
    }
    if (now - at > PUSH_OPEN_MAX_AGE_MS || at > now) {
      return null;
    }
    if (!isPushOpenPath(url)) {
      return null;
    }
    return url;
  } catch {
    return null;
  }
}

/**
 * Listens for `21gifts-push-open` from the service worker so an installed
 * phone app can `router.push` to the notification path (no WindowClient.navigate).
 * Also opens a path the worker stored when this page loads and the message
 * was missed.
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

    const openUrl = (url: string): void => {
      if (!cancelled) {
        router.push(url);
      }
    };

    const onMessage = (event: MessageEvent): void => {
      const data: unknown = event.data;
      if (data === null || typeof data !== 'object') {
        return;
      }
      const type = 'type' in data ? data.type : undefined;
      const url = 'url' in data ? data.url : undefined;
      if (type !== '21gifts-push-open' || typeof url !== 'string' || !isPushOpenPath(url)) {
        return;
      }
      openUrl(url);
    };

    const pull = (): void => {
      void takePendingPushOpen(Date.now()).then((url) => {
        if (url !== null) {
          openUrl(url);
        }
      });
    };

    worker.addEventListener('message', onMessage);
    pull();
    return () => {
      cancelled = true;
      worker.removeEventListener('message', onMessage);
    };
  }, [router]);

  return null;
}
