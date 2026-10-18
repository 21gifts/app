import { act, cleanup, fireEvent, screen } from '@testing-library/react';
import type { ReactElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Collapse } from '@/components/Collapse';
import {
  PAY_SHEET_HOLD_MS,
  PAY_SHEET_SUCCESS_MS,
  PaySheet,
  usePaySheetClose,
} from '@/components/PaySheet';
import { MOTION_FOLD_MS, MOTION_SWAP_FADE_MS } from '@/lib/motion';
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
  slot: ReactElement = <p>Pay slot</p>,
): ReactElement {
  return (
    <Collapse show={open} holdMs={PAY_SHEET_HOLD_MS}>
      {open ? (
        <PaySheet
          title="Send to Ana"
          amountSats={500}
          rateDay={rateDay}
          successTitle="Sent to Ana"
          onClose={onClose}
        >
          {slot}
        </PaySheet>
      ) : null}
    </Collapse>
  );
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
  return <p>{usePaySheetClose() === null ? 'no sheet' : 'sheet'}</p>;
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
