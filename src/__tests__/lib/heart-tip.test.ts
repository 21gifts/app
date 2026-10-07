import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CannotReceiveError, postMessageInvoice, WalletRequiredError } from '@/lib/api';
import type { Account } from '@/lib/api-types';
import { HEART_TIP_PLUS_ONE_MS, sendHeartTip, useHeartTip } from '@/lib/heart-tip';
import { unlockWalletPhrase } from '@/lib/wallet/wallet-phrase';
import { payFromWallet } from '@/lib/wallet/wallet-service';
import { useAuthStore } from '@/stores/auth-store';
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
    vi.mocked(postMessageInvoice).mockResolvedValue({ pr: 'lnbc1', amountSats: 1 });
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
    vi.mocked(postMessageInvoice).mockResolvedValue({ pr: 'lnbc1', amountSats: 1 });
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
    vi.mocked(postMessageInvoice).mockResolvedValue({ pr: 'lnbc1', amountSats: 1 });
    vi.mocked(payFromWallet).mockResolvedValue({ kind: 'failed' });
    await expect(sendHeartTip(BASE)).resolves.toEqual({
      kind: 'alert',
      alert: 'request',
    });
  });

  it('maps a below-minimum prepare to request', async () => {
    vi.mocked(postMessageInvoice).mockResolvedValue({ pr: 'lnbc1', amountSats: 1 });
    vi.mocked(payFromWallet).mockResolvedValue({ kind: 'belowMinimum', minSats: 1 });
    await expect(sendHeartTip(BASE)).resolves.toEqual({
      kind: 'alert',
      alert: 'request',
    });
  });

  it('does not unlock when the account cannot unlock', async () => {
    vi.mocked(postMessageInvoice).mockResolvedValue({ pr: 'lnbc1', amountSats: 1 });
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
    vi.mocked(postMessageInvoice).mockResolvedValue({ pr: 'lnbc1', amountSats: 1 });
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

  it('pays pr when sparkInvoice is empty', async () => {
    const send = vi.fn(async () => ({ kind: 'paid' as const }));
    vi.mocked(postMessageInvoice).mockResolvedValue({
      pr: 'lnbc1',
      amountSats: 1,
      sparkInvoice: '',
    });
    vi.mocked(payFromWallet).mockResolvedValue({
      kind: 'confirm',
      amountSats: 1,
      feeSats: 0,
      send,
    });
    await expect(sendHeartTip(BASE)).resolves.toEqual({ kind: 'paid' });
    expect(payFromWallet).toHaveBeenCalledWith({ type: 'input', input: 'lnbc1' });
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
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe('useHeartTip', () => {
  beforeEach(() => {
    useAuthStore.setState({ session: 'sess', account: HEART_ACCOUNT });
    useWalletStore.setState({ status: 'ready', balanceSats: 21, identityPubkey: null });
    const send = vi.fn(async () => ({ kind: 'paid' as const }));
    vi.mocked(postMessageInvoice).mockResolvedValue({ pr: 'lnbc1', amountSats: 1 });
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
    expect(result.current.heartTipViews.m1).toEqual({
      pressed: true,
      plusOne: true,
      alert: null,
    });
    expect(postMessageInvoice).toHaveBeenCalledTimes(1);
    expect(postMessageInvoice).toHaveBeenCalledWith('sess', 'm1', 1, undefined, undefined, true);
    act(() => {
      vi.advanceTimersByTime(HEART_TIP_PLUS_ONE_MS);
    });
    expect(result.current.heartTipViews.m1).toBeUndefined();
    vi.useRealTimers();
  });

  it('still pays when navigator.vibrate is missing', async () => {
    Reflect.deleteProperty(navigator, 'vibrate');
    const { result } = renderHook(() => useHeartTip({ readOnly: false }));
    await clickHeart(result);
    expect(result.current.heartTipViews.m1).toEqual({
      pressed: true,
      plusOne: true,
      alert: null,
    });
  });

  it('ignores a second click on the same id while the invoice is in flight', async () => {
    let resolveInvoice: ((value: { pr: string; amountSats: number }) => void) | undefined;
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
      resolveInvoice?.({ pr: 'lnbc1', amountSats: 1 });
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
    expect(result.current.heartTipViews.m1).toEqual({
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
    expect(result.current.heartTipViews.m1).toBeUndefined();
  });

  it('does not throw when unmounted during the plusOne window', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const { result, unmount } = renderHook(() => useHeartTip({ readOnly: false }));
    await clickHeart(result);
    expect(result.current.heartTipViews.m1).toEqual({
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
    expect(result.current.heartTipViews.m1).toEqual({
      pressed: true,
      plusOne: true,
      alert: null,
    });
    await clickHeart(result);
    expect(postMessageInvoice).toHaveBeenCalledTimes(2);
    expect(Object.keys(result.current.heartTipViews)).toEqual(['m1']);
    expect(result.current.heartTipViews.m1).toEqual({
      pressed: true,
      plusOne: true,
      alert: null,
    });
    vi.useRealTimers();
  });
});
