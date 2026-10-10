import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useLoanRepay } from '@/hooks/useLoanRepay';
import { WALLET_PAY_BALANCE_POLL_MS, WALLET_PAY_CONFIRM_WAIT_MS } from '@/hooks/useWalletPay';
import {
  postRepaymentDue,
  WalletRequiredError,
  type MyLoan,
  type MyLoans,
  type RepaymentBill,
} from '@/lib/api';
import { getE2eNow } from '@/lib/config';
import { logInteraction } from '@/lib/interaction-log';
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
vi.mock('@/lib/interaction-log', () => ({ logInteraction: vi.fn() }));
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

function bill(
  name: string,
  amountSats = 500,
  dayIndex = 0,
  sparkInvoice: string | null = `spark-${name}`,
): RepaymentBill {
  return {
    dayIndex,
    recipientAccountId: `acc-${name}`,
    name,
    username: name.toLowerCase(),
    amountSats,
    amount: null,
    pr: `pr-${name}`,
    sparkInvoice,
  };
}

function setWallet(status: WalletStatus, balanceSats: number | null = 21_000): void {
  useWalletStore.setState({ status, balanceSats, identityPubkey: null });
}

function confirmed(
  amountSats: number,
  send: () => Promise<WalletSendResult> = async () => ({ kind: 'paid' }),
  feeSats = 0,
): WalletPayResult {
  return { kind: 'confirm', amountSats, feeSats, send };
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
  vi.mocked(logInteraction).mockReset();
  vi.mocked(getE2eNow).mockReset().mockReturnValue(null);
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
    const disabled = renderHook(() => useLoanRepay({ reload: vi.fn() }));
    expect(disabled.result.current).toMatchObject({ phase: 'unavailable', balanceSats: null });
    disabled.unmount();

    useAuthStore.setState({ account: { ...account, passkeyCredentialId: null } });
    setWallet('ready');
    const cannotUnlock = renderHook(() => useLoanRepay({ reload: vi.fn() }));
    expect(cannotUnlock.result.current.phase).toBe('unavailable');
    cannotUnlock.unmount();

    useAuthStore.setState({ account });
    setWallet('connecting', null);
    const connecting = renderHook(() => useLoanRepay({ reload: vi.fn() }));
    expect(connecting.result.current.phase).toBe('connecting');
    connecting.unmount();

    process.env.NEXT_PUBLIC_BREEZ_API_KEY = 'key';
    useAuthStore.setState({ account: { ...account, sparkWalletVerified: false } });
    setWallet('ready');
    const setup = renderHook(() => useLoanRepay({ reload: vi.fn() }));
    expect(setup.result.current.phase).toBe('connecting');
    await act(async () => {
      useWalletStore.setState({ setupFailedSession: 'token' });
    });
    expect(setup.result.current.phase).toBe('setupFailed');
    setup.unmount();

    delete process.env.NEXT_PUBLIC_BREEZ_API_KEY;
    useAuthStore.setState({ account });
    setWallet('ready', 21_000);
    const ready = renderHook(() => useLoanRepay({ reload: vi.fn() }));
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
    const { result } = renderHook(() => useLoanRepay({ reload: vi.fn() }));
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
    const { result } = renderHook(() => useLoanRepay({ reload: vi.fn() }));
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
    const { result } = renderHook(() => useLoanRepay({ reload: vi.fn() }));
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
    const { result } = renderHook(() => useLoanRepay({ reload: vi.fn() }));
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

  it.each<WalletPayResult>([
    { kind: 'failed' },
    { kind: 'unlock' },
    { kind: 'belowMinimum', minSats: 1_000 },
    confirmed(501),
  ])('fails before sending for an unusable prepare result %#', async (prepare) => {
    vi.mocked(postRepaymentDue).mockResolvedValue({ bills: [bill('Bruno')], waiting: [] });
    vi.mocked(payFromWallet).mockResolvedValue(prepare);
    const { result } = renderHook(() => useLoanRepay({ reload: vi.fn() }));
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
    const { result } = renderHook(() => useLoanRepay({ reload: vi.fn() }));
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
    vi.mocked(postRepaymentDue)
      .mockResolvedValueOnce({
        bills: [bill('Cara', 200, 2, null), bill('Bruno', 500, 1), bill('Ana', 100, 1)],
        waiting: [],
      })
      .mockResolvedValueOnce({ bills: [bill('Bruno', 300, 1)], waiting: [bill('Ignored')] });
    let bruno = 0;
    vi.mocked(payFromWallet).mockImplementation(async (request) => {
      if (request.type !== 'input') {
        return { kind: 'failed' };
      }
      const { input } = request;
      if (input === 'spark-Bruno') {
        bruno += 1;
      }
      const amount =
        input === 'pr-Cara' ? 200 : input === 'spark-Ana' ? 100 : bruno === 1 ? 500 : 300;
      return confirmed(
        amount,
        async () => {
          sent.push(input);
          return { kind: 'paid' };
        },
        2,
      );
    });
    const reload = vi.fn(async (): Promise<MyLoans> =>
      body([loan('m1', 0, 900), loan('m2', 0, 500)]),
    );
    const { result } = renderHook(() => useLoanRepay({ reload }));
    act(() => result.current.pay([firstLoan, secondLoan]));
    await act(async () => undefined);
    expect(result.current.phase).toBe('waiting');
    expect(sent).toEqual(['spark-Bruno', 'spark-Ana', 'spark-Bruno', 'pr-Cara']);
    expect(result.current).toMatchObject({
      sentSats: 1_100,
      sentNames: ['Bruno', 'Ana', 'Cara'],
      feeSats: 8,
      topUpOpen: false,
    });
    expect(logInteraction).toHaveBeenCalledTimes(4);
    expect(logInteraction).toHaveBeenCalledWith('payment_sent', { amountSats: 500 }, 'token');
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
      .mockResolvedValueOnce({ kind: 'insufficient', feeSats: 20 });
    const { result } = renderHook(() => useLoanRepay({ reload: vi.fn() }));
    act(() => result.current.pay([loan()]));
    await waitFor(() => expect(result.current.phase).toBe('idle'));
    expect(result.current.missingSats).toBe(310);
    expect(result.current.sentSats).toBe(0);
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
    const { result } = renderHook(() => useLoanRepay({ reload: vi.fn() }));
    act(() => result.current.pay([loan()]));
    await waitFor(() => expect(result.current.phase).toBe('idle'));
    expect(result.current.missingSats).toBe(200);
  });

  it('treats a null store balance as zero while preparing', async () => {
    setWallet('ready', null);
    vi.mocked(postRepaymentDue).mockResolvedValue({ bills: [bill('Bruno')], waiting: [] });
    vi.mocked(payFromWallet).mockResolvedValue(confirmed(500));
    const { result } = renderHook(() => useLoanRepay({ reload: vi.fn() }));
    act(() => result.current.pay([loan()]));
    await waitFor(() => expect(result.current.missingSats).toBe(500));
    expect(result.current).toMatchObject({ phase: 'idle', sentSats: 0 });
  });

  it('uses a limit for the fitting prefix before an insufficient bill', async () => {
    vi.useFakeTimers();
    const send = vi.fn(async (): Promise<WalletSendResult> => ({ kind: 'paid' }));
    vi.mocked(postRepaymentDue).mockResolvedValue({
      bills: [bill('Bruno', 500), bill('Cara', 400, 1)],
      waiting: [],
    });
    vi.mocked(payFromWallet)
      .mockResolvedValueOnce(confirmed(500, send, 10))
      .mockResolvedValueOnce({ kind: 'insufficient' });
    const reload = vi.fn(async (): Promise<MyLoans> => body([loan('m1', 0, 600)]));
    const { result } = renderHook(() => useLoanRepay({ reload }));
    act(() => result.current.pay([loan()], 600));
    await act(async () => undefined);
    expect(send).toHaveBeenCalledTimes(1);
    expect(result.current.sentSats).toBe(500);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(WALLET_PAY_BALANCE_POLL_MS);
    });
    expect(result.current.phase).toBe('repaid');
  });

  it('keeps an empty limited prefix idle', async () => {
    vi.mocked(postRepaymentDue).mockResolvedValue({ bills: [bill('Bruno')], waiting: [] });
    vi.mocked(payFromWallet).mockResolvedValue(confirmed(500));
    const { result } = renderHook(() => useLoanRepay({ reload: vi.fn() }));
    act(() => result.current.pay([loan()], 100));
    await waitFor(() => expect(result.current.phase).toBe('idle'));
    expect(result.current.sentSats).toBe(0);
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
    const { result } = renderHook(() => useLoanRepay({ reload: vi.fn() }));
    act(() => result.current.pay([loan()], 1_000));
    await waitFor(() => expect(send).toHaveBeenCalledTimes(1));
    await act(async () => {
      setWallet('ready', null);
      resolveSend({ kind: 'insufficient' });
    });
    expect(result.current).toMatchObject({
      phase: 'failed',
      missingSats: 500,
      sentSats: 0,
    });
  });

  it('marks a partial run failed only after the sent bill settles', async () => {
    vi.useFakeTimers();
    setWallet('ready', 100);
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
      .mockResolvedValueOnce(confirmed(60, async () => ({ kind: 'insufficient' })));
    const reload = vi.fn(async (): Promise<MyLoans> => body([loan('m1', 50, 150)]));
    const { result } = renderHook(() => useLoanRepay({ reload }));
    act(() => result.current.pay([loan('m1', 110, 100)], 1_000));
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
      confirmed(500, async (): Promise<WalletSendResult> => ({ kind })),
    );
    const { result } = renderHook(() => useLoanRepay({ reload: vi.fn() }));
    act(() => result.current.pay([loan()]));
    await waitFor(() => expect(result.current.phase).toBe('failed'));
    expect(result.current.sentSats).toBe(0);
  });

  it.each([true, false])(
    'records an inactive failed send only when its late result is %s',
    async (wasSent) => {
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
      const { result } = renderHook(() => useLoanRepay({ reload: vi.fn() }));
      act(() => result.current.pay([loan()]));
      await waitFor(() => expect(resolveSend).toBeTypeOf('function'));
      await act(async () => {
        useAuthStore.setState({ session: 'other' });
      });
      await act(async () => {
        resolveSend({ kind: 'failed', sentLate });
      });
      await act(async () => {
        resolveLate(wasSent);
      });
      expect(result.current.phase).toBe('idle');
      expect(logInteraction).toHaveBeenCalledTimes(wasSent ? 1 : 0);
    },
  );

  it('counts a late send only after it resolves true, then settles as failed', async () => {
    vi.useFakeTimers();
    let resolveLate!: (sent: boolean) => void;
    const sentLate = new Promise<boolean>((resolve) => {
      resolveLate = resolve;
    });
    vi.mocked(postRepaymentDue).mockResolvedValue({ bills: [bill('Bruno')], waiting: [] });
    vi.mocked(payFromWallet).mockResolvedValue(
      confirmed(500, async () => ({ kind: 'failed', sentLate })),
    );
    const reload = vi.fn(async (): Promise<MyLoans> => body([]));
    const { result } = renderHook(() => useLoanRepay({ reload }));
    act(() => result.current.pay([loan()]));
    await act(async () => undefined);
    expect(result.current).toMatchObject({ phase: 'failed', sentSats: 0 });
    await act(async () => {
      resolveLate(true);
    });
    expect(result.current).toMatchObject({ phase: 'waiting', sentSats: 500 });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(WALLET_PAY_BALANCE_POLL_MS);
    });
    expect(result.current.phase).toBe('failed');
  });

  it('does not count a late send that resolves false', async () => {
    let resolveLate!: (sent: boolean) => void;
    vi.mocked(postRepaymentDue).mockResolvedValue({ bills: [bill('Bruno')], waiting: [] });
    vi.mocked(payFromWallet).mockResolvedValue(
      confirmed(500, async () => ({
        kind: 'failed',
        sentLate: new Promise<boolean>((resolve) => {
          resolveLate = resolve;
        }),
      })),
    );
    const { result } = renderHook(() => useLoanRepay({ reload: vi.fn() }));
    act(() => result.current.pay([loan()]));
    await waitFor(() => expect(result.current.phase).toBe('failed'));
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
      confirmed(500, async () => ({ kind: 'failed', sentLate })),
    );
    const { result } = renderHook(() => useLoanRepay({ reload: vi.fn() }));
    act(() => result.current.pay([loan()]));
    await waitFor(() => expect(result.current.phase).toBe('failed'));
    await act(async () => {
      useAuthStore.setState({ session: 'other' });
    });
    await act(async () => {
      resolveLate(true);
    });
    expect(result.current).toMatchObject({ phase: 'idle', sentSats: 0 });
    expect(logInteraction).toHaveBeenCalledTimes(1);
  });

  it('times out a late send that resolves after the confirmation window', async () => {
    vi.useFakeTimers();
    let resolveLate!: (sent: boolean) => void;
    const sentLate = new Promise<boolean>((resolve) => {
      resolveLate = resolve;
    });
    vi.mocked(postRepaymentDue).mockResolvedValue({ bills: [bill('Bruno')], waiting: [] });
    vi.mocked(payFromWallet).mockResolvedValue(
      confirmed(500, async () => ({ kind: 'failed', sentLate })),
    );
    const { result } = renderHook(() => useLoanRepay({ reload: vi.fn() }));
    act(() => result.current.pay([loan()]));
    await act(async () => undefined);
    expect(result.current.phase).toBe('failed');
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
      .mockResolvedValueOnce(confirmed(60, async () => ({ kind: 'failed', sentLate })));
    const reload = vi.fn(async (): Promise<MyLoans> => body([loan('m1', 0, 150)]));
    const { result } = renderHook(() => useLoanRepay({ reload }));
    act(() => result.current.pay([loan('m1', 110, 100)], 1_000));
    await act(async () => undefined);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(WALLET_PAY_BALANCE_POLL_MS);
    });
    expect(result.current.phase).toBe('waiting');
    await act(async () => {
      resolveLate(false);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(WALLET_PAY_BALANCE_POLL_MS);
    });
    expect(result.current).toMatchObject({ phase: 'failed', sentSats: 50 });
  });

  it('allows only one settlement read and ignores its result after timing out', async () => {
    vi.useFakeTimers();
    let resolveReload!: (loans: MyLoans) => void;
    const reload = vi.fn(
      () =>
        new Promise<MyLoans>((resolve) => {
          resolveReload = resolve;
        }),
    );
    vi.mocked(postRepaymentDue).mockResolvedValue({ bills: [bill('Bruno')], waiting: [] });
    vi.mocked(payFromWallet).mockResolvedValue(confirmed(500));
    const { result } = renderHook(() => useLoanRepay({ reload }));
    act(() => result.current.pay([loan()]));
    await act(async () => undefined);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(WALLET_PAY_BALANCE_POLL_MS * 2);
    });
    expect(reload).toHaveBeenCalledTimes(1);
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
    const reload = vi.fn(
      () =>
        new Promise<MyLoans>((resolve) => {
          resolveReload = resolve;
        }),
    );
    vi.mocked(postRepaymentDue).mockResolvedValue({ bills: [bill('Bruno')], waiting: [] });
    vi.mocked(payFromWallet).mockResolvedValue(confirmed(500));
    const { result } = renderHook(() => useLoanRepay({ reload }));
    act(() => result.current.pay([loan()]));
    await act(async () => undefined);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(WALLET_PAY_BALANCE_POLL_MS);
    });
    expect(reload).toHaveBeenCalledTimes(1);
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
    const { result } = renderHook(() => useLoanRepay({ reload: vi.fn() }));
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

describe('useLoanRepay visual pins', () => {
  const pins = [
    ['repay-ready', 'idle', 21_000],
    ['repay-short', 'idle', 600],
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
    const { result } = renderHook(() => useLoanRepay({ reload: vi.fn() }));
    expect(result.current).toMatchObject({ phase, balanceSats, pinned: true });
    act(() => {
      result.current.openTopUp();
      result.current.pay([loan()]);
      vi.advanceTimersByTime(WALLET_PAY_BALANCE_POLL_MS);
    });
    expect(postRepaymentDue).not.toHaveBeenCalled();
    expect(refreshWallet).not.toHaveBeenCalled();
    if (visual === 'repay-topup') {
      expect(result.current.topUpOpen).toBe(true);
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
    const { result } = renderHook(() => useLoanRepay({ reload: vi.fn() }));
    expect(result.current).toMatchObject({ phase: 'unavailable', pinned: false });
  });

  it('ignores another visual value in a Playwright build', () => {
    vi.mocked(getE2eNow).mockReturnValue('2026-10-10T12:00:00.000Z');
    window.history.replaceState({}, '', '/loans/repay?visual=other');
    const { result } = renderHook(() => useLoanRepay({ reload: vi.fn() }));
    expect(result.current).toMatchObject({ phase: 'idle', pinned: false });
  });
});
