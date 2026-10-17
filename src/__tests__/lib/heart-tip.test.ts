import { captureMessage } from '@sentry/nextjs';
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CannotReceiveError, postMessageInvoice, WalletRequiredError } from '@/lib/api';
import type { Account } from '@/lib/api-types';
import { getE2eNow } from '@/lib/config';
import {
  HEART_TIP_PLUS_ONE_MS,
  HEART_TIP_UNSETTLED_MS,
  endHeartPlusOne,
  sendHeartTip,
  useHeartTip,
} from '@/lib/heart-tip';
import { reportPaymentFailure, type PaymentFailure } from '@/lib/wallet/payment-failure';
import { unlockWalletPhrase } from '@/lib/wallet/wallet-phrase';
import { logInteraction } from '@/lib/interaction-log';
import type { WalletPayment } from '@/lib/wallet/wallet-sdk';
import {
  listWalletPayments,
  payFromWallet,
  type WalletPayResult,
  type WalletSendResult,
} from '@/lib/wallet/wallet-service';
import { useAuthStore } from '@/stores/auth-store';
import { useWalletStore } from '@/stores/wallet-store';

vi.mock('@sentry/nextjs', () => ({ captureMessage: vi.fn() }));
vi.mock('@/lib/wallet/payment-failure', () => ({ reportPaymentFailure: vi.fn() }));

vi.mock('@/lib/config', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/config')>();
  return { ...actual, getE2eNow: vi.fn() };
});

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return { ...actual, postMessageInvoice: vi.fn() };
});

vi.mock('@/lib/wallet/wallet-phrase', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/wallet/wallet-phrase')>();
  return { ...actual, unlockWalletPhrase: vi.fn() };
});

vi.mock('@/lib/wallet/wallet-service', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/wallet/wallet-service')>();
  return { ...actual, listWalletPayments: vi.fn(), payFromWallet: vi.fn() };
});

/** A heart prepare the SDK refused. */
const FAILED: PaymentFailure = {
  stage: 'prepare',
  reason: 'sdk_error',
  method: 'spark',
  amountSats: null,
  feeSats: null,
};
/** No wallet connection. */
const UNLOCK: PaymentFailure = { ...FAILED, reason: 'unlock' };
/** A balance too low for the heart. */
const LOW: PaymentFailure = { ...FAILED, reason: 'insufficient' };
/** An amount below the SDK minimum. */
const BELOW: PaymentFailure = { ...FAILED, reason: 'below_minimum' };
/** A heart send the SDK refused. */
const SEND_FAILED: PaymentFailure = { ...FAILED, stage: 'send', amountSats: 1, feeSats: 0 };
/** A heart send the balance did not cover. */
const SEND_LOW: PaymentFailure = { ...SEND_FAILED, reason: 'insufficient' };
/** A heart send the app stopped waiting for. */
const TIMEOUT: PaymentFailure = { ...SEND_FAILED, reason: 'timeout' };

/** Invoice body the api returns for a heart: a fee-free Spark invoice. */
const HEART_INVOICE = { pr: 'lnbc1', amountSats: 1, sparkInvoice: 'spark1heart' };

/**
 * One sent wallet payment for a Spark invoice.
 *
 * @param invoice - Spark invoice the payment paid.
 * @param status - Payment status.
 * @param direction - Payment direction.
 * @returns The payment.
 */
function sentPayment(
  invoice: string,
  status: WalletPayment['status'],
  direction: WalletPayment['direction'] = 'sent',
): WalletPayment {
  return {
    id: `pay-${invoice}`,
    direction,
    amountSats: 1,
    feesSats: 0,
    timestamp: 1,
    status,
    method: 'spark',
    senderComment: null,
    info: { invoice },
  };
}

const BASE = {
  messageId: 'm1',
  sessionToken: 'sess',
  readOnly: false,
  isLocalSunday: false,
  walletStatus: 'ready' as const,
  balanceSats: 21,
  needsWalletSetup: false,
  canUnlockWallet: true,
};

beforeEach(() => {
  window.history.replaceState({}, '', '/');
  sessionStorage.removeItem('21gifts.heart.sent');
  vi.mocked(getE2eNow).mockReset().mockReturnValue(null);
  vi.mocked(postMessageInvoice).mockReset();
  vi.mocked(payFromWallet).mockReset();
  vi.mocked(listWalletPayments).mockReset().mockResolvedValue([]);
  vi.mocked(unlockWalletPhrase).mockReset();
  vi.mocked(logInteraction).mockClear();
  vi.mocked(captureMessage).mockClear();
  vi.mocked(reportPaymentFailure).mockClear();
  useWalletStore.setState({ status: 'ready', balanceSats: 21, identityPubkey: null });
});

describe('sendHeartTip', () => {
  it('requests the invoice with heart true and sats 1, then sends without a second confirm', async () => {
    const send = vi.fn(async () => ({ kind: 'paid' as const }));
    vi.mocked(postMessageInvoice).mockResolvedValue(HEART_INVOICE);
    vi.mocked(payFromWallet).mockResolvedValue({
      kind: 'confirm',
      amountSats: 1,
      feeSats: 0,
      method: 'spark',
      send,
    });

    await expect(sendHeartTip(BASE)).resolves.toEqual({ kind: 'paid' });
    expect(postMessageInvoice).toHaveBeenCalledWith('sess', 'm1', 1, undefined, undefined, true);
    expect(payFromWallet).toHaveBeenCalledWith({ type: 'input', input: 'spark1heart' });
    expect(send).toHaveBeenCalledTimes(1);
    expect(logInteraction).toHaveBeenCalledTimes(1);
    expect(logInteraction).toHaveBeenCalledWith(
      'heart_sent',
      { messageId: 'm1', amountSats: 1 },
      'sess',
    );
  });

  it('does not send without a sparkInvoice and never pays pr', async () => {
    vi.mocked(postMessageInvoice).mockResolvedValue({ pr: 'lnbc1', amountSats: 1 });
    await expect(sendHeartTip(BASE)).resolves.toEqual({
      kind: 'failed',
      reason: 'heart_unavailable',
    });
    vi.mocked(postMessageInvoice).mockResolvedValue({
      pr: 'lnbc1',
      amountSats: 1,
      sparkInvoice: null,
    });
    await expect(sendHeartTip(BASE)).resolves.toEqual({
      kind: 'failed',
      reason: 'heart_unavailable',
    });
    expect(payFromWallet).not.toHaveBeenCalled();
  });

  it('does not send when the fee is above zero', async () => {
    const send = vi.fn(async () => ({ kind: 'paid' as const }));
    vi.mocked(postMessageInvoice).mockResolvedValue(HEART_INVOICE);
    vi.mocked(payFromWallet).mockResolvedValue({
      kind: 'confirm',
      amountSats: 1,
      feeSats: 1,
      method: 'spark',
      send,
    });
    await expect(sendHeartTip(BASE)).resolves.toEqual({
      kind: 'failed',
      reason: 'heart_unavailable',
    });
    expect(send).not.toHaveBeenCalled();
  });

  it('does not send when the prepared amount is not 1 sat', async () => {
    const send = vi.fn(async () => ({ kind: 'paid' as const }));
    vi.mocked(postMessageInvoice).mockResolvedValue(HEART_INVOICE);
    vi.mocked(payFromWallet).mockResolvedValue({
      kind: 'confirm',
      amountSats: 2,
      feeSats: 0,
      method: 'spark',
      send,
    });
    await expect(sendHeartTip(BASE)).resolves.toEqual({
      kind: 'failed',
      reason: 'heart_unavailable',
    });
    vi.mocked(payFromWallet).mockResolvedValue({
      kind: 'confirm',
      amountSats: 0,
      feeSats: 0,
      method: 'spark',
      send,
    });
    await expect(sendHeartTip(BASE)).resolves.toEqual({
      kind: 'failed',
      reason: 'heart_unavailable',
    });
    expect(send).not.toHaveBeenCalled();
  });

  it('does not send when the prepare after unlock is not 1 sat fee-free', async () => {
    const send = vi.fn(async () => ({ kind: 'paid' as const }));
    vi.mocked(postMessageInvoice).mockResolvedValue(HEART_INVOICE);
    vi.mocked(payFromWallet)
      .mockResolvedValueOnce({ kind: 'unlock', failure: UNLOCK })
      .mockResolvedValueOnce({ kind: 'confirm', amountSats: 1, feeSats: 3, method: 'spark', send });
    vi.mocked(unlockWalletPhrase).mockResolvedValue('unlocked');
    await expect(
      sendHeartTip({ ...BASE, walletStatus: 'locked', balanceSats: null }),
    ).resolves.toEqual({ kind: 'failed', reason: 'heart_unavailable' });
    expect(send).not.toHaveBeenCalled();
  });

  it('maps the api HEART_UNAVAILABLE refusal to unavailable', async () => {
    vi.mocked(postMessageInvoice).mockRejectedValueOnce(new Error('HEART_UNAVAILABLE'));
    await expect(sendHeartTip(BASE)).resolves.toEqual({
      kind: 'failed',
      reason: 'heart_unavailable',
    });
    expect(payFromWallet).not.toHaveBeenCalled();
  });

  it('is silent without a session or on a read-only board', async () => {
    await expect(sendHeartTip({ ...BASE, sessionToken: null })).resolves.toEqual({ kind: 'noop' });
    await expect(sendHeartTip({ ...BASE, readOnly: true })).resolves.toEqual({ kind: 'noop' });
    expect(postMessageInvoice).not.toHaveBeenCalled();
  });

  it('does not send on Sunday', async () => {
    await expect(sendHeartTip({ ...BASE, isLocalSunday: true })).resolves.toEqual({
      kind: 'failed',
      reason: 'sunday',
    });
    expect(postMessageInvoice).not.toHaveBeenCalled();
  });

  it('needs a balance when ready sats are below 1', async () => {
    await expect(sendHeartTip({ ...BASE, balanceSats: 0 })).resolves.toEqual({
      kind: 'failed',
      reason: 'no_balance',
    });
    expect(postMessageInvoice).not.toHaveBeenCalled();
  });

  it('does not send while wallet setup is still due', async () => {
    await expect(sendHeartTip({ ...BASE, needsWalletSetup: true })).resolves.toEqual({
      kind: 'failed',
      reason: 'wallet_setup_due',
    });
    expect(postMessageInvoice).not.toHaveBeenCalled();
  });

  it('stops with insufficient_balance when prepare reports insufficient', async () => {
    vi.mocked(postMessageInvoice).mockResolvedValue(HEART_INVOICE);
    vi.mocked(payFromWallet).mockResolvedValue({ kind: 'insufficient', failure: LOW });
    await expect(sendHeartTip(BASE)).resolves.toEqual({
      kind: 'failed',
      reason: 'insufficient_balance',
    });
  });

  it('unlocks once then prepares and sends', async () => {
    const send = vi.fn(async () => ({ kind: 'paid' as const }));
    vi.mocked(postMessageInvoice).mockResolvedValue(HEART_INVOICE);
    vi.mocked(payFromWallet)
      .mockResolvedValueOnce({ kind: 'unlock', failure: UNLOCK })
      .mockResolvedValueOnce({ kind: 'confirm', amountSats: 1, feeSats: 0, method: 'spark', send });
    vi.mocked(unlockWalletPhrase).mockResolvedValue('unlocked');

    await expect(
      sendHeartTip({ ...BASE, walletStatus: 'locked', balanceSats: null }),
    ).resolves.toEqual({ kind: 'paid' });
    expect(unlockWalletPhrase).toHaveBeenCalledTimes(1);
    expect(payFromWallet).toHaveBeenCalledTimes(2);
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('shows payFailed when the wallet still asks to unlock after it was unlocked', async () => {
    vi.mocked(postMessageInvoice).mockResolvedValue(HEART_INVOICE);
    vi.mocked(payFromWallet)
      .mockResolvedValueOnce({ kind: 'unlock', failure: UNLOCK })
      .mockResolvedValueOnce({ kind: 'unlock', failure: UNLOCK });
    vi.mocked(unlockWalletPhrase).mockResolvedValue('unlocked');

    await expect(
      sendHeartTip({ ...BASE, walletStatus: 'locked', balanceSats: null }),
    ).resolves.toEqual({ kind: 'failed', reason: 'payment_failed' });
    expect(unlockWalletPhrase).toHaveBeenCalledTimes(1);
    expect(payFromWallet).toHaveBeenCalledTimes(2);
  });

  it('shows payFailed when unlock is cancelled', async () => {
    vi.mocked(postMessageInvoice).mockResolvedValue(HEART_INVOICE);
    vi.mocked(payFromWallet).mockResolvedValue({ kind: 'unlock', failure: UNLOCK });
    vi.mocked(unlockWalletPhrase).mockResolvedValue('cancelled');

    await expect(
      sendHeartTip({ ...BASE, walletStatus: 'locked', balanceSats: null }),
    ).resolves.toEqual({ kind: 'failed', reason: 'payment_failed' });
  });

  it('maps author-wallet and rate-limit invoice errors', async () => {
    vi.mocked(postMessageInvoice).mockRejectedValueOnce(new CannotReceiveError());
    await expect(sendHeartTip(BASE)).resolves.toEqual({
      kind: 'failed',
      reason: 'author_cannot_receive',
    });
    vi.mocked(postMessageInvoice).mockRejectedValueOnce(new Error('Too many payments'));
    await expect(sendHeartTip(BASE)).resolves.toEqual({
      kind: 'failed',
      reason: 'rate_limited',
    });
    vi.mocked(postMessageInvoice).mockRejectedValueOnce(new Error('SUNDAY_REST'));
    await expect(sendHeartTip(BASE)).resolves.toEqual({
      kind: 'failed',
      reason: 'sunday',
    });
  });

  it('maps an invoice that requires a wallet to wallet_setup_due', async () => {
    vi.mocked(postMessageInvoice).mockRejectedValueOnce(new WalletRequiredError());
    await expect(sendHeartTip(BASE)).resolves.toEqual({
      kind: 'failed',
      reason: 'wallet_setup_due',
    });
  });

  it('maps any other invoice rejection to request_failed', async () => {
    vi.mocked(postMessageInvoice).mockRejectedValueOnce(new Error('offline'));
    await expect(sendHeartTip(BASE)).resolves.toEqual({
      kind: 'failed',
      reason: 'request_failed',
    });
    vi.mocked(postMessageInvoice).mockRejectedValueOnce('nope');
    await expect(sendHeartTip(BASE)).resolves.toEqual({
      kind: 'failed',
      reason: 'request_failed',
    });
  });

  it('stops with insufficient_balance when send reports insufficient', async () => {
    const send = vi.fn(async () => ({ kind: 'insufficient' as const, failure: SEND_LOW }));
    vi.mocked(postMessageInvoice).mockResolvedValue(HEART_INVOICE);
    vi.mocked(payFromWallet).mockResolvedValue({
      kind: 'confirm',
      amountSats: 1,
      feeSats: 0,
      method: 'spark',
      send,
    });
    await expect(sendHeartTip(BASE)).resolves.toEqual({
      kind: 'failed',
      reason: 'insufficient_balance',
    });
  });

  it('maps a failed send to request', async () => {
    const send = vi.fn(async () => ({ kind: 'failed' as const, failure: SEND_FAILED }));
    vi.mocked(postMessageInvoice).mockResolvedValue(HEART_INVOICE);
    vi.mocked(payFromWallet).mockResolvedValue({
      kind: 'confirm',
      amountSats: 1,
      feeSats: 0,
      method: 'spark',
      send,
    });
    await expect(sendHeartTip(BASE)).resolves.toEqual({
      kind: 'failed',
      reason: 'payment_failed',
    });
  });

  it('maps a failed prepare to request', async () => {
    vi.mocked(postMessageInvoice).mockResolvedValue(HEART_INVOICE);
    vi.mocked(payFromWallet).mockResolvedValue({ kind: 'failed', failure: FAILED });
    await expect(sendHeartTip(BASE)).resolves.toEqual({
      kind: 'failed',
      reason: 'payment_failed',
    });
  });

  it('maps a below-minimum prepare to request', async () => {
    vi.mocked(postMessageInvoice).mockResolvedValue(HEART_INVOICE);
    vi.mocked(payFromWallet).mockResolvedValue({
      kind: 'belowMinimum',
      minSats: 1,
      failure: BELOW,
    });
    await expect(sendHeartTip(BASE)).resolves.toEqual({
      kind: 'failed',
      reason: 'payment_failed',
    });
  });

  it('does not unlock when the account cannot unlock', async () => {
    vi.mocked(postMessageInvoice).mockResolvedValue(HEART_INVOICE);
    vi.mocked(payFromWallet).mockResolvedValue({ kind: 'unlock', failure: UNLOCK });
    await expect(sendHeartTip({ ...BASE, canUnlockWallet: false })).resolves.toEqual({
      kind: 'failed',
      reason: 'payment_failed',
    });
    expect(unlockWalletPhrase).not.toHaveBeenCalled();
  });

  it('stops with insufficient_balance when the live ready wallet is empty', async () => {
    const send = vi.fn(async () => ({ kind: 'paid' as const }));
    useWalletStore.setState({ status: 'ready', balanceSats: 0, identityPubkey: null });
    vi.mocked(postMessageInvoice).mockResolvedValue(HEART_INVOICE);
    vi.mocked(payFromWallet).mockResolvedValue({
      kind: 'confirm',
      amountSats: 1,
      feeSats: 0,
      method: 'spark',
      send,
    });
    await expect(sendHeartTip(BASE)).resolves.toEqual({
      kind: 'failed',
      reason: 'insufficient_balance',
    });
    expect(send).not.toHaveBeenCalled();
  });

  it('ignores visual=heart-paid in a production build and still invoices', async () => {
    window.history.replaceState({}, '', '/welcome?visual=heart-paid');
    vi.mocked(postMessageInvoice).mockResolvedValue(HEART_INVOICE);
    vi.mocked(payFromWallet).mockResolvedValue({ kind: 'insufficient', failure: LOW });
    await expect(sendHeartTip(BASE)).resolves.toEqual({
      kind: 'failed',
      reason: 'insufficient_balance',
    });
    expect(postMessageInvoice).toHaveBeenCalledTimes(1);
  });

  it('returns paid for visual=heart-paid in a Playwright build without invoicing', async () => {
    vi.mocked(getE2eNow).mockReturnValue('2026-01-07T12:00:00.000Z');
    window.history.replaceState({}, '', '/welcome?visual=heart-paid');
    await expect(sendHeartTip(BASE)).resolves.toEqual({ kind: 'paid' });
    expect(postMessageInvoice).not.toHaveBeenCalled();
  });

  it('ignores visual=heart-needs-balance in a production build and still pays', async () => {
    window.history.replaceState({}, '', '/welcome?visual=heart-needs-balance');
    const send = vi.fn(async () => ({ kind: 'paid' as const }));
    vi.mocked(postMessageInvoice).mockResolvedValue(HEART_INVOICE);
    vi.mocked(payFromWallet).mockResolvedValue({
      kind: 'confirm',
      amountSats: 1,
      feeSats: 0,
      method: 'spark',
      send,
    });
    await expect(sendHeartTip({ ...BASE, messageId: 'pin-prod' })).resolves.toEqual({
      kind: 'paid',
    });
    expect(postMessageInvoice).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('returns no_balance for visual=heart-needs-balance in a Playwright build without invoicing', async () => {
    vi.mocked(getE2eNow).mockReturnValue('2026-01-07T12:00:00.000Z');
    window.history.replaceState({}, '', '/welcome?visual=heart-needs-balance');
    await expect(sendHeartTip({ ...BASE, isLocalSunday: true })).resolves.toEqual({
      kind: 'failed',
      reason: 'no_balance',
    });
    await expect(sendHeartTip({ ...BASE, readOnly: true })).resolves.toEqual({ kind: 'noop' });
    expect(postMessageInvoice).not.toHaveBeenCalled();
  });

  it('returns author_cannot_receive for visual=heart-cannot-receive in a Playwright build without invoicing', async () => {
    vi.mocked(getE2eNow).mockReturnValue('2026-01-07T12:00:00.000Z');
    window.history.replaceState({}, '', '/welcome?visual=heart-cannot-receive');
    await expect(sendHeartTip(BASE)).resolves.toEqual({
      kind: 'failed',
      reason: 'author_cannot_receive',
    });
    expect(postMessageInvoice).not.toHaveBeenCalled();
  });

  it('ignores visual=heart-cannot-receive in a production build and still pays', async () => {
    window.history.replaceState({}, '', '/welcome?visual=heart-cannot-receive');
    const send = vi.fn(async () => ({ kind: 'paid' as const }));
    vi.mocked(postMessageInvoice).mockResolvedValue(HEART_INVOICE);
    vi.mocked(payFromWallet).mockResolvedValue({
      kind: 'confirm',
      amountSats: 1,
      feeSats: 0,
      method: 'spark',
      send,
    });
    await expect(sendHeartTip({ ...BASE, messageId: 'pin-prod-cr' })).resolves.toEqual({
      kind: 'paid',
    });
    expect(postMessageInvoice).toHaveBeenCalledTimes(1);
  });

  it('stays silent when signed out or read-only even with visual=heart-paid in Playwright', async () => {
    vi.mocked(getE2eNow).mockReturnValue('2026-01-07T12:00:00.000Z');
    window.history.replaceState({}, '', '/welcome?visual=heart-paid');
    await expect(sendHeartTip({ ...BASE, sessionToken: null })).resolves.toEqual({ kind: 'noop' });
    await expect(sendHeartTip({ ...BASE, readOnly: true })).resolves.toEqual({ kind: 'noop' });
    expect(postMessageInvoice).not.toHaveBeenCalled();
  });

  it('does not send when sparkInvoice is empty', async () => {
    vi.mocked(postMessageInvoice).mockResolvedValue({
      pr: 'lnbc1',
      amountSats: 1,
      sparkInvoice: '',
    });
    await expect(sendHeartTip(BASE)).resolves.toEqual({
      kind: 'failed',
      reason: 'heart_unavailable',
    });
    expect(payFromWallet).not.toHaveBeenCalled();
  });
});

describe('sendHeartTip error report', () => {
  it('reports a heart that was not sent with its reason code and the message id only', async () => {
    vi.mocked(postMessageInvoice).mockRejectedValueOnce(new Error('HEART_UNAVAILABLE'));
    await sendHeartTip({ ...BASE, messageId: 'r-unavailable' });
    expect(captureMessage).toHaveBeenCalledTimes(1);
    expect(captureMessage).toHaveBeenCalledWith('Heart not sent', {
      level: 'error',
      fingerprint: ['heart-not-sent', 'heart_unavailable'],
      tags: { heart_reason: 'heart_unavailable' },
      extra: { messageId: 'r-unavailable' },
    });
  });

  it('reports each local refusal with its own reason code', async () => {
    await sendHeartTip({ ...BASE, isLocalSunday: true });
    await sendHeartTip({ ...BASE, needsWalletSetup: true });
    expect(vi.mocked(captureMessage).mock.calls.map((call) => call[1])).toEqual([
      expect.objectContaining({ tags: { heart_reason: 'sunday' } }),
      expect.objectContaining({ tags: { heart_reason: 'wallet_setup_due' } }),
    ]);
    expect(postMessageInvoice).not.toHaveBeenCalled();
  });

  it('does not report a paid heart, a silent tap, or a balance known missing before the tap', async () => {
    const send = vi.fn(async () => ({ kind: 'paid' as const }));
    vi.mocked(postMessageInvoice).mockResolvedValue(HEART_INVOICE);
    vi.mocked(payFromWallet).mockResolvedValue({
      kind: 'confirm',
      amountSats: 1,
      feeSats: 0,
      method: 'spark',
      send,
    });
    await expect(sendHeartTip(BASE)).resolves.toEqual({ kind: 'paid' });
    await expect(sendHeartTip({ ...BASE, readOnly: true })).resolves.toEqual({ kind: 'noop' });
    await expect(sendHeartTip({ ...BASE, balanceSats: 0 })).resolves.toEqual({
      kind: 'failed',
      reason: 'no_balance',
    });
    expect(captureMessage).not.toHaveBeenCalled();
  });

  it('reports a balance the wallet finds too low only after the tap', async () => {
    vi.mocked(postMessageInvoice).mockResolvedValue(HEART_INVOICE);
    vi.mocked(payFromWallet).mockResolvedValueOnce({ kind: 'insufficient', failure: LOW });
    await expect(sendHeartTip({ ...BASE, messageId: 'r-insufficient' })).resolves.toEqual({
      kind: 'failed',
      reason: 'insufficient_balance',
    });
    expect(captureMessage).toHaveBeenCalledWith('Heart not sent', {
      level: 'error',
      fingerprint: ['heart-not-sent', 'insufficient_balance'],
      tags: { heart_reason: 'insufficient_balance' },
      extra: { messageId: 'r-insufficient' },
    });
  });
});

describe('sendHeartTip after a send timed out', () => {
  /**
   * Prepares a heart whose send times out, sends it, and expects `pending`.
   *
   * @param messageId - Note id, unique per test because the guard is per tab.
   * @param sparkInvoice - Spark invoice of that heart.
   * @returns Resolves after the timed-out heart.
   */
  async function timeOutHeart(messageId: string, sparkInvoice: string): Promise<void> {
    const send = vi.fn(async () => ({
      kind: 'failed' as const,
      failure: TIMEOUT,
      sentLate: new Promise<boolean>(() => undefined),
    }));
    vi.mocked(postMessageInvoice).mockResolvedValueOnce({ ...HEART_INVOICE, sparkInvoice });
    vi.mocked(payFromWallet).mockResolvedValueOnce({
      kind: 'confirm',
      amountSats: 1,
      feeSats: 0,
      method: 'spark',
      send,
    });
    await expect(sendHeartTip({ ...BASE, messageId })).resolves.toEqual({
      kind: 'failed',
      reason: 'timeout_pending',
    });
    expect(send).toHaveBeenCalledTimes(1);
  }

  /**
   * Prepares a heart that pays at once on the next prepare.
   *
   * @returns The send spy.
   */
  function payNext(): ReturnType<typeof vi.fn> {
    const send = vi.fn(async () => ({ kind: 'paid' as const }));
    vi.mocked(postMessageInvoice).mockResolvedValue(HEART_INVOICE);
    vi.mocked(payFromWallet).mockResolvedValue({
      kind: 'confirm',
      amountSats: 1,
      feeSats: 0,
      method: 'spark',
      send,
    });
    return send;
  }

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('does not pay again on a retap while the payment is pending or not listed yet', async () => {
    await timeOutHeart('t-pending', 'spark1pending');
    vi.mocked(postMessageInvoice).mockClear();
    vi.mocked(listWalletPayments).mockResolvedValueOnce([sentPayment('spark1pending', 'pending')]);
    await expect(sendHeartTip({ ...BASE, messageId: 't-pending' })).resolves.toEqual({
      kind: 'failed',
      reason: 'timeout_pending',
    });
    vi.mocked(listWalletPayments).mockResolvedValueOnce([
      sentPayment('spark1other', 'completed'),
      sentPayment('spark1pending', 'completed', 'received'),
    ]);
    await expect(sendHeartTip({ ...BASE, messageId: 't-pending' })).resolves.toEqual({
      kind: 'failed',
      reason: 'timeout_pending',
    });
    vi.mocked(listWalletPayments).mockRejectedValueOnce(new Error('wallet-connect'));
    await expect(sendHeartTip({ ...BASE, messageId: 't-pending' })).resolves.toEqual({
      kind: 'failed',
      reason: 'timeout_pending',
    });
    expect(postMessageInvoice).not.toHaveBeenCalled();
    expect(listWalletPayments).toHaveBeenCalledWith({ offset: 0, limit: 50 });
  });

  it('counts a completed earlier heart as paid without a new invoice, then pays as usual', async () => {
    await timeOutHeart('t-done', 'spark1done');
    vi.mocked(postMessageInvoice).mockClear();
    vi.mocked(listWalletPayments).mockResolvedValueOnce([sentPayment('spark1done', 'completed')]);
    await expect(sendHeartTip({ ...BASE, messageId: 't-done' })).resolves.toEqual({
      kind: 'paid',
    });
    expect(postMessageInvoice).not.toHaveBeenCalled();
    const send = payNext();
    await expect(sendHeartTip({ ...BASE, messageId: 't-done' })).resolves.toEqual({
      kind: 'paid',
    });
    expect(postMessageInvoice).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('sends a new heart once the earlier payment failed', async () => {
    await timeOutHeart('t-failed', 'spark1failed');
    vi.mocked(listWalletPayments).mockResolvedValueOnce([sentPayment('spark1failed', 'failed')]);
    const send = payNext();
    await expect(sendHeartTip({ ...BASE, messageId: 't-failed' })).resolves.toEqual({
      kind: 'paid',
    });
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('sends a new heart once the earlier one is still not listed after the window', async () => {
    const now = vi.spyOn(Date, 'now').mockReturnValue(1_000_000);
    await timeOutHeart('t-missing', 'spark1missing');
    now.mockReturnValue(1_000_000 + HEART_TIP_UNSETTLED_MS - 1);
    await expect(sendHeartTip({ ...BASE, messageId: 't-missing' })).resolves.toEqual({
      kind: 'failed',
      reason: 'timeout_pending',
    });
    now.mockReturnValue(1_000_000 + HEART_TIP_UNSETTLED_MS);
    const send = payNext();
    await expect(sendHeartTip({ ...BASE, messageId: 't-missing' })).resolves.toEqual({
      kind: 'paid',
    });
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('records a heart sent late and counts it as paid on the retap without a new invoice', async () => {
    let late: (sent: boolean) => void = () => undefined;
    const sentLate = new Promise<boolean>((resolve) => {
      late = resolve;
    });
    vi.mocked(postMessageInvoice).mockResolvedValue(HEART_INVOICE);
    vi.mocked(payFromWallet).mockResolvedValue({
      kind: 'confirm',
      amountSats: 1,
      feeSats: 0,
      method: 'spark',
      send: async () => ({ kind: 'failed', failure: TIMEOUT, sentLate }),
    });
    await expect(sendHeartTip({ ...BASE, messageId: 't-late' })).resolves.toEqual({
      kind: 'failed',
      reason: 'timeout_pending',
    });
    expect(logInteraction).not.toHaveBeenCalled();
    late(true);
    await sentLate;
    await Promise.resolve();
    expect(logInteraction).toHaveBeenCalledWith(
      'heart_sent',
      { messageId: 't-late', amountSats: 1 },
      'sess',
    );
    vi.mocked(postMessageInvoice).mockClear();
    await expect(sendHeartTip({ ...BASE, messageId: 't-late' })).resolves.toEqual({
      kind: 'paid',
    });
    expect(postMessageInvoice).not.toHaveBeenCalled();
    expect(listWalletPayments).not.toHaveBeenCalled();
  });

  it('forgets a heart whose late send failed and does not record it', async () => {
    const sentLate = Promise.resolve(false);
    vi.mocked(postMessageInvoice).mockResolvedValue(HEART_INVOICE);
    vi.mocked(payFromWallet).mockResolvedValueOnce({
      kind: 'confirm',
      amountSats: 1,
      feeSats: 0,
      method: 'spark',
      send: async () => ({ kind: 'failed', failure: TIMEOUT, sentLate }),
    });
    await expect(sendHeartTip({ ...BASE, messageId: 't-late-failed' })).resolves.toEqual({
      kind: 'failed',
      reason: 'timeout_pending',
    });
    await sentLate;
    await Promise.resolve();
    expect(logInteraction).not.toHaveBeenCalled();
    const send = payNext();
    await expect(sendHeartTip({ ...BASE, messageId: 't-late-failed' })).resolves.toEqual({
      kind: 'paid',
    });
    expect(send).toHaveBeenCalledTimes(1);
    expect(listWalletPayments).not.toHaveBeenCalled();
  });

  it('keeps a newer timed-out heart when an older late send fails', async () => {
    let lateOld: (sent: boolean) => void = () => undefined;
    const oldSentLate = new Promise<boolean>((resolve) => {
      lateOld = resolve;
    });
    vi.mocked(postMessageInvoice).mockResolvedValue(HEART_INVOICE);
    vi.mocked(payFromWallet).mockResolvedValueOnce({
      kind: 'confirm',
      amountSats: 1,
      feeSats: 0,
      method: 'spark',
      send: async () => ({ kind: 'failed', failure: TIMEOUT, sentLate: oldSentLate }),
    });
    await sendHeartTip({ ...BASE, messageId: 't-two' });
    vi.mocked(listWalletPayments).mockResolvedValueOnce([sentPayment('spark1heart', 'failed')]);
    vi.mocked(payFromWallet).mockResolvedValueOnce({
      kind: 'confirm',
      amountSats: 1,
      feeSats: 0,
      method: 'spark',
      send: async () => ({
        kind: 'failed',
        failure: TIMEOUT,
        sentLate: new Promise<boolean>(() => undefined),
      }),
    });
    await expect(sendHeartTip({ ...BASE, messageId: 't-two' })).resolves.toEqual({
      kind: 'failed',
      reason: 'timeout_pending',
    });
    lateOld(false);
    await oldSentLate;
    await Promise.resolve();
    vi.mocked(postMessageInvoice).mockClear();
    await expect(sendHeartTip({ ...BASE, messageId: 't-two' })).resolves.toEqual({
      kind: 'failed',
      reason: 'timeout_pending',
    });
    expect(postMessageInvoice).not.toHaveBeenCalled();
  });

  it('maps a failed send without sentLate to request and keeps no heart pending', async () => {
    const failed = vi.fn(async () => ({ kind: 'failed' as const, failure: SEND_FAILED }));
    vi.mocked(postMessageInvoice).mockResolvedValue(HEART_INVOICE);
    vi.mocked(payFromWallet).mockResolvedValueOnce({
      kind: 'confirm',
      amountSats: 1,
      feeSats: 0,
      method: 'spark',
      send: failed,
    });
    await expect(sendHeartTip({ ...BASE, messageId: 't-rejected' })).resolves.toEqual({
      kind: 'failed',
      reason: 'payment_failed',
    });
    const send = payNext();
    await expect(sendHeartTip({ ...BASE, messageId: 't-rejected' })).resolves.toEqual({
      kind: 'paid',
    });
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('does not start a second heart on a note while one is still sending', async () => {
    let finish: ((value: { kind: 'paid' }) => void) | undefined;
    const send = vi
      .fn(async () => ({ kind: 'paid' as const }))
      .mockImplementationOnce(
        () =>
          new Promise<{ kind: 'paid' }>((resolve) => {
            finish = resolve;
          }),
      );
    vi.mocked(postMessageInvoice).mockResolvedValue(HEART_INVOICE);
    vi.mocked(payFromWallet).mockResolvedValue({
      kind: 'confirm',
      amountSats: 1,
      feeSats: 0,
      method: 'spark',
      send,
    });
    const first = sendHeartTip({ ...BASE, messageId: 't-flight' });
    await vi.waitFor(() => {
      expect(send).toHaveBeenCalledTimes(1);
    });
    await expect(sendHeartTip({ ...BASE, messageId: 't-flight' })).resolves.toEqual({
      kind: 'failed',
      reason: 'in_flight',
    });
    expect(postMessageInvoice).toHaveBeenCalledTimes(1);
    finish?.({ kind: 'paid' });
    await expect(first).resolves.toEqual({ kind: 'paid' });
    await expect(sendHeartTip({ ...BASE, messageId: 't-flight' })).resolves.toEqual({
      kind: 'paid',
    });
    expect(postMessageInvoice).toHaveBeenCalledTimes(2);
  });

  it('counts a heart as paid when sentLate reports it while the payment list is read', async () => {
    let late: (sent: boolean) => void = () => undefined;
    const sentLate = new Promise<boolean>((resolve) => {
      late = resolve;
    });
    vi.mocked(postMessageInvoice).mockResolvedValue(HEART_INVOICE);
    vi.mocked(payFromWallet).mockResolvedValueOnce({
      kind: 'confirm',
      amountSats: 1,
      feeSats: 0,
      method: 'spark',
      send: async () => ({ kind: 'failed', failure: TIMEOUT, sentLate }),
    });
    const now = vi.spyOn(Date, 'now').mockReturnValue(2_000_000);
    await sendHeartTip({ ...BASE, messageId: 't-race' });
    now.mockReturnValue(2_000_000 + HEART_TIP_UNSETTLED_MS);
    let listed: (payments: WalletPayment[]) => void = () => undefined;
    vi.mocked(listWalletPayments).mockReturnValueOnce(
      new Promise<WalletPayment[]>((resolve) => {
        listed = resolve;
      }),
    );
    vi.mocked(postMessageInvoice).mockClear();
    const retap = sendHeartTip({ ...BASE, messageId: 't-race' });
    await vi.waitFor(() => {
      expect(listWalletPayments).toHaveBeenCalledTimes(1);
    });
    late(true);
    await sentLate;
    await Promise.resolve();
    listed([]);
    await expect(retap).resolves.toEqual({ kind: 'paid' });
    expect(postMessageInvoice).not.toHaveBeenCalled();
    expect(logInteraction).toHaveBeenCalledTimes(1);
  });

  it('keeps a timed-out heart to its own note', async () => {
    await timeOutHeart('t-own', 'spark1own');
    const send = payNext();
    await expect(sendHeartTip({ ...BASE, messageId: 't-other' })).resolves.toEqual({
      kind: 'paid',
    });
    expect(send).toHaveBeenCalledTimes(1);
  });
});

const HEART_ACCOUNT: Account = {
  id: 'acc_1',
  linkingKey: null,
  role: 'basis',
  name: 'Ada',
  location: null,
  lightningAddress: null,
  lightningAddressVerified: false,
  forumLawsDismissed: false,
  createdAt: 1,
  rulesAgreedAt: 1_700_000_001,
  viewKey: 'a'.repeat(64),
  aboutMe: null,
  aboutMeHasPhoto: false,
  setup: null,
  missing: [],
};

async function clickHeart(
  result: { current: { onHeartTip: (messageId: string) => void } },
  messageId = 'm1',
): Promise<void> {
  await act(async () => {
    result.current.onHeartTip(messageId);
    for (let tick = 0; tick < 12; tick += 1) {
      await Promise.resolve();
    }
  });
}

describe('endHeartPlusOne', () => {
  it('returns the same object when the id has no row', () => {
    const prev = { m2: { pressed: true, plusOne: true, needsBalance: false } };
    expect(endHeartPlusOne(prev, 'm1')).toBe(prev);
  });

  it('ends plusOne and clears pressed when extra is missing', () => {
    const prev = {
      m1: { pressed: true, plusOne: true, needsBalance: true },
      m2: { pressed: true, plusOne: false, needsBalance: false, extra: 1 },
    };
    expect(endHeartPlusOne(prev, 'm1')).toEqual({
      m1: { pressed: false, plusOne: false, needsBalance: true },
      m2: { pressed: true, plusOne: false, needsBalance: false, extra: 1 },
    });
  });

  it('ends plusOne and stays pressed when extra is 2', () => {
    const prev = {
      m1: { pressed: true, plusOne: true, needsBalance: true, extra: 2 },
    };
    expect(endHeartPlusOne(prev, 'm1')).toEqual({
      m1: { pressed: true, plusOne: false, needsBalance: true, extra: 2 },
    });
  });
});

describe('useHeartTip', () => {
  beforeEach(() => {
    useAuthStore.setState({ session: 'sess', account: HEART_ACCOUNT });
    useWalletStore.setState({ status: 'ready', balanceSats: 21, identityPubkey: null });
    const send = vi.fn(async () => ({ kind: 'paid' as const }));
    vi.mocked(postMessageInvoice).mockResolvedValue(HEART_INVOICE);
    vi.mocked(payFromWallet).mockResolvedValue({
      kind: 'confirm',
      amountSats: 1,
      feeSats: 0,
      method: 'spark',
      send,
    });
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    Reflect.deleteProperty(navigator, 'vibrate');
  });

  it('vibrates and shows the press and +1 before the payment resolves', async () => {
    const vibrate = vi.fn();
    Object.defineProperty(navigator, 'vibrate', { configurable: true, value: vibrate });
    let resolveInvoice: ((value: typeof HEART_INVOICE) => void) | undefined;
    vi.mocked(postMessageInvoice).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveInvoice = resolve;
        }),
    );
    const { result } = renderHook(() => useHeartTip({ readOnly: false }));
    act(() => {
      result.current.onHeartTip('h-early');
    });
    expect(vibrate).toHaveBeenCalledWith(10);
    expect(result.current.heartTipViews['h-early']).toEqual({
      pressed: true,
      plusOne: true,
      needsBalance: false,
      extra: 1,
    });
    expect(payFromWallet).not.toHaveBeenCalled();
    await vi.waitFor(() => {
      expect(postMessageInvoice).toHaveBeenCalledTimes(1);
    });
    await act(async () => {
      resolveInvoice?.(HEART_INVOICE);
      await vi.waitFor(() => {
        expect(logInteraction).toHaveBeenCalledTimes(1);
      });
    });
    expect(postMessageInvoice).toHaveBeenCalledWith(
      'sess',
      'h-early',
      1,
      undefined,
      undefined,
      true,
    );
  });

  it('clears only plusOne after HEART_TIP_PLUS_ONE_MS from the tap', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const { result } = renderHook(() => useHeartTip({ readOnly: false }));
    await clickHeart(result);
    expect(result.current.heartTipViews['m1']).toEqual({
      pressed: true,
      plusOne: true,
      needsBalance: false,
      extra: 1,
    });
    act(() => {
      vi.advanceTimersByTime(HEART_TIP_PLUS_ONE_MS - 1);
    });
    expect(result.current.heartTipViews['m1']?.plusOne).toBe(true);
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current.heartTipViews['m1']).toEqual({
      pressed: true,
      plusOne: false,
      needsBalance: false,
      extra: 1,
    });
  });

  it('shows nothing more when the heart fails, and reports it', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    vi.mocked(postMessageInvoice).mockRejectedValue(new Error('HEART_UNAVAILABLE'));
    const { result } = renderHook(() => useHeartTip({ readOnly: false }));
    await clickHeart(result, 'h-fail');
    expect(captureMessage).toHaveBeenCalledWith(
      'Heart not sent',
      expect.objectContaining({
        tags: { heart_reason: 'heart_unavailable' },
        extra: { messageId: 'h-fail' },
      }),
    );
    expect(result.current.heartTipViews['h-fail']).toEqual({
      pressed: true,
      plusOne: true,
      needsBalance: false,
      extra: 0,
    });
    act(() => {
      vi.advanceTimersByTime(HEART_TIP_PLUS_ONE_MS);
    });
    expect(result.current.heartTipViews['h-fail']).toEqual({
      pressed: false,
      plusOne: false,
      needsBalance: false,
      extra: 0,
    });
  });

  it('shows the author-wallet line when the api says the author cannot receive', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    vi.mocked(postMessageInvoice).mockRejectedValue(new CannotReceiveError());
    const { result } = renderHook(() => useHeartTip({ readOnly: false }));
    await clickHeart(result, 'h-cannot');
    expect(result.current.heartTipViews['h-cannot']).toEqual({
      pressed: true,
      plusOne: true,
      needsBalance: false,
      extra: 0,
      cannotReceive: true,
    });
    expect(captureMessage).toHaveBeenCalledWith(
      'Heart not sent',
      expect.objectContaining({ tags: { heart_reason: 'author_cannot_receive' } }),
    );
    act(() => {
      vi.advanceTimersByTime(HEART_TIP_PLUS_ONE_MS);
    });
    expect(result.current.heartTipViews['h-cannot']).toEqual({
      pressed: false,
      plusOne: false,
      needsBalance: false,
      extra: 0,
      cannotReceive: true,
    });
  });

  it('keeps the author-wallet line when heartCounts catch up with an earlier heart', async () => {
    sessionStorage.setItem('21gifts.heart.sent', JSON.stringify({ m1: { base: 3, extra: 2 } }));
    vi.mocked(postMessageInvoice).mockRejectedValue(new CannotReceiveError());
    const { result, rerender } = renderHook(
      ({ heartCounts }: { heartCounts: Readonly<Record<string, number>> }) =>
        useHeartTip({ readOnly: false, heartCounts }),
      { initialProps: { heartCounts: { m1: 3 } } },
    );
    await clickHeart(result, 'm1');
    expect(result.current.heartTipViews['m1']?.cannotReceive).toBe(true);
    rerender({ heartCounts: { m1: 4 } });
    expect(result.current.heartTipViews['m1']?.extra).toBe(1);
    expect(result.current.heartTipViews['m1']?.cannotReceive).toBe(true);
  });

  it('shows the press and +1 on a Sunday tap and reports it without invoicing', async () => {
    document.documentElement.dataset['localSunday'] = '1';
    try {
      const { result } = renderHook(() => useHeartTip({ readOnly: false }));
      await clickHeart(result, 'h-sunday');
      expect(result.current.heartTipViews['h-sunday']).toEqual({
        pressed: true,
        plusOne: true,
        needsBalance: false,
        extra: 0,
      });
      expect(postMessageInvoice).not.toHaveBeenCalled();
      expect(captureMessage).toHaveBeenCalledWith(
        'Heart not sent',
        expect.objectContaining({ tags: { heart_reason: 'sunday' } }),
      );
    } finally {
      delete document.documentElement.dataset['localSunday'];
    }
  });

  it('shows only the balance line, without vibrate, press, or +1, when the ready wallet is empty', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const vibrate = vi.fn();
    Object.defineProperty(navigator, 'vibrate', { configurable: true, value: vibrate });
    useWalletStore.setState({ status: 'ready', balanceSats: 0, identityPubkey: null });
    const { result } = renderHook(() => useHeartTip({ readOnly: false }));
    await clickHeart(result);
    expect(result.current.heartTipViews['m1']).toEqual({
      pressed: false,
      plusOne: false,
      needsBalance: true,
      extra: 0,
    });
    expect(vibrate).not.toHaveBeenCalled();
    expect(postMessageInvoice).not.toHaveBeenCalled();
    expect(captureMessage).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(HEART_TIP_PLUS_ONE_MS);
    });
    expect(result.current.heartTipViews['m1']?.needsBalance).toBe(true);
  });

  it('replaces the balance line with the press and +1 once the wallet has a balance', async () => {
    useWalletStore.setState({ status: 'ready', balanceSats: 0, identityPubkey: null });
    const { result } = renderHook(() => useHeartTip({ readOnly: false }));
    await clickHeart(result);
    expect(result.current.heartTipViews['m1']?.needsBalance).toBe(true);
    useWalletStore.setState({ status: 'ready', balanceSats: 21, identityPubkey: null });
    await clickHeart(result);
    expect(result.current.heartTipViews['m1']).toEqual({
      pressed: true,
      plusOne: true,
      needsBalance: false,
      extra: 1,
    });
  });

  it('shows the balance line for visual=heart-needs-balance in a Playwright build', async () => {
    vi.mocked(getE2eNow).mockReturnValue('2026-01-07T12:00:00.000Z');
    window.history.replaceState({}, '', '/welcome?visual=heart-needs-balance');
    const { result } = renderHook(() => useHeartTip({ readOnly: false }));
    await clickHeart(result);
    expect(result.current.heartTipViews['m1']).toEqual({
      pressed: false,
      plusOne: false,
      needsBalance: true,
      extra: 0,
    });
    expect(postMessageInvoice).not.toHaveBeenCalled();
  });

  it('keeps plusOne on screen when visual=heart-paid', async () => {
    vi.mocked(getE2eNow).mockReturnValue('2026-01-07T12:00:00.000Z');
    window.history.replaceState({}, '', '/welcome?visual=heart-paid');
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const { result } = renderHook(() => useHeartTip({ readOnly: false }));
    await clickHeart(result);
    expect(postMessageInvoice).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(HEART_TIP_PLUS_ONE_MS);
    });
    expect(result.current.heartTipViews['m1']).toEqual({
      pressed: true,
      plusOne: true,
      needsBalance: false,
      extra: 1,
    });
  });

  it('still pays when navigator.vibrate is missing', async () => {
    Reflect.deleteProperty(navigator, 'vibrate');
    const { result } = renderHook(() => useHeartTip({ readOnly: false }));
    await clickHeart(result);
    expect(result.current.heartTipViews['m1']).toEqual({
      pressed: true,
      plusOne: true,
      needsBalance: false,
      extra: 1,
    });
    expect(logInteraction).toHaveBeenCalledTimes(1);
  });

  it('shows the +1 on a retap while a heart is still sending, without paying twice', async () => {
    let resolveInvoice: ((value: typeof HEART_INVOICE) => void) | undefined;
    vi.mocked(postMessageInvoice).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveInvoice = resolve;
        }),
    );
    const { result } = renderHook(() => useHeartTip({ readOnly: false }));
    await clickHeart(result, 'h-twice');
    await clickHeart(result, 'h-twice');
    expect(result.current.heartTipViews['h-twice']).toEqual({
      pressed: true,
      plusOne: true,
      needsBalance: false,
      extra: 1,
    });
    expect(postMessageInvoice).toHaveBeenCalledTimes(1);
    expect(captureMessage).toHaveBeenCalledWith(
      'Heart not sent',
      expect.objectContaining({ tags: { heart_reason: 'in_flight' } }),
    );
    await act(async () => {
      resolveInvoice?.(HEART_INVOICE);
      await vi.waitFor(() => {
        expect(logInteraction).toHaveBeenCalledTimes(1);
      });
    });
    expect(postMessageInvoice).toHaveBeenCalledTimes(1);
  });

  it('starts another send on a second click after the first one finished', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const { result } = renderHook(() => useHeartTip({ readOnly: false }));
    await clickHeart(result);
    await clickHeart(result);
    expect(postMessageInvoice).toHaveBeenCalledTimes(2);
    expect(Object.keys(result.current.heartTipViews)).toEqual(['m1']);
    act(() => {
      vi.advanceTimersByTime(HEART_TIP_PLUS_ONE_MS);
    });
    expect(result.current.heartTipViews['m1']).toEqual({
      pressed: true,
      plusOne: false,
      needsBalance: false,
      extra: 2,
    });
  });

  it('does not throw when unmounted during the plusOne window', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const { result, unmount } = renderHook(() => useHeartTip({ readOnly: false }));
    await clickHeart(result);
    expect(result.current.heartTipViews['m1']?.plusOne).toBe(true);
    unmount();
    act(() => {
      vi.advanceTimersByTime(HEART_TIP_PLUS_ONE_MS);
    });
  });

  it('shows the +1 on a retap after a timed-out heart, and does not pay again', async () => {
    const send = vi.fn(async () => ({
      kind: 'failed' as const,
      failure: TIMEOUT,
      sentLate: new Promise<boolean>(() => undefined),
    }));
    vi.mocked(postMessageInvoice).mockResolvedValue({
      ...HEART_INVOICE,
      sparkInvoice: 'spark1hook',
    });
    vi.mocked(payFromWallet).mockResolvedValue({
      kind: 'confirm',
      amountSats: 1,
      feeSats: 0,
      method: 'spark',
      send,
    });
    vi.mocked(listWalletPayments).mockResolvedValue([sentPayment('spark1hook', 'pending')]);
    const { result } = renderHook(() => useHeartTip({ readOnly: false }));
    await clickHeart(result, 'h-timeout');
    await clickHeart(result, 'h-timeout');
    expect(result.current.heartTipViews['h-timeout']).toEqual({
      pressed: true,
      plusOne: true,
      needsBalance: false,
      extra: 0,
    });
    expect(postMessageInvoice).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledTimes(1);
    expect(vi.mocked(captureMessage).mock.calls.map((call) => call[1])).toEqual([
      expect.objectContaining({ tags: { heart_reason: 'timeout_pending' } }),
      expect.objectContaining({ tags: { heart_reason: 'timeout_pending' } }),
    ]);
  });

  it('does not vibrate or pay when readOnly is true', async () => {
    const vibrate = vi.fn();
    Object.defineProperty(navigator, 'vibrate', { configurable: true, value: vibrate });
    const { result } = renderHook(() => useHeartTip({ readOnly: true }));
    await clickHeart(result);
    expect(vibrate).not.toHaveBeenCalled();
    expect(result.current.heartTipViews['m1']).toBeUndefined();
    expect(postMessageInvoice).not.toHaveBeenCalled();
  });

  it('does not vibrate or pay when the session is null', async () => {
    useAuthStore.setState({ session: null, account: HEART_ACCOUNT });
    const vibrate = vi.fn();
    Object.defineProperty(navigator, 'vibrate', { configurable: true, value: vibrate });
    const { result } = renderHook(() => useHeartTip({ readOnly: false }));
    await clickHeart(result);
    expect(vibrate).not.toHaveBeenCalled();
    expect(result.current.heartTipViews['m1']).toBeUndefined();
    expect(postMessageInvoice).not.toHaveBeenCalled();
  });

  it('keeps a paid heart filled when a later tap fails', async () => {
    const { result } = renderHook(() => useHeartTip({ readOnly: false }));
    await clickHeart(result);
    expect(result.current.heartTipViews['m1']?.extra).toBe(1);
    vi.mocked(postMessageInvoice).mockRejectedValueOnce(new Error('HEART_UNAVAILABLE'));
    await clickHeart(result);
    expect(result.current.heartTipViews['m1']).toEqual({
      pressed: true,
      plusOne: true,
      needsBalance: false,
      extra: 1,
    });
  });

  it('reconciles stored extras against heartCounts by value, not object identity', () => {
    sessionStorage.setItem('21gifts.heart.sent', JSON.stringify({ m1: { base: 3, extra: 2 } }));
    const { result, rerender } = renderHook(
      ({ heartCounts }: { heartCounts: Readonly<Record<string, number>> }) =>
        useHeartTip({ readOnly: false, heartCounts }),
      { initialProps: { heartCounts: { m1: 4 } } },
    );
    expect(result.current.heartTipViews['m1']).toEqual({
      pressed: true,
      plusOne: false,
      needsBalance: false,
      extra: 1,
    });
    expect(JSON.parse(String(sessionStorage.getItem('21gifts.heart.sent')))).toEqual({
      m1: { base: 4, extra: 1 },
    });
    rerender({ heartCounts: { m1: 4 } });
    expect(result.current.heartTipViews['m1']?.extra).toBe(1);
    rerender({ heartCounts: { m1: 5 } });
    expect(result.current.heartTipViews['m1']?.extra).toBe(0);
    expect(JSON.parse(String(sessionStorage.getItem('21gifts.heart.sent')))).toEqual({});
  });

  it('keeps extra on reload when the server count still equals base', () => {
    sessionStorage.setItem('21gifts.heart.sent', JSON.stringify({ m1: { base: 3, extra: 1 } }));
    const { result } = renderHook(() => useHeartTip({ readOnly: false, heartCounts: { m1: 3 } }));
    expect(result.current.heartTipViews['m1']).toEqual({
      pressed: true,
      plusOne: false,
      needsBalance: false,
      extra: 1,
    });
  });

  it('does not throw or restore a heart from invalid JSON in storage', () => {
    sessionStorage.setItem('21gifts.heart.sent', '{');
    const { result } = renderHook(() => useHeartTip({ readOnly: false }));
    expect(result.current.heartTipViews['m1']).toBeUndefined();
  });

  it('does not restore a heart from stored null', () => {
    sessionStorage.setItem('21gifts.heart.sent', 'null');
    const { result } = renderHook(() => useHeartTip({ readOnly: false }));
    expect(result.current.heartTipViews['m1']).toBeUndefined();
  });

  it('does not restore a heart from a stored array', () => {
    sessionStorage.setItem('21gifts.heart.sent', '[]');
    const { result } = renderHook(() => useHeartTip({ readOnly: false }));
    expect(result.current.heartTipViews['m1']).toBeUndefined();
  });

  it('does not restore a heart from a stored string', () => {
    sessionStorage.setItem('21gifts.heart.sent', '"x"');
    const { result } = renderHook(() => useHeartTip({ readOnly: false }));
    expect(result.current.heartTipViews['m1']).toBeUndefined();
  });

  it('restores only a valid stored extra row', () => {
    sessionStorage.setItem(
      '21gifts.heart.sent',
      JSON.stringify({
        a: null,
        b: 'nope',
        c: { base: -1, extra: 1 },
        d: { base: 1, extra: -1 },
        e: { base: 1, extra: 0 },
        f: { base: 1.5, extra: 1 },
        m1: { base: 2, extra: 3 },
      }),
    );
    const { result } = renderHook(() => useHeartTip({ readOnly: false }));
    expect(result.current.heartTipViews).toEqual({
      m1: { pressed: true, plusOne: false, needsBalance: false, extra: 3 },
    });
  });

  it('still pays when sessionStorage is missing', async () => {
    vi.stubGlobal('sessionStorage', undefined);
    try {
      const { result } = renderHook(() => useHeartTip({ readOnly: false }));
      await clickHeart(result);
      expect(postMessageInvoice).toHaveBeenCalled();
      expect(result.current.heartTipViews['m1']?.extra).toBe(1);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('still pays when setItem throws', async () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    try {
      const { result } = renderHook(() => useHeartTip({ readOnly: false }));
      await clickHeart(result);
      expect(postMessageInvoice).toHaveBeenCalled();
      expect(result.current.heartTipViews['m1']?.extra).toBe(1);
    } finally {
      setItem.mockRestore();
    }
  });

  it('stores the server heartCount as base on the first click', async () => {
    const { result } = renderHook(() => useHeartTip({ readOnly: false, heartCounts: { m1: 4 } }));
    await clickHeart(result);
    expect(JSON.parse(String(sessionStorage.getItem('21gifts.heart.sent')))).toEqual({
      m1: { base: 4, extra: 1 },
    });
  });

  it('keeps a session heart filled when a later tap has no balance', async () => {
    const { result } = renderHook(() => useHeartTip({ readOnly: false, heartCounts: { m1: 4 } }));
    await clickHeart(result);
    useWalletStore.setState({ status: 'ready', balanceSats: 0, identityPubkey: null });
    await clickHeart(result);
    expect(result.current.heartTipViews['m1']).toEqual({
      pressed: true,
      plusOne: false,
      needsBalance: true,
      extra: 1,
    });
    expect(postMessageInvoice).toHaveBeenCalledTimes(1);
  });

  it('does not write storage when heartCounts grow without a stored row', () => {
    const { rerender } = renderHook(
      ({ heartCounts }: { heartCounts: Readonly<Record<string, number>> }) =>
        useHeartTip({ readOnly: false, heartCounts }),
      { initialProps: { heartCounts: { other: 1 } } },
    );
    rerender({ heartCounts: { other: 2 } });
    expect(sessionStorage.getItem('21gifts.heart.sent')).toBeNull();
  });
});

describe('sendHeartTip payment_failed record', () => {
  /** A prepared heart of 1 sat at ₿0 whose send gives `result`. */
  function heartConfirm(send: () => Promise<WalletSendResult>): WalletPayResult {
    return { kind: 'confirm', amountSats: 1, feeSats: 0, method: 'spark', send };
  }

  beforeEach(() => {
    vi.mocked(postMessageInvoice).mockResolvedValue(HEART_INVOICE);
  });

  it('records a failed prepare under heart, 1 sat, and the click session', async () => {
    vi.mocked(payFromWallet).mockResolvedValue({ kind: 'failed', failure: FAILED });
    await sendHeartTip({ ...BASE, messageId: 'rec-prepare' });
    expect(reportPaymentFailure).toHaveBeenCalledTimes(1);
    expect(reportPaymentFailure).toHaveBeenCalledWith({ ...FAILED, amountSats: 1 }, 'heart', {
      session: 'sess',
      sentLate: undefined,
    });
  });

  it.each([
    ['the wallet cannot be unlocked here', { canUnlockWallet: false }, undefined],
    ['unlocking is cancelled', {}, 'cancelled' as const],
  ])('records the unlock when %s', async (_label, input, unlocked) => {
    vi.mocked(payFromWallet).mockResolvedValue({ kind: 'unlock', failure: UNLOCK });
    if (unlocked !== undefined) {
      vi.mocked(unlockWalletPhrase).mockResolvedValue(unlocked);
    }
    await sendHeartTip({ ...BASE, ...input, messageId: `rec-unlock-${_label}` });
    expect(reportPaymentFailure).toHaveBeenCalledWith({ ...UNLOCK, amountSats: 1 }, 'heart', {
      session: 'sess',
      sentLate: undefined,
    });
  });

  it('records nothing for an unlock that is followed by a paid heart', async () => {
    vi.mocked(payFromWallet)
      .mockResolvedValueOnce({ kind: 'unlock', failure: UNLOCK })
      .mockResolvedValueOnce(heartConfirm(async () => ({ kind: 'paid' })));
    vi.mocked(unlockWalletPhrase).mockResolvedValue('unlocked');
    await expect(sendHeartTip({ ...BASE, messageId: 'rec-unlocked' })).resolves.toEqual({
      kind: 'paid',
    });
    expect(reportPaymentFailure).not.toHaveBeenCalled();
  });

  it('records a prepared heart that is not 1 sat at ₿0 as amount_mismatch', async () => {
    vi.mocked(payFromWallet).mockResolvedValue({
      kind: 'confirm',
      amountSats: 1,
      feeSats: 2,
      method: 'spark',
      send: async () => ({ kind: 'paid' }),
    });
    await sendHeartTip({ ...BASE, messageId: 'rec-mismatch' });
    expect(reportPaymentFailure).toHaveBeenCalledWith(
      { stage: 'prepare', reason: 'amount_mismatch', method: 'spark', amountSats: 1, feeSats: 2 },
      'heart',
      { session: 'sess', sentLate: undefined },
    );
  });

  it('records a confirmed heart the live zero balance cannot cover as insufficient', async () => {
    vi.mocked(payFromWallet).mockResolvedValue(heartConfirm(async () => ({ kind: 'paid' })));
    useWalletStore.setState({ status: 'ready', balanceSats: 0 });
    await sendHeartTip({ ...BASE, messageId: 'rec-zero' });
    expect(reportPaymentFailure).toHaveBeenCalledWith(
      { stage: 'prepare', reason: 'insufficient', method: 'spark', amountSats: 1, feeSats: 0 },
      'heart',
      { session: 'sess', sentLate: undefined },
    );
  });

  it('records a failed send, and a timed-out one with its late outcome', async () => {
    vi.mocked(payFromWallet).mockResolvedValueOnce(
      heartConfirm(async () => ({ kind: 'insufficient', failure: SEND_LOW })),
    );
    await sendHeartTip({ ...BASE, messageId: 'rec-send' });
    expect(reportPaymentFailure).toHaveBeenLastCalledWith(SEND_LOW, 'heart', {
      session: 'sess',
      sentLate: undefined,
    });
    const sentLate = new Promise<boolean>(() => undefined);
    vi.mocked(payFromWallet).mockResolvedValueOnce(
      heartConfirm(async () => ({ kind: 'failed', failure: TIMEOUT, sentLate })),
    );
    await sendHeartTip({ ...BASE, messageId: 'rec-timeout' });
    expect(reportPaymentFailure).toHaveBeenLastCalledWith(TIMEOUT, 'heart', {
      session: 'sess',
      sentLate,
    });
  });

  it('records nothing for a paid heart', async () => {
    vi.mocked(payFromWallet).mockResolvedValue(heartConfirm(async () => ({ kind: 'paid' })));
    await sendHeartTip({ ...BASE, messageId: 'rec-paid' });
    expect(reportPaymentFailure).not.toHaveBeenCalled();
  });
});
