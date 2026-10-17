import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useLoanRepay } from '@/hooks/useLoanRepay';
import { WALLET_PAY_BALANCE_POLL_MS, WALLET_PAY_CONFIRM_WAIT_MS } from '@/hooks/useWalletPay';
import {
  CannotReceiveError,
  postRepaymentDue,
  WalletRequiredError,
  type MyLoan,
  type MyLoans,
  type RepaymentBill,
} from '@/lib/api';
import { getE2eNow } from '@/lib/config';
import { reportPaymentFailure, type PaymentFailure } from '@/lib/wallet/payment-failure';
import {
  payFromWallet,
  refreshWallet,
  type WalletPayResult,
  type WalletSendResult,
} from '@/lib/wallet/wallet-service';
import { useAuthStore } from '@/stores/auth-store';
import { useWalletStore, type WalletStatus } from '@/stores/wallet-store';

vi.mock('@/lib/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api')>()),
  postRepaymentDue: vi.fn(),
}));
vi.mock('@/lib/wallet/wallet-service', () => ({
  payFromWallet: vi.fn(),
  refreshWallet: vi.fn(),
}));
vi.mock('@/lib/wallet/payment-failure', () => ({ reportPaymentFailure: vi.fn() }));
vi.mock('@/lib/config', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/config')>()),
  getE2eNow: vi.fn(() => null),
}));

const ORIGINAL_BREEZ_KEY = process.env.NEXT_PUBLIC_BREEZ_API_KEY;

const account = {
  id: 'acc_1',
  linkingKey: null,
  role: 'basis' as const,
  name: 'Ada',
  username: 'ada',
  location: null,
  lightningAddress: null,
  lightningAddressVerified: false,
  forumLawsDismissed: false,
  createdAt: 1,
  rulesAgreedAt: 1,
  viewKey: 'a'.repeat(64),
  aboutMe: null,
  aboutMeHasPhoto: false,
  setup: null,
  missing: [],
  walletRequired: true,
  passkeyCredentialId: 'credential',
  sparkWalletVerified: true,
};

function loan(messageId = 'm1', payableSats = 500, repaidSats = 100): MyLoan {
  return {
    messageId,
    text: 'Train ticket',
    createdAt: '2026-10-01T12:00:00.000Z',
    goalSats: 1_000,
    sats: 1_000,
    goalCurrency: 'BTC',
    goalAmount: '1000',
    goalAmountUsd: null,
    goalAmountChf: null,
    goalAmountEur: null,
    goalAmountPhp: null,
    amountUsd: null,
    amountChf: null,
    amountEur: null,
    amountPhp: null,
    termDays: 30,
    fundedAt: '2026-10-02T12:00:00.000Z',
    daysDue: 2,
    daysPaid: 1,
    repaidSats,
    totalSats: 1_000,
    due: {
      payableSats,
      payablePeople: payableSats > 0 ? 1 : 0,
      waitingSats: 0,
      waitingPeople: 0,
      behindDays: 0,
      payableAmount: null,
      waitingAmount: null,
      lastPayment: false,
    },
    next: null,
  };
}

let invoiceSeq = 0;

function bill(
  name: string,
  amountSats = 500,
  dayIndex = 0,
  sparkInvoice?: string | null,
): RepaymentBill {
  invoiceSeq += 1;
  return {
    dayIndex,
    recipientAccountId: `acc-${name}-${invoiceSeq}`,
    name,
    username: name.toLowerCase(),
    amountSats,
    amount: null,
    pr: `pr-${name}-${invoiceSeq}`,
    sparkInvoice: sparkInvoice === undefined ? `spark-${name}-${invoiceSeq}` : sparkInvoice,
  };
}

function invoiceOf(row: RepaymentBill): string {
  return row.sparkInvoice ?? row.pr;
}

function shareKeys(messageId: string, ...rows: RepaymentBill[]): ReadonlySet<string> {
  return new Set(rows.map((row) => `${messageId}:${row.dayIndex}:${row.recipientAccountId}`));
}

function setWallet(status: WalletStatus, balanceSats: number | null = 21_000): void {
  useWalletStore.setState({ status, balanceSats, identityPubkey: null });
}

function failure(stage: PaymentFailure['stage'], reason: PaymentFailure['reason']): PaymentFailure {
  return { stage, reason, method: 'spark', amountSats: null, feeSats: null };
}

function confirmed(
  amountSats: number,
  send: () => Promise<WalletSendResult> = async () => ({ kind: 'paid' }),
  feeSats = 0,
): WalletPayResult {
  return { kind: 'confirm', amountSats, feeSats, method: 'spark', send };
}

function body(loans: MyLoan[]): MyLoans {
  return { sundayRest: false, loans };
}

beforeEach(() => {
  window.history.replaceState({}, '', '/loans/repay');
  delete process.env.NEXT_PUBLIC_BREEZ_API_KEY;
  useAuthStore.setState({ session: 'token', account });
  useWalletStore.setState({ setupFailedSession: null });
  setWallet('ready');
  vi.mocked(postRepaymentDue).mockReset();
  vi.mocked(payFromWallet).mockReset();
  vi.mocked(refreshWallet).mockReset().mockResolvedValue(undefined);
  vi.mocked(getE2eNow).mockReset().mockReturnValue(null);
  vi.mocked(reportPaymentFailure).mockClear();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  if (ORIGINAL_BREEZ_KEY === undefined) {
    delete process.env.NEXT_PUBLIC_BREEZ_API_KEY;
  } else {
    process.env.NEXT_PUBLIC_BREEZ_API_KEY = ORIGINAL_BREEZ_KEY;
  }
});

describe('useLoanRepay wallet state', () => {
  it('derives unavailable, connecting, setupFailed, and idle with its balance', async () => {
    setWallet('disabled', null);
    const disabled = renderHook(() => useLoanRepay({ reload: vi.fn(async () => body([loan()])) }));
    expect(disabled.result.current).toMatchObject({ phase: 'unavailable', balanceSats: null });
    disabled.unmount();

    useAuthStore.setState({ account: { ...account, passkeyCredentialId: null } });
    setWallet('ready');
    const cannotUnlock = renderHook(() =>
      useLoanRepay({ reload: vi.fn(async () => body([loan()])) }),
    );
    expect(cannotUnlock.result.current.phase).toBe('unavailable');
    cannotUnlock.unmount();

    useAuthStore.setState({ account });
    setWallet('connecting', null);
    const connecting = renderHook(() =>
      useLoanRepay({ reload: vi.fn(async () => body([loan()])) }),
    );
    expect(connecting.result.current.phase).toBe('connecting');
    connecting.unmount();

    process.env.NEXT_PUBLIC_BREEZ_API_KEY = 'key';
    useAuthStore.setState({ account: { ...account, sparkWalletVerified: false } });
    setWallet('ready');
    const setup = renderHook(() => useLoanRepay({ reload: vi.fn(async () => body([loan()])) }));
    expect(setup.result.current.phase).toBe('connecting');
    await act(async () => {
      useWalletStore.setState({ setupFailedSession: 'token' });
    });
    expect(setup.result.current.phase).toBe('setupFailed');
    setup.unmount();

    delete process.env.NEXT_PUBLIC_BREEZ_API_KEY;
    useAuthStore.setState({ account });
    setWallet('ready', 21_000);
    const ready = renderHook(() => useLoanRepay({ reload: vi.fn(async () => body([loan()])) }));
    expect(ready.result.current).toMatchObject({
      phase: 'idle',
      balanceSats: 21_000,
      pinned: false,
    });
  });

  it('opens top-up and polls the ready wallet one read at a time', async () => {
    vi.useFakeTimers();
    let finish!: () => void;
    vi.mocked(refreshWallet).mockReturnValue(
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
    );
    const { result } = renderHook(() =>
      useLoanRepay({ reload: vi.fn(async () => body([loan()])) }),
    );
    act(() => {
      result.current.openTopUp();
    });
    expect(result.current.topUpOpen).toBe(true);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(WALLET_PAY_BALANCE_POLL_MS * 2);
    });
    expect(refreshWallet).toHaveBeenCalledTimes(1);
    await act(async () => {
      finish();
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(WALLET_PAY_BALANCE_POLL_MS);
    });
    expect(refreshWallet).toHaveBeenCalledTimes(2);
    expect(refreshWallet).toHaveBeenCalledWith({ ensureSynced: true, ignoreFailure: true });
    await act(async () => {
      setWallet('connecting', null);
      await vi.advanceTimersByTimeAsync(WALLET_PAY_BALANCE_POLL_MS);
    });
    expect(refreshWallet).toHaveBeenCalledTimes(2);
  });

  it('does not start a run without a current session', () => {
    useAuthStore.setState({ session: null, account });
    const { result } = renderHook(() =>
      useLoanRepay({ reload: vi.fn(async () => body([loan()])) }),
    );
    expect(result.current.phase).toBe('idle');
    act(() => result.current.pay([loan()]));
    expect(postRepaymentDue).not.toHaveBeenCalled();
  });
});

describe('useLoanRepay preparation', () => {
  it('maps due-request errors and ignores another tap while preparing', async () => {
    let reject!: (error: unknown) => void;
    vi.mocked(postRepaymentDue).mockReturnValue(
      new Promise<never>((_resolve, fail) => {
        reject = fail;
      }),
    );
    const { result } = renderHook(() =>
      useLoanRepay({ reload: vi.fn(async () => body([loan()])) }),
    );
    act(() => {
      result.current.pay([loan()]);
      result.current.pay([loan('m2')]);
    });
    expect(result.current.phase).toBe('preparing');
    expect(postRepaymentDue).toHaveBeenCalledTimes(1);
    await act(async () => {
      reject(new Error('Too many payments'));
    });
    expect(result.current).toMatchObject({
      phase: 'failed',
      errorKey: 'forum.payErrorRateLimit',
      sentSats: 0,
    });

    vi.mocked(postRepaymentDue).mockRejectedValueOnce(new WalletRequiredError());
    act(() => result.current.pay([loan()]));
    await waitFor(() => expect(result.current.phase).toBe('failed'));
    expect(result.current.errorKey).toBe('wallet.payUnavailable');

    vi.mocked(postRepaymentDue).mockRejectedValueOnce(new CannotReceiveError());
    act(() => result.current.pay([loan()]));
    await waitFor(() => expect(result.current.phase).toBe('failed'));
    expect(result.current.errorKey).toBe('loans.errorCannotReceive');

    vi.mocked(postRepaymentDue).mockRejectedValueOnce(new Error('other'));
    act(() => result.current.pay([loan()]));
    await waitFor(() => expect(result.current.phase).toBe('failed'));
    expect(result.current.errorKey).toBe('forum.payErrorRequest');
  });

  it('ignores a due-request error after the session changes', async () => {
    let reject!: (error: unknown) => void;
    vi.mocked(postRepaymentDue).mockReturnValue(
      new Promise<never>((_resolve, fail) => {
        reject = fail;
      }),
    );
    const { result } = renderHook(() =>
      useLoanRepay({ reload: vi.fn(async () => body([loan()])) }),
    );
    act(() => result.current.pay([loan()]));
    await act(async () => {
      useAuthStore.setState({ session: 'other' });
    });
    await act(async () => {
      reject(new Error('late request failure'));
    });
    expect(result.current).toMatchObject({ phase: 'idle', errorKey: null });
  });

  it('skips loans without payable sats and treats no bills as freshly repaid', async () => {
    const reload = vi.fn(async (): Promise<MyLoans> => body([]));
    vi.mocked(postRepaymentDue).mockResolvedValue({ bills: [], waiting: [] });
    const { result } = renderHook(() => useLoanRepay({ reload }));
    act(() => result.current.openTopUp());
    act(() => result.current.pay([loan('skip', 0), loan()]));
    await waitFor(() => expect(result.current.phase).toBe('repaid'));
    expect(postRepaymentDue).toHaveBeenCalledTimes(1);
    expect(postRepaymentDue).toHaveBeenCalledWith('token', 'm1');
    expect(reload).toHaveBeenCalledTimes(1);
    expect(result.current.topUpOpen).toBe(false);
  });

  it('ends failed when nothing is due and the loans reload fails, sending nothing', async () => {
    const reload = vi.fn(async (): Promise<MyLoans | null> => null);
    vi.mocked(postRepaymentDue).mockResolvedValue({ bills: [], waiting: [] });
    const { result } = renderHook(() => useLoanRepay({ reload }));
    act(() => result.current.pay([loan()]));
    await waitFor(() => expect(result.current.phase).toBe('failed'));
    expect(result.current.errorKey).toBe('forum.payErrorRequest');
    expect(reload).toHaveBeenCalledTimes(1);
    expect(payFromWallet).not.toHaveBeenCalled();
  });

  it('ends failed when a named share is no longer due and the loans reload fails', async () => {
    const reload = vi.fn(async (): Promise<MyLoans | null> => null);
    vi.mocked(postRepaymentDue).mockResolvedValue({ bills: [], waiting: [] });
    const { result } = renderHook(() => useLoanRepay({ reload }));
    act(() => result.current.pay([loan()], new Set(['m1:0:gone'])));
    await waitFor(() => expect(result.current.phase).toBe('failed'));
    expect(result.current.errorKey).toBe('forum.payErrorRequest');
    expect(payFromWallet).not.toHaveBeenCalled();
  });

  it('ignores an empty-bills reload after the session changes', async () => {
    let resolveReload!: (loans: MyLoans) => void;
    const reload = vi.fn(
      () =>
        new Promise<MyLoans>((resolve) => {
          resolveReload = resolve;
        }),
    );
    vi.mocked(postRepaymentDue).mockResolvedValue({ bills: [], waiting: [] });
    const { result } = renderHook(() => useLoanRepay({ reload }));
    act(() => result.current.pay([loan()]));
    await waitFor(() => expect(reload).toHaveBeenCalledTimes(1));
    await act(async () => {
      useAuthStore.setState({ session: 'other' });
    });
    await act(async () => {
      resolveReload(body([]));
    });
    expect(result.current.phase).toBe('idle');
  });

  it('ignores a post-due baseline reload after the session changes', async () => {
    let resolveReload!: (loans: MyLoans | null) => void;
    const reload = vi.fn(
      () =>
        new Promise<MyLoans | null>((resolve) => {
          resolveReload = resolve;
        }),
    );
    vi.mocked(postRepaymentDue).mockResolvedValue({
      bills: [bill('BaseAbort')],
      waiting: [],
    });
    const { result } = renderHook(() => useLoanRepay({ reload }));
    act(() => result.current.pay([loan()]));
    await waitFor(() => expect(reload).toHaveBeenCalledTimes(1));
    expect(payFromWallet).not.toHaveBeenCalled();
    await act(async () => {
      useAuthStore.setState({ session: 'other' });
    });
    await act(async () => {
      resolveReload(body([loan()]));
    });
    expect(result.current.phase).toBe('idle');
    expect(payFromWallet).not.toHaveBeenCalled();
  });

  it.each<WalletPayResult>([
    { kind: 'failed', failure: failure('prepare', 'sdk_error') },
    { kind: 'unlock', failure: failure('prepare', 'unlock') },
    { kind: 'belowMinimum', minSats: 1_000, failure: failure('prepare', 'below_minimum') },
    confirmed(501),
  ])('fails before sending for an unusable prepare result %#', async (prepare) => {
    vi.mocked(postRepaymentDue).mockResolvedValue({ bills: [bill('Bruno')], waiting: [] });
    vi.mocked(payFromWallet).mockResolvedValue(prepare);
    const { result } = renderHook(() =>
      useLoanRepay({ reload: vi.fn(async () => body([loan()])) }),
    );
    act(() => result.current.pay([loan()]));
    await waitFor(() => expect(result.current.phase).toBe('failed'));
    expect(result.current.errorKey).toBe('forum.payErrorRequest');
    expect(result.current.sentSats).toBe(0);
  });

  it('ignores a prepared bill after the session changes', async () => {
    let resolvePrepare!: (result: WalletPayResult) => void;
    const send = vi.fn(async (): Promise<WalletSendResult> => ({ kind: 'paid' }));
    vi.mocked(postRepaymentDue).mockResolvedValue({ bills: [bill('Bruno')], waiting: [] });
    vi.mocked(payFromWallet).mockReturnValue(
      new Promise<WalletPayResult>((resolve) => {
        resolvePrepare = resolve;
      }),
    );
    const { result } = renderHook(() =>
      useLoanRepay({ reload: vi.fn(async () => body([loan()])) }),
    );
    act(() => result.current.pay([loan()]));
    await waitFor(() => expect(payFromWallet).toHaveBeenCalledTimes(1));
    await act(async () => {
      useAuthStore.setState({ session: 'other' });
    });
    await act(async () => {
      resolvePrepare(confirmed(500, send));
    });
    expect(result.current.phase).toBe('idle');
    expect(send).not.toHaveBeenCalled();
  });

  it('orders bills by day, loan entry, and api order, then sends sequentially', async () => {
    vi.useFakeTimers();
    const sent: string[] = [];
    const firstLoan = loan('m1', 800, 100);
    const secondLoan = loan('m2', 500, 200);
    const cara = bill('Cara', 200, 2, null);
    const brunoDay1 = bill('Bruno', 500, 1);
    const ana = bill('Ana', 100, 1);
    const brunoLoan2 = bill('Bruno', 300, 1);
    vi.mocked(postRepaymentDue)
      .mockResolvedValueOnce({
        bills: [cara, brunoDay1, ana],
        waiting: [],
      })
      .mockResolvedValueOnce({ bills: [brunoLoan2], waiting: [bill('Ignored')] });
    const amountByInvoice: Record<string, number> = {
      [invoiceOf(cara)]: 200,
      [invoiceOf(ana)]: 100,
      [invoiceOf(brunoDay1)]: 500,
      [invoiceOf(brunoLoan2)]: 300,
    };
    vi.mocked(payFromWallet).mockImplementation(async (request) => {
      if (request.type !== 'input') {
        return { kind: 'failed', failure: failure('prepare', 'sdk_error') };
      }
      const { input } = request;
      return confirmed(
        amountByInvoice[input] ?? 0,
        async () => {
          sent.push(input);
          return { kind: 'paid' };
        },
        2,
      );
    });
    const reload = vi
      .fn<() => Promise<MyLoans>>()
      .mockResolvedValueOnce(body([firstLoan, secondLoan]))
      .mockResolvedValue(body([loan('m1', 0, 900), loan('m2', 0, 500)]));
    const { result } = renderHook(() => useLoanRepay({ reload }));
    act(() => result.current.pay([firstLoan, secondLoan]));
    await act(async () => undefined);
    expect(result.current.phase).toBe('waiting');
    expect(sent).toEqual([
      invoiceOf(brunoDay1),
      invoiceOf(ana),
      invoiceOf(brunoLoan2),
      invoiceOf(cara),
    ]);
    expect(result.current).toMatchObject({
      sentSats: 1_100,
      sentNames: ['Bruno', 'Ana', 'Cara'],
      feeSats: 8,
      topUpOpen: false,
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(WALLET_PAY_BALANCE_POLL_MS);
    });
    expect(result.current.phase).toBe('repaid');
  });

  it('sends nothing after insufficient preparation and reports all missing sats', async () => {
    setWallet('ready', 600);
    vi.mocked(postRepaymentDue).mockResolvedValue({
      bills: [bill('Bruno', 500), bill('Cara', 400, 1)],
      waiting: [],
    });
    vi.mocked(payFromWallet)
      .mockResolvedValueOnce(confirmed(500, async () => ({ kind: 'paid' }), 10))
      .mockResolvedValueOnce({
        kind: 'insufficient',
        feeSats: 20,
        failure: failure('prepare', 'insufficient'),
      });
    const { result } = renderHook(() =>
      useLoanRepay({ reload: vi.fn(async () => body([loan()])) }),
    );
    act(() => result.current.pay([loan()]));
    await waitFor(() => expect(result.current.phase).toBe('idle'));
    expect(result.current.missingSats).toBe(330);
    expect(result.current.sentSats).toBe(0);
  });

  it('includes the insufficient preparation fee in the missing sats', async () => {
    setWallet('ready', 1_000);
    vi.mocked(postRepaymentDue).mockResolvedValue({
      bills: [bill('Bruno', 1_000)],
      waiting: [],
    });
    vi.mocked(payFromWallet).mockResolvedValue({
      kind: 'insufficient',
      feeSats: 25,
      failure: failure('prepare', 'insufficient'),
    });
    const { result } = renderHook(() =>
      useLoanRepay({ reload: vi.fn(async () => body([loan()])) }),
    );
    act(() => result.current.pay([loan()]));
    await waitFor(() => expect(result.current.phase).toBe('idle'));
    expect(result.current.missingSats).toBe(25);
  });

  it('reports at least one missing sat after an insufficient preparation without a fee', async () => {
    setWallet('ready', 1_000);
    vi.mocked(postRepaymentDue).mockResolvedValue({
      bills: [bill('Bruno', 1_000)],
      waiting: [],
    });
    vi.mocked(payFromWallet).mockResolvedValue({
      kind: 'insufficient',
      failure: failure('prepare', 'insufficient'),
    });
    const { result } = renderHook(() =>
      useLoanRepay({ reload: vi.fn(async () => body([loan()])) }),
    );
    act(() => result.current.pay([loan()]));
    await waitFor(() => expect(result.current.phase).toBe('idle'));
    expect(result.current.missingSats).toBe(1);
  });

  it('sends nothing when individually prepared bills exceed the current balance', async () => {
    setWallet('ready', 600);
    vi.mocked(postRepaymentDue).mockResolvedValue({
      bills: [bill('Bruno', 500), bill('Cara', 200, 1)],
      waiting: [],
    });
    vi.mocked(payFromWallet)
      .mockResolvedValueOnce(confirmed(500, async () => ({ kind: 'paid' }), 100))
      .mockResolvedValueOnce(confirmed(200));
    const { result } = renderHook(() =>
      useLoanRepay({ reload: vi.fn(async () => body([loan()])) }),
    );
    act(() => result.current.pay([loan()]));
    await waitFor(() => expect(result.current.phase).toBe('idle'));
    expect(result.current.missingSats).toBe(200);
    act(() => setWallet('ready', 800));
    expect(result.current.missingSats).toBeNull();
  });

  it('treats a null store balance as zero while preparing', async () => {
    setWallet('ready', null);
    vi.mocked(postRepaymentDue).mockResolvedValue({ bills: [bill('Bruno')], waiting: [] });
    vi.mocked(payFromWallet).mockResolvedValue(confirmed(500));
    const { result } = renderHook(() =>
      useLoanRepay({ reload: vi.fn(async () => body([loan()])) }),
    );
    act(() => result.current.pay([loan()]));
    await waitFor(() => expect(result.current.missingSats).toBe(500));
    expect(result.current).toMatchObject({ phase: 'idle', sentSats: 0 });
  });

  it('pays the named share set that fits and skips later due bills', async () => {
    vi.useFakeTimers();
    const firstBill = bill('Bruno', 500);
    const laterBill = bill('Cara', 400, 1);
    const send = vi.fn(async (): Promise<WalletSendResult> => ({ kind: 'paid' }));
    vi.mocked(postRepaymentDue).mockResolvedValue({
      bills: [firstBill, laterBill],
      waiting: [],
    });
    vi.mocked(payFromWallet).mockResolvedValueOnce(confirmed(500, send, 10));
    const reload = vi
      .fn<() => Promise<MyLoans>>()
      .mockResolvedValueOnce(body([loan()]))
      .mockResolvedValue(body([loan('m1', 0, 600)]));
    const { result } = renderHook(() => useLoanRepay({ reload }));
    act(() => result.current.pay([loan()], shareKeys('m1', firstBill)));
    await act(async () => undefined);
    expect(payFromWallet).toHaveBeenCalledTimes(1);
    expect(payFromWallet).toHaveBeenCalledWith({ type: 'input', input: invoiceOf(firstBill) });
    expect(send).toHaveBeenCalledTimes(1);
    expect(result.current.sentSats).toBe(500);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(WALLET_PAY_BALANCE_POLL_MS);
    });
    expect(result.current.phase).toBe('repaid');
  });

  it('does not block the named prefix when a later bill would fail prepare', async () => {
    vi.useFakeTimers();
    const firstBill = bill('PrefixOk', 500);
    const laterBill = bill('BehindFail', 400, 1);
    const send = vi.fn(async (): Promise<WalletSendResult> => ({ kind: 'paid' }));
    vi.mocked(postRepaymentDue).mockResolvedValue({
      bills: [firstBill, laterBill],
      waiting: [],
    });
    vi.mocked(payFromWallet).mockImplementation(async (request) => {
      if (request.type !== 'input') {
        return { kind: 'failed', failure: failure('prepare', 'sdk_error') };
      }
      if (request.input === invoiceOf(laterBill)) {
        return { kind: 'failed', failure: failure('prepare', 'sdk_error') };
      }
      return confirmed(500, send, 10);
    });
    const reload = vi
      .fn<() => Promise<MyLoans>>()
      .mockResolvedValueOnce(body([loan()]))
      .mockResolvedValue(body([loan('m1', 0, 600)]));
    const { result } = renderHook(() => useLoanRepay({ reload }));
    act(() => result.current.pay([loan()], shareKeys('m1', firstBill)));
    await act(async () => undefined);
    expect(payFromWallet).toHaveBeenCalledTimes(1);
    expect(payFromWallet).toHaveBeenCalledWith({ type: 'input', input: invoiceOf(firstBill) });
    expect(send).toHaveBeenCalledTimes(1);
    expect(result.current.sentSats).toBe(500);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(WALLET_PAY_BALANCE_POLL_MS);
    });
    expect(result.current.phase).toBe('repaid');
  });

  it('reloads and stays idle when every named share is already gone from /due', async () => {
    const namedA = bill('GoneA', 500);
    const namedB = bill('GoneB', 400, 1);
    const stillDue = bill('StillDue', 300, 2);
    vi.mocked(postRepaymentDue).mockResolvedValue({
      bills: [stillDue],
      waiting: [],
    });
    vi.mocked(payFromWallet).mockResolvedValue(confirmed(300));
    const reload = vi.fn(async (): Promise<MyLoans> => body([loan()]));
    const { result } = renderHook(() => useLoanRepay({ reload }));
    act(() => result.current.pay([loan()], shareKeys('m1', namedA, namedB)));
    await waitFor(() => expect(result.current.phase).toBe('idle'));
    expect(payFromWallet).not.toHaveBeenCalled();
    expect(reload).toHaveBeenCalledTimes(1);
    expect(result.current.sentSats).toBe(0);
    expect(result.current.missingSats).toBeNull();
  });

  it('sends nothing when a named unreserved share is missing from /due', async () => {
    const present = bill('Present', 500);
    const absent = bill('Absent', 400, 1);
    vi.mocked(postRepaymentDue).mockResolvedValue({
      bills: [present],
      waiting: [],
    });
    vi.mocked(payFromWallet).mockResolvedValue(confirmed(500));
    const reload = vi.fn(async (): Promise<MyLoans> => body([loan()]));
    const { result } = renderHook(() => useLoanRepay({ reload }));
    act(() => result.current.pay([loan()], shareKeys('m1', present, absent)));
    await waitFor(() => expect(result.current.phase).toBe('idle'));
    expect(payFromWallet).not.toHaveBeenCalled();
    expect(reload).toHaveBeenCalledTimes(1);
    expect(result.current.missingSats).toBeNull();
  });

  it('pays every named share in the set', async () => {
    vi.useFakeTimers();
    const firstBill = bill('LimitKeepA', 500);
    const secondBill = bill('LimitKeepB', 400, 1);
    const sendFirst = vi.fn(async (): Promise<WalletSendResult> => ({ kind: 'paid' }));
    const sendSecond = vi.fn(async (): Promise<WalletSendResult> => ({ kind: 'paid' }));
    vi.mocked(postRepaymentDue).mockResolvedValue({
      bills: [firstBill, secondBill],
      waiting: [],
    });
    vi.mocked(payFromWallet)
      .mockResolvedValueOnce(confirmed(500, sendFirst, 10))
      .mockResolvedValueOnce(confirmed(400, sendSecond, 10));
    const reload = vi
      .fn<() => Promise<MyLoans>>()
      .mockResolvedValueOnce(body([loan()]))
      .mockResolvedValue(body([loan('m1', 0, 1_000)]));
    const { result } = renderHook(() => useLoanRepay({ reload }));
    act(() => result.current.pay([loan()], shareKeys('m1', firstBill, secondBill)));
    await act(async () => undefined);
    expect(sendFirst).toHaveBeenCalledTimes(1);
    expect(sendSecond).toHaveBeenCalledTimes(1);
    expect(result.current.sentSats).toBe(900);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(WALLET_PAY_BALANCE_POLL_MS);
    });
    expect(result.current.phase).toBe('repaid');
  });

  it('sends nothing when the named share set fees exceed the balance', async () => {
    setWallet('ready', 900);
    const firstBill = bill('FeeGapA', 500);
    const secondBill = bill('FeeGapB', 400, 1);
    const sendFirst = vi.fn(async (): Promise<WalletSendResult> => ({ kind: 'paid' }));
    const sendSecond = vi.fn(async (): Promise<WalletSendResult> => ({ kind: 'paid' }));
    vi.mocked(postRepaymentDue).mockResolvedValue({
      bills: [firstBill, secondBill],
      waiting: [],
    });
    vi.mocked(payFromWallet)
      .mockResolvedValueOnce(confirmed(500, sendFirst, 50))
      .mockResolvedValueOnce(confirmed(400, sendSecond, 50));
    const { result } = renderHook(() =>
      useLoanRepay({ reload: vi.fn(async () => body([loan()])) }),
    );
    act(() => result.current.pay([loan()], shareKeys('m1', firstBill, secondBill)));
    await waitFor(() => expect(result.current.phase).toBe('idle'));
    expect(sendFirst).not.toHaveBeenCalled();
    expect(sendSecond).not.toHaveBeenCalled();
    expect(result.current).toMatchObject({ missingSats: 100, sentSats: 0 });
  });

  it('sends nothing after insufficient preparation of a named share', async () => {
    setWallet('ready', 600);
    const firstBill = bill('Bruno', 500);
    const secondBill = bill('Cara', 400, 1);
    const send = vi.fn(async (): Promise<WalletSendResult> => ({ kind: 'paid' }));
    vi.mocked(postRepaymentDue).mockResolvedValue({
      bills: [firstBill, secondBill],
      waiting: [],
    });
    vi.mocked(payFromWallet)
      .mockResolvedValueOnce(confirmed(500, send, 10))
      .mockResolvedValueOnce({
        kind: 'insufficient',
        feeSats: 20,
        failure: failure('prepare', 'insufficient'),
      });
    const { result } = renderHook(() =>
      useLoanRepay({ reload: vi.fn(async () => body([loan()])) }),
    );
    act(() => result.current.pay([loan()], shareKeys('m1', firstBill, secondBill)));
    await waitFor(() => expect(result.current.phase).toBe('idle'));
    expect(send).not.toHaveBeenCalled();
    expect(result.current).toMatchObject({ missingSats: 330, sentSats: 0 });
  });

  it('prepares only the named shares when /due amounts shrink below the ledger', async () => {
    vi.useFakeTimers();
    const billA = bill('NamedA', 450);
    const billB = bill('NamedB', 360, 1);
    const billC = bill('UnnamedC', 80, 2);
    const sendA = vi.fn(async (): Promise<WalletSendResult> => ({ kind: 'paid' }));
    const sendB = vi.fn(async (): Promise<WalletSendResult> => ({ kind: 'paid' }));
    const sendC = vi.fn(async (): Promise<WalletSendResult> => ({ kind: 'paid' }));
    vi.mocked(postRepaymentDue).mockResolvedValue({
      bills: [billA, billB, billC],
      waiting: [],
    });
    vi.mocked(payFromWallet).mockImplementation(async (request) => {
      if (request.type !== 'input') {
        return { kind: 'failed', failure: failure('prepare', 'sdk_error') };
      }
      if (request.input === invoiceOf(billA)) {
        return confirmed(450, sendA);
      }
      if (request.input === invoiceOf(billB)) {
        return confirmed(360, sendB);
      }
      return confirmed(80, sendC);
    });
    const reload = vi
      .fn<() => Promise<MyLoans>>()
      .mockResolvedValueOnce(body([loan()]))
      .mockResolvedValue(body([loan('m1', 0, 910)]));
    const { result } = renderHook(() => useLoanRepay({ reload }));
    act(() => result.current.pay([loan()], shareKeys('m1', billA, billB)));
    await act(async () => undefined);
    expect(payFromWallet).toHaveBeenCalledTimes(2);
    expect(payFromWallet).toHaveBeenCalledWith({ type: 'input', input: invoiceOf(billA) });
    expect(payFromWallet).toHaveBeenCalledWith({ type: 'input', input: invoiceOf(billB) });
    expect(sendA).toHaveBeenCalledTimes(1);
    expect(sendB).toHaveBeenCalledTimes(1);
    expect(sendC).not.toHaveBeenCalled();
    expect(result.current.sentSats).toBe(810);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(WALLET_PAY_BALANCE_POLL_MS);
    });
    expect(result.current.phase).toBe('repaid');
  });
});

describe('useLoanRepay send and settlement', () => {
  it('uses zero for a null balance when send reports insufficient funds', async () => {
    let resolveSend!: (result: WalletSendResult) => void;
    const send = vi.fn(
      () =>
        new Promise<WalletSendResult>((resolve) => {
          resolveSend = resolve;
        }),
    );
    vi.mocked(postRepaymentDue).mockResolvedValue({ bills: [bill('Bruno')], waiting: [] });
    vi.mocked(payFromWallet).mockResolvedValue(confirmed(500, send));
    const { result } = renderHook(() =>
      useLoanRepay({ reload: vi.fn(async () => body([loan()])) }),
    );
    act(() => result.current.pay([loan()]));
    await waitFor(() => expect(send).toHaveBeenCalledTimes(1));
    await act(async () => {
      setWallet('ready', null);
      resolveSend({ kind: 'insufficient', failure: failure('send', 'insufficient') });
    });
    expect(result.current).toMatchObject({
      phase: 'failed',
      missingSats: 500,
      sentSats: 0,
    });
  });

  it('marks a partial run failed only after the sent bill settles', async () => {
    vi.useFakeTimers();
    setWallet('ready', 110);
    vi.mocked(postRepaymentDue).mockResolvedValue({
      bills: [bill('Bruno', 50), bill('Cara', 60, 1)],
      waiting: [],
    });
    vi.mocked(payFromWallet)
      .mockResolvedValueOnce(
        confirmed(50, async () => {
          setWallet('ready', 50);
          return { kind: 'paid' };
        }),
      )
      .mockResolvedValueOnce(
        confirmed(60, async () => ({
          kind: 'insufficient',
          failure: failure('send', 'insufficient'),
        })),
      );
    const reload = vi
      .fn<() => Promise<MyLoans>>()
      .mockResolvedValueOnce(body([loan('m1', 110, 100)]))
      .mockResolvedValue(body([loan('m1', 50, 150)]));
    const { result } = renderHook(() => useLoanRepay({ reload }));
    act(() => result.current.pay([loan('m1', 110, 100)]));
    await act(async () => undefined);
    expect(result.current).toMatchObject({
      phase: 'waiting',
      sentSats: 50,
      missingSats: 10,
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(WALLET_PAY_BALANCE_POLL_MS);
    });
    expect(result.current).toMatchObject({
      phase: 'failed',
      errorKey: 'forum.payErrorRequest',
      sentSats: 50,
    });
  });

  it.each(['failed', 'expired'] as const)('fails with nothing sent on %s', async (kind) => {
    vi.mocked(postRepaymentDue).mockResolvedValue({ bills: [bill('Bruno')], waiting: [] });
    vi.mocked(payFromWallet).mockResolvedValue(
      confirmed(500, async (): Promise<WalletSendResult> =>
        kind === 'expired'
          ? { kind: 'expired', failure: failure('send', 'expired') }
          : { kind: 'failed', failure: failure('send', 'sdk_error') },
      ),
    );
    const { result } = renderHook(() =>
      useLoanRepay({ reload: vi.fn(async () => body([loan()])) }),
    );
    act(() => result.current.pay([loan()]));
    await waitFor(() => expect(result.current.phase).toBe('failed'));
    expect(result.current.sentSats).toBe(0);
  });

  it.each([true, false])('ignores an inactive failed send with late result %s', async (wasSent) => {
    let resolveSend!: (result: WalletSendResult) => void;
    let resolveLate!: (sent: boolean) => void;
    const sentLate = new Promise<boolean>((resolve) => {
      resolveLate = resolve;
    });
    vi.mocked(postRepaymentDue).mockResolvedValue({ bills: [bill('Bruno')], waiting: [] });
    vi.mocked(payFromWallet).mockResolvedValue(
      confirmed(
        500,
        () =>
          new Promise<WalletSendResult>((resolve) => {
            resolveSend = resolve;
          }),
      ),
    );
    const { result } = renderHook(() =>
      useLoanRepay({ reload: vi.fn(async () => body([loan()])) }),
    );
    act(() => result.current.pay([loan()]));
    await waitFor(() => expect(resolveSend).toBeTypeOf('function'));
    await act(async () => {
      useAuthStore.setState({ session: 'other' });
    });
    await act(async () => {
      resolveSend({ kind: 'failed', failure: failure('send', 'timeout'), sentLate });
    });
    await act(async () => {
      resolveLate(wasSent);
    });
    expect(result.current.phase).toBe('idle');
  });

  it('blocks retry while a late send is pending, then counts true and settles as repaid', async () => {
    vi.useFakeTimers();
    let resolveLate!: (sent: boolean) => void;
    const sentLate = new Promise<boolean>((resolve) => {
      resolveLate = resolve;
    });
    vi.mocked(postRepaymentDue).mockResolvedValue({ bills: [bill('Bruno')], waiting: [] });
    vi.mocked(payFromWallet).mockResolvedValue(
      confirmed(500, async () => ({
        kind: 'failed',
        failure: failure('send', 'timeout'),
        sentLate,
      })),
    );
    const reload = vi
      .fn(async (): Promise<MyLoans> => body([]))
      .mockResolvedValueOnce(body([loan()]));
    const { result } = renderHook(() => useLoanRepay({ reload }));
    act(() => result.current.pay([loan()]));
    await act(async () => undefined);
    expect(result.current).toMatchObject({ phase: 'waiting', sentSats: 0 });
    act(() => result.current.pay([loan('retry')]));
    expect(postRepaymentDue).toHaveBeenCalledTimes(1);
    await act(async () => {
      resolveLate(true);
    });
    expect(result.current).toMatchObject({ phase: 'waiting', sentSats: 500 });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(WALLET_PAY_BALANCE_POLL_MS);
    });
    expect(result.current.phase).toBe('repaid');
  });

  it('does not count a late send that resolves false', async () => {
    let resolveLate!: (sent: boolean) => void;
    vi.mocked(postRepaymentDue).mockResolvedValue({ bills: [bill('Bruno')], waiting: [] });
    vi.mocked(payFromWallet).mockResolvedValue(
      confirmed(500, async () => ({
        kind: 'failed',
        failure: failure('send', 'timeout'),
        sentLate: new Promise<boolean>((resolve) => {
          resolveLate = resolve;
        }),
      })),
    );
    const { result } = renderHook(() =>
      useLoanRepay({ reload: vi.fn(async () => body([loan()])) }),
    );
    act(() => result.current.pay([loan()]));
    await waitFor(() => expect(result.current.phase).toBe('waiting'));
    await act(async () => {
      resolveLate(false);
    });
    expect(result.current).toMatchObject({ phase: 'failed', sentSats: 0 });
  });

  it('ignores an active late-send result after the session changes', async () => {
    let resolveLate!: (sent: boolean) => void;
    const sentLate = new Promise<boolean>((resolve) => {
      resolveLate = resolve;
    });
    vi.mocked(postRepaymentDue).mockResolvedValue({ bills: [bill('Bruno')], waiting: [] });
    vi.mocked(payFromWallet).mockResolvedValue(
      confirmed(500, async () => ({
        kind: 'failed',
        failure: failure('send', 'timeout'),
        sentLate,
      })),
    );
    const { result } = renderHook(() =>
      useLoanRepay({ reload: vi.fn(async () => body([loan()])) }),
    );
    act(() => result.current.pay([loan()]));
    await waitFor(() => expect(result.current.phase).toBe('waiting'));
    await act(async () => {
      useAuthStore.setState({ session: 'other' });
    });
    await act(async () => {
      resolveLate(true);
    });
    expect(result.current).toMatchObject({ phase: 'idle', sentSats: 0 });
  });

  it('times out a late send that resolves after the confirmation window', async () => {
    vi.useFakeTimers();
    let resolveLate!: (sent: boolean) => void;
    const sentLate = new Promise<boolean>((resolve) => {
      resolveLate = resolve;
    });
    vi.mocked(postRepaymentDue).mockResolvedValue({ bills: [bill('Bruno')], waiting: [] });
    vi.mocked(payFromWallet).mockResolvedValue(
      confirmed(500, async () => ({
        kind: 'failed',
        failure: failure('send', 'timeout'),
        sentLate,
      })),
    );
    const { result } = renderHook(() =>
      useLoanRepay({ reload: vi.fn(async () => body([loan()])) }),
    );
    act(() => result.current.pay([loan()]));
    await act(async () => undefined);
    expect(result.current.phase).toBe('waiting');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(WALLET_PAY_CONFIRM_WAIT_MS + 1);
      resolveLate(true);
    });
    expect(result.current).toMatchObject({ phase: 'unconfirmed', sentSats: 500 });
  });

  it('waits for a late-send answer before settling an earlier sent bill', async () => {
    vi.useFakeTimers();
    let resolveLate!: (sent: boolean) => void;
    const sentLate = new Promise<boolean>((resolve) => {
      resolveLate = resolve;
    });
    vi.mocked(postRepaymentDue).mockResolvedValue({
      bills: [bill('Bruno', 50), bill('Cara', 60, 1)],
      waiting: [],
    });
    vi.mocked(payFromWallet)
      .mockResolvedValueOnce(confirmed(50, async () => ({ kind: 'paid' })))
      .mockResolvedValueOnce(
        confirmed(60, async () => ({
          kind: 'failed',
          failure: failure('send', 'timeout'),
          sentLate,
        })),
      );
    const reload = vi
      .fn<() => Promise<MyLoans>>()
      .mockResolvedValueOnce(body([loan('m1', 110, 100)]))
      .mockResolvedValue(body([loan('m1', 0, 150)]));
    const { result } = renderHook(() => useLoanRepay({ reload }));
    act(() => result.current.pay([loan('m1', 110, 100)]));
    await act(async () => undefined);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(WALLET_PAY_BALANCE_POLL_MS);
    });
    expect(result.current.phase).toBe('waiting');
    await act(async () => {
      resolveLate(false);
    });
    expect(result.current).toMatchObject({ phase: 'waiting', sentSats: 50 });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(WALLET_PAY_BALANCE_POLL_MS);
    });
    expect(result.current).toMatchObject({ phase: 'failed', sentSats: 50 });
  });

  it('allows only one settlement read and ignores its result after timing out', async () => {
    vi.useFakeTimers();
    let resolveReload!: (loans: MyLoans) => void;
    let reloadCalls = 0;
    const reload = vi.fn(() => {
      reloadCalls += 1;
      if (reloadCalls === 1) {
        return Promise.resolve(body([loan()]));
      }
      return new Promise<MyLoans>((resolve) => {
        resolveReload = resolve;
      });
    });
    vi.mocked(postRepaymentDue).mockResolvedValue({ bills: [bill('Bruno')], waiting: [] });
    vi.mocked(payFromWallet).mockResolvedValue(confirmed(500));
    const { result } = renderHook(() => useLoanRepay({ reload }));
    act(() => result.current.pay([loan()]));
    await act(async () => undefined);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(WALLET_PAY_BALANCE_POLL_MS * 2);
    });
    expect(reload).toHaveBeenCalledTimes(2);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(
        WALLET_PAY_CONFIRM_WAIT_MS - WALLET_PAY_BALANCE_POLL_MS * 2,
      );
    });
    expect(result.current.phase).toBe('unconfirmed');
    await act(async () => {
      resolveReload(body([loan('m1', 0, 600)]));
    });
    expect(result.current.phase).toBe('unconfirmed');
  });

  it('ignores an in-flight settlement read after the session changes', async () => {
    vi.useFakeTimers();
    let resolveReload!: (loans: MyLoans) => void;
    let reloadCalls = 0;
    const reload = vi.fn(() => {
      reloadCalls += 1;
      if (reloadCalls === 1) {
        return Promise.resolve(body([loan()]));
      }
      return new Promise<MyLoans>((resolve) => {
        resolveReload = resolve;
      });
    });
    vi.mocked(postRepaymentDue).mockResolvedValue({ bills: [bill('Bruno')], waiting: [] });
    vi.mocked(payFromWallet).mockResolvedValue(confirmed(500));
    const { result } = renderHook(() => useLoanRepay({ reload }));
    act(() => result.current.pay([loan()]));
    await act(async () => undefined);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(WALLET_PAY_BALANCE_POLL_MS);
    });
    expect(reload).toHaveBeenCalledTimes(2);
    await act(async () => {
      useAuthStore.setState({ session: 'other' });
    });
    await act(async () => {
      resolveReload(body([loan('m1', 0, 600)]));
    });
    expect(result.current.phase).toBe('idle');
  });

  it('stays waiting through null or unsettled reloads and then becomes unconfirmed', async () => {
    vi.useFakeTimers();
    vi.mocked(postRepaymentDue).mockResolvedValue({ bills: [bill('Bruno')], waiting: [] });
    vi.mocked(payFromWallet).mockResolvedValue(confirmed(500));
    const reload = vi
      .fn<() => Promise<MyLoans | null>>()
      .mockResolvedValueOnce(body([loan()]))
      .mockResolvedValueOnce(null)
      .mockResolvedValue(body([loan('m1', 500, 599)]));
    const { result } = renderHook(() => useLoanRepay({ reload }));
    act(() => result.current.pay([loan()]));
    await act(async () => undefined);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(WALLET_PAY_BALANCE_POLL_MS * 2);
    });
    expect(result.current.phase).toBe('waiting');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(
        WALLET_PAY_CONFIRM_WAIT_MS - WALLET_PAY_BALANCE_POLL_MS * 2,
      );
    });
    expect(result.current.phase).toBe('unconfirmed');
  });

  it('drops an in-flight run when the session changes', async () => {
    let resolve!: (value: Awaited<ReturnType<typeof postRepaymentDue>>) => void;
    vi.mocked(postRepaymentDue).mockReturnValue(
      new Promise<Awaited<ReturnType<typeof postRepaymentDue>>>((done) => {
        resolve = done;
      }),
    );
    const { result } = renderHook(() =>
      useLoanRepay({ reload: vi.fn(async () => body([loan()])) }),
    );
    act(() => result.current.pay([loan()]));
    await act(async () => {
      useAuthStore.setState({ session: 'other' });
    });
    await act(async () => {
      resolve({ bills: [bill('Bruno')], waiting: [] });
    });
    expect(result.current.phase).toBe('idle');
    expect(payFromWallet).not.toHaveBeenCalled();
  });
});

describe('useLoanRepay failure report', () => {
  it('reports a failed prepare under repay and the session', async () => {
    const prepareFailure = failure('prepare', 'sdk_error');
    vi.mocked(postRepaymentDue).mockResolvedValue({ bills: [bill('Bruno')], waiting: [] });
    vi.mocked(payFromWallet).mockResolvedValue({ kind: 'failed', failure: prepareFailure });
    const { result } = renderHook(() =>
      useLoanRepay({ reload: vi.fn(async () => body([loan()])) }),
    );
    act(() => result.current.pay([loan()]));
    await waitFor(() => expect(result.current.phase).toBe('failed'));
    expect(reportPaymentFailure).toHaveBeenCalledTimes(1);
    expect(reportPaymentFailure).toHaveBeenCalledWith(
      { ...prepareFailure, amountSats: 500 },
      'repay',
      { session: 'token' },
    );
  });

  it('reports an insufficient prepare', async () => {
    const low = failure('prepare', 'insufficient');
    setWallet('ready', 1_000);
    vi.mocked(postRepaymentDue).mockResolvedValue({
      bills: [bill('Bruno', 1_000)],
      waiting: [],
    });
    vi.mocked(payFromWallet).mockResolvedValue({
      kind: 'insufficient',
      feeSats: 25,
      failure: low,
    });
    const { result } = renderHook(() =>
      useLoanRepay({ reload: vi.fn(async () => body([loan()])) }),
    );
    act(() => result.current.pay([loan()]));
    await waitFor(() => expect(result.current.phase).toBe('idle'));
    expect(reportPaymentFailure).toHaveBeenCalledTimes(1);
    expect(reportPaymentFailure).toHaveBeenCalledWith({ ...low, amountSats: 1_000 }, 'repay', {
      session: 'token',
    });
  });

  it('reports a prepared amount other than the bill as amount_mismatch', async () => {
    vi.mocked(postRepaymentDue).mockResolvedValue({ bills: [bill('Bruno')], waiting: [] });
    vi.mocked(payFromWallet).mockResolvedValue({
      kind: 'confirm',
      amountSats: 501,
      feeSats: 1,
      method: 'lightning',
      send: async () => ({ kind: 'paid' }),
    });
    const { result } = renderHook(() =>
      useLoanRepay({ reload: vi.fn(async () => body([loan()])) }),
    );
    act(() => result.current.pay([loan()]));
    await waitFor(() => expect(result.current.phase).toBe('failed'));
    expect(reportPaymentFailure).toHaveBeenCalledWith(
      {
        stage: 'prepare',
        reason: 'amount_mismatch',
        method: 'lightning',
        amountSats: 500,
        feeSats: 1,
      },
      'repay',
      { session: 'token' },
    );
  });

  it('reports a failed send with its sentLate', async () => {
    const sentLate = Promise.resolve(false);
    const sendFailure = failure('send', 'timeout');
    vi.mocked(postRepaymentDue).mockResolvedValue({ bills: [bill('Bruno')], waiting: [] });
    vi.mocked(payFromWallet).mockResolvedValue(
      confirmed(500, async () => ({ kind: 'failed', failure: sendFailure, sentLate })),
    );
    const { result } = renderHook(() =>
      useLoanRepay({ reload: vi.fn(async () => body([loan()])) }),
    );
    act(() => result.current.pay([loan()]));
    await waitFor(() => expect(result.current.phase).toBe('failed'));
    expect(reportPaymentFailure).toHaveBeenCalledWith(
      { ...sendFailure, amountSats: 500 },
      'repay',
      {
        session: 'token',
        sentLate,
      },
    );
  });

  it('reports a send that resolves after unmount', async () => {
    let resolveSend!: (result: WalletSendResult) => void;
    const send = vi.fn(
      () =>
        new Promise<WalletSendResult>((resolve) => {
          resolveSend = resolve;
        }),
    );
    vi.mocked(postRepaymentDue).mockResolvedValue({ bills: [bill('Bruno')], waiting: [] });
    vi.mocked(payFromWallet).mockResolvedValue(confirmed(500, send));
    const { result, unmount } = renderHook(() =>
      useLoanRepay({ reload: vi.fn(async () => body([loan()])) }),
    );
    act(() => result.current.pay([loan()]));
    await waitFor(() => expect(send).toHaveBeenCalledTimes(1));
    unmount();
    const sendFailure = failure('send', 'no_route');
    await act(async () => {
      resolveSend({ kind: 'failed', failure: sendFailure });
    });
    expect(reportPaymentFailure).toHaveBeenCalledWith(
      { ...sendFailure, amountSats: 500 },
      'repay',
      { session: 'token', sentLate: undefined },
    );
  });

  it('does not report a prepare that resolves after unmount', async () => {
    let resolvePrepare!: (result: WalletPayResult) => void;
    vi.mocked(postRepaymentDue).mockResolvedValue({ bills: [bill('Bruno')], waiting: [] });
    vi.mocked(payFromWallet).mockReturnValue(
      new Promise<WalletPayResult>((resolve) => {
        resolvePrepare = resolve;
      }),
    );
    const { result, unmount } = renderHook(() =>
      useLoanRepay({ reload: vi.fn(async () => body([loan()])) }),
    );
    act(() => result.current.pay([loan()]));
    await waitFor(() => expect(payFromWallet).toHaveBeenCalledTimes(1));
    unmount();
    await act(async () => {
      resolvePrepare({ kind: 'failed', failure: failure('prepare', 'sdk_error') });
    });
    expect(reportPaymentFailure).not.toHaveBeenCalled();
  });

  it('reports nothing for a paid run', async () => {
    vi.useFakeTimers();
    vi.mocked(postRepaymentDue).mockResolvedValue({ bills: [bill('Bruno')], waiting: [] });
    vi.mocked(payFromWallet).mockResolvedValue(confirmed(500));
    const reload = vi.fn(async (): Promise<MyLoans> => body([loan('m1', 0, 600)]));
    const { result } = renderHook(() => useLoanRepay({ reload }));
    act(() => result.current.pay([loan()]));
    await act(async () => undefined);
    expect(result.current.phase).toBe('waiting');
    expect(reportPaymentFailure).not.toHaveBeenCalled();
  });
});

describe('useLoanRepay already-sent invoices', () => {
  it('prepares only the named unpaid share when a reserved leader would free budget', async () => {
    const billA = bill('NamedA', 500);
    const billB = bill('NamedB', 400, 1);
    const billC = bill('UnnamedC', 300, 2);
    const sendA = vi.fn(async (): Promise<WalletSendResult> => ({ kind: 'paid' }));
    const sendBFail = vi.fn(async (): Promise<WalletSendResult> => ({
      kind: 'failed',
      failure: failure('send', 'sdk_error'),
    }));
    vi.mocked(postRepaymentDue).mockResolvedValue({
      bills: [billA, billB, billC],
      waiting: [],
    });
    vi.mocked(payFromWallet)
      .mockResolvedValueOnce(confirmed(500, sendA))
      .mockResolvedValueOnce(confirmed(400, sendBFail));
    const first = renderHook(() =>
      useLoanRepay({ reload: vi.fn(async () => body([loan('m1', 1_200, 100)])) }),
    );
    act(() => first.result.current.pay([loan('m1', 1_200, 100)], shareKeys('m1', billA, billB)));
    await act(async () => undefined);
    expect(sendA).toHaveBeenCalledTimes(1);
    expect(sendBFail).toHaveBeenCalledTimes(1);
    expect(payFromWallet).toHaveBeenCalledTimes(2);
    first.unmount();

    const sendB = vi.fn(async (): Promise<WalletSendResult> => ({ kind: 'paid' }));
    vi.mocked(payFromWallet).mockReset();
    vi.mocked(payFromWallet).mockImplementation(async (request) => {
      if (request.type !== 'input') {
        return { kind: 'failed', failure: failure('prepare', 'sdk_error') };
      }
      expect(request.input).toBe(invoiceOf(billB));
      return confirmed(400, sendB);
    });
    vi.mocked(postRepaymentDue).mockResolvedValue({
      bills: [billA, billB, billC],
      waiting: [],
    });
    const second = renderHook(() =>
      useLoanRepay({ reload: vi.fn(async () => body([loan('m1', 0, 1_000)])) }),
    );
    act(() => second.result.current.pay([loan('m1', 700, 600)], shareKeys('m1', billA, billB)));
    await act(async () => undefined);
    expect(payFromWallet).toHaveBeenCalledTimes(1);
    expect(payFromWallet).toHaveBeenCalledWith({ type: 'input', input: invoiceOf(billB) });
    expect(sendB).toHaveBeenCalledTimes(1);
    expect(second.result.current.sentSats).toBe(400);
  });

  it('ends unconfirmed when every named share is reserved and prepares nothing', async () => {
    const billA = bill('AllNamedA', 500);
    const billB = bill('AllNamedB', 400, 1);
    const billC = bill('AllNamedC', 300, 2);
    const sendA = vi.fn(async (): Promise<WalletSendResult> => ({ kind: 'paid' }));
    const sendB = vi.fn(async (): Promise<WalletSendResult> => ({ kind: 'paid' }));
    vi.mocked(postRepaymentDue).mockResolvedValue({
      bills: [billA, billB],
      waiting: [],
    });
    vi.mocked(payFromWallet)
      .mockResolvedValueOnce(confirmed(500, sendA))
      .mockResolvedValueOnce(confirmed(400, sendB));
    const seed = renderHook(() =>
      useLoanRepay({ reload: vi.fn(async () => body([loan('m1', 900, 100)])) }),
    );
    act(() => seed.result.current.pay([loan('m1', 900, 100)], shareKeys('m1', billA, billB)));
    await act(async () => undefined);
    expect(sendA).toHaveBeenCalledTimes(1);
    expect(sendB).toHaveBeenCalledTimes(1);
    seed.unmount();

    vi.mocked(payFromWallet).mockReset();
    vi.mocked(payFromWallet).mockResolvedValue(confirmed(300));
    vi.mocked(postRepaymentDue).mockResolvedValue({
      bills: [billA, billB, billC],
      waiting: [],
    });
    const reload = vi.fn(async (): Promise<MyLoans> => body([loan()]));
    const second = renderHook(() => useLoanRepay({ reload }));
    act(() => second.result.current.pay([loan('m1', 1_200, 100)], shareKeys('m1', billA, billB)));
    await waitFor(() => expect(second.result.current.phase).toBe('unconfirmed'));
    expect(payFromWallet).not.toHaveBeenCalled();
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('prepares only the unpaid bill when a prior run paid the first and failed the second', async () => {
    vi.useFakeTimers();
    const firstBill = bill('SkipPaid', 500);
    const secondBill = bill('SkipFail', 400, 1);
    const sendPaid = vi.fn(async (): Promise<WalletSendResult> => ({ kind: 'paid' }));
    const sendFail = vi.fn(async (): Promise<WalletSendResult> => ({
      kind: 'failed',
      failure: failure('send', 'sdk_error'),
    }));
    vi.mocked(postRepaymentDue).mockResolvedValue({
      bills: [firstBill, secondBill],
      waiting: [],
    });
    vi.mocked(payFromWallet)
      .mockResolvedValueOnce(confirmed(500, sendPaid))
      .mockResolvedValueOnce(confirmed(400, sendFail));
    const reload = vi
      .fn<() => Promise<MyLoans>>()
      .mockResolvedValueOnce(body([loan('m1', 900, 100)]))
      .mockResolvedValue(body([loan('m1', 400, 600)]));
    const { result } = renderHook(() => useLoanRepay({ reload }));
    act(() => result.current.pay([loan('m1', 900, 100)]));
    await act(async () => undefined);
    expect(result.current.phase).toBe('waiting');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(WALLET_PAY_BALANCE_POLL_MS);
    });
    expect(result.current).toMatchObject({ phase: 'failed', sentSats: 500 });

    const sendSecond = vi.fn(async (): Promise<WalletSendResult> => ({ kind: 'paid' }));
    vi.mocked(payFromWallet).mockReset();
    vi.mocked(payFromWallet).mockImplementation(async (request) => {
      if (request.type !== 'input') {
        return { kind: 'failed', failure: failure('prepare', 'sdk_error') };
      }
      expect(request.input).toBe(invoiceOf(secondBill));
      return confirmed(400, sendSecond);
    });
    vi.mocked(postRepaymentDue).mockResolvedValue({
      bills: [firstBill, secondBill],
      waiting: [],
    });
    reload.mockImplementation(async (): Promise<MyLoans> => body([loan('m1', 0, 1_000)]));
    act(() => result.current.pay([loan('m1', 400, 600)]));
    await act(async () => undefined);
    expect(payFromWallet).toHaveBeenCalledTimes(1);
    expect(sendSecond).toHaveBeenCalledTimes(1);
    expect(result.current.sentSats).toBe(400);
  });

  it('does not pay again a bill that resolved paid after unmount', async () => {
    const dueBill = bill('AfterUnmount');
    let resolveSend!: (result: WalletSendResult) => void;
    const send = vi.fn(
      () =>
        new Promise<WalletSendResult>((resolve) => {
          resolveSend = resolve;
        }),
    );
    vi.mocked(postRepaymentDue).mockResolvedValue({ bills: [dueBill], waiting: [] });
    vi.mocked(payFromWallet).mockResolvedValue(confirmed(500, send));
    const { result, unmount } = renderHook(() =>
      useLoanRepay({ reload: vi.fn(async () => body([loan()])) }),
    );
    act(() => result.current.pay([loan()]));
    await waitFor(() => expect(send).toHaveBeenCalledTimes(1));
    unmount();
    await act(async () => {
      resolveSend({ kind: 'paid' });
    });

    vi.mocked(payFromWallet).mockClear();
    const reload = vi.fn(async (): Promise<MyLoans> => body([loan()]));
    vi.mocked(postRepaymentDue).mockResolvedValue({ bills: [dueBill], waiting: [] });
    const fresh = renderHook(() => useLoanRepay({ reload }));
    act(() => fresh.result.current.pay([loan()]));
    await waitFor(() => expect(fresh.result.current.phase).toBe('unconfirmed'));
    expect(payFromWallet).not.toHaveBeenCalled();
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('skips a bill whose late send is still pending', async () => {
    const dueBill = bill('LatePending');
    const sentLate = new Promise<boolean>(() => undefined);
    vi.mocked(postRepaymentDue).mockResolvedValue({ bills: [dueBill], waiting: [] });
    vi.mocked(payFromWallet).mockResolvedValue(
      confirmed(500, async () => ({
        kind: 'failed',
        failure: failure('send', 'timeout'),
        sentLate,
      })),
    );
    const first = renderHook(() => useLoanRepay({ reload: vi.fn(async () => body([loan()])) }));
    act(() => first.result.current.pay([loan()]));
    await waitFor(() => expect(first.result.current.phase).toBe('waiting'));
    first.unmount();

    vi.mocked(payFromWallet).mockClear();
    vi.mocked(payFromWallet).mockResolvedValue(confirmed(500));
    const reload = vi.fn(async (): Promise<MyLoans> => body([loan()]));
    vi.mocked(postRepaymentDue).mockResolvedValue({ bills: [dueBill], waiting: [] });
    const second = renderHook(() => useLoanRepay({ reload }));
    act(() => second.result.current.pay([loan()]));
    await waitFor(() => expect(second.result.current.phase).toBe('unconfirmed'));
    expect(payFromWallet).not.toHaveBeenCalled();
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('pays a bill again after its late send resolves false', async () => {
    const dueBill = bill('LateFalse');
    let resolveLate!: (sent: boolean) => void;
    vi.mocked(postRepaymentDue).mockResolvedValue({ bills: [dueBill], waiting: [] });
    vi.mocked(payFromWallet).mockResolvedValue(
      confirmed(500, async () => ({
        kind: 'failed',
        failure: failure('send', 'timeout'),
        sentLate: new Promise<boolean>((resolve) => {
          resolveLate = resolve;
        }),
      })),
    );
    const { result } = renderHook(() =>
      useLoanRepay({ reload: vi.fn(async () => body([loan()])) }),
    );
    act(() => result.current.pay([loan()]));
    await waitFor(() => expect(result.current.phase).toBe('waiting'));
    await act(async () => {
      resolveLate(false);
    });
    expect(result.current.phase).toBe('failed');

    const send = vi.fn(async (): Promise<WalletSendResult> => ({ kind: 'paid' }));
    vi.mocked(payFromWallet).mockReset();
    vi.mocked(payFromWallet).mockResolvedValue(confirmed(500, send));
    vi.mocked(postRepaymentDue).mockResolvedValue({ bills: [dueBill], waiting: [] });
    act(() => result.current.pay([loan()]));
    await waitFor(() => expect(send).toHaveBeenCalledTimes(1));
  });

  it('skips a bill whose late send resolved true', async () => {
    vi.useFakeTimers();
    const dueBill = bill('LateTrue');
    let resolveLate!: (sent: boolean) => void;
    const sentLate = new Promise<boolean>((resolve) => {
      resolveLate = resolve;
    });
    vi.mocked(postRepaymentDue).mockResolvedValue({ bills: [dueBill], waiting: [] });
    vi.mocked(payFromWallet).mockResolvedValue(
      confirmed(500, async () => ({
        kind: 'failed',
        failure: failure('send', 'timeout'),
        sentLate,
      })),
    );
    const reload = vi
      .fn<() => Promise<MyLoans>>()
      .mockResolvedValueOnce(body([loan()]))
      .mockResolvedValue(body([loan('m1', 0, 600)]));
    const { result } = renderHook(() => useLoanRepay({ reload }));
    act(() => result.current.pay([loan()]));
    await act(async () => undefined);
    await act(async () => {
      resolveLate(true);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(WALLET_PAY_BALANCE_POLL_MS);
    });
    expect(result.current.phase).toBe('repaid');

    vi.mocked(payFromWallet).mockReset();
    vi.mocked(payFromWallet).mockResolvedValue(confirmed(500));
    vi.mocked(postRepaymentDue).mockResolvedValue({ bills: [dueBill], waiting: [] });
    reload.mockClear();
    act(() => result.current.pay([loan()]));
    await act(async () => undefined);
    expect(result.current.phase).toBe('unconfirmed');
    expect(payFromWallet).not.toHaveBeenCalled();
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('does not send a bill whose send is still in flight after unmount', async () => {
    const dueBill = bill('InFlight');
    let resolveSend!: (result: WalletSendResult) => void;
    const send = vi.fn(
      () =>
        new Promise<WalletSendResult>((resolve) => {
          resolveSend = resolve;
        }),
    );
    vi.mocked(postRepaymentDue).mockResolvedValue({ bills: [dueBill], waiting: [] });
    vi.mocked(payFromWallet).mockResolvedValue(confirmed(500, send));
    const { result, unmount } = renderHook(() =>
      useLoanRepay({ reload: vi.fn(async () => body([loan()])) }),
    );
    act(() => result.current.pay([loan()]));
    await waitFor(() => expect(send).toHaveBeenCalledTimes(1));
    unmount();

    vi.mocked(payFromWallet).mockClear();
    const sendSecond = vi.fn(async (): Promise<WalletSendResult> => ({ kind: 'paid' }));
    vi.mocked(payFromWallet).mockResolvedValue(confirmed(500, sendSecond));
    const reload = vi.fn(async (): Promise<MyLoans> => body([loan()]));
    vi.mocked(postRepaymentDue).mockResolvedValue({ bills: [dueBill], waiting: [] });
    const fresh = renderHook(() => useLoanRepay({ reload }));
    act(() => fresh.result.current.pay([loan()]));
    await waitFor(() => expect(fresh.result.current.phase).toBe('unconfirmed'));
    expect(payFromWallet).not.toHaveBeenCalled();
    expect(sendSecond).not.toHaveBeenCalled();
    expect(reload).toHaveBeenCalledTimes(1);
    await act(async () => {
      resolveSend({ kind: 'paid' });
    });
    expect(send).toHaveBeenCalledTimes(1);
  });

  it.each(['insufficient', 'expired', 'failed'] as const)(
    'releases a bill after a send that resolves %s so a later pay sends it again',
    async (kind) => {
      const dueBill = bill(`Release${kind}`);
      vi.mocked(postRepaymentDue).mockResolvedValue({ bills: [dueBill], waiting: [] });
      vi.mocked(payFromWallet).mockResolvedValue(
        confirmed(500, async (): Promise<WalletSendResult> =>
          kind === 'insufficient'
            ? { kind: 'insufficient', failure: failure('send', 'insufficient') }
            : kind === 'expired'
              ? { kind: 'expired', failure: failure('send', 'expired') }
              : { kind: 'failed', failure: failure('send', 'sdk_error') },
        ),
      );
      const { result } = renderHook(() =>
        useLoanRepay({ reload: vi.fn(async () => body([loan()])) }),
      );
      act(() => result.current.pay([loan()]));
      await waitFor(() => expect(result.current.phase).toBe('failed'));

      const send = vi.fn(async (): Promise<WalletSendResult> => ({ kind: 'paid' }));
      vi.mocked(payFromWallet).mockReset();
      vi.mocked(payFromWallet).mockResolvedValue(confirmed(500, send));
      vi.mocked(postRepaymentDue).mockResolvedValue({ bills: [dueBill], waiting: [] });
      act(() => result.current.pay([loan()]));
      await waitFor(() => expect(send).toHaveBeenCalledTimes(1));
      expect(payFromWallet).toHaveBeenCalledTimes(1);
    },
  );

  it('skips a send when another run already reserved the same share', async () => {
    const dueBill = bill('RaceReserve');
    let resolveFirstPrepare!: (result: WalletPayResult) => void;
    let resolveSecondPrepare!: (result: WalletPayResult) => void;
    const sendFirst = vi.fn(() => new Promise<WalletSendResult>(() => undefined));
    const sendSecond = vi.fn(async (): Promise<WalletSendResult> => ({ kind: 'paid' }));
    vi.mocked(postRepaymentDue).mockResolvedValue({ bills: [dueBill], waiting: [] });
    vi.mocked(payFromWallet)
      .mockImplementationOnce(
        () =>
          new Promise<WalletPayResult>((resolve) => {
            resolveFirstPrepare = resolve;
          }),
      )
      .mockImplementationOnce(
        () =>
          new Promise<WalletPayResult>((resolve) => {
            resolveSecondPrepare = resolve;
          }),
      );
    const first = renderHook(() => useLoanRepay({ reload: vi.fn(async () => body([loan()])) }));
    const second = renderHook(() => useLoanRepay({ reload: vi.fn(async () => body([loan()])) }));
    act(() => first.result.current.pay([loan()]));
    await waitFor(() => expect(payFromWallet).toHaveBeenCalledTimes(1));
    act(() => second.result.current.pay([loan()]));
    await waitFor(() => expect(payFromWallet).toHaveBeenCalledTimes(2));
    await act(async () => {
      resolveFirstPrepare(confirmed(500, sendFirst));
    });
    await waitFor(() => expect(sendFirst).toHaveBeenCalledTimes(1));
    await act(async () => {
      resolveSecondPrepare(confirmed(500, sendSecond));
    });
    expect(sendSecond).not.toHaveBeenCalled();
    expect(second.result.current.phase).toBe('unconfirmed');
  });

  it('counts a bill skipped at send toward the settlement of its loan', async () => {
    vi.useFakeTimers();
    const billA = bill('SendSkipA', 500);
    const billB = bill('SendSkipB', 400, 1);
    let resolveASend!: (result: WalletSendResult) => void;
    const sendA = vi.fn(
      () =>
        new Promise<WalletSendResult>((resolve) => {
          resolveASend = resolve;
        }),
    );
    const sendB = vi.fn(() => new Promise<WalletSendResult>(() => undefined));
    vi.mocked(postRepaymentDue).mockResolvedValue({ bills: [billA, billB], waiting: [] });
    vi.mocked(payFromWallet).mockImplementation(async (request) => {
      if (request.type !== 'input') {
        return { kind: 'failed', failure: failure('prepare', 'sdk_error') };
      }
      if (request.input === invoiceOf(billA)) {
        return confirmed(500, sendA);
      }
      return confirmed(400, sendB);
    });
    const reload = vi
      .fn<() => Promise<MyLoans | null>>()
      .mockResolvedValueOnce(body([loan('m1', 900, 100)]))
      .mockResolvedValueOnce(body([loan('m1', 400, 600)]))
      .mockResolvedValue(body([loan('m1', 0, 1_000)]));
    const main = renderHook(() => useLoanRepay({ reload }));
    act(() => main.result.current.pay([loan('m1', 900, 100)]));
    await act(async () => undefined);
    expect(sendA).toHaveBeenCalledTimes(1);

    const other = renderHook(() => useLoanRepay({ reload: vi.fn(async () => body([loan()])) }));
    act(() => other.result.current.pay([loan('m1', 900, 100)]));
    await act(async () => undefined);
    expect(sendB).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveASend({ kind: 'paid' });
    });
    expect(sendB).toHaveBeenCalledTimes(1);
    expect(main.result.current).toMatchObject({ phase: 'waiting', sentSats: 500 });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(WALLET_PAY_BALANCE_POLL_MS);
    });
    expect(main.result.current.phase).toBe('waiting');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(WALLET_PAY_BALANCE_POLL_MS);
    });
    expect(main.result.current.phase).toBe('repaid');
  });

  it('counts skipped bills toward the settlement target of their loan', async () => {
    vi.useFakeTimers();
    const billA = bill('SkipSettleA', 500);
    const billB = bill('SkipSettleB', 400, 1);
    const sendA = vi.fn(async (): Promise<WalletSendResult> => ({ kind: 'paid' }));
    vi.mocked(postRepaymentDue).mockResolvedValue({ bills: [billA], waiting: [] });
    vi.mocked(payFromWallet).mockResolvedValue(confirmed(500, sendA));
    const first = renderHook(() =>
      useLoanRepay({ reload: vi.fn(async () => body([loan('m1', 900, 100)])) }),
    );
    act(() => first.result.current.pay([loan('m1', 900, 100)]));
    await act(async () => undefined);
    expect(sendA).toHaveBeenCalledTimes(1);
    first.unmount();

    const sendB = vi.fn(async (): Promise<WalletSendResult> => ({ kind: 'paid' }));
    vi.mocked(postRepaymentDue).mockResolvedValue({ bills: [billA, billB], waiting: [] });
    vi.mocked(payFromWallet).mockReset();
    vi.mocked(payFromWallet).mockImplementation(async (request) => {
      if (request.type !== 'input') {
        return { kind: 'failed', failure: failure('prepare', 'sdk_error') };
      }
      expect(request.input).toBe(invoiceOf(billB));
      return confirmed(400, sendB);
    });
    const waitingReload = vi
      .fn<() => Promise<MyLoans>>()
      .mockResolvedValueOnce(body([loan('m1', 900, 100)]))
      .mockResolvedValue(body([loan('m1', 400, 600)]));
    const waitingHook = renderHook(() => useLoanRepay({ reload: waitingReload }));
    act(() => waitingHook.result.current.pay([loan('m1', 900, 100)]));
    await act(async () => undefined);
    expect(sendB).toHaveBeenCalledTimes(1);
    expect(waitingHook.result.current.sentSats).toBe(400);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(WALLET_PAY_BALANCE_POLL_MS);
    });
    expect(waitingHook.result.current.phase).toBe('waiting');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(WALLET_PAY_CONFIRM_WAIT_MS - WALLET_PAY_BALANCE_POLL_MS);
    });
    expect(waitingHook.result.current.phase).toBe('unconfirmed');
    waitingHook.unmount();

    const billC = bill('SkipSettleC', 500);
    const billD = bill('SkipSettleD', 400, 1);
    const sendC = vi.fn(async (): Promise<WalletSendResult> => ({ kind: 'paid' }));
    vi.mocked(postRepaymentDue).mockResolvedValue({ bills: [billC], waiting: [] });
    vi.mocked(payFromWallet).mockReset();
    vi.mocked(payFromWallet).mockResolvedValue(confirmed(500, sendC));
    const seed = renderHook(() =>
      useLoanRepay({ reload: vi.fn(async () => body([loan('m1', 900, 100)])) }),
    );
    act(() => seed.result.current.pay([loan('m1', 900, 100)]));
    await act(async () => undefined);
    expect(sendC).toHaveBeenCalledTimes(1);
    seed.unmount();

    const sendD = vi.fn(async (): Promise<WalletSendResult> => ({ kind: 'paid' }));
    vi.mocked(postRepaymentDue).mockResolvedValue({ bills: [billC, billD], waiting: [] });
    vi.mocked(payFromWallet).mockReset();
    vi.mocked(payFromWallet).mockImplementation(async (request) => {
      if (request.type !== 'input') {
        return { kind: 'failed', failure: failure('prepare', 'sdk_error') };
      }
      expect(request.input).toBe(invoiceOf(billD));
      return confirmed(400, sendD);
    });
    const settledReload = vi
      .fn<() => Promise<MyLoans>>()
      .mockResolvedValueOnce(body([loan('m1', 900, 100)]))
      .mockResolvedValue(body([loan('m1', 0, 1_000)]));
    const settled = renderHook(() => useLoanRepay({ reload: settledReload }));
    act(() => settled.result.current.pay([loan('m1', 900, 100)]));
    await act(async () => undefined);
    expect(sendD).toHaveBeenCalledTimes(1);
    expect(settled.result.current.sentSats).toBe(400);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(WALLET_PAY_BALANCE_POLL_MS);
    });
    expect(settled.result.current.phase).toBe('repaid');
  });

  it('does not require a reserved share already counted in the fresh baseline', async () => {
    vi.useFakeTimers();
    const billA = bill('BaselineSkipA', 500);
    const billB = bill('BaselineSkipB', 400, 1);
    const sendA = vi.fn(async (): Promise<WalletSendResult> => ({ kind: 'paid' }));
    vi.mocked(postRepaymentDue).mockResolvedValue({ bills: [billA], waiting: [] });
    vi.mocked(payFromWallet).mockResolvedValue(confirmed(500, sendA));
    const first = renderHook(() =>
      useLoanRepay({ reload: vi.fn(async () => body([loan('m1', 900, 100)])) }),
    );
    act(() => first.result.current.pay([loan('m1', 900, 100)]));
    await act(async () => undefined);
    expect(sendA).toHaveBeenCalledTimes(1);
    first.unmount();

    const sendB = vi.fn(async (): Promise<WalletSendResult> => ({ kind: 'paid' }));
    vi.mocked(postRepaymentDue).mockResolvedValue({ bills: [billA, billB], waiting: [] });
    vi.mocked(payFromWallet).mockReset();
    vi.mocked(payFromWallet).mockImplementation(async (request) => {
      if (request.type !== 'input') {
        return { kind: 'failed', failure: failure('prepare', 'sdk_error') };
      }
      expect(request.input).toBe(invoiceOf(billB));
      return confirmed(400, sendB);
    });
    const reload = vi
      .fn<() => Promise<MyLoans>>()
      .mockResolvedValueOnce(body([loan('m1', 400, 600)]))
      .mockResolvedValue(body([loan('m1', 0, 1_000)]));
    const { result } = renderHook(() => useLoanRepay({ reload }));
    act(() => result.current.pay([loan('m1', 900, 100)]));
    await act(async () => undefined);
    expect(sendB).toHaveBeenCalledTimes(1);
    expect(result.current.sentSats).toBe(400);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(WALLET_PAY_BALANCE_POLL_MS);
    });
    expect(result.current.phase).toBe('repaid');
  });

  it('does not send a new invoice for a share whose first send is still in flight', async () => {
    const firstBill = bill('ShareRotate', 500, 0, 'spark-share-old');
    const rotatedBill = {
      ...bill('ShareRotate', 500, 0, 'spark-share-new'),
      recipientAccountId: firstBill.recipientAccountId,
    };
    expect(invoiceOf(firstBill)).not.toBe(invoiceOf(rotatedBill));
    expect(rotatedBill.dayIndex).toBe(firstBill.dayIndex);
    expect(rotatedBill.recipientAccountId).toBe(firstBill.recipientAccountId);
    let resolveSend!: (result: WalletSendResult) => void;
    const sendFirst = vi.fn(
      () =>
        new Promise<WalletSendResult>((resolve) => {
          resolveSend = resolve;
        }),
    );
    const sendSecond = vi.fn(async (): Promise<WalletSendResult> => ({ kind: 'paid' }));
    vi.mocked(postRepaymentDue).mockResolvedValue({ bills: [firstBill], waiting: [] });
    vi.mocked(payFromWallet).mockResolvedValue(confirmed(500, sendFirst));
    const first = renderHook(() =>
      useLoanRepay({ reload: vi.fn(async () => body([loan('share-rotate')])) }),
    );
    act(() => first.result.current.pay([loan('share-rotate')]));
    await waitFor(() => expect(sendFirst).toHaveBeenCalledTimes(1));

    vi.mocked(payFromWallet).mockReset();
    vi.mocked(payFromWallet).mockResolvedValue(confirmed(500, sendSecond));
    vi.mocked(postRepaymentDue).mockResolvedValue({ bills: [rotatedBill], waiting: [] });
    const reload = vi.fn(async (): Promise<MyLoans> => body([loan('share-rotate')]));
    const second = renderHook(() => useLoanRepay({ reload }));
    act(() => second.result.current.pay([loan('share-rotate')]));
    await waitFor(() => expect(second.result.current.phase).toBe('unconfirmed'));
    expect(payFromWallet).not.toHaveBeenCalled();
    expect(sendSecond).not.toHaveBeenCalled();
    expect(reload).toHaveBeenCalledTimes(1);
    await act(async () => {
      resolveSend({ kind: 'paid' });
    });
    expect(sendFirst).toHaveBeenCalledTimes(1);
  });
});

describe('useLoanRepay fresh settlement baseline', () => {
  it('does not treat an earlier settled bill as confirmation of a later send', async () => {
    vi.useFakeTimers();
    const billA = bill('FreshA', 500);
    const billB = bill('FreshB', 400, 1);
    const sendA = vi.fn(async (): Promise<WalletSendResult> => ({ kind: 'paid' }));
    vi.mocked(postRepaymentDue).mockResolvedValue({ bills: [billA], waiting: [] });
    vi.mocked(payFromWallet).mockResolvedValue(confirmed(500, sendA));
    const seed = renderHook(() =>
      useLoanRepay({ reload: vi.fn(async () => body([loan('fresh-m1', 400, 100)])) }),
    );
    act(() => seed.result.current.pay([loan('fresh-m1', 900, 100)]));
    await act(async () => undefined);
    expect(sendA).toHaveBeenCalledTimes(1);
    seed.unmount();

    const sendB = vi.fn(async (): Promise<WalletSendResult> => ({ kind: 'paid' }));
    vi.mocked(postRepaymentDue).mockResolvedValue({ bills: [billB], waiting: [] });
    vi.mocked(payFromWallet).mockReset();
    vi.mocked(payFromWallet).mockResolvedValue(confirmed(400, sendB));
    const reload = vi
      .fn<() => Promise<MyLoans>>()
      .mockResolvedValueOnce(body([loan('fresh-m1', 400, 600)]))
      .mockResolvedValueOnce(body([loan('fresh-m1', 400, 600)]))
      .mockResolvedValue(body([loan('fresh-m1', 0, 1_000)]));
    const { result } = renderHook(() => useLoanRepay({ reload }));
    act(() => result.current.pay([loan('fresh-m1', 900, 100)]));
    await act(async () => undefined);
    expect(sendB).toHaveBeenCalledTimes(1);
    expect(payFromWallet).toHaveBeenCalledTimes(1);
    expect(payFromWallet).toHaveBeenCalledWith({ type: 'input', input: invoiceOf(billB) });
    expect(result.current.phase).toBe('waiting');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(WALLET_PAY_BALANCE_POLL_MS);
    });
    expect(result.current.phase).toBe('waiting');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(WALLET_PAY_BALANCE_POLL_MS);
    });
    expect(result.current.phase).toBe('repaid');
  });

  it('sends nothing when the post-due reload is null', async () => {
    vi.mocked(postRepaymentDue).mockResolvedValue({
      bills: [bill('NullBase')],
      waiting: [],
    });
    vi.mocked(payFromWallet).mockResolvedValue(confirmed(500));
    const reload = vi.fn(async (): Promise<MyLoans | null> => null);
    const { result } = renderHook(() => useLoanRepay({ reload }));
    act(() => result.current.pay([loan('null-m1')]));
    await waitFor(() => expect(result.current.phase).toBe('failed'));
    expect(payFromWallet).not.toHaveBeenCalled();
    expect(result.current.errorKey).toBe('forum.payErrorRequest');
  });

  it('sends nothing when the post-due reload omits a loan that has a bill', async () => {
    vi.mocked(postRepaymentDue).mockResolvedValue({
      bills: [bill('OmitLoan')],
      waiting: [],
    });
    vi.mocked(payFromWallet).mockResolvedValue(confirmed(500));
    const reload = vi.fn(async (): Promise<MyLoans> => body([loan('other-loan', 0, 9_000)]));
    const { result } = renderHook(() => useLoanRepay({ reload }));
    act(() => result.current.pay([loan('omit-m1')]));
    await waitFor(() => expect(result.current.phase).toBe('failed'));
    expect(payFromWallet).not.toHaveBeenCalled();
    expect(result.current.errorKey).toBe('forum.payErrorRequest');
  });

  it('proceeds when the post-due reload omits a loan that has no bills in the run', async () => {
    vi.useFakeTimers();
    vi.mocked(postRepaymentDue).mockResolvedValue({
      bills: [bill('Keep')],
      waiting: [],
    });
    vi.mocked(payFromWallet).mockResolvedValue(confirmed(500));
    const payable = loan('keep-m1', 500, 100);
    const skipped = loan('skip-m2', 0, 50);
    const reload = vi
      .fn<() => Promise<MyLoans>>()
      .mockResolvedValueOnce(body([payable]))
      .mockResolvedValue(body([loan('keep-m1', 0, 600)]));
    const { result } = renderHook(() => useLoanRepay({ reload }));
    act(() => result.current.pay([payable, skipped]));
    await act(async () => undefined);
    expect(payFromWallet).toHaveBeenCalledTimes(1);
    expect(result.current.phase).toBe('waiting');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(WALLET_PAY_BALANCE_POLL_MS);
    });
    expect(result.current.phase).toBe('repaid');
  });
});

describe('useLoanRepay visual pins', () => {
  const pins = [
    ['repay-ready', 'idle', 21_000],
    ['repay-connecting', 'connecting', null],
    ['repay-setup-failed', 'setupFailed', null],
    ['repay-short', 'idle', 600],
    ['repay-fee-gap', 'idle', 1_000],
    ['repay-fee-gap-topup', 'idle', 1_000],
    ['repay-topup', 'idle', 600],
    ['repay-sending', 'sending', 21_000],
    ['repay-partial', 'idle', 21_000],
    ['repay-repaid', 'repaid', 21_000],
    ['repay-repaid-multi', 'repaid', 21_000],
    ['repay-unconfirmed', 'unconfirmed', 21_000],
    ['repay-failed', 'failed', 21_000],
  ] as const;

  it.each(pins)('pins %s only in a Playwright build', (visual, phase, balanceSats) => {
    vi.useFakeTimers();
    vi.mocked(getE2eNow).mockReturnValue('2026-10-10T12:00:00.000Z');
    window.history.replaceState({}, '', `/loans/repay?visual=${visual}`);
    setWallet('disabled', null);
    const { result } = renderHook(() =>
      useLoanRepay({ reload: vi.fn(async () => body([loan()])) }),
    );
    expect(result.current).toMatchObject({ phase, balanceSats, pinned: true });
    act(() => {
      result.current.openTopUp();
      result.current.pay([loan()]);
      vi.advanceTimersByTime(WALLET_PAY_BALANCE_POLL_MS);
    });
    expect(postRepaymentDue).not.toHaveBeenCalled();
    expect(refreshWallet).not.toHaveBeenCalled();
    expect(reportPaymentFailure).not.toHaveBeenCalled();
    if (visual === 'repay-topup' || visual === 'repay-fee-gap-topup') {
      expect(result.current.topUpOpen).toBe(true);
    }
    if (visual === 'repay-fee-gap' || visual === 'repay-fee-gap-topup') {
      expect(result.current.missingSats).toBe(25);
    }
    if (visual === 'repay-partial') {
      expect(result.current).toMatchObject({ sentSats: 500, sentNames: ['Bruno'] });
    }
    if (visual === 'repay-repaid') {
      expect(result.current).toMatchObject({
        sentSats: 1_000,
        sentNames: ['Bruno', 'Carla', 'Diego'],
      });
    }
    if (visual === 'repay-repaid-multi') {
      expect(result.current).toMatchObject({
        sentSats: 2_200,
        sentNames: ['Bruno', 'Carla', 'Diego', 'Elena', 'Farid'],
      });
    }
    if (visual === 'repay-failed') {
      expect(result.current.errorKey).toBe('forum.payErrorRequest');
    }
  });

  it.each(pins.map(([visual]) => visual))('ignores %s in a production build', (visual) => {
    window.history.replaceState({}, '', `/loans/repay?visual=${visual}`);
    setWallet('disabled', null);
    const { result } = renderHook(() =>
      useLoanRepay({ reload: vi.fn(async () => body([loan()])) }),
    );
    expect(result.current).toMatchObject({ phase: 'unavailable', pinned: false });
  });

  it('ignores another visual value in a Playwright build', () => {
    vi.mocked(getE2eNow).mockReturnValue('2026-10-10T12:00:00.000Z');
    window.history.replaceState({}, '', '/loans/repay?visual=other');
    const { result } = renderHook(() =>
      useLoanRepay({ reload: vi.fn(async () => body([loan()])) }),
    );
    expect(result.current).toMatchObject({ phase: 'idle', pinned: false });
  });
});
