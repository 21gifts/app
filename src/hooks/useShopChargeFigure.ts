'use client';

import { useEffect, useState } from 'react';
import { committedFiatFigure, type FiatCode } from '@/lib/committed-fiat';
import { fetchShopChargeReceipt } from '@/lib/pos';

/** What a shop payment row shows before and after its receipt. */
export interface ShopChargeFigureState {
  /** True until the receipt read settles. False when this payment is not a shop charge. */
  pending: boolean;
  /** Stored figure, or `null` while pending, on a miss, or when this is not a shop charge. */
  figure: { code: FiatCode; amount: string } | null;
}

/**
 * Local part of a Lightning address (`name@domain`), or `null` when there is none.
 *
 * @param address - Paid Lightning address, when the payment has one.
 * @returns The text before `@`, or `null`.
 */
function lightningLocalPart(address: string | undefined): string | null {
  if (address === undefined) {
    return null;
  }
  const at = address.indexOf('@');
  if (at < 1) {
    return null;
  }
  const local = address.slice(0, at);
  const domain = address.slice(at + 1);
  if (domain === '' || /\s/.test(local)) {
    return null;
  }
  return local;
}

/**
 * Receipt figure of a shop payment. Bitcoin (`figure` null) until the receipt
 * returns, and after a 404 or a network error. Does not read the spot rate.
 * A payment that is not a shop charge does not fetch.
 *
 * @param info - Payment method details, or `null` when there is no payment.
 * @returns Whether the receipt is still out, and the stored figure once it is known.
 */
export function useShopChargeFigure(
  info: { purpose?: 'gift' | 'shop'; chargeId?: string; lnAddress?: string } | null,
): ShopChargeFigureState {
  const chargeId =
    info !== null && info.purpose === 'shop' && typeof info.chargeId === 'string'
      ? info.chargeId
      : null;
  const username = chargeId === null || info === null ? null : lightningLocalPart(info.lnAddress);
  const [pending, setPending] = useState(chargeId !== null);
  const [figure, setFigure] = useState<ShopChargeFigureState['figure']>(null);

  useEffect(() => {
    if (chargeId === null) {
      setPending(false);
      setFigure(null);
      return;
    }
    let alive = true;
    setPending(true);
    setFigure(null);
    void fetchShopChargeReceipt(chargeId, username).then((receipt) => {
      if (!alive) {
        return;
      }
      setFigure(receipt === null ? null : committedFiatFigure(receipt));
      setPending(false);
    });
    return () => {
      alive = false;
    };
  }, [chargeId, username]);

  return { pending, figure };
}
