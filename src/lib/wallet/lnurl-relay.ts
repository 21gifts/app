import { giftsLightningAddress } from '@/lib/gifts-address';
import { decodeLnurl } from '@/lib/lnurl';

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
  const domain = host.toLowerCase().replace(/\.$/, '');
  return giftsLightningAddress('own', hostname) === `own@${domain}` ? null : bare;
}
