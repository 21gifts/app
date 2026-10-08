import { getE2eNow } from '@/lib/config';

/**
 * Name of the `?visual=` screenshot pin, honoured only in a Playwright build
 * (`getE2eNow()` set). The wallet balance, panel, payment, send, pay slot,
 * setup note, login gate, heart-paid, and heart-pending pins are read through this one check.
 *
 * @returns The pin name, or `null` (always `null` in a deployed build and during SSR).
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
