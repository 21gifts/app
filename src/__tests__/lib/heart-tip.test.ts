import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CannotReceiveError, postMessageInvoice } from '@/lib/api';
import { sendHeartTip } from '@/lib/heart-tip';
import { unlockWalletPhrase } from '@/lib/wallet/wallet-phrase';
import { payFromWallet } from '@/lib/wallet/wallet-service';
import { useWalletStore } from '@/stores/wallet-store';

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
  return { ...actual, payFromWallet: vi.fn() };
});

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
  vi.mocked(postMessageInvoice).mockReset();
  vi.mocked(payFromWallet).mockReset();
  vi.mocked(unlockWalletPhrase).mockReset();
  useWalletStore.setState({ status: 'ready', balanceSats: 21, identityPubkey: null });
});

describe('sendHeartTip', () => {
  it('requests the invoice with heart true and sats 1, then sends without a second confirm', async () => {
    const send = vi.fn(async () => ({ kind: 'paid' as const }));
    vi.mocked(postMessageInvoice).mockResolvedValue({
      pr: 'lnbc1',
      amountSats: 1,
      sparkInvoice: 'spark1heart',
    });
    vi.mocked(payFromWallet).mockResolvedValue({
      kind: 'confirm',
      amountSats: 1,
      feeSats: 2,
      send,
    });

    await expect(sendHeartTip(BASE)).resolves.toEqual({ kind: 'paid' });
    expect(postMessageInvoice).toHaveBeenCalledWith('sess', 'm1', 1, undefined, undefined, true);
    expect(payFromWallet).toHaveBeenCalledWith({ type: 'input', input: 'spark1heart' });
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('pays pr when the api issued no sparkInvoice', async () => {
    const send = vi.fn(async () => ({ kind: 'paid' as const }));
    vi.mocked(postMessageInvoice).mockResolvedValue({ pr: 'lnbc1', amountSats: 1 });
    vi.mocked(payFromWallet).mockResolvedValue({
      kind: 'confirm',
      amountSats: 1,
      feeSats: 0,
      send,
    });

    await expect(sendHeartTip(BASE)).resolves.toEqual({ kind: 'paid' });
    expect(payFromWallet).toHaveBeenCalledWith({ type: 'input', input: 'lnbc1' });
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
    vi.mocked(postMessageInvoice).mockResolvedValue({ pr: 'lnbc1', amountSats: 1 });
    vi.mocked(payFromWallet).mockResolvedValue({ kind: 'insufficient' });
    await expect(sendHeartTip(BASE)).resolves.toEqual({
      kind: 'alert',
      alert: 'needsBalance',
    });
  });

  it('unlocks once then prepares and sends', async () => {
    const send = vi.fn(async () => ({ kind: 'paid' as const }));
    vi.mocked(postMessageInvoice).mockResolvedValue({ pr: 'lnbc1', amountSats: 1 });
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

  it('shows payFailed when unlock is cancelled', async () => {
    vi.mocked(postMessageInvoice).mockResolvedValue({ pr: 'lnbc1', amountSats: 1 });
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
});
