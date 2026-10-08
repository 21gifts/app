import { postWalletReport, WALLET_REPORT_PAGE_SIZE } from '@/lib/api';
import { logInteraction } from '@/lib/interaction-log';
import { listWalletReportPayments } from '@/lib/wallet/wallet-service';
import type { WalletReportPayment } from '@/lib/wallet/wallet-sdk';
import { useAuthStore } from '@/stores/auth-store';
import { useWalletStore } from '@/stores/wallet-store';

/**
 * How long a report that carries no payment and the same balance as the last
 * one waits after that one. Reports with a new balance or new payments go at once.
 */
export const WALLET_REPORT_QUIET_MS = 60_000;

/** Wallet identity the cursors below belong to. */
let identity: string | null = null;

/** Payment id → status the api acknowledged. Tab memory only. */
const acknowledged = new Map<string, WalletReportPayment['status']>();

/** Payment id → status at the last listing, or `null` before the first one. */
let listed: Map<string, WalletReportPayment['status']> | null = null;

/** Balance of the last accepted report, and when it was accepted. */
let lastBalance: number | null = null;
let lastReportAt = 0;

/** The running report, or `null`. */
let running: Promise<void> | null = null;

/** Set when a report was asked for while one was running. */
let again = false;

/**
 * Forgets every cursor, so the next report starts from the full history.
 */
function forget(): void {
  acknowledged.clear();
  listed = null;
  lastBalance = null;
  lastReportAt = 0;
}

/**
 * Every payment the wallet lists, newest first, read in pages of
 * {@link WALLET_REPORT_PAGE_SIZE}.
 *
 * @returns The payments.
 * @throws When the wallet cannot list them.
 */
async function listAll(): Promise<WalletReportPayment[]> {
  const all: WalletReportPayment[] = [];
  for (;;) {
    const page = await listWalletReportPayments({
      offset: all.length,
      limit: WALLET_REPORT_PAGE_SIZE,
    });
    all.push(...page);
    if (page.length < WALLET_REPORT_PAGE_SIZE) {
      return all;
    }
  }
}

/**
 * Records a received payment that completed while the app was open, once per
 * payment. The first listing in a tab only sets the baseline.
 *
 * @param payments - The current listing.
 * @param session - Session the report runs under.
 */
function noticeReceived(payments: WalletReportPayment[], session: string): void {
  const before = listed;
  listed = new Map(payments.map((payment) => [payment.id, payment.status]));
  if (before === null) {
    return;
  }
  for (const payment of payments) {
    if (
      payment.direction === 'in' &&
      payment.status === 'completed' &&
      before.get(payment.id) !== 'completed'
    ) {
      logInteraction(
        'payment_received_seen',
        { paymentId: payment.id, amountSats: payment.amountSats },
        session,
      );
    }
  }
}

/**
 * One report: the balance, then every payment the api has not acknowledged
 * with its current status, in requests of at most
 * {@link WALLET_REPORT_PAGE_SIZE}. Stops at the first failed request; the next
 * report sends the rest again.
 *
 * @returns Resolves when the report is sent, skipped, or stopped.
 */
async function reportOnce(): Promise<void> {
  const session = useAuthStore.getState().session;
  const wallet = useWalletStore.getState();
  if (
    session === null ||
    wallet.status !== 'ready' ||
    wallet.balanceSats === null ||
    wallet.identityPubkey === null
  ) {
    return;
  }
  if (identity !== wallet.identityPubkey) {
    identity = wallet.identityPubkey;
    forget();
  }
  const owner = identity;
  const balanceSats = wallet.balanceSats;
  const syncedAt = new Date().toISOString();
  let payments: WalletReportPayment[];
  try {
    payments = await listAll();
  } catch {
    return;
  }
  if (useWalletStore.getState().identityPubkey !== owner) {
    return;
  }
  noticeReceived(payments, session);
  const unsent = payments.filter((payment) => acknowledged.get(payment.id) !== payment.status);
  if (
    unsent.length === 0 &&
    balanceSats === lastBalance &&
    Date.now() - lastReportAt < WALLET_REPORT_QUIET_MS
  ) {
    return;
  }
  let offset = 0;
  do {
    const chunk = unsent.slice(offset, offset + WALLET_REPORT_PAGE_SIZE);
    let ids: string[];
    try {
      ids = await postWalletReport(session, { balanceSats, syncedAt, payments: chunk });
    } catch {
      return;
    }
    if (useWalletStore.getState().identityPubkey !== owner) {
      return;
    }
    const sentStatus = new Map(chunk.map((payment) => [payment.id, payment.status]));
    for (const id of ids) {
      const status = sentStatus.get(id);
      if (status !== undefined) {
        acknowledged.set(id, status);
      }
    }
    lastBalance = balanceSats;
    lastReportAt = Date.now();
    offset += WALLET_REPORT_PAGE_SIZE;
  } while (offset < unsent.length);
}

/**
 * Sends the wallet data report while the member is signed in (login opens the wallet):
 * the balance and every payment the api has not acknowledged yet (the first
 * report of a tab sends the full history). The acknowledged cursor lives in
 * tab memory only, so a new tab sends the history again; the api ignores
 * repeats. A report that carries nothing new waits
 * {@link WALLET_REPORT_QUIET_MS} after the last one. Calls while a report runs
 * add one more report after it. Without a session or a ready wallet nothing
 * is sent. The report holds the payment fields of
 * {@link WalletReportPayment} only: never the recovery phrase, a key, PRF
 * output, or a preimage. Never rejects.
 *
 * @returns Resolves when the report and any report asked for meanwhile are done.
 */
export function reportWallet(): Promise<void> {
  if (running !== null) {
    again = true;
    return running;
  }
  running = (async (): Promise<void> => {
    do {
      again = false;
      await reportOnce();
    } while (again);
  })().finally(() => {
    running = null;
  });
  return running;
}
