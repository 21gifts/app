import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { WalletReportPayment } from '@/lib/wallet/wallet-sdk';

const mocks = vi.hoisted(() => ({
  postWalletReport: vi.fn(),
  listWalletReportPayments: vi.fn(),
  logInteraction: vi.fn(),
}));

vi.mock('@/lib/api', () => ({
  WALLET_REPORT_PAGE_SIZE: 200,
  postWalletReport: mocks.postWalletReport,
}));
vi.mock('@/lib/wallet/wallet-service', () => ({
  listWalletReportPayments: mocks.listWalletReportPayments,
}));
vi.mock('@/lib/interaction-log', () => ({
  logInteraction: mocks.logInteraction,
}));

const MNEMONIC =
  'abandon ability able about above absent absorb abstract absurd abuse access accident';
const PREIMAGE = 'f'.repeat(64);

type Module = typeof import('@/lib/wallet/wallet-report');
type Stores = {
  auth: typeof import('@/stores/auth-store').useAuthStore;
  wallet: typeof import('@/stores/wallet-store').useWalletStore;
};

let mod: Module;
let stores: Stores;

/**
 * A payment in the report shape.
 *
 * @param id - Payment id.
 * @param extra - Overrides.
 * @returns The payment.
 */
function payment(id: string, extra: Partial<WalletReportPayment> = {}): WalletReportPayment {
  return {
    id,
    direction: 'in',
    status: 'completed',
    amountSats: 21,
    feeSats: 0,
    timestamp: '2026-10-07T00:00:00.000Z',
    method: 'lightning',
    paymentHash: 'e'.repeat(64),
    invoice: 'lnbc1example',
    destination: null,
    description: null,
    lnurlComment: null,
    ...extra,
  };
}

/**
 * Lists `rows` through the mocked service in pages.
 *
 * @param rows - Every payment, newest first.
 */
function listing(rows: WalletReportPayment[]): void {
  mocks.listWalletReportPayments.mockImplementation(
    ({ offset, limit }: { offset: number; limit: number }) =>
      Promise.resolve(rows.slice(offset, offset + limit)),
  );
}

/** Acknowledges every payment it receives. */
function ackAll(): void {
  mocks.postWalletReport.mockImplementation(
    (_session: string, body: { payments: WalletReportPayment[] }) =>
      Promise.resolve(body.payments.map((row) => row.id)),
  );
}

beforeEach(async () => {
  vi.resetModules();
  vi.clearAllMocks();
  mod = await import('@/lib/wallet/wallet-report');
  stores = {
    auth: (await import('@/stores/auth-store')).useAuthStore,
    wallet: (await import('@/stores/wallet-store')).useWalletStore,
  };
  stores.auth.setState({ session: 'sess' });
  stores.wallet.setState({ status: 'ready', balanceSats: 5_000, identityPubkey: 'id-1' });
  listing([]);
  ackAll();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('reportWallet', () => {
  it('sends nothing without a session or a ready wallet', async () => {
    stores.auth.setState({ session: null });
    await mod.reportWallet();
    stores.auth.setState({ session: 'sess' });
    for (const state of [
      { status: 'locked' as const },
      { status: 'ready' as const, balanceSats: null },
      { status: 'ready' as const, balanceSats: 1, identityPubkey: null },
    ]) {
      stores.wallet.setState(state);
      await mod.reportWallet();
    }
    expect(mocks.listWalletReportPayments).not.toHaveBeenCalled();
    expect(mocks.postWalletReport).not.toHaveBeenCalled();
  });

  it('sends the full history in pages of at most 200 on the first report', async () => {
    const rows = Array.from({ length: 450 }, (_, i) => payment(`p${String(i)}`));
    listing(rows);
    await mod.reportWallet();
    expect(mocks.listWalletReportPayments.mock.calls.map(([page]) => page as unknown)).toEqual([
      { offset: 0, limit: 200 },
      { offset: 200, limit: 200 },
      { offset: 400, limit: 200 },
    ]);
    const bodies = mocks.postWalletReport.mock.calls.map(
      ([session, body]) =>
        [session, body] as [string, { payments: unknown[]; balanceSats: number }],
    );
    expect(bodies.map(([, body]) => body.payments.length)).toEqual([200, 200, 50]);
    expect(
      bodies.every(([session, body]) => session === 'sess' && body.balanceSats === 5_000),
    ).toBe(true);
  });

  it('sends only payments the api has not acknowledged, and status changes again', async () => {
    listing([payment('a', { status: 'pending' }), payment('b')]);
    mocks.postWalletReport.mockResolvedValueOnce(['a', 'unknown-id']);
    await mod.reportWallet();
    stores.wallet.setState({ balanceSats: 4_000 });
    ackAll();
    await mod.reportWallet();
    const second = mocks.postWalletReport.mock.calls[1]?.[1] as { payments: WalletReportPayment[] };
    expect(second.payments.map((row) => row.id)).toEqual(['b']);
    listing([payment('a'), payment('b')]);
    await mod.reportWallet();
    const third = mocks.postWalletReport.mock.calls[2]?.[1] as { payments: WalletReportPayment[] };
    expect(third.payments.map((row) => [row.id, row.status])).toEqual([['a', 'completed']]);
  });

  it('sends a balance-only report at once when the balance changed, else after the quiet time', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-07T00:00:00.000Z'));
    await mod.reportWallet();
    expect(mocks.postWalletReport).toHaveBeenCalledTimes(1);
    expect(mocks.postWalletReport.mock.calls[0]?.[1]).toEqual({
      balanceSats: 5_000,
      syncedAt: '2026-10-07T00:00:00.000Z',
      payments: [],
    });
    await mod.reportWallet();
    expect(mocks.postWalletReport).toHaveBeenCalledTimes(1);
    stores.wallet.setState({ balanceSats: 6_000 });
    await mod.reportWallet();
    expect(mocks.postWalletReport).toHaveBeenCalledTimes(2);
    vi.setSystemTime(Date.now() + mod.WALLET_REPORT_QUIET_MS);
    await mod.reportWallet();
    expect(mocks.postWalletReport).toHaveBeenCalledTimes(3);
  });

  it('stops at a failed list or post and sends the rest on the next report', async () => {
    mocks.listWalletReportPayments.mockRejectedValueOnce(new Error('wallet-connect'));
    await mod.reportWallet();
    expect(mocks.postWalletReport).not.toHaveBeenCalled();
    listing([payment('a')]);
    mocks.postWalletReport.mockRejectedValueOnce(new Error('429'));
    await mod.reportWallet();
    await mod.reportWallet();
    const retried = mocks.postWalletReport.mock.calls[1]?.[1] as {
      payments: WalletReportPayment[];
    };
    expect(retried.payments.map((row) => row.id)).toEqual(['a']);
  });

  it('starts over for another wallet and drops work of the previous one', async () => {
    listing([payment('a')]);
    await mod.reportWallet();
    let release: (rows: WalletReportPayment[]) => void = () => undefined;
    mocks.listWalletReportPayments.mockImplementationOnce(
      () =>
        new Promise<WalletReportPayment[]>((resolve) => {
          release = resolve;
        }),
    );
    stores.wallet.setState({ identityPubkey: 'id-2', balanceSats: 1 });
    const pending = mod.reportWallet();
    await Promise.resolve();
    stores.wallet.setState({ identityPubkey: 'id-3' });
    const queued = mod.reportWallet();
    release([payment('a')]);
    await pending;
    await queued;
    const last = mocks.postWalletReport.mock.calls.at(-1)?.[1] as {
      payments: WalletReportPayment[];
    };
    expect(mocks.postWalletReport).toHaveBeenCalledTimes(2);
    expect(last.payments.map((row) => row.id)).toEqual(['a']);
  });

  it('drops acknowledgements of a wallet that changed during the post', async () => {
    listing([payment('a')]);
    mocks.postWalletReport.mockImplementationOnce(() => {
      stores.wallet.setState({ identityPubkey: 'id-2' });
      return Promise.resolve(['a']);
    });
    await mod.reportWallet();
    await mod.reportWallet();
    const second = mocks.postWalletReport.mock.calls[1]?.[1] as { payments: WalletReportPayment[] };
    expect(second.payments.map((row) => row.id)).toEqual(['a']);
  });

  it('runs one more report when asked during a running one', async () => {
    let release: () => void = () => undefined;
    mocks.listWalletReportPayments.mockImplementationOnce(
      () =>
        new Promise<WalletReportPayment[]>((resolve) => {
          release = () => {
            resolve([]);
          };
        }),
    );
    const first = mod.reportWallet();
    const second = mod.reportWallet();
    const third = mod.reportWallet();
    expect(second).toBe(first);
    expect(third).toBe(first);
    stores.wallet.setState({ balanceSats: 9 });
    release();
    await first;
    expect(mocks.listWalletReportPayments).toHaveBeenCalledTimes(2);
  });

  it('records a received payment that completes after the first listing, once', async () => {
    listing([payment('old')]);
    await mod.reportWallet();
    expect(mocks.logInteraction).not.toHaveBeenCalled();
    listing([
      payment('new', { amountSats: 500 }),
      payment('pending', { status: 'pending' }),
      payment('sent', { direction: 'out' }),
      payment('old'),
    ]);
    stores.wallet.setState({ balanceSats: 5_500 });
    await mod.reportWallet();
    expect(mocks.logInteraction).toHaveBeenCalledTimes(1);
    expect(mocks.logInteraction).toHaveBeenCalledWith(
      'payment_received_seen',
      { paymentId: 'new', amountSats: 500 },
      'sess',
    );
    listing([payment('pending'), payment('new', { amountSats: 500 }), payment('old')]);
    stores.wallet.setState({ balanceSats: 5_521 });
    await mod.reportWallet();
    expect(mocks.logInteraction).toHaveBeenCalledTimes(2);
    expect(mocks.logInteraction).toHaveBeenLastCalledWith(
      'payment_received_seen',
      { paymentId: 'pending', amountSats: 21 },
      'sess',
    );
  });

  it('keeps its cursor in tab memory only and writes no browser storage', async () => {
    const setItem = vi.spyOn(window.localStorage, 'setItem');
    const setSession = vi.spyOn(Storage.prototype, 'setItem');
    const indexedOpen = vi.fn();
    vi.stubGlobal('indexedDB', { open: indexedOpen });
    listing([payment('a')]);
    await mod.reportWallet();
    expect(setItem).not.toHaveBeenCalled();
    expect(setSession).not.toHaveBeenCalled();
    expect(indexedOpen).not.toHaveBeenCalled();
    expect(document.cookie).toBe('');
    setItem.mockRestore();
    setSession.mockRestore();
    vi.unstubAllGlobals();
  });

  it('never sends the phrase, the session, or a preimage', async () => {
    const { rememberSessionPhrase, clearSessionPhrase } = await import('@/lib/tab-phrase');
    rememberSessionPhrase(MNEMONIC);
    listing([payment('a')]);
    await mod.reportWallet();
    clearSessionPhrase();
    const sent = JSON.stringify(
      mocks.postWalletReport.mock.calls.map(([, body]) => body as unknown),
    );
    expect(sent).not.toContain(MNEMONIC);
    expect(sent).not.toContain('sess');
    expect(sent).not.toContain(PREIMAGE);
    expect(sent).not.toMatch(/preimage|mnemonic|seed|prf/i);
  });
});
