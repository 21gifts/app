import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ReactElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Collapse } from '@/components/Collapse';
import { AddBitcoinButton, OpenReceiveProvider, useReceiveLink } from '@/components/OpenReceive';
import { PAY_SHEET_HOLD_MS, PaySheet } from '@/components/PaySheet';
import { renderWithLocale } from '@/__tests__/render-with-locale';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

/** A page that opens Receive when the address asks for it. */
function ReceivePage({ onOpen }: { onOpen: () => void }): ReactElement {
  useReceiveLink(onOpen);
  return <p>Wallet</p>;
}

beforeEach(() => {
  push.mockReset();
});

afterEach(() => {
  cleanup();
  window.history.replaceState(null, '', '/');
});

describe('AddBitcoinButton', () => {
  it('opens the page’s own Receive view under a provider, and closes the pay sheet first', () => {
    const order: string[] = [];
    renderWithLocale(
      <OpenReceiveProvider onOpen={() => order.push('receive')}>
        <Collapse show holdMs={PAY_SHEET_HOLD_MS}>
          <PaySheet
            title="Send to Ana"
            amountSats={500}
            rateDay={null}
            successTitle="Sent to Ana"
            onClose={() => order.push('close')}
          >
            <AddBitcoinButton />
          </PaySheet>
        </Collapse>
      </OpenReceiveProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Add Bitcoin' }));
    expect(order).toEqual(['close', 'receive']);
    expect(push).not.toHaveBeenCalled();
  });

  it('goes to the wallet with Receive open without a provider or outside a sheet', () => {
    renderWithLocale(<AddBitcoinButton />);
    fireEvent.click(screen.getByRole('button', { name: 'Add Bitcoin' }));
    expect(push).toHaveBeenCalledWith('/wallet?receive=1');
  });

  it('goes to the wallet when the page has no Receive view right now', () => {
    renderWithLocale(
      <OpenReceiveProvider onOpen={null}>
        <AddBitcoinButton />
      </OpenReceiveProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Add Bitcoin' }));
    expect(push).toHaveBeenCalledWith('/wallet?receive=1');
  });
});

describe('useReceiveLink', () => {
  it('opens Receive once and removes receive from the address, keeping the rest', () => {
    window.history.replaceState({ keep: 1 }, '', '/wallet?receive=1&x=2#top');
    const onOpen = vi.fn();
    render(<ReceivePage onOpen={onOpen} />);
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(`${window.location.pathname}${window.location.search}${window.location.hash}`).toBe(
      '/wallet?x=2#top',
    );
    expect(window.history.state).toEqual({ keep: 1 });
  });

  it('leaves an address with nothing else clean', () => {
    window.history.replaceState(null, '', '/wallet?receive=1');
    const onOpen = vi.fn();
    render(<ReceivePage onOpen={onOpen} />);
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(`${window.location.pathname}${window.location.search}`).toBe('/wallet');
  });

  it('does nothing without receive=1', () => {
    window.history.replaceState(null, '', '/wallet?receive=0');
    const onOpen = vi.fn();
    render(<ReceivePage onOpen={onOpen} />);
    expect(onOpen).not.toHaveBeenCalled();
    expect(window.location.search).toBe('?receive=0');
  });
});
