'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

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
 * Listens for `21gifts-push-open` from the service worker so an installed
 * phone app can `router.push` to the notification path (no WindowClient.navigate).
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
      router.push(url);
    };

    worker.addEventListener('message', onMessage);
    return () => {
      worker.removeEventListener('message', onMessage);
    };
  }, [router]);

  return null;
}
