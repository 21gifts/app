import { cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SEND_LINK_PARAM, useSendLink } from '@/hooks/useSendLink';
import type { UseWalletSendResult } from '@/hooks/useWalletSend';

/**
 * Minimal send flow: only `sendTo` is read by the hook.
 *
 * @param sendTo - The spy for `sendTo`.
 * @returns A send flow with that spy.
 */
function sendWith(sendTo: (value: string) => void): UseWalletSendResult {
  return { sendTo } as unknown as UseWalletSendResult;
}

afterEach(() => {
  cleanup();
  window.history.replaceState(null, '', '/');
});

describe('useSendLink', () => {
  it('uses `send` as the query parameter', () => {
    expect(SEND_LINK_PARAM).toBe('send');
  });

  it('opens Send, reads the member address at once, and removes only `send`', () => {
    window.history.replaceState(null, '', '/wallet?send=tondo-fond&tab=1#top');
    const openSend = vi.fn();
    const sendTo = vi.fn();
    renderHook(() => {
      useSendLink(openSend, sendWith(sendTo));
    });
    expect(openSend).toHaveBeenCalledTimes(1);
    // jsdom runs on localhost, which addresses name as 21.gifts.
    expect(sendTo).toHaveBeenCalledWith('tondo-fond@21.gifts');
    const { pathname, search, hash } = window.location;
    expect(`${pathname}${search}${hash}`).toBe('/wallet?tab=1#top');
  });

  it('lower-cases the handle and leaves a bare path when nothing else was in the query', () => {
    window.history.replaceState(null, '', '/wallet?send=Tondo-Fond');
    const sendTo = vi.fn();
    renderHook(() => {
      useSendLink(vi.fn(), sendWith(sendTo));
    });
    expect(sendTo).toHaveBeenCalledWith('tondo-fond@21.gifts');
    expect(`${window.location.pathname}${window.location.search}`).toBe('/wallet');
  });

  it('runs once: a later render of the same entry opens nothing again', () => {
    window.history.replaceState(null, '', '/wallet?send=tondo-fond');
    const openSend = vi.fn();
    const sendTo = vi.fn();
    const { rerender } = renderHook(() => {
      useSendLink(openSend, sendWith(sendTo));
    });
    rerender();
    expect(openSend).toHaveBeenCalledTimes(1);
    expect(sendTo).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['a full address', 'bob@example.com'],
    ['a payment request', 'lnbc1example'],
    ['an empty value', ''],
  ])('removes and ignores %s', (_label, value) => {
    window.history.replaceState(
      null,
      '',
      `/wallet?${SEND_LINK_PARAM}=${encodeURIComponent(value)}`,
    );
    const openSend = vi.fn();
    const sendTo = vi.fn();
    renderHook(() => {
      useSendLink(openSend, sendWith(sendTo));
    });
    expect(openSend).not.toHaveBeenCalled();
    expect(sendTo).not.toHaveBeenCalled();
    expect(window.location.search).toBe('');
  });

  it('does nothing without the parameter', () => {
    window.history.replaceState(null, '', '/wallet?receive=1');
    const openSend = vi.fn();
    const sendTo = vi.fn();
    renderHook(() => {
      useSendLink(openSend, sendWith(sendTo));
    });
    expect(openSend).not.toHaveBeenCalled();
    expect(sendTo).not.toHaveBeenCalled();
    expect(window.location.search).toBe('?receive=1');
  });

  it('leaves the parameter for later on a page without a send flow', () => {
    window.history.replaceState(null, '', '/wallet?send=tondo-fond');
    const openSend = vi.fn();
    renderHook(() => {
      useSendLink(openSend, undefined);
    });
    expect(openSend).not.toHaveBeenCalled();
    expect(window.location.search).toBe('?send=tondo-fond');
  });
});
