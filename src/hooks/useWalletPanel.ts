'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useAppShellScroller } from '@/components/AppShell';
import type { UseWalletSendResult } from '@/hooks/useWalletSend';
import { visualPin } from '@/lib/visual-pin';

/** Wallet view shown in place of a page's own body. `none` is the page itself. */
export type WalletPanel = 'none' | 'receive' | 'send';

/** Inputs of {@link useWalletPanel}. */
export interface UseWalletPanelOptions {
  /** Send flow state, or `undefined` where the page has no Send. */
  send: UseWalletSendResult | undefined;
  /**
   * Open the Send view on mount under a `?visual=send-…` pin (Playwright
   * builds only). `/welcome` sets it; `/wallet` keeps its pins behind Send.
   */
  openPinnedSend?: boolean;
}

/** State and actions of {@link useWalletPanel}. */
export interface UseWalletPanelResult {
  /** The view to render now. */
  shown: WalletPanel;
  /** Opens Receive. */
  openReceive: () => void;
  /** Opens Send, also while the wallet is still opening. */
  openSend: () => void;
  /** The footer button to focus when the page comes back (the view that just closed), or `null`. */
  returnFocus: 'receive' | 'send' | null;
  /** Whether the Send input step shows its manual-entry sheet over the camera. */
  manualEntry: boolean;
  /** Opens or closes the manual-entry sheet. */
  setManualEntry: (open: boolean) => void;
  /**
   * One top-left Back step: closes the manual-entry sheet or an open send
   * step (or is held while a read or send is in flight), otherwise returns
   * from Send or Receive to the page; a read that waits for the wallet is
   * dropped on the way.
   *
   * @returns `true` when it took an in-page step, `false` when no view is open.
   */
  stepBack: () => boolean;
  /**
   * Returns to the page at its top (the wordmark and the Menu's Home),
   * dropping a read or prepare in flight, unless a confirmed send is in
   * flight.
   */
  close: () => void;
}

/**
 * Whether the Send view must stay on screen: while a send is in flight, its
 * Sent line shows, or an alert is up, so a closed view never hides a payment
 * that may already have left or the alert of one that failed.
 *
 * @param send - Send flow state.
 * @returns Whether the Send view is pinned.
 */
function isSendPinned(send: UseWalletSendResult): boolean {
  return (
    send.busy ||
    send.state.step === 'sent' ||
    (send.state.step === 'input' && send.state.error !== null)
  );
}

/**
 * Which wallet view (Receive or Send) shows over a page, shared by `/wallet`
 * and `/welcome`. Send and Receive open at once, also while the wallet is
 * still opening: only a step inside a view that needs the open wallet waits
 * for it, and a view never closes because the wallet is not ready. The Send
 * view stays while a send is in flight, its Sent line shows, or a send alert
 * is up. Leaving the Sent line (Done or Back) returns to the page; that
 * adjusts during render, so no commit shows the Send input (and its camera)
 * in between. The manual-entry sheet of the Send input step closes whenever
 * the send step changes, a read starts waiting for the wallet (the camera
 * area then shows that wait), or a view opens or closes. Opening a view keeps the page's
 * scroll position and shows the view from the top; closing it restores that
 * position.
 *
 * @param options - Send flow, and whether a send pin opens Send.
 * @returns The shown view and its open, Back, and close actions.
 */
export function useWalletPanel({
  send,
  openPinnedSend = false,
}: UseWalletPanelOptions): UseWalletPanelResult {
  const [panel, setPanel] = useState<WalletPanel>('none');
  const [manual, setManual] = useState(false);
  const sendStep = send?.state.step;
  const wait = send?.walletWait ?? null;
  const [seen, setSeen] = useState({ sendStep, wait });
  if (seen.sendStep !== sendStep || seen.wait !== wait) {
    setSeen({ sendStep, wait });
    // The sheet closes with a step change, and when a read starts waiting for the wallet (the
    // camera area then shows that wait), so Back never takes an invisible step.
    if (seen.sendStep !== sendStep || wait !== null) {
      setManual(false);
    }
    if (seen.sendStep === 'sent' && sendStep !== 'sent') {
      setPanel('none');
    }
  }
  const shown: WalletPanel = send !== undefined && isSendPinned(send) ? 'send' : panel;
  const manualEntry = manual && shown === 'send' && sendStep === 'input';
  const [lastView, setLastView] = useState<'receive' | 'send' | null>(null);
  if (shown !== 'none' && lastView !== shown) {
    setLastView(shown);
  }

  const scroller = useAppShellScroller();
  /** Page scroll position when a view opened. */
  const savedScroll = useRef(0);
  const lastShown = useRef<WalletPanel>(shown);
  useLayoutEffect(() => {
    const from = lastShown.current;
    if (from === shown) {
      return;
    }
    lastShown.current = shown;
    if (scroller === null) {
      return;
    }
    if (shown === 'none') {
      scroller.scrollTop = savedScroll.current;
    } else if (from === 'none') {
      scroller.scrollTop = 0;
    }
  }, [shown, scroller]);

  const remember = useCallback((): void => {
    if (lastShown.current === 'none') {
      savedScroll.current = scroller?.scrollTop ?? 0;
    }
  }, [scroller]);

  const openReceive = useCallback((): void => {
    remember();
    setManual(false);
    setPanel('receive');
  }, [remember]);

  const openSend = useCallback((): void => {
    if (send === undefined) {
      return;
    }
    remember();
    setManual(false);
    setPanel('send');
  }, [send, remember]);

  useEffect(() => {
    if (openPinnedSend && visualPin()?.startsWith('send-') === true) {
      setPanel('send');
    }
  }, [openPinnedSend]);

  const stepBack = (): boolean => {
    if (manualEntry) {
      setManual(false);
      return true;
    }
    if (shown === 'send' && send !== undefined) {
      if (send.cancel()) {
        return true;
      }
      // A read that waits for the wallet is dropped; one that already runs holds Back.
      if (send.walletWait !== null) {
        send.abandon();
        setPanel('none');
      } else if (!send.busy) {
        send.setText('');
        setPanel('none');
      }
      return true;
    }
    if (shown === 'receive') {
      setPanel('none');
      return true;
    }
    return false;
  };

  const close = (): void => {
    if (shown === 'send' && send !== undefined) {
      if (send.sending) {
        return;
      }
      send.abandon();
    }
    savedScroll.current = 0;
    setManual(false);
    setPanel('none');
  };

  return {
    shown,
    returnFocus: shown === 'none' ? lastView : null,
    openReceive,
    openSend,
    manualEntry,
    setManualEntry: setManual,
    stepBack,
    close,
  };
}
