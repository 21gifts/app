import { getE2eNow } from '@/lib/config';

/**
 * Name of the `?visual=` screenshot pin, honoured only in a Playwright build
 * (`getE2eNow()` set).
 *
 * @returns The pin name, or `null` (always `null` in a deployed build).
 */
export function visualPin(): string | null {
  /* v8 ignore next 3 -- SSR has no window */
  if (typeof window === 'undefined') {
    return null;
  }
  if (getE2eNow() === null) {
    return null;
  }
  return new URLSearchParams(window.location.search).get('visual');
}
