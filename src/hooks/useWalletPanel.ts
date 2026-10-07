'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useAppShellScroller } from '@/components/AppShell';
import type { UseWalletResult } from '@/hooks/useWallet';
import type { UseWalletSendResult } from '@/hooks/useWalletSend';
import { visualPin } from '@/lib/visual-pin';
import type { WalletStatus } from '@/stores/wallet-store';

/** Wallet view shown in place of a page's own body. `none` is the page itself. */
export type WalletPanel = 'none' | 'receive' | 'send';

/** Inputs of {@link useWalletPanel}. */
export interface UseWalletPanelOptions {
  /** Send flow state, or `undefined` where the page has no Send. */
  send: UseWalletSendResult | undefined;
  /** Wallet state, or `undefined` where the page shows no wallet. */
  wallet: UseWalletResult | undefined;
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
  /**
   * Opens Send while the wallet is ready. While it is locked, runs the
   * existing unlock first and opens Send once the wallet is ready.
   */
  openSend: () => void;
  /** The footer button to focus when the page comes back (the view that just closed), or `null`. */
  returnFocus: 'receive' | 'send' | null;
  /** Whether Send cannot be pressed now (no send flow, or the wallet is neither ready nor locked). */
  sendDisabled: boolean;
  /** Whether the Send input step shows its manual-entry sheet over the camera. */
  manualEntry: boolean;
  /** Opens or closes the manual-entry sheet. */
  setManualEntry: (open: boolean) => void;
  /**
   * One top-left Back step: closes the manual-entry sheet or an open send
   * step (or is held while a send is in flight), otherwise returns from Send
   * or Receive to the page.
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
 * Sent line shows, or an alert is up, so neither Back nor a wallet that stops
 * being ready hides a payment that may already have left or the alert of one
 * that failed.
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
 * and `/welcome`. Send opens only while the wallet is ready; pressed while
 * the wallet is locked, it runs the existing unlock and opens once the wallet
 * is ready (an unlock that fails or is dismissed opens nothing). The Send
 * view stays while a send is in flight, its Sent line shows, or a send alert
 * is up. Leaving the Sent line (Done or Back) returns to the page, and a
 * chosen Send view closes when the wallet stops being ready. Both adjust
 * during render, so no commit shows the Send input (and its camera) in
 * between. The manual-entry sheet of the Send input step closes whenever the
 * send step changes or a view opens or closes. Opening a view keeps the page's
 * scroll position and shows the view from the top; closing it restores that
 * position.
 *
 * @param options - Send flow, wallet state, and whether a send pin opens Send.
 * @returns The shown view and its open, Back, and close actions.
 */
export function useWalletPanel({
  send,
  wallet,
  openPinnedSend = false,
}: UseWalletPanelOptions): UseWalletPanelResult {
  const status: WalletStatus | undefined = wallet?.status;
  const walletReady = status === 'ready';
  const unlock = wallet?.unlock;
  const [panel, setPanel] = useState<WalletPanel>('none');
  const [manual, setManual] = useState(false);
  const [sendAfterUnlock, setSendAfterUnlock] = useState(false);
  const sendStep = send?.state.step;
  const [seen, setSeen] = useState({ sendStep, status });
  if (seen.sendStep !== sendStep || seen.status !== status) {
    setSeen({ sendStep, status });
    // The sheet closes with a step change, and when the wallet stops being ready (the Send view
    // then shows only its alert), so Back never takes an invisible step.
    if (seen.sendStep !== sendStep || !walletReady) {
      setManual(false);
    }
    if ((seen.sendStep === 'sent' && sendStep !== 'sent') || (!walletReady && panel === 'send')) {
      setPanel('none');
    }
    if (sendAfterUnlock) {
      if (walletReady) {
        setSendAfterUnlock(false);
        setManual(false);
        setPanel('send');
      } else if (status !== 'connecting' && status !== 'locked') {
        setSendAfterUnlock(false);
      } else if (seen.status === 'connecting' && status === 'locked') {
        setSendAfterUnlock(false);
      }
    }
  }
  const shown: WalletPanel =
    send !== undefined && isSendPinned(send)
      ? 'send'
      : panel === 'send' && !walletReady
        ? 'none'
        : panel;
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
    setSendAfterUnlock(false);
    setManual(false);
    setPanel('receive');
  }, [remember]);

  const openSend = useCallback((): void => {
    if (send === undefined) {
      return;
    }
    remember();
    setManual(false);
    if (status === 'locked' && unlock !== undefined) {
      setSendAfterUnlock(true);
      unlock();
      return;
    }
    if (walletReady) {
      setPanel('send');
    }
  }, [send, status, unlock, walletReady, remember]);

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
      if (!send.cancel() && !send.busy) {
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
    setSendAfterUnlock(false);
    setManual(false);
    setPanel('none');
  };

  return {
    shown,
    returnFocus: shown === 'none' ? lastView : null,
    openReceive,
    openSend,
    sendDisabled: send === undefined || !(walletReady || status === 'locked'),
    manualEntry,
    setManualEntry: setManual,
    stepBack,
    close,
  };
}
