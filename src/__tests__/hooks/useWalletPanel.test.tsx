import { act, cleanup, renderHook } from '@testing-library/react';
import type { ReactElement, ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppShellContext } from '@/components/AppShell';
import type { UseWalletResult } from '@/hooks/useWallet';
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
    ...extra,
  };
}

function walletWith(status: UseWalletResult['status'], unlock = vi.fn()): UseWalletResult {
  return { status, balanceSats: null, unlock, retry: vi.fn(), prfUnsupported: false };
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
    const { result } = renderPanel({ send: sendWith(), wallet: walletWith('ready') });
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

  it('opens Send only while ready, and never without a send flow', () => {
    const send = sendWith();
    const { result, rerender } = renderPanel({ send, wallet: walletWith('connecting') });
    act(() => {
      result.current.openSend();
    });
    expect(result.current.shown).toBe('none');
    rerender({ send: undefined, wallet: walletWith('ready') });
    act(() => {
      result.current.openSend();
    });
    expect(result.current.shown).toBe('none');
    rerender({ send, wallet: walletWith('ready') });
    act(() => {
      result.current.openSend();
    });
    expect(result.current.shown).toBe('send');
  });

  it('enables Send only for a send flow while the wallet is ready or locked', () => {
    const cases = [
      ['ready', true, false],
      ['locked', true, false],
      ['connecting', true, true],
      ['error', true, true],
      ['disabled', true, true],
      ['ready', false, true],
    ] as const;
    for (const [status, withSend, disabled] of cases) {
      const { result, unmount } = renderPanel({
        send: withSend ? sendWith() : undefined,
        wallet: walletWith(status),
      });
      expect(result.current.sendDisabled).toBe(disabled);
      unmount();
    }
    const { result } = renderPanel({ send: sendWith(), wallet: undefined });
    expect(result.current.sendDisabled).toBe(true);
  });

  it('Back in Send closes an open step first, then clears the text and returns to the page', () => {
    const confirm = sendWith(CONFIRM);
    const { result, rerender } = renderPanel({ send: confirm, wallet: walletWith('ready') });
    act(() => {
      result.current.openSend();
    });
    act(() => {
      result.current.stepBack();
    });
    expect(confirm.cancel).toHaveBeenCalledTimes(1);
    expect(result.current.shown).toBe('send');
    const idle = sendWith();
    rerender({ send: idle, wallet: walletWith('ready') });
    act(() => {
      result.current.stepBack();
    });
    expect(idle.setText).toHaveBeenCalledWith('');
    expect(result.current.shown).toBe('none');
  });

  it('holds Back while a send is in flight', () => {
    const busy = sendWith({ step: 'input', error: null }, { busy: true });
    const { result } = renderPanel({ send: busy, wallet: walletWith('ready') });
    expect(result.current.shown).toBe('send');
    act(() => {
      result.current.stepBack();
    });
    expect(busy.setText).not.toHaveBeenCalled();
    expect(result.current.shown).toBe('send');
  });

  it('pins Send for an alert or the Sent line, returns to the page after Sent, and closes when the wallet stops being ready', () => {
    const wallet = walletWith('ready');
    const { result, rerender } = renderPanel({
      send: sendWith({ step: 'input', error: 'notReady' }),
      wallet: walletWith('locked'),
    });
    expect(result.current.shown).toBe('send');
    rerender({ send: sendWith({ step: 'sent', amountSats: 1, recipient: 'r' }), wallet });
    expect(result.current.shown).toBe('send');
    rerender({ send: sendWith(), wallet });
    expect(result.current.shown).toBe('none');
    act(() => {
      result.current.openSend();
    });
    expect(result.current.shown).toBe('send');
    rerender({ send: sendWith(), wallet: walletWith('connecting') });
    expect(result.current.shown).toBe('none');
    rerender({ send: sendWith(), wallet });
    expect(result.current.shown).toBe('none');
  });
});

describe('useWalletPanel locked wallet', () => {
  it('runs the unlock and opens Send once the wallet is ready', () => {
    const unlock = vi.fn();
    const send = sendWith();
    const { result, rerender } = renderPanel({ send, wallet: walletWith('locked', unlock) });
    act(() => {
      result.current.openSend();
    });
    expect(unlock).toHaveBeenCalledTimes(1);
    expect(result.current.shown).toBe('none');
    rerender({ send, wallet: walletWith('connecting', unlock) });
    expect(result.current.shown).toBe('none');
    rerender({ send, wallet: walletWith('ready', unlock) });
    expect(result.current.shown).toBe('send');
  });

  it('opens nothing after an unlock that fails or is dismissed', () => {
    const send = sendWith();
    const failed = renderPanel({ send, wallet: walletWith('locked') });
    act(() => {
      failed.result.current.openSend();
    });
    failed.rerender({ send, wallet: walletWith('error') });
    failed.rerender({ send, wallet: walletWith('ready') });
    expect(failed.result.current.shown).toBe('none');
    failed.unmount();

    const dismissed = renderPanel({ send, wallet: walletWith('locked') });
    act(() => {
      dismissed.result.current.openSend();
    });
    dismissed.rerender({ send, wallet: walletWith('connecting') });
    dismissed.rerender({ send, wallet: walletWith('locked') });
    dismissed.rerender({ send, wallet: walletWith('ready') });
    expect(dismissed.result.current.shown).toBe('none');
  });

  it('keeps waiting while the status stays locked, and close drops the wait', () => {
    const send = sendWith();
    const { result, rerender } = renderPanel({ send, wallet: walletWith('locked') });
    act(() => {
      result.current.openSend();
    });
    rerender({
      send: sendWith({ step: 'amount', target: CONFIRM as never, amountError: false }),
      wallet: walletWith('locked'),
    });
    rerender({ send, wallet: walletWith('locked') });
    act(() => {
      result.current.close();
    });
    rerender({ send, wallet: walletWith('ready') });
    expect(result.current.shown).toBe('none');
  });
});

describe('useWalletPanel manual entry and pending unlock', () => {
  it('closes the sheet when the wallet stops being ready, so Back takes no invisible step', () => {
    const send = sendWith({ step: 'input', error: 'notReady' });
    const { result, rerender } = renderPanel({ send, wallet: walletWith('ready') });
    act(() => {
      result.current.setManualEntry(true);
    });
    expect(result.current.manualEntry).toBe(true);
    rerender({ send, wallet: walletWith('connecting') });
    expect(result.current.manualEntry).toBe(false);
    act(() => {
      result.current.stepBack();
    });
    expect(send.setText).toHaveBeenCalledWith('');
  });

  it('drops a pending unlock-then-Send when Receive is chosen meanwhile', () => {
    const send = sendWith();
    const { result, rerender } = renderPanel({ send, wallet: walletWith('locked') });
    act(() => {
      result.current.openSend();
    });
    rerender({ send, wallet: walletWith('connecting') });
    act(() => {
      result.current.openReceive();
    });
    rerender({ send, wallet: walletWith('ready') });
    expect(result.current.shown).toBe('receive');
  });
});

describe('useWalletPanel manual entry', () => {
  it('shows the sheet only on the Send input step; Back and a step change close it', () => {
    const send = sendWith();
    const { result, rerender } = renderPanel({ send, wallet: walletWith('ready') });
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
    rerender({ send: sendWith(CONFIRM), wallet: walletWith('ready') });
    expect(result.current.manualEntry).toBe(false);
    rerender({ send, wallet: walletWith('ready') });
    expect(result.current.manualEntry).toBe(false);
  });
});

describe('useWalletPanel close', () => {
  it('cancels the flow, clears the text, and returns to the page top, but not while a send is in flight', () => {
    const scroller = document.createElement('div');
    const busy = sendWith(CONFIRM, { busy: true });
    const { result, rerender } = renderPanel({ send: busy, wallet: walletWith('ready') }, scroller);
    act(() => {
      result.current.close();
    });
    expect(busy.cancel).not.toHaveBeenCalled();
    expect(result.current.shown).toBe('send');
    const idle = sendWith(CONFIRM);
    rerender({ send: idle, wallet: walletWith('ready') });
    act(() => {
      result.current.openSend();
    });
    act(() => {
      result.current.close();
    });
    expect(idle.cancel).toHaveBeenCalledTimes(1);
    expect(idle.setText).toHaveBeenCalledWith('');
    rerender({ send: sendWith(), wallet: walletWith('ready') });
    expect(result.current.shown).toBe('none');
    expect(scroller.scrollTop).toBe(0);
  });

  it('closes Receive without touching the send flow', () => {
    const send = sendWith();
    const { result } = renderPanel({ send, wallet: walletWith('ready') });
    act(() => {
      result.current.openReceive();
    });
    act(() => {
      result.current.close();
    });
    expect(send.cancel).not.toHaveBeenCalled();
    expect(result.current.shown).toBe('none');
  });
});

describe('useWalletPanel scroll', () => {
  it('shows a view from the top and restores the page position on Back', () => {
    const scroller = document.createElement('div');
    scroller.scrollTop = 320;
    const { result } = renderPanel({ send: sendWith(), wallet: walletWith('ready') }, scroller);
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
      wallet: walletWith('ready'),
      openPinnedSend: true,
    });
    expect(result.current.shown).toBe('send');
  });

  it('ignores the send pin outside a Playwright build, on pages that do not ask, and for other pins', () => {
    window.history.replaceState({}, '', '/welcome?visual=send-input');
    const deployed = renderPanel({
      send: sendWith(),
      wallet: walletWith('ready'),
      openPinnedSend: true,
    });
    expect(deployed.result.current.shown).toBe('none');
    deployed.unmount();
    process.env.NEXT_PUBLIC_E2E_NOW = '2026-01-07T12:00:00.000Z';
    const wallet = renderPanel({ send: sendWith(), wallet: walletWith('ready') });
    expect(wallet.result.current.shown).toBe('none');
    wallet.unmount();
    window.history.replaceState({}, '', '/welcome?visual=balance-ready');
    const other = renderPanel({
      send: sendWith(),
      wallet: walletWith('ready'),
      openPinnedSend: true,
    });
    expect(other.result.current.shown).toBe('none');
  });
});
