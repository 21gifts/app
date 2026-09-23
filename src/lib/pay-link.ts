import { decodeLnurl } from '@/lib/lnurl';

const IPV4_ADDRESS = /^(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)$/;

function normaliseHost(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/^(\[[^\]]+\]):\d+$/, '$1')
    .replace(/^([^:]+):\d+$/, '$1')
    .replace(/^www\./, '');
}

/**
 * Resolve a same-host LNURL-pay value to its untouched username.
 *
 * @param lightning - Encoded LNURL from the payment-page query.
 * @param pageHost - Current page host, optionally including a port.
 * @returns The decoded username, or `null` when the payment link is invalid.
 */
export function payLinkUsername(lightning: string, pageHost: string): string | null {
  const decoded = decodeLnurl(lightning);
  if (decoded === null) {
    return null;
  }

  try {
    const target = new URL(decoded);
    if (target.protocol !== 'https:') {
      return null;
    }
    const match = /^\/\.well-known\/lnurlp\/([^/]+)$/.exec(target.pathname);
    const segment = match?.[1];
    if (segment === undefined) {
      return null;
    }

    const host = normaliseHost(pageHost);
    const expectedHost =
      host === '' ||
      host === 'localhost' ||
      host === '::1' ||
      host === '[::1]' ||
      host.endsWith('.localhost') ||
      IPV4_ADDRESS.test(host)
        ? '21.gifts'
        : host;
    if (target.hostname !== expectedHost) {
      return null;
    }

    return decodeURIComponent(segment);
  } catch {
    return null;
  }
}
