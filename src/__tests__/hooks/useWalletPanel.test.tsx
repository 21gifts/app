import { act, cleanup, renderHook } from '@testing-library/react';
import type { ReactElement, ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppShellContext } from '@/components/AppShell';
import { useWalletPanel, type UseWalletPanelOptions } from '@/hooks/useWalletPanel';
import type { UseWalletSendResult, WalletSendState } from '@/hooks/useWalletSend';

const ORIGINAL_E2E_NOW = process.env.NEXT_PUBLIC_E2E_NOW;

function sendWith(
  state: WalletSendState = { step: 'input', error: null },
  extra: Partial<UseWalletSendResult> = {},
): UseWalletSendResult {
  return {
    state,
    busy: false,
    walletWait: null,
    retryWallet: vi.fn(),
    sending: false,
    text: '',
    setText: vi.fn(),
    comment: '',
    setComment: vi.fn(),
    submitInput: vi.fn(),
    submitAmount: vi.fn(),
    setSpeed: vi.fn(),
    confirm: vi.fn(),
    cancel: vi.fn(() => state.step !== 'input'),
    abandon: vi.fn(),
    ...extra,
  };
}

const CONFIRM: WalletSendState = { step: 'confirm', recipient: 'r', amountSats: 1, feeSats: 0 };

/** Renders the hook inside a shell context whose scroller is `scroller`. */
function renderPanel(
  initial: UseWalletPanelOptions,
  scroller: HTMLElement | null = null,
): ReturnType<typeof renderHook<ReturnType<typeof useWalletPanel>, UseWalletPanelOptions>> {
  const wrapper = ({ children }: { children: ReactNode }): ReactElement => (
    <AppShellContext.Provider
      value={
        { scrollerEl: scroller } as unknown as NonNullable<
          React.ContextType<typeof AppShellContext>
        >
      }
    >
      {children}
    </AppShellContext.Provider>
  );
  return renderHook((props: UseWalletPanelOptions) => useWalletPanel(props), {
    initialProps: initial,
    wrapper,
  });
}

beforeEach(() => {
  delete process.env.NEXT_PUBLIC_E2E_NOW;
  window.history.replaceState({}, '', '/welcome');
});

afterEach(() => {
  cleanup();
  if (ORIGINAL_E2E_NOW === undefined) {
    delete process.env.NEXT_PUBLIC_E2E_NOW;
  } else {
    process.env.NEXT_PUBLIC_E2E_NOW = ORIGINAL_E2E_NOW;
  }
});

describe('useWalletPanel open and Back', () => {
  it('opens Receive and Back returns to the page; Back on the page takes no step', () => {
    const { result } = renderPanel({ send: sendWith() });
    expect(result.current.shown).toBe('none');
    let stepped = true;
    act(() => {
      stepped = result.current.stepBack();
    });
    expect(stepped).toBe(false);
    act(() => {
      result.current.openReceive();
    });
    expect(result.current.shown).toBe('receive');
    act(() => {
      stepped = result.current.stepBack();
    });
    expect(stepped).toBe(true);
    expect(result.current.shown).toBe('none');
  });

  it('opens Send at once, also while the wallet opens, and never without a send flow', () => {
    const send = sendWith();
    const { result, rerender } = renderPanel({ send: undefined });
    act(() => {
      result.current.openSend();
    });
    expect(result.current.shown).toBe('none');
    rerender({ send });
    act(() => {
      result.current.openSend();
    });
    expect(result.current.shown).toBe('send');
  });

  it('Back in Send closes an open step first, then clears the text and returns to the page', () => {
    const confirm = sendWith(CONFIRM);
    const { result, rerender } = renderPanel({ send: confirm });
    act(() => {
      result.current.openSend();
    });
    act(() => {
      result.current.stepBack();
    });
    expect(confirm.cancel).toHaveBeenCalledTimes(1);
    expect(result.current.shown).toBe('send');
    const idle = sendWith();
    rerender({ send: idle });
    act(() => {
      result.current.stepBack();
    });
    expect(idle.setText).toHaveBeenCalledWith('');
    expect(result.current.shown).toBe('none');
  });

  it('Back drops a read that waits for the wallet and returns to the page', () => {
    const waiting = sendWith({ step: 'input', error: null }, { busy: true, walletWait: 'error' });
    const { result, rerender } = renderPanel({ send: waiting });
    act(() => {
      result.current.openSend();
    });
    let stepped = false;
    act(() => {
      stepped = result.current.stepBack();
    });
    expect(stepped).toBe(true);
    expect(waiting.abandon).toHaveBeenCalledTimes(1);
    expect(waiting.setText).not.toHaveBeenCalled();
    // abandon leaves the flow idle, so the view is no longer held open.
    rerender({ send: sendWith() });
    expect(result.current.shown).toBe('none');
  });

  it('holds Back while a send is in flight', () => {
    const busy = sendWith({ step: 'input', error: null }, { busy: true });
    const { result } = renderPanel({ send: busy });
    expect(result.current.shown).toBe('send');
    act(() => {
      result.current.stepBack();
    });
    expect(busy.setText).not.toHaveBeenCalled();
    expect(result.current.shown).toBe('send');
  });

  it('pins Send for an alert or the Sent line, returns to the page after Sent, and keeps a chosen Send view while the wallet waits', () => {
    const { result, rerender } = renderPanel({
      send: sendWith({ step: 'input', error: 'unavailable' }),
    });
    expect(result.current.shown).toBe('send');
    rerender({ send: sendWith({ step: 'sent', amountSats: 1, recipient: 'r' }) });
    expect(result.current.shown).toBe('send');
    rerender({ send: sendWith() });
    expect(result.current.shown).toBe('none');
    act(() => {
      result.current.openSend();
    });
    expect(result.current.shown).toBe('send');
    rerender({
      send: sendWith({ step: 'input', error: null }, { busy: true, walletWait: 'opening' }),
    });
    expect(result.current.shown).toBe('send');
    rerender({
      send: sendWith({ step: 'quote', recipient: 'r', amountSats: 1 }, { walletWait: 'error' }),
    });
    expect(result.current.shown).toBe('send');
  });
});

describe('useWalletPanel focus', () => {
  it('names the view that just closed as the footer button to focus', () => {
    const { result } = renderPanel({ send: sendWith() });
    expect(result.current.returnFocus).toBeNull();
    act(() => {
      result.current.openSend();
    });
    expect(result.current.returnFocus).toBeNull();
    act(() => {
      result.current.stepBack();
    });
    expect(result.current.returnFocus).toBe('send');
    act(() => {
      result.current.openReceive();
    });
    act(() => {
      result.current.stepBack();
    });
    expect(result.current.returnFocus).toBe('receive');
  });
});

describe('useWalletPanel manual entry and readiness', () => {
  it('closes the sheet when a read starts waiting for the wallet, so Back takes no invisible step', () => {
    const send = sendWith();
    const { result, rerender } = renderPanel({ send });
    act(() => {
      result.current.openSend();
    });
    act(() => {
      result.current.setManualEntry(true);
    });
    expect(result.current.manualEntry).toBe(true);
    rerender({ send: sendWith({ step: 'input', error: null }, { busy: true }) });
    expect(result.current.manualEntry).toBe(true);
    const waiting = sendWith({ step: 'input', error: null }, { busy: true, walletWait: 'opening' });
    rerender({ send: waiting });
    expect(result.current.manualEntry).toBe(false);
    rerender({ send: sendWith({ step: 'input', error: null }, { busy: true }) });
    expect(result.current.manualEntry).toBe(false);
  });
});

describe('useWalletPanel manual entry', () => {
  it('shows the sheet only on the Send input step; Back and a step change close it', () => {
    const send = sendWith();
    const { result, rerender } = renderPanel({ send });
    act(() => {
      result.current.setManualEntry(true);
    });
    expect(result.current.manualEntry).toBe(false);
    act(() => {
      result.current.openSend();
    });
    act(() => {
      result.current.setManualEntry(true);
    });
    expect(result.current.manualEntry).toBe(true);
    let stepped = false;
    act(() => {
      stepped = result.current.stepBack();
    });
    expect(stepped).toBe(true);
    expect(result.current.manualEntry).toBe(false);
    expect(result.current.shown).toBe('send');
    act(() => {
      result.current.setManualEntry(true);
    });
    rerender({ send: sendWith(CONFIRM) });
    expect(result.current.manualEntry).toBe(false);
    rerender({ send });
    expect(result.current.manualEntry).toBe(false);
  });
});

describe('useWalletPanel close', () => {
  it('drops the flow and returns to the page top, but not while a confirmed send is in flight', () => {
    const scroller = document.createElement('div');
    const sending = sendWith(CONFIRM, { busy: true, sending: true });
    const { result, rerender } = renderPanel({ send: sending }, scroller);
    act(() => {
      result.current.close();
    });
    expect(sending.abandon).not.toHaveBeenCalled();
    expect(result.current.shown).toBe('send');
    const reading = sendWith({ step: 'input', error: null }, { busy: true });
    rerender({ send: reading });
    act(() => {
      result.current.openSend();
    });
    act(() => {
      result.current.close();
    });
    expect(reading.abandon).toHaveBeenCalledTimes(1);
    rerender({ send: sendWith() });
    expect(result.current.shown).toBe('none');
    expect(scroller.scrollTop).toBe(0);
  });

  it('closes Receive without touching the send flow', () => {
    const send = sendWith();
    const { result } = renderPanel({ send });
    act(() => {
      result.current.openReceive();
    });
    act(() => {
      result.current.close();
    });
    expect(send.abandon).not.toHaveBeenCalled();
    expect(result.current.shown).toBe('none');
  });
});

describe('useWalletPanel scroll', () => {
  it('shows a view from the top and restores the page position on Back', () => {
    const scroller = document.createElement('div');
    scroller.scrollTop = 320;
    const { result } = renderPanel({ send: sendWith() }, scroller);
    act(() => {
      result.current.openReceive();
    });
    expect(scroller.scrollTop).toBe(0);
    act(() => {
      result.current.openSend();
    });
    expect(result.current.shown).toBe('send');
    expect(scroller.scrollTop).toBe(0);
    act(() => {
      result.current.stepBack();
    });
    expect(result.current.shown).toBe('none');
    expect(scroller.scrollTop).toBe(320);
  });
});

describe('useWalletPanel Send pin', () => {
  it('opens Send under a send pin in a Playwright build when asked', () => {
    process.env.NEXT_PUBLIC_E2E_NOW = '2026-01-07T12:00:00.000Z';
    window.history.replaceState({}, '', '/welcome?visual=send-input');
    const { result } = renderPanel({
      send: sendWith(),
      openPinnedSend: true,
    });
    expect(result.current.shown).toBe('send');
  });

  it('ignores the send pin outside a Playwright build, on pages that do not ask, and for other pins', () => {
    window.history.replaceState({}, '', '/welcome?visual=send-input');
    const deployed = renderPanel({
      send: sendWith(),
      openPinnedSend: true,
    });
    expect(deployed.result.current.shown).toBe('none');
    deployed.unmount();
    process.env.NEXT_PUBLIC_E2E_NOW = '2026-01-07T12:00:00.000Z';
    const wallet = renderPanel({ send: sendWith() });
    expect(wallet.result.current.shown).toBe('none');
    wallet.unmount();
    window.history.replaceState({}, '', '/welcome?visual=balance-ready');
    const other = renderPanel({
      send: sendWith(),
      openPinnedSend: true,
    });
    expect(other.result.current.shown).toBe('none');
  });
});
