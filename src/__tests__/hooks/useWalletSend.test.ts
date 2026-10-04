import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WALLET_SEND_VISUAL_FIXTURE, useWalletSend, walletSendBounds } from '@/hooks/useWalletSend';
import { LnurlRelayError, postLnurlInvoice, postLnurlPayRequest } from '@/lib/api';
import type { LnurlPayRequest } from '@/lib/api-types';
import { encodeLnurl } from '@/lib/lnurl';
import type { WalletTarget } from '@/lib/wallet/wallet-sdk';
import {
  parseWalletInput,
  payFromWallet,
  type WalletPayResult,
  type WalletSendResult,
} from '@/lib/wallet/wallet-service';
import { setWalletUsable } from '@/__tests__/wallet-pay-fixture';
import { useAuthStore } from '@/stores/auth-store';
import { useWalletStore } from '@/stores/wallet-store';

vi.mock('@/lib/wallet/wallet-service', () => ({
  parseWalletInput: vi.fn(),
  payFromWallet: vi.fn(),
}));

vi.mock('@/lib/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api')>()),
  postLnurlPayRequest: vi.fn(),
  postLnurlInvoice: vi.fn(),
}));

const ORIGINAL_E2E_NOW = process.env.NEXT_PUBLIC_E2E_NOW;
const ORIGINAL_BREEZ_KEY = process.env.NEXT_PUBLIC_BREEZ_API_KEY;

const LNURL: WalletTarget = {
  type: 'lnurl',
  request: { details: { callback: 'x' } },
  minSats: 10,
  maxSats: 1_000,
  commentMaxLength: 5,
  recipient: 'bob@pay.example',
};

function target(value: WalletTarget): void {
  vi.mocked(parseWalletInput).mockResolvedValue({ kind: 'target', target: value });
}

function confirmWith(send: () => Promise<WalletSendResult>): WalletPayResult {
  return { kind: 'confirm', amountSats: 2_100, feeSats: 1, send };
}

async function typeAndSubmit(
  result: { current: ReturnType<typeof useWalletSend> },
  text: string,
): Promise<void> {
  act(() => {
    result.current.setText(text);
  });
  await act(async () => {
    result.current.submitInput();
  });
}

beforeEach(() => {
  useAuthStore.setState({ session: null, account: null });
  setWalletUsable();
  window.history.replaceState({}, '', '/wallet');
  delete process.env.NEXT_PUBLIC_E2E_NOW;
  vi.mocked(parseWalletInput).mockReset();
  vi.mocked(payFromWallet).mockReset();
  vi.mocked(postLnurlPayRequest).mockReset();
  vi.mocked(postLnurlInvoice).mockReset();
  useAuthStore.setState({ session: 'sess' });
});

afterEach(() => {
  cleanup();
  if (ORIGINAL_E2E_NOW === undefined) {
    delete process.env.NEXT_PUBLIC_E2E_NOW;
  } else {
    process.env.NEXT_PUBLIC_E2E_NOW = ORIGINAL_E2E_NOW;
  }
  if (ORIGINAL_BREEZ_KEY === undefined) {
    delete process.env.NEXT_PUBLIC_BREEZ_API_KEY;
  } else {
    process.env.NEXT_PUBLIC_BREEZ_API_KEY = ORIGINAL_BREEZ_KEY;
  }
});

describe('walletSendBounds', () => {
  it('uses the receiver bounds for an LNURL and 1 sat upward otherwise', () => {
    expect(walletSendBounds(LNURL as Extract<WalletTarget, { type: 'lnurl' }>)).toEqual({
      min: 10,
      max: 1_000,
    });
    expect(
      walletSendBounds({ type: 'request', input: 'sp1', amountSats: null, recipient: 'sp1' }),
    ).toEqual({ min: 1, max: Number.MAX_SAFE_INTEGER });
  });
});

describe('walletSendBounds relay', () => {
  it('uses the receiver bounds for an outside address', () => {
    expect(
      walletSendBounds({
        type: 'relay',
        target: 'bob@example.com',
        minSats: 2,
        maxSats: 9,
        commentMaxLength: 0,
        recipient: 'bob@example.com',
      }),
    ).toEqual({ min: 2, max: 9 });
  });
});

describe('useWalletSend input', () => {
  it('starts on the input step', () => {
    const { result } = renderHook(() => useWalletSend());
    expect(result.current.state).toEqual({ step: 'input', error: null });
    expect(result.current.busy).toBe(false);
    expect(result.current.cancel()).toBe(false);
  });

  it('prepares a request with an amount and confirms with amount, fee, and recipient', async () => {
    target({ type: 'request', input: 'lnbc1', amountSats: 21, recipient: 'Coffee' });
    vi.mocked(payFromWallet).mockResolvedValue(confirmWith(async () => ({ kind: 'paid' })));
    const { result } = renderHook(() => useWalletSend());
    await typeAndSubmit(result, ' lnbc1 ');
    expect(parseWalletInput).toHaveBeenCalledWith(' lnbc1 ');
    expect(payFromWallet).toHaveBeenCalledWith({ type: 'input', input: 'lnbc1' });
    expect(result.current.state).toEqual({
      step: 'confirm',
      recipient: 'Coffee',
      amountSats: 2_100,
      feeSats: 1,
    });
  });

  it('passes an amount taken from a BIP21 URI to prepare', async () => {
    target({
      type: 'request',
      input: 'sp1',
      amountSats: 2_100,
      recipient: 'sp1',
      amountFromUri: true,
    });
    vi.mocked(payFromWallet).mockResolvedValue(confirmWith(async () => ({ kind: 'paid' })));
    const { result } = renderHook(() => useWalletSend());
    await typeAndSubmit(result, 'bitcoin:?sp=sp1&amount=0.000021');
    expect(payFromWallet).toHaveBeenCalledWith({ type: 'input', input: 'sp1', amountSats: 2_100 });
    expect(result.current.state.step).toBe('confirm');
  });

  it.each([
    [{ kind: 'unreachable' } as const, 'unreachable'],
    [{ kind: 'invalid' } as const, 'invalid'],
    [{ kind: 'unlock' } as const, 'failed'],
  ])('shows an alert for %o', async (parsed, error) => {
    vi.mocked(parseWalletInput).mockResolvedValue(parsed);
    const { result } = renderHook(() => useWalletSend());
    await typeAndSubmit(result, 'x');
    expect(result.current.state).toEqual({ step: 'input', error });
    act(() => {
      result.current.setText('y');
    });
    expect(result.current.state).toEqual({ step: 'input', error: null });
  });

  it('says a base-chain address is not supported yet, and so for other inputs', async () => {
    target({ type: 'onchain' });
    const { result } = renderHook(() => useWalletSend());
    await typeAndSubmit(result, 'bc1q');
    expect(result.current.state).toEqual({ step: 'input', error: 'onchain' });
    target({ type: 'unsupported' });
    await typeAndSubmit(result, 'lnurlw');
    expect(result.current.state).toEqual({ step: 'input', error: 'unsupported' });
    expect(payFromWallet).not.toHaveBeenCalled();
  });

  it('keeps the state when text changes without an alert', () => {
    const { result } = renderHook(() => useWalletSend());
    const before = result.current.state;
    act(() => {
      result.current.setText('abc');
    });
    expect(result.current.state).toBe(before);
    expect(result.current.text).toBe('abc');
  });

  it('maps a prepare failure and insufficient balance to input alerts', async () => {
    target({ type: 'request', input: 'lnbc1', amountSats: 21, recipient: 'r' });
    vi.mocked(payFromWallet).mockResolvedValueOnce({ kind: 'failed' });
    const { result } = renderHook(() => useWalletSend());
    await typeAndSubmit(result, 'lnbc1');
    expect(result.current.state).toEqual({ step: 'input', error: 'failed' });
    vi.mocked(payFromWallet).mockResolvedValueOnce({ kind: 'insufficient' });
    await typeAndSubmit(result, 'lnbc1');
    expect(result.current.state).toEqual({ step: 'input', error: 'insufficient' });
  });

  it('ignores a second submit while reading', async () => {
    vi.mocked(parseWalletInput).mockReturnValue(new Promise(() => undefined));
    const { result } = renderHook(() => useWalletSend());
    act(() => {
      result.current.setText('x');
    });
    act(() => {
      result.current.submitInput();
    });
    expect(result.current.busy).toBe(true);
    act(() => {
      result.current.submitInput();
    });
    expect(parseWalletInput).toHaveBeenCalledTimes(1);
  });
});

describe('useWalletSend amount', () => {
  it('asks an LNURL receiver for an amount within bounds and a trimmed, capped comment', async () => {
    target(LNURL);
    vi.mocked(payFromWallet).mockResolvedValue(confirmWith(async () => ({ kind: 'paid' })));
    const { result } = renderHook(() => useWalletSend());
    await typeAndSubmit(result, 'bob@21.gifts');
    expect(result.current.state).toMatchObject({ step: 'amount', amountError: false });
    act(() => {
      result.current.submitAmount(5);
    });
    expect(result.current.state).toMatchObject({ step: 'amount', amountError: true });
    act(() => {
      result.current.submitAmount(null);
    });
    expect(result.current.state).toMatchObject({ amountError: true });
    act(() => {
      result.current.submitAmount(2_000);
    });
    expect(payFromWallet).not.toHaveBeenCalled();
    act(() => {
      result.current.setComment('  Thanks a lot ');
    });
    await act(async () => {
      result.current.submitAmount(100);
    });
    expect(payFromWallet).toHaveBeenCalledWith({
      type: 'lnurl',
      request: LNURL.type === 'lnurl' ? LNURL.request : null,
      amountSats: 100,
      comment: 'Thank',
    });
    expect(result.current.state).toMatchObject({ step: 'confirm', recipient: 'bob@pay.example' });
  });

  it('sends no comment when it is blank', async () => {
    target(LNURL);
    vi.mocked(payFromWallet).mockResolvedValue({ kind: 'failed' });
    const { result } = renderHook(() => useWalletSend());
    await typeAndSubmit(result, 'bob@21.gifts');
    await act(async () => {
      result.current.submitAmount(100);
    });
    expect(payFromWallet).toHaveBeenCalledWith({
      type: 'lnurl',
      request: LNURL.type === 'lnurl' ? LNURL.request : null,
      amountSats: 100,
    });
  });

  it('asks for an amount for a request without one (and for a zero amount)', async () => {
    target({ type: 'request', input: 'sp1', amountSats: null, recipient: 'sp1' });
    vi.mocked(payFromWallet).mockResolvedValue(confirmWith(async () => ({ kind: 'paid' })));
    const { result } = renderHook(() => useWalletSend());
    await typeAndSubmit(result, 'sp1');
    expect(result.current.state).toMatchObject({ step: 'amount' });
    await act(async () => {
      result.current.submitAmount(500);
    });
    expect(payFromWallet).toHaveBeenCalledWith({ type: 'input', input: 'sp1', amountSats: 500 });
    act(() => {
      result.current.cancel();
    });
    target({ type: 'request', input: 'lnbc0', amountSats: 0, recipient: 'r' });
    await typeAndSubmit(result, 'lnbc0');
    expect(result.current.state).toMatchObject({ step: 'amount' });
  });

  it('ignores an amount outside the amount step', () => {
    const { result } = renderHook(() => useWalletSend());
    act(() => {
      result.current.submitAmount(100);
    });
    expect(payFromWallet).not.toHaveBeenCalled();
  });

  it('cancel returns to input and drops a late prepare result', async () => {
    target(LNURL);
    let finish: (value: WalletPayResult) => void = () => undefined;
    vi.mocked(payFromWallet).mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const { result } = renderHook(() => useWalletSend());
    await typeAndSubmit(result, 'bob@21.gifts');
    act(() => {
      result.current.submitAmount(100);
    });
    let closed = false;
    act(() => {
      closed = result.current.cancel();
    });
    expect(closed).toBe(true);
    expect(result.current.state).toEqual({ step: 'input', error: null });
    await act(async () => {
      finish(confirmWith(async () => ({ kind: 'paid' })));
    });
    expect(result.current.state).toEqual({ step: 'input', error: null });
  });

  it('drops a late parse result after unmount', async () => {
    let finish: (value: Awaited<ReturnType<typeof parseWalletInput>>) => void = () => undefined;
    vi.mocked(parseWalletInput).mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const { result, unmount } = renderHook(() => useWalletSend());
    act(() => {
      result.current.setText('x');
    });
    act(() => {
      result.current.submitInput();
    });
    unmount();
    await act(async () => {
      finish({ kind: 'invalid' });
    });
    expect(result.current.state).toEqual({ step: 'input', error: null });
  });
});

describe('useWalletSend confirm', () => {
  async function toConfirm(send: () => Promise<WalletSendResult>): Promise<{
    current: ReturnType<typeof useWalletSend>;
  }> {
    target({ type: 'request', input: 'lnbc1', amountSats: 21, recipient: 'r' });
    vi.mocked(payFromWallet).mockResolvedValue(confirmWith(send));
    const { result } = renderHook(() => useWalletSend());
    await typeAndSubmit(result, 'lnbc1');
    return result;
  }

  it('sends once and shows sent, then Done returns to an empty input', async () => {
    const send = vi.fn(async (): Promise<WalletSendResult> => ({ kind: 'paid' }));
    const result = await toConfirm(send);
    await act(async () => {
      result.current.confirm();
    });
    expect(result.current.state).toEqual({ step: 'sent', amountSats: 2_100 });
    expect(result.current.text).toBe('');
    act(() => {
      result.current.confirm();
    });
    expect(send).toHaveBeenCalledTimes(1);
    act(() => {
      result.current.cancel();
    });
    expect(result.current.state).toEqual({ step: 'input', error: null });
  });

  it('maps a failed or insufficient send to input alerts without retrying', async () => {
    const failed = await toConfirm(async () => ({ kind: 'failed' }));
    await act(async () => {
      failed.current.confirm();
    });
    expect(failed.current.state).toEqual({ step: 'input', error: 'failed' });
    cleanup();
    const low = await toConfirm(async () => ({ kind: 'insufficient' }));
    await act(async () => {
      low.current.confirm();
    });
    expect(low.current.state).toEqual({ step: 'input', error: 'insufficient' });
  });

  it('keeps the confirm step while sending, even when back is pressed', async () => {
    let finish: (value: WalletSendResult) => void = () => undefined;
    const result = await toConfirm(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    act(() => {
      result.current.confirm();
    });
    let closed = false;
    act(() => {
      closed = result.current.cancel();
    });
    expect(closed).toBe(true);
    expect(result.current.state).toMatchObject({ step: 'confirm' });
    await act(async () => {
      finish({ kind: 'paid' });
    });
    expect(result.current.state).toMatchObject({ step: 'sent' });
  });

  it('drops a send result after the wallet screen moved on', async () => {
    let finish: (value: WalletSendResult) => void = () => undefined;
    const result = await toConfirm(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    act(() => {
      result.current.confirm();
    });
    cleanup();
    await act(async () => {
      finish({ kind: 'paid' });
    });
    expect(result.current.state).toMatchObject({ step: 'confirm' });
  });
});

describe('useWalletSend visual pins', () => {
  const fixture = WALLET_SEND_VISUAL_FIXTURE;
  it.each([
    ['send-input', { step: 'input', error: null }],
    ['send-amount', { step: 'amount', amountError: false }],
    [
      'send-confirm',
      {
        step: 'confirm',
        recipient: fixture.recipient,
        amountSats: fixture.amountSats,
        feeSats: fixture.feeSats,
      },
    ],
    [
      'send-confirm-fixed',
      {
        step: 'confirm',
        recipient: 'shop@21.gifts',
        amountSats: fixture.fixedAmountSats,
        feeSats: fixture.feeSats,
      },
    ],
    ['send-sent', { step: 'sent', amountSats: fixture.amountSats }],
    ['send-onchain', { step: 'input', error: 'onchain' }],
    ['send-unsupported', { step: 'input', error: 'unsupported' }],
    ['send-invalid', { step: 'input', error: 'invalid' }],
    ['send-failed', { step: 'input', error: 'failed' }],
    ['send-alert-locked', { step: 'input', error: 'failed' }],
    ['send-insufficient', { step: 'input', error: 'insufficient' }],
    ['send-error', { step: 'input', error: 'unreachable' }],
    ['send-amount-error', { step: 'amount', amountError: true, target: { type: 'lnurl' } }],
    [
      'send-amount-request',
      { step: 'amount', amountError: false, target: { type: 'request', amountSats: null } },
    ],
    ['send-amount-min', { step: 'amount', amountError: true, target: { type: 'request' } }],
    [
      'send-amount-no-comment',
      { step: 'amount', amountError: false, target: { type: 'lnurl', commentMaxLength: 0 } },
    ],
    ['send-not-payable', { step: 'input', error: 'notPayable' }],
    ['send-not-found', { step: 'input', error: 'notFound' }],
    ['send-relay-unreachable', { step: 'input', error: 'relayUnreachable' }],
    [
      'send-comment-long',
      {
        step: 'amount',
        target: { type: 'relay', recipient: fixture.recipient },
        amountError: false,
        commentError: true,
      },
    ],
  ])('pins %s in a Playwright build and keeps actions inert', (visual, state) => {
    process.env.NEXT_PUBLIC_E2E_NOW = '2026-01-07T12:00:00.000Z';
    window.history.replaceState({}, '', `/wallet?visual=${visual}`);
    const { result } = renderHook(() => useWalletSend());
    expect(result.current.state).toMatchObject(state);
    expect(result.current.busy).toBe(false);
    act(() => {
      result.current.submitInput();
      result.current.submitAmount(1);
      result.current.confirm();
    });
    expect(result.current.cancel()).toBe(false);
    expect(parseWalletInput).not.toHaveBeenCalled();
    expect(payFromWallet).not.toHaveBeenCalled();
    expect(postLnurlInvoice).not.toHaveBeenCalled();
  });

  it('pins send-confirm-sending as a confirm step with a send in flight', () => {
    process.env.NEXT_PUBLIC_E2E_NOW = '2026-01-07T12:00:00.000Z';
    window.history.replaceState({}, '', '/wallet?visual=send-confirm-sending');
    const { result } = renderHook(() => useWalletSend());
    expect(result.current.state.step).toBe('confirm');
    expect(result.current.busy).toBe(true);
    act(() => {
      result.current.confirm();
    });
    expect(payFromWallet).not.toHaveBeenCalled();
  });

  it('pins send-input-busy and send-amount-busy, whose Continue only marks the step busy', () => {
    process.env.NEXT_PUBLIC_E2E_NOW = '2026-01-07T12:00:00.000Z';
    window.history.replaceState({}, '', '/wallet?visual=send-input-busy');
    const input = renderHook(() => useWalletSend()).result;
    expect(input.current.state).toEqual({ step: 'input', error: null });
    expect(input.current.busy).toBe(false);
    act(() => {
      input.current.submitAmount(21);
    });
    expect(input.current.busy).toBe(false);
    act(() => {
      input.current.submitInput();
    });
    expect(input.current.busy).toBe(true);
    window.history.replaceState({}, '', '/wallet?visual=send-amount-busy');
    const amount = renderHook(() => useWalletSend()).result;
    expect(amount.current.state.step).toBe('amount');
    act(() => {
      amount.current.submitInput();
    });
    expect(amount.current.busy).toBe(false);
    act(() => {
      amount.current.submitAmount(21);
    });
    expect(amount.current.busy).toBe(true);
    expect(parseWalletInput).not.toHaveBeenCalled();
    expect(payFromWallet).not.toHaveBeenCalled();
  });

  it.each(['balance-ready', 'history-rows'])(
    'keeps the send actions inert under the %s pin',
    (visual) => {
      process.env.NEXT_PUBLIC_E2E_NOW = '2026-01-07T12:00:00.000Z';
      window.history.replaceState({}, '', `/wallet?visual=${visual}`);
      const { result } = renderHook(() => useWalletSend());
      expect(result.current.state).toEqual({ step: 'input', error: null });
      act(() => {
        result.current.setText('bob@example.com');
      });
      act(() => {
        result.current.submitInput();
        result.current.submitAmount(21);
        result.current.confirm();
      });
      expect(result.current.busy).toBe(false);
      expect(result.current.cancel()).toBe(false);
      expect(parseWalletInput).not.toHaveBeenCalled();
      expect(payFromWallet).not.toHaveBeenCalled();
      expect(postLnurlPayRequest).not.toHaveBeenCalled();
    },
  );

  it('ignores pins outside a Playwright build and unknown values', () => {
    window.history.replaceState({}, '', '/wallet?visual=send-confirm');
    expect(renderHook(() => useWalletSend()).result.current.state.step).toBe('input');
    process.env.NEXT_PUBLIC_E2E_NOW = '2026-01-07T12:00:00.000Z';
    window.history.replaceState({}, '', '/wallet?visual=balance-ready');
    expect(renderHook(() => useWalletSend()).result.current.state.step).toBe('input');
  });
});

describe('useWalletSend wallet status', () => {
  function setStatus(status: 'ready' | 'locked' | 'error'): void {
    act(() => {
      useWalletStore.setState({ status });
    });
  }

  it('returns an open amount step to the input when the wallet leaves ready', async () => {
    target(LNURL);
    const { result } = renderHook(() => useWalletSend());
    await typeAndSubmit(result, 'bob@21.gifts');
    expect(result.current.state.step).toBe('amount');
    setStatus('locked');
    expect(result.current.state).toEqual({ step: 'input', error: null });
  });

  it('returns an idle confirm step to the input when the wallet leaves ready', async () => {
    target({ type: 'request', input: 'lnbc1', amountSats: 21, recipient: 'r' });
    vi.mocked(payFromWallet).mockResolvedValue(confirmWith(async () => ({ kind: 'paid' })));
    const { result } = renderHook(() => useWalletSend());
    await typeAndSubmit(result, 'lnbc1');
    expect(result.current.state.step).toBe('confirm');
    setStatus('locked');
    expect(result.current.state).toEqual({ step: 'input', error: null });
    act(() => {
      result.current.confirm();
    });
    expect(result.current.busy).toBe(false);
  });

  it('drops a prepare in flight on the amount step when the wallet leaves ready', async () => {
    target(LNURL);
    let finish: (value: WalletPayResult) => void = () => undefined;
    vi.mocked(payFromWallet).mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const { result } = renderHook(() => useWalletSend());
    await typeAndSubmit(result, 'bob@21.gifts');
    act(() => {
      result.current.submitAmount(100);
    });
    expect(result.current.busy).toBe(true);
    setStatus('locked');
    expect(result.current.busy).toBe(false);
    expect(result.current.state).toEqual({ step: 'input', error: null });
    await act(async () => {
      finish(confirmWith(async () => ({ kind: 'paid' })));
    });
    expect(result.current.state).toEqual({ step: 'input', error: null });
  });

  it('drops a read in flight when the wallet leaves ready', async () => {
    let finish: (value: Awaited<ReturnType<typeof parseWalletInput>>) => void = () => undefined;
    vi.mocked(parseWalletInput).mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const { result } = renderHook(() => useWalletSend());
    act(() => {
      result.current.setText('x');
    });
    act(() => {
      result.current.submitInput();
    });
    setStatus('error');
    expect(result.current.busy).toBe(false);
    await act(async () => {
      finish({ kind: 'invalid' });
    });
    expect(result.current.state).toEqual({ step: 'input', error: null });
  });

  it('drops a read or prepare that settles after the wallet left ready but before the reset ran', async () => {
    const lockedView = (): void => {
      const state = useWalletStore.getState();
      vi.spyOn(useWalletStore, 'getState').mockReturnValue({ ...state, status: 'locked' });
    };
    let finishRead: (value: Awaited<ReturnType<typeof parseWalletInput>>) => void = () => undefined;
    vi.mocked(parseWalletInput).mockReturnValue(
      new Promise((resolve) => {
        finishRead = resolve;
      }),
    );
    const { result } = renderHook(() => useWalletSend());
    act(() => {
      result.current.setText('x');
    });
    act(() => {
      result.current.submitInput();
    });
    lockedView();
    await act(async () => {
      finishRead({ kind: 'invalid' });
    });
    vi.mocked(useWalletStore.getState).mockRestore();
    expect(result.current.state).toEqual({ step: 'input', error: null });
    setStatus('locked');
    expect(result.current.busy).toBe(false);

    setStatus('ready');
    target(LNURL);
    let finishPrepare: (value: WalletPayResult) => void = () => undefined;
    vi.mocked(payFromWallet).mockReturnValue(
      new Promise((resolve) => {
        finishPrepare = resolve;
      }),
    );
    await typeAndSubmit(result, 'bob@21.gifts');
    act(() => {
      result.current.submitAmount(100);
    });
    lockedView();
    await act(async () => {
      finishPrepare({ kind: 'failed' });
    });
    vi.mocked(useWalletStore.getState).mockRestore();
    expect(result.current.state.step).toBe('amount');
    setStatus('locked');
    expect(result.current.state).toEqual({ step: 'input', error: null });
    expect(result.current.busy).toBe(false);
  });

  it('drops an open confirm or prepare when the account leaves wallet mode', async () => {
    const send = vi.fn(async (): Promise<WalletSendResult> => ({ kind: 'paid' }));
    target({ type: 'request', input: 'lnbc1', amountSats: 21, recipient: 'r' });
    vi.mocked(payFromWallet).mockResolvedValueOnce(confirmWith(send));
    const { result } = renderHook(() => useWalletSend());
    await typeAndSubmit(result, 'lnbc1');
    expect(result.current.state.step).toBe('confirm');
    const eligible = useAuthStore.getState().account;
    act(() => {
      useAuthStore.setState({ account: { ...eligible!, passkeyCredentialId: null } });
    });
    expect(result.current.state).toEqual({ step: 'input', error: null });
    act(() => {
      useAuthStore.setState({ account: eligible });
    });
    act(() => {
      result.current.confirm();
    });
    expect(send).not.toHaveBeenCalled();

    target(LNURL);
    let finish: (value: WalletPayResult) => void = () => undefined;
    vi.mocked(payFromWallet).mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    await typeAndSubmit(result, 'bob@21.gifts');
    act(() => {
      result.current.submitAmount(100);
    });
    expect(result.current.busy).toBe(true);
    act(() => {
      useAuthStore.setState({ account: { ...eligible!, walletRequired: false } });
    });
    expect(result.current.busy).toBe(false);
    await act(async () => {
      finish(confirmWith(send));
    });
    expect(result.current.state).toEqual({ step: 'input', error: null });
  });

  it('does nothing while the account is in the one-time wallet setup', async () => {
    process.env.NEXT_PUBLIC_BREEZ_API_KEY = 'breez-key';
    target(LNURL);
    const { result } = renderHook(() => useWalletSend());
    await typeAndSubmit(result, 'bob@21.gifts');
    expect(result.current.state.step).toBe('amount');
    const eligible = useAuthStore.getState().account;
    act(() => {
      useAuthStore.setState({ account: { ...eligible!, sparkWalletVerified: false } });
    });
    expect(result.current.state).toEqual({ step: 'input', error: null });
    vi.mocked(parseWalletInput).mockClear();
    await typeAndSubmit(result, 'bob@21.gifts');
    act(() => {
      result.current.submitAmount(100);
    });
    expect(parseWalletInput).not.toHaveBeenCalled();
    expect(payFromWallet).not.toHaveBeenCalled();
    act(() => {
      useAuthStore.setState({ account: { ...eligible!, sparkWalletVerified: true } });
    });
    await typeAndSubmit(result, 'bob@21.gifts');
    expect(parseWalletInput).toHaveBeenCalledTimes(1);
    expect(result.current.state.step).toBe('amount');
  });

  it('keeps a send in flight and the sent and idle input steps', async () => {
    target({ type: 'request', input: 'lnbc1', amountSats: 21, recipient: 'r' });
    let finish: (value: WalletSendResult) => void = () => undefined;
    vi.mocked(payFromWallet).mockResolvedValue(
      confirmWith(
        () =>
          new Promise((resolve) => {
            finish = resolve;
          }),
      ),
    );
    const { result } = renderHook(() => useWalletSend());
    setStatus('locked');
    expect(result.current.state).toEqual({ step: 'input', error: null });
    setStatus('ready');
    await typeAndSubmit(result, 'lnbc1');
    act(() => {
      result.current.confirm();
    });
    setStatus('error');
    expect(result.current.state.step).toBe('confirm');
    await act(async () => {
      finish({ kind: 'paid' });
    });
    expect(result.current.state.step).toBe('sent');
    setStatus('locked');
    expect(result.current.state.step).toBe('sent');
  });

  it('ignores the wallet status while pinned', () => {
    process.env.NEXT_PUBLIC_E2E_NOW = '2026-01-07T12:00:00.000Z';
    window.history.replaceState({}, '', '/wallet?visual=send-confirm');
    useWalletStore.setState({ status: 'disabled' });
    const { result } = renderHook(() => useWalletSend());
    expect(result.current.state.step).toBe('confirm');
  });
});

const PAY_REQUEST: LnurlPayRequest = {
  target: 'bob@example.com',
  minSendableMsat: 1_500,
  maxSendableMsat: 1_000_900,
  commentAllowed: 5,
  description: 'Pay bob',
  domain: 'example.com',
};

const OUTSIDE_LNURL = encodeLnurl('https://example.com/lnurlp/bob');

/**
 * Pastes an outside address and reaches its amount step.
 *
 * @returns The rendered hook.
 */
async function relayAmountStep(): Promise<{ current: ReturnType<typeof useWalletSend> }> {
  vi.mocked(postLnurlPayRequest).mockResolvedValue(PAY_REQUEST);
  const { result } = renderHook(() => useWalletSend());
  await typeAndSubmit(result, 'bob@example.com');
  return result;
}

describe('useWalletSend routing', () => {
  it.each([
    ['an address on another host', 'bob@example.com', 'bob@example.com'],
    ['a lightning: address on another host', 'lightning:bob@example.com', 'bob@example.com'],
    ['an LNURL on another host', OUTSIDE_LNURL, OUTSIDE_LNURL],
  ])('reads %s through the api', async (_label, text, relayed) => {
    vi.mocked(postLnurlPayRequest).mockResolvedValue(PAY_REQUEST);
    const { result } = renderHook(() => useWalletSend());
    await typeAndSubmit(result, text);
    expect(postLnurlPayRequest).toHaveBeenCalledWith('sess', relayed);
    expect(parseWalletInput).not.toHaveBeenCalled();
  });

  it.each([
    ['an address on the own host', 'bob@21.gifts'],
    ['an LNURL on the own host', encodeLnurl('https://21.gifts/.well-known/lnurlp/bob')],
    ['a Spark address', 'sp1qqexample'],
    ['a payment request', 'lnbc1'],
  ])('reads %s with the wallet', async (_label, text) => {
    target({ type: 'request', input: text, amountSats: null, recipient: text });
    const { result } = renderHook(() => useWalletSend());
    await typeAndSubmit(result, text);
    expect(parseWalletInput).toHaveBeenCalledWith(text);
    expect(postLnurlPayRequest).not.toHaveBeenCalled();
  });
});

describe('useWalletSend relay pay request', () => {
  it('shows whole-sat bounds, the comment length, and the address', async () => {
    const result = await relayAmountStep();
    expect(result.current.busy).toBe(false);
    expect(result.current.state).toEqual({
      step: 'amount',
      target: {
        type: 'relay',
        target: 'bob@example.com',
        minSats: 2,
        maxSats: 1_000,
        commentMaxLength: 5,
        recipient: 'bob@example.com',
      },
      amountError: false,
    });
  });

  it('names the domain for an LNURL and asks for at least one sat', async () => {
    vi.mocked(postLnurlPayRequest).mockResolvedValue({
      ...PAY_REQUEST,
      target: OUTSIDE_LNURL,
      minSendableMsat: 0,
    });
    const { result } = renderHook(() => useWalletSend());
    await typeAndSubmit(result, OUTSIDE_LNURL);
    expect(result.current.state).toMatchObject({
      step: 'amount',
      target: { minSats: 1, recipient: 'example.com', target: OUTSIDE_LNURL },
    });
  });

  it('calls a receiver unsupported when its bounds leave no whole sat', async () => {
    vi.mocked(postLnurlPayRequest).mockResolvedValue({
      ...PAY_REQUEST,
      minSendableMsat: 1_100,
      maxSendableMsat: 1_900,
    });
    const { result } = renderHook(() => useWalletSend());
    await typeAndSubmit(result, 'bob@example.com');
    expect(result.current.state).toEqual({ step: 'input', error: 'unsupported' });
  });

  it.each([
    [new LnurlRelayError('notPayable'), 'notPayable'],
    [new LnurlRelayError('notFound'), 'notFound'],
    [new LnurlRelayError('unreachable'), 'relayUnreachable'],
    [new LnurlRelayError('failed'), 'failed'],
    [new LnurlRelayError('amount'), 'failed'],
    [new Error('other'), 'failed'],
  ])('maps %o to the %s alert', async (error, alert) => {
    vi.mocked(postLnurlPayRequest).mockRejectedValue(error);
    const { result } = renderHook(() => useWalletSend());
    await typeAndSubmit(result, 'bob@example.com');
    expect(result.current.busy).toBe(false);
    expect(result.current.state).toEqual({ step: 'input', error: alert });
  });

  it('fails without a session and asks the api nothing', async () => {
    useAuthStore.setState({ session: null });
    const { result } = renderHook(() => useWalletSend());
    await typeAndSubmit(result, 'bob@example.com');
    expect(postLnurlPayRequest).not.toHaveBeenCalled();
    expect(result.current.state).toEqual({ step: 'input', error: 'failed' });
  });

  it.each([
    ['an answer', (finish: Settle<LnurlPayRequest>) => finish.resolve(PAY_REQUEST)],
    ['a refusal', (finish: Settle<LnurlPayRequest>) => finish.reject(new Error('x'))],
  ])('drops %s that arrives after the wallet left ready', async (_label, settle) => {
    const finish = pending(vi.mocked(postLnurlPayRequest));
    const { result } = renderHook(() => useWalletSend());
    act(() => {
      result.current.setText('bob@example.com');
    });
    act(() => {
      result.current.submitInput();
    });
    expect(result.current.busy).toBe(true);
    act(() => {
      useWalletStore.setState({ status: 'locked' });
    });
    await act(async () => {
      settle(finish);
    });
    expect(result.current.state).toEqual({ step: 'input', error: null });
  });
});

/** Controls of a promise a mock returns. */
interface Settle<T> {
  resolve: (value: T) => void;
  reject: (error: unknown) => void;
}

/**
 * Makes `mock` return one promise that the test settles.
 *
 * @param mock - Mocked async function.
 * @returns The controls.
 */
function pending<T>(mock: { mockReturnValue: (value: Promise<T>) => unknown }): Settle<T> {
  const controls: Settle<T> = { resolve: () => undefined, reject: () => undefined };
  mock.mockReturnValue(
    new Promise<T>((resolve, reject) => {
      controls.resolve = resolve;
      controls.reject = reject;
    }),
  );
  return controls;
}

describe('useWalletSend relay invoice', () => {
  it('asks the api for an invoice in millisats and pays it with the wallet', async () => {
    const result = await relayAmountStep();
    vi.mocked(postLnurlInvoice).mockResolvedValue({ pr: 'lnbc1relay' });
    vi.mocked(payFromWallet).mockResolvedValue({
      kind: 'confirm',
      amountSats: 100,
      feeSats: 1,
      send: async () => ({ kind: 'paid' }),
    });
    act(() => {
      result.current.setComment('  Thanks a lot ');
    });
    await act(async () => {
      result.current.submitAmount(100);
    });
    expect(postLnurlInvoice).toHaveBeenCalledWith('sess', 'bob@example.com', 100_000, 'Thank');
    expect(payFromWallet).toHaveBeenCalledWith({ type: 'input', input: 'lnbc1relay' });
    expect(result.current.state).toEqual({
      step: 'confirm',
      recipient: 'bob@example.com',
      amountSats: 100,
      feeSats: 1,
    });
  });

  it('checks the bounds before it asks the api', async () => {
    const result = await relayAmountStep();
    act(() => {
      result.current.submitAmount(1);
    });
    expect(postLnurlInvoice).not.toHaveBeenCalled();
    expect(result.current.state).toMatchObject({ step: 'amount', amountError: true });
  });

  it('refuses an invoice whose amount differs from the one entered', async () => {
    const result = await relayAmountStep();
    vi.mocked(postLnurlInvoice).mockResolvedValue({ pr: 'lnbc1relay' });
    vi.mocked(payFromWallet).mockResolvedValue({
      kind: 'confirm',
      amountSats: 101,
      feeSats: 1,
      send: async () => ({ kind: 'paid' }),
    });
    await act(async () => {
      result.current.submitAmount(100);
    });
    expect(result.current.state).toEqual({ step: 'input', error: 'failed' });
  });

  it('keeps the amount step with the amount alert on Amount out of range', async () => {
    const result = await relayAmountStep();
    vi.mocked(postLnurlInvoice).mockRejectedValue(new LnurlRelayError('amount'));
    await act(async () => {
      result.current.submitAmount(100);
    });
    expect(result.current.busy).toBe(false);
    expect(result.current.state).toEqual({
      step: 'amount',
      target: expect.objectContaining({ type: 'relay' }) as unknown,
      amountError: true,
    });
  });

  it('keeps the amount step with the comment alert on Comment too long', async () => {
    const result = await relayAmountStep();
    vi.mocked(postLnurlInvoice).mockRejectedValue(new LnurlRelayError('comment'));
    await act(async () => {
      result.current.submitAmount(100);
    });
    expect(result.current.state).toEqual({
      step: 'amount',
      target: expect.objectContaining({ type: 'relay' }) as unknown,
      amountError: false,
      commentError: true,
    });
    act(() => {
      result.current.submitAmount(1);
    });
    expect(result.current.state).not.toHaveProperty('commentError');
  });

  it.each([
    [new LnurlRelayError('notPayable'), 'notPayable'],
    [new LnurlRelayError('notFound'), 'notFound'],
    [new LnurlRelayError('unreachable'), 'relayUnreachable'],
    [new LnurlRelayError('failed'), 'failed'],
    [new Error('other'), 'failed'],
  ])('returns to the input with an alert on %o', async (error, alert) => {
    const result = await relayAmountStep();
    vi.mocked(postLnurlInvoice).mockRejectedValue(error);
    await act(async () => {
      result.current.submitAmount(100);
    });
    expect(result.current.state).toEqual({ step: 'input', error: alert });
    expect(payFromWallet).not.toHaveBeenCalled();
  });

  it('fails without a session and asks the api nothing', async () => {
    const result = await relayAmountStep();
    act(() => {
      useAuthStore.setState({ session: null });
    });
    await act(async () => {
      result.current.submitAmount(100);
    });
    expect(postLnurlInvoice).not.toHaveBeenCalled();
    expect(result.current.state).toEqual({ step: 'input', error: 'failed' });
  });

  it.each([
    ['an invoice', (finish: Settle<{ pr: string }>) => finish.resolve({ pr: 'lnbc1relay' })],
    ['a refusal', (finish: Settle<{ pr: string }>) => finish.reject(new Error('x'))],
  ])('drops %s that arrives after cancel', async (_label, settle) => {
    const result = await relayAmountStep();
    const finish = pending(vi.mocked(postLnurlInvoice));
    act(() => {
      result.current.submitAmount(100);
    });
    expect(result.current.busy).toBe(true);
    act(() => {
      result.current.cancel();
    });
    await act(async () => {
      settle(finish);
    });
    expect(payFromWallet).not.toHaveBeenCalled();
    expect(result.current.state).toEqual({ step: 'input', error: null });
  });
});

describe('useWalletSend relay answers after the wallet left ready', () => {
  /** Makes the store read `locked` while React has not yet run the reset effect. */
  const lockedView = (): void => {
    const state = useWalletStore.getState();
    vi.spyOn(useWalletStore, 'getState').mockReturnValue({ ...state, status: 'locked' });
  };

  it.each([
    ['a pay request', (finish: Settle<LnurlPayRequest>) => finish.resolve(PAY_REQUEST)],
    ['a pay-request refusal', (finish: Settle<LnurlPayRequest>) => finish.reject(new Error('x'))],
  ])('drops %s that settles before the reset ran', async (_label, settle) => {
    const finish = pending(vi.mocked(postLnurlPayRequest));
    const { result } = renderHook(() => useWalletSend());
    act(() => {
      result.current.setText('bob@example.com');
    });
    act(() => {
      result.current.submitInput();
    });
    lockedView();
    await act(async () => {
      settle(finish);
    });
    vi.mocked(useWalletStore.getState).mockRestore();
    expect(result.current.state).toEqual({ step: 'input', error: null });
    expect(result.current.busy).toBe(true);
  });

  it.each([
    ['an invoice', (finish: Settle<{ pr: string }>) => finish.resolve({ pr: 'lnbc1relay' })],
    ['an invoice refusal', (finish: Settle<{ pr: string }>) => finish.reject(new Error('x'))],
  ])('drops %s that settles before the reset ran', async (_label, settle) => {
    const result = await relayAmountStep();
    const finish = pending(vi.mocked(postLnurlInvoice));
    act(() => {
      result.current.submitAmount(100);
    });
    lockedView();
    await act(async () => {
      settle(finish);
    });
    vi.mocked(useWalletStore.getState).mockRestore();
    expect(payFromWallet).not.toHaveBeenCalled();
    expect(result.current.state.step).toBe('amount');
    expect(result.current.busy).toBe(true);
  });
});

describe('useWalletSend fixed amount', () => {
  const SHOP_URL = 'https://21.gifts/.well-known/lnurlp/shop';
  const SHOP_LNURL = encodeLnurl(SHOP_URL);
  const SHOP_LINK = `https://21.gifts/pl/?lightning=${SHOP_LNURL}`;
  const OUTSIDE_SHOP = encodeLnurl('https://example.com/.well-known/lnurlp/shop');
  const FIXED: WalletTarget = {
    type: 'lnurl',
    request: { details: { callback: 'shop' } },
    minSats: 7,
    maxSats: 7,
    commentMaxLength: 140,
    recipient: '21.gifts',
  };

  function confirmFixed(amountSats = 7): WalletPayResult {
    return { kind: 'confirm', amountSats, feeSats: 1, send: async () => ({ kind: 'paid' }) };
  }

  it.each([
    ['the /pl/?lightning= link', SHOP_LINK],
    ['the bech32 LNURL', SHOP_LNURL],
    ['the lightning: LNURL', `lightning:${SHOP_LNURL}`],
  ])(
    'goes from %s on the own host straight to confirm without a message, naming the address',
    async (_label, text) => {
      target(FIXED);
      vi.mocked(payFromWallet).mockResolvedValue(confirmFixed());
      const { result } = renderHook(() => useWalletSend());
      act(() => {
        result.current.setComment('left over');
      });
      await typeAndSubmit(result, text);
      expect(parseWalletInput).toHaveBeenCalledWith(text);
      expect(postLnurlPayRequest).not.toHaveBeenCalled();
      expect(payFromWallet).toHaveBeenCalledTimes(1);
      expect(payFromWallet).toHaveBeenCalledWith({
        type: 'lnurl',
        request: FIXED.type === 'lnurl' ? FIXED.request : null,
        amountSats: 7,
      });
      expect(result.current.comment).toBe('');
      expect(result.current.busy).toBe(false);
      expect(result.current.state).toEqual({
        step: 'confirm',
        recipient: 'shop@21.gifts',
        amountSats: 7,
        feeSats: 1,
      });
    },
  );

  it('stays busy from the read until the prepared payment of a fixed amount', async () => {
    target(FIXED);
    const finish = pending(vi.mocked(payFromWallet));
    const { result } = renderHook(() => useWalletSend());
    await typeAndSubmit(result, SHOP_LINK);
    expect(result.current.busy).toBe(true);
    expect(result.current.state).toEqual({ step: 'input', error: null });
    await act(async () => {
      finish.resolve(confirmFixed());
    });
    expect(result.current.state).toMatchObject({ step: 'confirm', amountSats: 7 });
  });

  it('closes the confirm step of a fixed amount back to the input, not to an amount step', async () => {
    target(FIXED);
    vi.mocked(payFromWallet).mockResolvedValue(confirmFixed());
    const { result } = renderHook(() => useWalletSend());
    await typeAndSubmit(result, SHOP_LINK);
    expect(result.current.state.step).toBe('confirm');
    let closed = false;
    act(() => {
      closed = result.current.cancel();
    });
    expect(closed).toBe(true);
    expect(result.current.state).toEqual({ step: 'input', error: null });
    expect(result.current.text).toBe(SHOP_LINK);
  });

  it('maps a failed prepare of a fixed amount to the input alert', async () => {
    target(FIXED);
    vi.mocked(payFromWallet).mockResolvedValue({ kind: 'insufficient' });
    const { result } = renderHook(() => useWalletSend());
    await typeAndSubmit(result, SHOP_LINK);
    expect(result.current.state).toEqual({ step: 'input', error: 'insufficient' });
  });

  it('keeps the amount step for an own-host receiver whose bounds differ, naming the address', async () => {
    target({ ...FIXED, maxSats: 8 });
    const { result } = renderHook(() => useWalletSend());
    await typeAndSubmit(result, SHOP_LINK);
    expect(payFromWallet).not.toHaveBeenCalled();
    expect(result.current.state).toMatchObject({
      step: 'amount',
      amountError: false,
      target: { type: 'lnurl', minSats: 7, maxSats: 8, recipient: 'shop@21.gifts' },
    });
  });

  it('keeps the domain for an own-host LNURL that is not an address', async () => {
    target(FIXED);
    vi.mocked(payFromWallet).mockResolvedValue(confirmFixed());
    const { result } = renderHook(() => useWalletSend());
    await typeAndSubmit(result, encodeLnurl('https://21.gifts/pay/shop'));
    expect(result.current.state).toMatchObject({ step: 'confirm', recipient: '21.gifts' });
  });

  it('keeps the recipient the wallet read for a pasted Lightning address', async () => {
    target({ ...FIXED, recipient: 'shop@21.gifts' });
    vi.mocked(payFromWallet).mockResolvedValue(confirmFixed());
    const { result } = renderHook(() => useWalletSend());
    await typeAndSubmit(result, 'Shop@21.gifts');
    expect(result.current.state).toMatchObject({ step: 'confirm', recipient: 'shop@21.gifts' });
  });

  it.each([
    ['equal bounds', 7_000, 7_000],
    ['bounds that round to one whole sat', 6_001, 7_999],
  ])(
    'asks the api for the invoice of an outside receiver with %s and confirms it',
    async (_label, minSendableMsat, maxSendableMsat) => {
      vi.mocked(postLnurlPayRequest).mockResolvedValue({
        ...PAY_REQUEST,
        target: OUTSIDE_SHOP,
        minSendableMsat,
        maxSendableMsat,
      });
      vi.mocked(postLnurlInvoice).mockResolvedValue({ pr: 'lnbc70n1shop' });
      vi.mocked(payFromWallet).mockResolvedValue(confirmFixed());
      const { result } = renderHook(() => useWalletSend());
      act(() => {
        result.current.setComment('left over');
      });
      await typeAndSubmit(result, OUTSIDE_SHOP);
      expect(postLnurlPayRequest).toHaveBeenCalledWith('sess', OUTSIDE_SHOP);
      expect(postLnurlInvoice).toHaveBeenCalledWith('sess', OUTSIDE_SHOP, 7_000, '');
      expect(payFromWallet).toHaveBeenCalledWith({ type: 'input', input: 'lnbc70n1shop' });
      expect(result.current.comment).toBe('');
      expect(result.current.state).toEqual({
        step: 'confirm',
        recipient: 'shop@example.com',
        amountSats: 7,
        feeSats: 1,
      });
    },
  );

  it('names the address of an outside fixed receiver read from an address', async () => {
    vi.mocked(postLnurlPayRequest).mockResolvedValue({
      ...PAY_REQUEST,
      minSendableMsat: 7_000,
      maxSendableMsat: 7_000,
    });
    vi.mocked(postLnurlInvoice).mockResolvedValue({ pr: 'lnbc70n1shop' });
    vi.mocked(payFromWallet).mockResolvedValue(confirmFixed());
    const { result } = renderHook(() => useWalletSend());
    await typeAndSubmit(result, 'bob@example.com');
    expect(postLnurlInvoice).toHaveBeenCalledWith('sess', 'bob@example.com', 7_000, '');
    expect(result.current.state).toMatchObject({ step: 'confirm', recipient: 'bob@example.com' });
  });

  it('refuses an outside fixed invoice whose amount differs', async () => {
    vi.mocked(postLnurlPayRequest).mockResolvedValue({
      ...PAY_REQUEST,
      target: OUTSIDE_SHOP,
      minSendableMsat: 7_000,
      maxSendableMsat: 7_000,
    });
    vi.mocked(postLnurlInvoice).mockResolvedValue({ pr: 'lnbc70n1shop' });
    vi.mocked(payFromWallet).mockResolvedValue(confirmFixed(8));
    const { result } = renderHook(() => useWalletSend());
    await typeAndSubmit(result, OUTSIDE_SHOP);
    expect(result.current.state).toEqual({ step: 'input', error: 'failed' });
  });

  it('shows the amount step with its alert when the api refuses the fixed amount', async () => {
    vi.mocked(postLnurlPayRequest).mockResolvedValue({
      ...PAY_REQUEST,
      target: OUTSIDE_SHOP,
      minSendableMsat: 7_000,
      maxSendableMsat: 7_000,
    });
    vi.mocked(postLnurlInvoice).mockRejectedValue(new LnurlRelayError('amount'));
    const { result } = renderHook(() => useWalletSend());
    await typeAndSubmit(result, OUTSIDE_SHOP);
    expect(payFromWallet).not.toHaveBeenCalled();
    expect(result.current.busy).toBe(false);
    expect(result.current.state).toMatchObject({
      step: 'amount',
      amountError: true,
      target: { type: 'relay', minSats: 7, maxSats: 7, recipient: 'shop@example.com' },
    });
  });

  it('keeps the amount step and the address for an outside LNURL whose bounds differ', async () => {
    vi.mocked(postLnurlPayRequest).mockResolvedValue({ ...PAY_REQUEST, target: OUTSIDE_SHOP });
    const { result } = renderHook(() => useWalletSend());
    await typeAndSubmit(result, OUTSIDE_SHOP);
    expect(postLnurlInvoice).not.toHaveBeenCalled();
    expect(result.current.state).toMatchObject({
      step: 'amount',
      target: { type: 'relay', minSats: 2, maxSats: 1_000, recipient: 'shop@example.com' },
    });
  });
});
