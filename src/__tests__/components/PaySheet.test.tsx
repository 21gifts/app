import { act, cleanup, fireEvent, renderHook, screen } from '@testing-library/react';
import { useEffect, useLayoutEffect, useState, type ReactElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Collapse } from '@/components/Collapse';
import {
  PAY_SHEET_HOLD_MS,
  PAY_SHEET_SUCCESS_MS,
  PaySheet,
  PaySheetFailed,
  usePaySheetClose,
  usePaySheetHold,
  usePaySheetSent,
} from '@/components/PaySheet';
import type { WalletPaySent } from '@/hooks/useWalletPay';
import { MOTION_FOLD_MS, MOTION_SWAP_FADE_MS } from '@/lib/motion';
import type { StoredFiat } from '@/lib/committed-fiat';
import type { FiatRateDay } from '@/lib/stats-money';
import { renderWithLocale } from '@/__tests__/render-with-locale';

const RATE_DAY: FiatRateDay = {
  sats: 100_000_000,
  usd: '100000.00',
  chf: '80000.00',
  eur: '90000.00',
  php: '5600000.00',
};

/** The sheet as a host renders it: inside a `Collapse` that holds it for the success step. */
function sheet(
  open: boolean,
  onClose: () => void,
  rateDay: FiatRateDay | null = RATE_DAY,
  slot: ReactElement = <Sent />,
  stored?: StoredFiat,
): ReactElement {
  return (
    <Collapse show={open} holdMs={PAY_SHEET_HOLD_MS}>
      {open ? (
        <PaySheet
          title="Send to Ana"
          amountSats={500}
          rateDay={rateDay}
          {...(stored === undefined ? {} : { stored })}
          successTitle="Sent to Ana"
          onClose={onClose}
        >
          {slot}
        </PaySheet>
      ) : null}
    </Collapse>
  );
}

/** A pay slot that reports where its send stands, as the wallet's pay slot does. */
function Sent({ sent = 'paid' }: { sent?: WalletPaySent }): ReactElement {
  const report = usePaySheetSent();
  useEffect(() => {
    report?.(sent);
  }, [report, sent]);
  return <p>Pay slot</p>;
}

/** A pay slot whose send state the test changes after the host's fold froze its content. */
function liveSent(initial: WalletPaySent): {
  slot: ReactElement;
  set: (sent: WalletPaySent) => void;
} {
  const setter: { current: (sent: WalletPaySent) => void } = { current: () => undefined };
  function Live(): ReactElement {
    const [sent, setSent] = useState<WalletPaySent>(initial);
    setter.current = setSent;
    return <Sent sent={sent} />;
  }
  return {
    slot: <Live />,
    set: (sent) => {
      act(() => {
        setter.current(sent);
      });
    },
  };
}

/** Lets the pay step fade out, so the success step is on screen. */
function fadeToSuccess(): void {
  act(() => {
    vi.advanceTimersByTime(MOTION_SWAP_FADE_MS);
  });
}

function layer(): string | null {
  return (
    document.querySelector('[data-pay-sheet-layer]')?.getAttribute('data-pay-sheet-layer') ?? null
  );
}

function scrim(): HTMLElement {
  return screen.getAllByRole('button', { name: 'Close' })[0] as HTMLElement;
}

function closeButton(): HTMLElement {
  return screen.getAllByRole('button', { name: 'Close' })[1] as HTMLElement;
}

/** A control inside the sheet that leaves the payment, like the pay slot's Add Bitcoin. */
function Leave(): ReactElement {
  const close = usePaySheetClose();
  return (
    <button type="button" onClick={() => close?.()}>
      Leave
    </button>
  );
}

function Outside(): ReactElement {
  const close = usePaySheetClose();
  const report = usePaySheetSent();
  return <p>{close === null && report === null ? 'no sheet' : 'sheet'}</p>;
}

beforeEach(() => {
  vi.useFakeTimers({
    toFake: ['setTimeout', 'clearTimeout', 'requestAnimationFrame', 'cancelAnimationFrame'],
  });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('PaySheet', () => {
  it('holds the closed sheet for the success step and the slide away', () => {
    expect(PAY_SHEET_HOLD_MS).toBe(PAY_SHEET_SUCCESS_MS + MOTION_FOLD_MS);
  });

  it('shows the title, the amount with its fiat, the close, and the pay slot, and slides in', () => {
    renderWithLocale(sheet(true, vi.fn()));
    const dialog = screen.getByRole('dialog', { name: 'Send to Ana' });
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(dialog.getAttribute('data-pay-sheet')).toBe('pay');
    expect(document.activeElement).toBe(dialog);
    expect(screen.getByRole('heading', { name: 'Send to Ana' })).not.toBeNull();
    expect(screen.getByText('₿500')).not.toBeNull();
    expect(screen.getByText('$0.50')).not.toBeNull();
    expect(screen.getByText('Pay slot')).not.toBeNull();
    expect(layer()).toBe('closed');
    act(() => {
      vi.advanceTimersToNextFrame();
    });
    expect(layer()).toBe('open');
    expect(dialog.className).toContain('translate-y-0');
  });

  it('shows no fiat line while there is no rate', () => {
    renderWithLocale(sheet(true, vi.fn(), null));
    expect(screen.getByText('₿500')).not.toBeNull();
    expect(screen.queryByText('$0.50')).toBeNull();
  });

  it('shows the current spot when the stored figure is absent', () => {
    renderWithLocale(
      sheet(true, vi.fn(), RATE_DAY, <Sent />, {
        amountCurrency: null,
        amount: null,
        amountUsd: null,
        amountChf: null,
        amountEur: null,
        amountPhp: null,
      }),
    );
    expect(screen.getByText('₿500')).not.toBeNull();
    expect(screen.getByText('$0.50')).not.toBeNull();
    expect(screen.queryByText('₱12.00')).toBeNull();
  });

  it('shows the stored PHP amount instead of the spot', () => {
    renderWithLocale(
      sheet(true, vi.fn(), RATE_DAY, <Sent />, {
        amountCurrency: 'PHP',
        amount: '12.00',
        amountUsd: '1.00',
        amountChf: null,
        amountEur: null,
        amountPhp: null,
      }),
    );
    expect(screen.getByText('₿500')).not.toBeNull();
    expect(screen.getByText('₱12.00')).not.toBeNull();
    expect(screen.queryByText('$0.50')).toBeNull();
    expect(screen.queryByText('$1.00')).toBeNull();
  });

  it('shows an empty stored PHP amount as ₱0.00 instead of the spot', () => {
    renderWithLocale(
      sheet(true, vi.fn(), RATE_DAY, <Sent />, {
        amountCurrency: 'PHP',
        amount: '',
        amountUsd: '1.00',
        amountChf: null,
        amountEur: null,
        amountPhp: null,
      }),
    );
    expect(screen.getByText('₿500')).not.toBeNull();
    expect(screen.getByText('₱0.00')).not.toBeNull();
    expect(screen.queryByText('$0.50')).toBeNull();
    expect(screen.queryByText('$1.00')).toBeNull();
  });

  it('closes once on Close and slides away without a success step', () => {
    const onClose = vi.fn();
    const view = renderWithLocale(sheet(true, onClose));
    act(() => {
      vi.advanceTimersToNextFrame();
    });
    fireEvent.click(closeButton());
    fireEvent.click(closeButton());
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(layer()).toBe('closed');
    view.rerender(sheet(false, onClose));
    fadeToSuccess();
    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.getByRole('dialog').getAttribute('data-pay-sheet')).toBe('pay');
    act(() => {
      vi.advanceTimersByTime(PAY_SHEET_HOLD_MS);
    });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('slides up again for a new payment while the host still holds the closed one', () => {
    const onClose = vi.fn();
    const view = renderWithLocale(sheet(true, onClose));
    act(() => {
      vi.advanceTimersToNextFrame();
    });
    fireEvent.click(closeButton());
    view.rerender(sheet(false, onClose));
    expect(layer()).toBe('closed');
    // Within the hold: the same sheet is still mounted when the next payment opens.
    view.rerender(sheet(true, onClose));
    expect(layer()).toBe('closed');
    act(() => {
      vi.advanceTimersToNextFrame();
    });
    expect(layer()).toBe('open');
    expect(screen.getByRole('dialog').getAttribute('data-pay-sheet')).toBe('pay');
    expect(document.activeElement).toBe(screen.getByRole('dialog'));
    fireEvent.click(closeButton());
    expect(onClose).toHaveBeenCalledTimes(2);
    expect(layer()).toBe('closed');
  });

  it('starts a new payment over after a success step the host still holds', () => {
    const view = renderWithLocale(sheet(true, vi.fn()));
    act(() => {
      vi.advanceTimersToNextFrame();
    });
    view.rerender(sheet(false, vi.fn()));
    fadeToSuccess();
    expect(screen.getByRole('status')).not.toBeNull();
    view.rerender(sheet(true, vi.fn()));
    fadeToSuccess();
    act(() => {
      vi.advanceTimersToNextFrame();
    });
    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.getByText('Pay slot')).not.toBeNull();
    expect(layer()).toBe('open');
  });

  it('closes on a tap on the dimmed page', () => {
    const onClose = vi.fn();
    renderWithLocale(sheet(true, onClose));
    fireEvent.click(scrim());
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes on Escape from the first frame, before the page runs its effects', () => {
    const onClose = vi.fn();
    /** Presses Escape in a layout effect: after the sheet's own layout effects, before any effect. */
    function EscapeOnFirstFrame(): null {
      useLayoutEffect(() => {
        fireEvent.keyDown(window, { key: 'Escape' });
      }, []);
      return null;
    }
    renderWithLocale(
      <>
        {sheet(true, onClose)}
        <EscapeOnFirstFrame />
      </>,
    );
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes on Escape and ignores other keys', () => {
    const onClose = vi.fn();
    renderWithLocale(sheet(true, onClose));
    fireEvent.keyDown(window, { key: 'Enter' });
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('shows the success step when the payment closes the sheet, then slides away', () => {
    const onClose = vi.fn();
    const view = renderWithLocale(sheet(true, onClose));
    act(() => {
      vi.advanceTimersToNextFrame();
    });
    view.rerender(sheet(false, onClose));
    expect(screen.getByRole('dialog').getAttribute('data-pay-sheet')).toBe('success');
    fadeToSuccess();
    const status = screen.getByRole('status');
    expect(status.textContent).toContain('Sent to Ana');
    expect(status.textContent).toContain('₿500');
    expect(status.textContent).toContain('$0.50');
    expect(screen.getByRole('dialog').getAttribute('data-pay-sheet')).toBe('success');
    expect(screen.queryByText('Pay slot')).toBeNull();
    expect(screen.queryByRole('heading')).toBeNull();
    expect(layer()).toBe('open');
    act(() => {
      vi.advanceTimersByTime(PAY_SHEET_SUCCESS_MS - MOTION_SWAP_FADE_MS - 1);
    });
    expect(layer()).toBe('open');
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(layer()).toBe('closed');
    expect(onClose).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(MOTION_FOLD_MS);
    });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('takes the leaving sheet out of reach and gives focus back to what opened it', () => {
    const opener = document.createElement('button');
    document.body.append(opener);
    opener.focus();
    const view = renderWithLocale(sheet(true, vi.fn()));
    act(() => {
      vi.advanceTimersToNextFrame();
    });
    expect(document.activeElement).toBe(screen.getByRole('dialog'));
    expect(document.querySelector('[data-pay-sheet-layer]')?.hasAttribute('inert')).toBe(false);
    fireEvent.click(closeButton());
    expect(document.querySelector('[data-pay-sheet-layer]')?.hasAttribute('inert')).toBe(true);
    act(() => {
      vi.advanceTimersToNextFrame();
    });
    expect(document.activeElement).toBe(opener);
    view.unmount();
    opener.remove();
  });

  it('gives focus back after the success step once the host has freed its controls', () => {
    const opener = document.createElement('button');
    document.body.append(opener);
    opener.focus();
    function Host({ open }: { open: boolean }): ReactElement {
      const hold = usePaySheetHold(open ? 'pay-1' : null);
      opener.disabled = hold.held !== null;
      return (
        <Collapse show={open} holdMs={PAY_SHEET_HOLD_MS}>
          <PaySheet
            title="Send to Ana"
            amountSats={500}
            rateDay={RATE_DAY}
            successTitle="Sent to Ana"
            onClose={vi.fn()}
            onSentChange={(sent) => hold.sentChange('pay-1', sent)}
          >
            <Sent />
          </PaySheet>
        </Collapse>
      );
    }
    const view = renderWithLocale(<Host open />);
    act(() => {
      vi.advanceTimersToNextFrame();
    });
    view.rerender(<Host open={false} />);
    expect(opener.disabled).toBe(true);
    act(() => {
      vi.advanceTimersByTime(PAY_SHEET_SUCCESS_MS);
    });
    act(() => {
      vi.advanceTimersToNextFrame();
    });
    expect(opener.disabled).toBe(false);
    expect(document.activeElement).toBe(opener);
    view.unmount();
    opener.remove();
  });

  it('keeps focus where it is when what opened the sheet is gone', () => {
    const opener = document.createElement('button');
    document.body.append(opener);
    opener.focus();
    renderWithLocale(sheet(true, vi.fn()));
    opener.remove();
    fireEvent.click(closeButton());
    act(() => {
      vi.advanceTimersToNextFrame();
    });
    expect(document.activeElement).not.toBe(opener);
  });

  it('slides away without a success step when the host closes a payment that is not out', () => {
    const onClose = vi.fn();
    const slot = <Sent sent={null} />;
    const view = renderWithLocale(sheet(true, onClose, RATE_DAY, slot));
    act(() => {
      vi.advanceTimersToNextFrame();
    });
    expect(layer()).toBe('open');
    // A failed check or another thread closes the payment: no payment went out.
    view.rerender(sheet(false, onClose, RATE_DAY, slot));
    expect(layer()).toBe('closed');
    fadeToSuccess();
    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.getByRole('dialog').getAttribute('data-pay-sheet')).toBe('pay');
    expect(onClose).not.toHaveBeenCalled();
  });

  it('slides away without a success step when the host closes a paid payment whose purpose failed', () => {
    const onClose = vi.fn();
    const ui = (open: boolean, failed: boolean): ReactElement => (
      <PaySheetFailed failed={failed}>{sheet(open, onClose)}</PaySheetFailed>
    );
    const view = renderWithLocale(ui(true, false));
    act(() => {
      vi.advanceTimersToNextFrame();
    });
    expect(layer()).toBe('open');
    // The payment is out, but the post it paid for failed: the host closes it with the flag set.
    view.rerender(ui(false, true));
    expect(layer()).toBe('closed');
    fadeToSuccess();
    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.getByRole('dialog').getAttribute('data-pay-sheet')).toBe('pay');
    expect(onClose).not.toHaveBeenCalled();
  });

  it('keeps the pay step while a send is pending at the host close, then shows success once it went out', () => {
    const onClose = vi.fn();
    const live = liveSent('pending');
    const view = renderWithLocale(sheet(true, onClose, RATE_DAY, live.slot));
    act(() => {
      vi.advanceTimersToNextFrame();
    });
    view.rerender(sheet(false, onClose, RATE_DAY, live.slot));
    expect(layer()).toBe('open');
    expect(screen.getByRole('dialog').getAttribute('data-pay-sheet')).toBe('pay');
    expect(screen.getByText('Pay slot')).toBeTruthy();
    act(() => {
      vi.advanceTimersByTime(300);
    });
    live.set('paid');
    expect(screen.getByRole('dialog').getAttribute('data-pay-sheet')).toBe('success');
    fadeToSuccess();
    expect(screen.getByRole('status').textContent).toContain('Sent to Ana');
    // The step ends PAY_SHEET_SUCCESS_MS after the host's close, not after the late success.
    act(() => {
      vi.advanceTimersByTime(PAY_SHEET_SUCCESS_MS - 300 - MOTION_SWAP_FADE_MS);
    });
    expect(layer()).toBe('closed');
    expect(onClose).not.toHaveBeenCalled();
  });

  it('slides away without a success step when a send pending at the host close then fails', () => {
    const onClose = vi.fn();
    const live = liveSent('pending');
    const view = renderWithLocale(sheet(true, onClose, RATE_DAY, live.slot));
    act(() => {
      vi.advanceTimersToNextFrame();
    });
    view.rerender(sheet(false, onClose, RATE_DAY, live.slot));
    expect(layer()).toBe('open');
    live.set(null);
    expect(layer()).toBe('closed');
    fadeToSuccess();
    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.getByRole('dialog').getAttribute('data-pay-sheet')).toBe('pay');
    expect(onClose).not.toHaveBeenCalled();
  });

  it('slides away when a send pending at the host close never answers', () => {
    const onClose = vi.fn();
    const view = renderWithLocale(sheet(true, onClose, RATE_DAY, <Sent sent="pending" />));
    act(() => {
      vi.advanceTimersToNextFrame();
    });
    view.rerender(sheet(false, onClose, RATE_DAY, <Sent sent="pending" />));
    act(() => {
      vi.advanceTimersByTime(PAY_SHEET_SUCCESS_MS - 1);
    });
    expect(layer()).toBe('open');
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(layer()).toBe('closed');
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('lets a sheet waiting on a pending send go on Escape without cancelling the closed payment', () => {
    const onClose = vi.fn();
    const view = renderWithLocale(sheet(true, onClose, RATE_DAY, <Sent sent="pending" />));
    act(() => {
      vi.advanceTimersToNextFrame();
    });
    view.rerender(sheet(false, onClose, RATE_DAY, <Sent sent="pending" />));
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(layer()).toBe('closed');
    expect(onClose).not.toHaveBeenCalled();
  });

  describe('Tab inside the open sheet', () => {
    function slotWithButtons(): ReactElement {
      return (
        <>
          <Sent sent={null} />
          <button type="button">Middle</button>
          <button type="button" disabled>
            Off
          </button>
          <button type="button">Last</button>
        </>
      );
    }

    function tab(shiftKey = false): boolean {
      return fireEvent.keyDown(window, { key: 'Tab', shiftKey });
    }

    it('wraps Tab from the last control to the first and Shift+Tab back', () => {
      renderWithLocale(sheet(true, vi.fn(), RATE_DAY, slotWithButtons()));
      const last = screen.getByRole('button', { name: 'Last' });
      last.focus();
      expect(tab()).toBe(false);
      expect(document.activeElement).toBe(closeButton());
      expect(tab(true)).toBe(false);
      expect(document.activeElement).toBe(last);
    });

    it('lets Tab move on between controls inside the sheet', () => {
      renderWithLocale(sheet(true, vi.fn(), RATE_DAY, slotWithButtons()));
      screen.getByRole('button', { name: 'Middle' }).focus();
      expect(tab()).toBe(true);
      expect(tab(true)).toBe(true);
    });

    it('sends Shift+Tab from the panel itself to the last control', () => {
      renderWithLocale(sheet(true, vi.fn(), RATE_DAY, slotWithButtons()));
      expect(document.activeElement).toBe(screen.getByRole('dialog'));
      expect(tab(true)).toBe(false);
      expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Last' }));
    });

    it('brings focus from the page behind to the first control', () => {
      renderWithLocale(
        <>
          <button type="button">Behind</button>
          {sheet(true, vi.fn(), RATE_DAY, slotWithButtons())}
        </>,
      );
      screen.getByRole('button', { name: 'Behind' }).focus();
      expect(tab()).toBe(false);
      expect(document.activeElement).toBe(closeButton());
    });

    it('keeps focus on the panel when the success step has no control', () => {
      const onClose = vi.fn();
      const view = renderWithLocale(sheet(true, onClose));
      act(() => {
        vi.advanceTimersToNextFrame();
      });
      view.rerender(sheet(false, onClose));
      fadeToSuccess();
      expect(tab()).toBe(false);
      expect(document.activeElement).toBe(screen.getByRole('dialog'));
    });
  });

  it('lets the success step go at once on Escape', () => {
    const view = renderWithLocale(sheet(true, vi.fn()));
    act(() => {
      vi.advanceTimersToNextFrame();
    });
    view.rerender(sheet(false, vi.fn()));
    fadeToSuccess();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(layer()).toBe('closed');
  });

  it('lets the success step go at once on a tap on the dimmed page', () => {
    const onClose = vi.fn();
    const view = renderWithLocale(sheet(true, onClose));
    act(() => {
      vi.advanceTimersToNextFrame();
    });
    view.rerender(sheet(false, onClose));
    fadeToSuccess();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(layer()).toBe('closed');
    expect(onClose).not.toHaveBeenCalled();
  });

  it('gives controls inside the sheet its close, which counts as the member closing', () => {
    const onClose = vi.fn();
    const view = renderWithLocale(sheet(true, onClose, RATE_DAY, <Leave />));
    fireEvent.click(screen.getByRole('button', { name: 'Leave' }));
    expect(onClose).toHaveBeenCalledTimes(1);
    view.rerender(sheet(false, onClose, RATE_DAY, <Leave />));
    fadeToSuccess();
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('never shows the success step outside a fold that holds it', () => {
    renderWithLocale(
      <PaySheet title="Send" amountSats={500} rateDay={null} successTitle="Sent" onClose={vi.fn()}>
        <p>Pay slot</p>
      </PaySheet>,
    );
    expect(screen.getByRole('dialog').getAttribute('data-pay-sheet')).toBe('pay');
  });

  it('has no close outside a pay sheet', () => {
    renderWithLocale(<Outside />);
    expect(screen.getByText('no sheet')).not.toBeNull();
  });

  it('stops its frame and its success timer when it unmounts', () => {
    const view = renderWithLocale(sheet(true, vi.fn()));
    view.rerender(sheet(false, vi.fn()));
    const cancelFrame = vi.spyOn(globalThis, 'cancelAnimationFrame');
    const clearTimer = vi.spyOn(window, 'clearTimeout');
    view.unmount();
    expect(cancelFrame).toHaveBeenCalledTimes(1);
    expect(clearTimer).toHaveBeenCalled();
  });
});

describe('usePaySheetHold', () => {
  it('holds a payment that went out and closed without the member for the success step, then frees it', () => {
    const { result, rerender } = renderHook(({ key }) => usePaySheetHold(key), {
      initialProps: { key: 'pay-1' as string | null },
    });
    expect(result.current.held).toBeNull();
    act(() => {
      result.current.sentChange('pay-1', true);
    });
    rerender({ key: null });
    expect(result.current.held).toBe('pay-1');
    act(() => {
      vi.advanceTimersByTime(PAY_SHEET_SUCCESS_MS - 1);
    });
    expect(result.current.held).toBe('pay-1');
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current.held).toBeNull();
  });

  it('holds nothing after a close by the member', () => {
    const { result, rerender } = renderHook(({ key }) => usePaySheetHold(key), {
      initialProps: { key: 'pay-1' as string | null },
    });
    act(() => {
      result.current.sentChange('pay-1', true);
      result.current.closedByMember();
    });
    rerender({ key: null });
    expect(result.current.held).toBeNull();
  });

  it('holds nothing when the host closes a payment that is not out', () => {
    const { result, rerender } = renderHook(({ key }) => usePaySheetHold(key), {
      initialProps: { key: 'pay-1' as string | null },
    });
    // A failed check closes the payment while nothing went out from the wallet.
    rerender({ key: null });
    expect(result.current.held).toBeNull();
  });

  it('holds a payment pending at the close and frees it once that send does not go out', () => {
    const { result, rerender } = renderHook(({ key }) => usePaySheetHold(key), {
      initialProps: { key: 'pay-1' as string | null },
    });
    act(() => {
      result.current.sentChange('pay-1', true);
    });
    rerender({ key: null });
    expect(result.current.held).toBe('pay-1');
    act(() => {
      result.current.sentChange('pay-1', false);
    });
    expect(result.current.held).toBeNull();
  });

  it('counts a late report only for its own payment, never for the next one', () => {
    const { result, rerender } = renderHook(({ key }) => usePaySheetHold(key), {
      initialProps: { key: 'pay-a' as string | null },
    });
    // A closes with its send pending, so its controls are held.
    act(() => {
      result.current.sentChange('pay-a', true);
    });
    rerender({ key: null });
    expect(result.current.held).toBe('pay-a');
    // B opens and its send is on its way; then A's send fails late.
    rerender({ key: 'pay-b' });
    act(() => {
      result.current.sentChange('pay-b', true);
      result.current.sentChange('pay-a', false);
    });
    rerender({ key: null });
    expect(result.current.held).toBe('pay-b');
  });

  it('does not hold the next payment for a late report of the one before', () => {
    const { result, rerender } = renderHook(({ key }) => usePaySheetHold(key), {
      initialProps: { key: 'pay-a' as string | null },
    });
    rerender({ key: 'pay-b' });
    // A's sheet, still held, reports a late paid send; B sends nothing.
    act(() => {
      result.current.sentChange('pay-a', true);
    });
    rerender({ key: null });
    expect(result.current.held).toBeNull();
  });

  it('frees a held payment when the next one opens', () => {
    const { result, rerender } = renderHook(({ key }) => usePaySheetHold(key), {
      initialProps: { key: 'pay-1' as string | null },
    });
    act(() => {
      result.current.sentChange('pay-1', true);
    });
    rerender({ key: null });
    expect(result.current.held).toBe('pay-1');
    rerender({ key: 'pay-2' });
    expect(result.current.held).toBeNull();
  });
});
