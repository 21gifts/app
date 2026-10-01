import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WALLET_SEND_VISUAL_FIXTURE, useWalletSend, walletSendBounds } from '@/hooks/useWalletSend';
import type { WalletTarget } from '@/lib/wallet/wallet-sdk';
import {
  parseWalletInput,
  payFromWallet,
  type WalletPayResult,
  type WalletSendResult,
} from '@/lib/wallet/wallet-service';

vi.mock('@/lib/wallet/wallet-service', () => ({
  parseWalletInput: vi.fn(),
  payFromWallet: vi.fn(),
}));

const ORIGINAL_E2E_NOW = process.env.NEXT_PUBLIC_E2E_NOW;

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
  window.history.replaceState({}, '', '/wallet');
  delete process.env.NEXT_PUBLIC_E2E_NOW;
  vi.mocked(parseWalletInput).mockReset();
  vi.mocked(payFromWallet).mockReset();
});

afterEach(() => {
  cleanup();
  if (ORIGINAL_E2E_NOW === undefined) {
    delete process.env.NEXT_PUBLIC_E2E_NOW;
  } else {
    process.env.NEXT_PUBLIC_E2E_NOW = ORIGINAL_E2E_NOW;
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
    await typeAndSubmit(result, 'bob@pay.example');
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
    await typeAndSubmit(result, 'bob@pay.example');
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
    await typeAndSubmit(result, 'bob@pay.example');
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
    ['send-sent', { step: 'sent', amountSats: fixture.amountSats }],
    ['send-unsupported', { step: 'input', error: 'onchain' }],
    ['send-error', { step: 'input', error: 'unreachable' }],
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
  });

  it('ignores pins outside a Playwright build and unknown values', () => {
    window.history.replaceState({}, '', '/wallet?visual=send-confirm');
    expect(renderHook(() => useWalletSend()).result.current.state.step).toBe('input');
    process.env.NEXT_PUBLIC_E2E_NOW = '2026-01-07T12:00:00.000Z';
    window.history.replaceState({}, '', '/wallet?visual=balance-ready');
    expect(renderHook(() => useWalletSend()).result.current.state.step).toBe('input');
  });
});
