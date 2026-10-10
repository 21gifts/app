import { giftsLightningAddress } from '@/lib/gifts-address';
import { decodeLnurl } from '@/lib/lnurl';
import { lnurlPayAddress } from '@/lib/pay-link';

/** `user@domain`; a leading `₿` (a DNS payment address) is left to the wallet. */
const LIGHTNING_ADDRESS = /^[^\s@₿]+@([^\s@]+\.[^\s@]+)$/;

/**
 * Decides whether the `/wallet` send flow reads a pasted text through the
 * api (`POST /lnurl/pay-request` and `POST /lnurl/invoice`) instead of the
 * wallet. That is a Lightning address or a bech32 LNURL whose host is not
 * this app's own host. Own-host addresses, payment requests, Spark targets,
 * and anything else stay with the wallet.
 *
 * @param text - Text as pasted; an optional `lightning:` prefix is removed.
 * @param hostname - This page's host name (`window.location.hostname`).
 * @returns The address or LNURL to send as `target`, or `null` when the wallet reads the text.
 */
export function lnurlRelayTarget(text: string, hostname: string): string | null {
  const bare = text.trim().replace(/^lightning:/i, '');
  let host: string;
  const address = LIGHTNING_ADDRESS.exec(bare);
  if (address !== null) {
    host = address[1] as string;
  } else {
    const url = decodeLnurl(bare);
    if (url === null) {
      return null;
    }
    try {
      host = new URL(url).hostname;
    } catch {
      return null;
    }
  }
  return isOwnHost(host, hostname) ? null : bare;
}

/**
 * This app's own host, the way addresses name it (see `giftsLightningAddress`).
 *
 * @param hostname - This page's host name.
 * @returns The domain of an address on this host.
 */
function ownDomain(hostname: string): string {
  return (giftsLightningAddress('own', hostname.replace(/\.$/, '')) as string).slice('own@'.length);
}

/**
 * Whether `host` is this app's own host.
 *
 * @param host - Host of an address or LNURL.
 * @param hostname - This page's host name.
 * @returns `true` for the own host (any case, `www.`, or a trailing dot).
 */
function isOwnHost(host: string, hostname: string): boolean {
  const domain = host
    .toLowerCase()
    .replace(/\.$/, '')
    .replace(/^www\./, '');
  return domain === ownDomain(hostname);
}

/** A 21.gifts shop on this app's own host. */
export interface OwnShop {
  /** Lower-case username, as `GET /pay/:username` takes it. */
  name: string;
  /** `<name>@<host>` shown as the receiver. */
  address: string;
}

/**
 * The 21.gifts shop on this app's own host that a pasted or scanned text
 * pays: a Lightning address `<name>@<host>`, or an LNURL (bare, with
 * `lightning:`, or in an https `/pl/?lightning=` link) of
 * `https://<host>/.well-known/lnurlp/<name>`. The `/wallet` send flow asks
 * that shop for an open charge it can pay with a Spark invoice.
 *
 * @param text - Text as pasted or scanned.
 * @param hostname - This page's host name (`window.location.hostname`).
 * @returns The shop's name and address, or `null` for anything else.
 */
export function ownShop(text: string, hostname: string): OwnShop | null {
  const bare = text.trim().replace(/^lightning:/i, '');
  const address = LIGHTNING_ADDRESS.test(bare) ? bare : lnurlPayAddress(bare);
  if (address === null) {
    return null;
  }
  const at = address.lastIndexOf('@');
  if (!isOwnHost(address.slice(at + 1), hostname)) {
    return null;
  }
  const name = address.slice(0, at).toLowerCase();
  return { name, address: `${name}@${ownDomain(hostname)}` };
}
