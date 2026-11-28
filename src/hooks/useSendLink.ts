'use client';

import { useEffect } from 'react';
import type { UseWalletSendResult } from '@/hooks/useWalletSend';
import { giftsLightningAddress } from '@/lib/gifts-address';
import { usernameProblem } from '@/lib/profile-fields';

/**
 * Query parameter that opens the Send view of `/wallet` for one 21.gifts
 * username on this host (`/wallet?send=tondo-fond`). The value is a username,
 * never a full address or payment request, so the link can only start a
 * payment to a member's own `<username>@<host>` address.
 */
export const SEND_LINK_PARAM = 'send';

/**
 * Opens Send once when the page was opened with `?send=<username>`, and reads
 * that member's `<username>@<host>` address at once (`sendTo`), so the member
 * lands on the amount step of the existing send flow, as if they had pasted
 * the address. The parameter is then removed from the address with
 * `history.replaceState`, so a later visit of this entry shows the page
 * itself, as `useReceiveLink` does for `?receive=1`. A value that is not a
 * valid username (`usernameProblem`) is removed and ignored. Without a send
 * flow nothing happens.
 *
 * @param openSend - The page's Send opener.
 * @param send - The page's send flow, or `undefined` where the page has no Send.
 */
export function useSendLink(openSend: () => void, send: UseWalletSendResult | undefined): void {
  const sendTo = send?.sendTo;
  useEffect(() => {
    if (sendTo === undefined) {
      return;
    }
    const { pathname, search, hash, hostname } = window.location;
    const params = new URLSearchParams(search);
    const raw = params.get(SEND_LINK_PARAM);
    if (raw === null) {
      return;
    }
    params.delete(SEND_LINK_PARAM);
    const rest = params.toString();
    window.history.replaceState(
      window.history.state,
      '',
      `${pathname}${rest === '' ? '' : `?${rest}`}${hash}`,
    );
    if (usernameProblem(raw) !== null) {
      return;
    }
    openSend();
    sendTo(giftsLightningAddress(raw, hostname) as string);
  }, [openSend, sendTo]);
}
