'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from '@/components/LocaleProvider';
import { usePaySheetClose } from '@/components/PaySheet';
import { Button } from '@/components/ui';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  type ReactElement,
  type ReactNode,
} from 'react';

/** Query parameter that opens the Receive view of `/wallet` (`/wallet?receive=1`). */
const RECEIVE_PARAM = 'receive';

const OpenReceiveContext = createContext<(() => void) | null>(null);

/**
 * Gives the page's own Receive view to the controls inside it that send the member to Receive (the
 * pay sheet's **Add Bitcoin**). The forum home provides it, so Receive opens over the forum there.
 * `null` (no wallet view on the page right now) leaves them the way to `/wallet`.
 *
 * @param props - The page's Receive opener, or `null`, and the page.
 * @returns The page with that opener.
 */
export function OpenReceiveProvider({
  onOpen,
  children,
}: {
  onOpen: (() => void) | null;
  children: ReactNode;
}): ReactElement {
  return <OpenReceiveContext.Provider value={onOpen}>{children}</OpenReceiveContext.Provider>;
}

/**
 * **Add Bitcoin** of the pay slot when the balance is too low: a full-width secondary button that
 * closes the pay sheet around it (`usePaySheetClose`, a close by the member, so no success step)
 * and opens the wallet's Receive view: the page's own one under an {@link OpenReceiveProvider},
 * otherwise `/wallet` with Receive open (`/wallet?receive=1`, through the client-side router).
 *
 * @returns The button.
 */
export function AddBitcoinButton(): ReactElement {
  const { t } = useTranslations();
  const own = useContext(OpenReceiveContext);
  const closeSheet = usePaySheetClose();
  const router = useRouter();
  const open = useCallback((): void => {
    closeSheet?.();
    if (own !== null) {
      own();
      return;
    }
    router.push(`/wallet?${RECEIVE_PARAM}=1`);
  }, [closeSheet, own, router]);
  return (
    <Button type="button" variant="secondary" size="lg" onClick={open}>
      {t('paySheet.addBitcoin')}
    </Button>
  );
}

/**
 * Opens Receive once when the page was opened with `?receive=1`, and then removes `receive` from
 * the address with `history.replaceState`, so a later visit of this entry shows the page itself.
 *
 * @param openReceive - The page's Receive opener.
 */
export function useReceiveLink(openReceive: () => void): void {
  useEffect(() => {
    const { pathname, search, hash } = window.location;
    const params = new URLSearchParams(search);
    if (params.get(RECEIVE_PARAM) !== '1') {
      return;
    }
    params.delete(RECEIVE_PARAM);
    const rest = params.toString();
    window.history.replaceState(
      window.history.state,
      '',
      `${pathname}${rest === '' ? '' : `?${rest}`}${hash}`,
    );
    openReceive();
  }, [openReceive]);
}
