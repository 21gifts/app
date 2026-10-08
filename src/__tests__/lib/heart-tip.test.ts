import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CannotReceiveError, postMessageInvoice, WalletRequiredError } from '@/lib/api';
import type { Account } from '@/lib/api-types';
import { getE2eNow } from '@/lib/config';
import {
  HEART_TIP_PLUS_ONE_MS,
  HEART_TIP_UNSETTLED_MS,
  sendHeartTip,
  useHeartTip,
} from '@/lib/heart-tip';
import { unlockWalletPhrase } from '@/lib/wallet/wallet-phrase';
import { logInteraction } from '@/lib/interaction-log';
import type { WalletPayment } from '@/lib/wallet/wallet-sdk';
import { listWalletPayments, payFromWallet } from '@/lib/wallet/wallet-service';
import { useAuthStore } from '@/stores/auth-store';
import { useWalletStore } from '@/stores/wallet-store';

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
  vi.mocked(getE2eNow).mockReset().mockReturnValue(null);
  vi.mocked(postMessageInvoice).mockReset();
  vi.mocked(payFromWallet).mockReset();
  vi.mocked(listWalletPayments).mockReset().mockResolvedValue([]);
  vi.mocked(unlockWalletPhrase).mockReset();
  vi.mocked(logInteraction).mockClear();
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
    await expect(sendHeartTip(BASE)).resolves.toEqual({ kind: 'alert', alert: 'unavailable' });
    vi.mocked(postMessageInvoice).mockResolvedValue({
      pr: 'lnbc1',
      amountSats: 1,
      sparkInvoice: null,
    });
    await expect(sendHeartTip(BASE)).resolves.toEqual({ kind: 'alert', alert: 'unavailable' });
    expect(payFromWallet).not.toHaveBeenCalled();
  });

  it('does not send when the fee is above zero', async () => {
    const send = vi.fn(async () => ({ kind: 'paid' as const }));
    vi.mocked(postMessageInvoice).mockResolvedValue(HEART_INVOICE);
    vi.mocked(payFromWallet).mockResolvedValue({
      kind: 'confirm',
      amountSats: 1,
      feeSats: 1,
      send,
    });
    await expect(sendHeartTip(BASE)).resolves.toEqual({ kind: 'alert', alert: 'unavailable' });
    expect(send).not.toHaveBeenCalled();
  });

  it('does not send when the prepared amount is not 1 sat', async () => {
    const send = vi.fn(async () => ({ kind: 'paid' as const }));
    vi.mocked(postMessageInvoice).mockResolvedValue(HEART_INVOICE);
    vi.mocked(payFromWallet).mockResolvedValue({
      kind: 'confirm',
      amountSats: 2,
      feeSats: 0,
      send,
    });
    await expect(sendHeartTip(BASE)).resolves.toEqual({ kind: 'alert', alert: 'unavailable' });
    vi.mocked(payFromWallet).mockResolvedValue({
      kind: 'confirm',
      amountSats: 0,
      feeSats: 0,
      send,
    });
    await expect(sendHeartTip(BASE)).resolves.toEqual({ kind: 'alert', alert: 'unavailable' });
    expect(send).not.toHaveBeenCalled();
  });

  it('does not send when the prepare after unlock is not 1 sat fee-free', async () => {
    const send = vi.fn(async () => ({ kind: 'paid' as const }));
    vi.mocked(postMessageInvoice).mockResolvedValue(HEART_INVOICE);
    vi.mocked(payFromWallet)
      .mockResolvedValueOnce({ kind: 'unlock' })
      .mockResolvedValueOnce({ kind: 'confirm', amountSats: 1, feeSats: 3, send });
    vi.mocked(unlockWalletPhrase).mockResolvedValue('unlocked');
    await expect(
      sendHeartTip({ ...BASE, walletStatus: 'locked', balanceSats: null }),
    ).resolves.toEqual({ kind: 'alert', alert: 'unavailable' });
    expect(send).not.toHaveBeenCalled();
  });

  it('maps the api HEART_UNAVAILABLE refusal to unavailable', async () => {
    vi.mocked(postMessageInvoice).mockRejectedValueOnce(new Error('HEART_UNAVAILABLE'));
    await expect(sendHeartTip(BASE)).resolves.toEqual({ kind: 'alert', alert: 'unavailable' });
    expect(payFromWallet).not.toHaveBeenCalled();
  });

  it('is silent without a session or on a read-only board', async () => {
    await expect(sendHeartTip({ ...BASE, sessionToken: null })).resolves.toEqual({ kind: 'noop' });
    await expect(sendHeartTip({ ...BASE, readOnly: true })).resolves.toEqual({ kind: 'noop' });
    expect(postMessageInvoice).not.toHaveBeenCalled();
  });

  it('does not send on Sunday', async () => {
    await expect(sendHeartTip({ ...BASE, isLocalSunday: true })).resolves.toEqual({
      kind: 'alert',
      alert: 'sunday',
    });
    expect(postMessageInvoice).not.toHaveBeenCalled();
  });

  it('needs a balance when ready sats are below 1', async () => {
    await expect(sendHeartTip({ ...BASE, balanceSats: 0 })).resolves.toEqual({
      kind: 'alert',
      alert: 'needsBalance',
    });
    expect(postMessageInvoice).not.toHaveBeenCalled();
  });

  it('needs a balance when wallet setup is still due', async () => {
    await expect(sendHeartTip({ ...BASE, needsWalletSetup: true })).resolves.toEqual({
      kind: 'alert',
      alert: 'needsBalance',
    });
    expect(postMessageInvoice).not.toHaveBeenCalled();
  });

  it('needs a balance when prepare reports insufficient', async () => {
    vi.mocked(postMessageInvoice).mockResolvedValue(HEART_INVOICE);
    vi.mocked(payFromWallet).mockResolvedValue({ kind: 'insufficient' });
    await expect(sendHeartTip(BASE)).resolves.toEqual({
      kind: 'alert',
      alert: 'needsBalance',
    });
  });

  it('unlocks once then prepares and sends', async () => {
    const send = vi.fn(async () => ({ kind: 'paid' as const }));
    vi.mocked(postMessageInvoice).mockResolvedValue(HEART_INVOICE);
    vi.mocked(payFromWallet)
      .mockResolvedValueOnce({ kind: 'unlock' })
      .mockResolvedValueOnce({ kind: 'confirm', amountSats: 1, feeSats: 0, send });
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
      .mockResolvedValueOnce({ kind: 'unlock' })
      .mockResolvedValueOnce({ kind: 'unlock' });
    vi.mocked(unlockWalletPhrase).mockResolvedValue('unlocked');

    await expect(
      sendHeartTip({ ...BASE, walletStatus: 'locked', balanceSats: null }),
    ).resolves.toEqual({ kind: 'alert', alert: 'payFailed' });
    expect(unlockWalletPhrase).toHaveBeenCalledTimes(1);
    expect(payFromWallet).toHaveBeenCalledTimes(2);
  });

  it('shows payFailed when unlock is cancelled', async () => {
    vi.mocked(postMessageInvoice).mockResolvedValue(HEART_INVOICE);
    vi.mocked(payFromWallet).mockResolvedValue({ kind: 'unlock' });
    vi.mocked(unlockWalletPhrase).mockResolvedValue('cancelled');

    await expect(
      sendHeartTip({ ...BASE, walletStatus: 'locked', balanceSats: null }),
    ).resolves.toEqual({ kind: 'alert', alert: 'payFailed' });
  });

  it('maps author-wallet and rate-limit invoice errors', async () => {
    vi.mocked(postMessageInvoice).mockRejectedValueOnce(new CannotReceiveError());
    await expect(sendHeartTip(BASE)).resolves.toEqual({
      kind: 'alert',
      alert: 'authorWallet',
    });
    vi.mocked(postMessageInvoice).mockRejectedValueOnce(new Error('Too many payments'));
    await expect(sendHeartTip(BASE)).resolves.toEqual({
      kind: 'alert',
      alert: 'rateLimit',
    });
    vi.mocked(postMessageInvoice).mockRejectedValueOnce(new Error('SUNDAY_REST'));
    await expect(sendHeartTip(BASE)).resolves.toEqual({
      kind: 'alert',
      alert: 'sunday',
    });
  });

  it('needs a balance when the invoice requires a wallet', async () => {
    vi.mocked(postMessageInvoice).mockRejectedValueOnce(new WalletRequiredError());
    await expect(sendHeartTip(BASE)).resolves.toEqual({
      kind: 'alert',
      alert: 'needsBalance',
    });
  });

  it('maps any other invoice rejection to request', async () => {
    vi.mocked(postMessageInvoice).mockRejectedValueOnce(new Error('offline'));
    await expect(sendHeartTip(BASE)).resolves.toEqual({
      kind: 'alert',
      alert: 'request',
    });
    vi.mocked(postMessageInvoice).mockRejectedValueOnce('nope');
    await expect(sendHeartTip(BASE)).resolves.toEqual({
      kind: 'alert',
      alert: 'request',
    });
  });

  it('needs a balance when send reports insufficient', async () => {
    const send = vi.fn(async () => ({ kind: 'insufficient' as const }));
    vi.mocked(postMessageInvoice).mockResolvedValue(HEART_INVOICE);
    vi.mocked(payFromWallet).mockResolvedValue({
      kind: 'confirm',
      amountSats: 1,
      feeSats: 0,
      send,
    });
    await expect(sendHeartTip(BASE)).resolves.toEqual({
      kind: 'alert',
      alert: 'needsBalance',
    });
  });

  it('maps a failed send to request', async () => {
    const send = vi.fn(async () => ({ kind: 'failed' as const }));
    vi.mocked(postMessageInvoice).mockResolvedValue(HEART_INVOICE);
    vi.mocked(payFromWallet).mockResolvedValue({
      kind: 'confirm',
      amountSats: 1,
      feeSats: 0,
      send,
    });
    await expect(sendHeartTip(BASE)).resolves.toEqual({
      kind: 'alert',
      alert: 'request',
    });
  });

  it('maps a failed prepare to request', async () => {
    vi.mocked(postMessageInvoice).mockResolvedValue(HEART_INVOICE);
    vi.mocked(payFromWallet).mockResolvedValue({ kind: 'failed' });
    await expect(sendHeartTip(BASE)).resolves.toEqual({
      kind: 'alert',
      alert: 'request',
    });
  });

  it('maps a below-minimum prepare to request', async () => {
    vi.mocked(postMessageInvoice).mockResolvedValue(HEART_INVOICE);
    vi.mocked(payFromWallet).mockResolvedValue({ kind: 'belowMinimum', minSats: 1 });
    await expect(sendHeartTip(BASE)).resolves.toEqual({
      kind: 'alert',
      alert: 'request',
    });
  });

  it('does not unlock when the account cannot unlock', async () => {
    vi.mocked(postMessageInvoice).mockResolvedValue(HEART_INVOICE);
    vi.mocked(payFromWallet).mockResolvedValue({ kind: 'unlock' });
    await expect(sendHeartTip({ ...BASE, canUnlockWallet: false })).resolves.toEqual({
      kind: 'alert',
      alert: 'request',
    });
    expect(unlockWalletPhrase).not.toHaveBeenCalled();
  });

  it('needs a balance when the live ready wallet is empty', async () => {
    const send = vi.fn(async () => ({ kind: 'paid' as const }));
    useWalletStore.setState({ status: 'ready', balanceSats: 0, identityPubkey: null });
    vi.mocked(postMessageInvoice).mockResolvedValue(HEART_INVOICE);
    vi.mocked(payFromWallet).mockResolvedValue({
      kind: 'confirm',
      amountSats: 1,
      feeSats: 0,
      send,
    });
    await expect(sendHeartTip(BASE)).resolves.toEqual({
      kind: 'alert',
      alert: 'needsBalance',
    });
    expect(send).not.toHaveBeenCalled();
  });

  it('ignores visual=heart-paid in a production build and still invoices', async () => {
    window.history.replaceState({}, '', '/welcome?visual=heart-paid');
    vi.mocked(postMessageInvoice).mockResolvedValue(HEART_INVOICE);
    vi.mocked(payFromWallet).mockResolvedValue({ kind: 'insufficient' });
    await expect(sendHeartTip(BASE)).resolves.toEqual({
      kind: 'alert',
      alert: 'needsBalance',
    });
    expect(postMessageInvoice).toHaveBeenCalledTimes(1);
  });

  it('returns paid for visual=heart-paid in a Playwright build without invoicing', async () => {
    vi.mocked(getE2eNow).mockReturnValue('2026-01-07T12:00:00.000Z');
    window.history.replaceState({}, '', '/welcome?visual=heart-paid');
    await expect(sendHeartTip(BASE)).resolves.toEqual({ kind: 'paid' });
    expect(postMessageInvoice).not.toHaveBeenCalled();
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
    await expect(sendHeartTip(BASE)).resolves.toEqual({ kind: 'alert', alert: 'unavailable' });
    expect(payFromWallet).not.toHaveBeenCalled();
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
      sentLate: new Promise<boolean>(() => undefined),
    }));
    vi.mocked(postMessageInvoice).mockResolvedValueOnce({ ...HEART_INVOICE, sparkInvoice });
    vi.mocked(payFromWallet).mockResolvedValueOnce({
      kind: 'confirm',
      amountSats: 1,
      feeSats: 0,
      send,
    });
    await expect(sendHeartTip({ ...BASE, messageId })).resolves.toEqual({
      kind: 'alert',
      alert: 'pending',
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
      kind: 'alert',
      alert: 'pending',
    });
    vi.mocked(listWalletPayments).mockResolvedValueOnce([
      sentPayment('spark1other', 'completed'),
      sentPayment('spark1pending', 'completed', 'received'),
    ]);
    await expect(sendHeartTip({ ...BASE, messageId: 't-pending' })).resolves.toEqual({
      kind: 'alert',
      alert: 'pending',
    });
    vi.mocked(listWalletPayments).mockRejectedValueOnce(new Error('wallet-connect'));
    await expect(sendHeartTip({ ...BASE, messageId: 't-pending' })).resolves.toEqual({
      kind: 'alert',
      alert: 'pending',
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
      kind: 'alert',
      alert: 'pending',
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
      send: async () => ({ kind: 'failed', sentLate }),
    });
    await expect(sendHeartTip({ ...BASE, messageId: 't-late' })).resolves.toEqual({
      kind: 'alert',
      alert: 'pending',
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
      send: async () => ({ kind: 'failed', sentLate }),
    });
    await expect(sendHeartTip({ ...BASE, messageId: 't-late-failed' })).resolves.toEqual({
      kind: 'alert',
      alert: 'pending',
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
      send: async () => ({ kind: 'failed', sentLate: oldSentLate }),
    });
    await sendHeartTip({ ...BASE, messageId: 't-two' });
    vi.mocked(listWalletPayments).mockResolvedValueOnce([sentPayment('spark1heart', 'failed')]);
    vi.mocked(payFromWallet).mockResolvedValueOnce({
      kind: 'confirm',
      amountSats: 1,
      feeSats: 0,
      send: async () => ({ kind: 'failed', sentLate: new Promise<boolean>(() => undefined) }),
    });
    await expect(sendHeartTip({ ...BASE, messageId: 't-two' })).resolves.toEqual({
      kind: 'alert',
      alert: 'pending',
    });
    lateOld(false);
    await oldSentLate;
    await Promise.resolve();
    vi.mocked(postMessageInvoice).mockClear();
    await expect(sendHeartTip({ ...BASE, messageId: 't-two' })).resolves.toEqual({
      kind: 'alert',
      alert: 'pending',
    });
    expect(postMessageInvoice).not.toHaveBeenCalled();
  });

  it('maps a failed send without sentLate to request and keeps no heart pending', async () => {
    const failed = vi.fn(async () => ({ kind: 'failed' as const }));
    vi.mocked(postMessageInvoice).mockResolvedValue(HEART_INVOICE);
    vi.mocked(payFromWallet).mockResolvedValueOnce({
      kind: 'confirm',
      amountSats: 1,
      feeSats: 0,
      send: failed,
    });
    await expect(sendHeartTip({ ...BASE, messageId: 't-rejected' })).resolves.toEqual({
      kind: 'alert',
      alert: 'request',
    });
    const send = payNext();
    await expect(sendHeartTip({ ...BASE, messageId: 't-rejected' })).resolves.toEqual({
      kind: 'paid',
    });
    expect(send).toHaveBeenCalledTimes(1);
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
      send,
    });
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    Reflect.deleteProperty(navigator, 'vibrate');
  });

  it('vibrates, shows plusOne, and clears the view after HEART_TIP_PLUS_ONE_MS', async () => {
    const vibrate = vi.fn();
    Object.defineProperty(navigator, 'vibrate', { configurable: true, value: vibrate });
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const { result } = renderHook(() => useHeartTip({ readOnly: false }));
    await clickHeart(result);
    expect(vibrate).toHaveBeenCalledWith(10);
    expect(result.current.heartTipViews['m1']).toEqual({
      pressed: true,
      plusOne: true,
      alert: null,
    });
    expect(postMessageInvoice).toHaveBeenCalledTimes(1);
    expect(postMessageInvoice).toHaveBeenCalledWith('sess', 'm1', 1, undefined, undefined, true);
    act(() => {
      vi.advanceTimersByTime(HEART_TIP_PLUS_ONE_MS);
    });
    expect(result.current.heartTipViews['m1']).toBeUndefined();
    vi.useRealTimers();
  });

  it('keeps plusOne on screen when visual=heart-paid', async () => {
    vi.mocked(getE2eNow).mockReturnValue('2026-01-07T12:00:00.000Z');
    window.history.replaceState({}, '', '/welcome?visual=heart-paid');
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const { result } = renderHook(() => useHeartTip({ readOnly: false }));
    await clickHeart(result);
    expect(postMessageInvoice).not.toHaveBeenCalled();
    expect(result.current.heartTipViews['m1']).toEqual({
      pressed: true,
      plusOne: true,
      alert: null,
    });
    act(() => {
      vi.advanceTimersByTime(HEART_TIP_PLUS_ONE_MS);
    });
    expect(result.current.heartTipViews['m1']).toEqual({
      pressed: true,
      plusOne: true,
      alert: null,
    });
    vi.useRealTimers();
  });

  it('still pays when navigator.vibrate is missing', async () => {
    Reflect.deleteProperty(navigator, 'vibrate');
    const { result } = renderHook(() => useHeartTip({ readOnly: false }));
    await clickHeart(result);
    expect(result.current.heartTipViews['m1']).toEqual({
      pressed: true,
      plusOne: true,
      alert: null,
    });
  });

  it('ignores a second click on the same id while the invoice is in flight', async () => {
    let resolveInvoice: ((value: typeof HEART_INVOICE) => void) | undefined;
    vi.mocked(postMessageInvoice).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveInvoice = resolve;
        }),
    );
    const { result } = renderHook(() => useHeartTip({ readOnly: false }));
    await act(async () => {
      result.current.onHeartTip('m1');
    });
    await act(async () => {
      result.current.onHeartTip('m1');
    });
    expect(postMessageInvoice).toHaveBeenCalledTimes(1);
    await act(async () => {
      resolveInvoice?.(HEART_INVOICE);
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(postMessageInvoice).toHaveBeenCalledTimes(1);
  });

  it('needs a balance when the ready wallet is empty', async () => {
    useWalletStore.setState({ status: 'ready', balanceSats: 0, identityPubkey: null });
    const { result } = renderHook(() => useHeartTip({ readOnly: false }));
    await clickHeart(result);
    expect(result.current.heartTipViews['m1']).toEqual({
      pressed: false,
      plusOne: false,
      alert: 'needsBalance',
    });
    expect(postMessageInvoice).not.toHaveBeenCalled();
  });

  it('removes the view when the session is null', async () => {
    useAuthStore.setState({ session: null, account: HEART_ACCOUNT });
    const { result } = renderHook(() => useHeartTip({ readOnly: false }));
    await clickHeart(result);
    expect(result.current.heartTipViews['m1']).toBeUndefined();
  });

  it('does not throw when unmounted during the plusOne window', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const { result, unmount } = renderHook(() => useHeartTip({ readOnly: false }));
    await clickHeart(result);
    expect(result.current.heartTipViews['m1']).toEqual({
      pressed: true,
      plusOne: true,
      alert: null,
    });
    unmount();
    act(() => {
      vi.advanceTimersByTime(HEART_TIP_PLUS_ONE_MS);
    });
    vi.useRealTimers();
  });

  it('starts another send on a second click while plusOne is showing', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const { result } = renderHook(() => useHeartTip({ readOnly: false }));
    await clickHeart(result);
    expect(result.current.heartTipViews['m1']).toEqual({
      pressed: true,
      plusOne: true,
      alert: null,
    });
    await clickHeart(result);
    expect(postMessageInvoice).toHaveBeenCalledTimes(2);
    expect(Object.keys(result.current.heartTipViews)).toEqual(['m1']);
    expect(result.current.heartTipViews['m1']).toEqual({
      pressed: true,
      plusOne: true,
      alert: null,
    });
    vi.useRealTimers();
  });

  it('keeps a timed-out heart filled and pending, and a retap does not pay again', async () => {
    const send = vi.fn(async () => ({
      kind: 'failed' as const,
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
      send,
    });
    vi.mocked(listWalletPayments).mockResolvedValue([sentPayment('spark1hook', 'pending')]);
    const { result } = renderHook(() => useHeartTip({ readOnly: false }));
    await clickHeart(result, 'h-timeout');
    expect(result.current.heartTipViews['h-timeout']).toEqual({
      pressed: true,
      plusOne: false,
      alert: 'pending',
    });
    await clickHeart(result, 'h-timeout');
    expect(result.current.heartTipViews['h-timeout']).toEqual({
      pressed: true,
      plusOne: false,
      alert: 'pending',
    });
    expect(postMessageInvoice).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('shows unavailable with an empty glyph when the api issued no Spark invoice', async () => {
    vi.mocked(postMessageInvoice).mockResolvedValue({ pr: 'lnbc1', amountSats: 1 });
    const { result } = renderHook(() => useHeartTip({ readOnly: false }));
    await clickHeart(result, 'h-unavailable');
    expect(result.current.heartTipViews['h-unavailable']).toEqual({
      pressed: false,
      plusOne: false,
      alert: 'unavailable',
    });
    expect(payFromWallet).not.toHaveBeenCalled();
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
});
