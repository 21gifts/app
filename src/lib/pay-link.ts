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

/**
 * Lightning address (`<name>@<host>`) behind an LNURL that points at
 * `https://<host>/.well-known/lnurlp/<name>`, so a send can name the receiver
 * the way a pasted address does. Reads a bech32 LNURL (with or without
 * `lightning:`) and the `https://<host>/pl/?lightning=` link of a profile or
 * point-of-sale QR. Any host.
 *
 * @param text - Text as pasted or scanned.
 * @returns The address, or `null` for any other text or LNURL (another path,
 *   a port, a query, user info, not https, or a name an address cannot carry).
 */
export function lnurlPayAddress(text: string): string | null {
  const bare = text.trim().replace(/^lightning:/i, '');
  try {
    let lnurl = bare;
    if (/^[a-z][a-z0-9+.-]*:\/\//i.test(bare)) {
      const link = new URL(bare);
      if (link.protocol !== 'https:' || !/^\/pl\/?$/.test(link.pathname)) {
        return null;
      }
      lnurl = link.searchParams.get('lightning') ?? '';
    }
    const decoded = decodeLnurl(lnurl);
    if (decoded === null) {
      return null;
    }
    const target = new URL(decoded);
    if (
      target.protocol !== 'https:' ||
      target.port !== '' ||
      target.search !== '' ||
      target.username !== '' ||
      target.password !== ''
    ) {
      return null;
    }
    const segment = /^\/\.well-known\/lnurlp\/([^/]+)$/.exec(target.pathname)?.[1];
    if (segment === undefined) {
      return null;
    }
    const name = decodeURIComponent(segment);
    return /^[a-z0-9._+-]+$/i.test(name) ? `${name}@${target.hostname}` : null;
  } catch {
    return null;
  }
}
