'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { getE2eNow } from '@/lib/config';
import type { WalletPayment } from '@/lib/wallet/wallet-sdk';
import { listWalletPayments } from '@/lib/wallet/wallet-service';
import { useWalletStore } from '@/stores/wallet-store';

/** Payments loaded per page. */
export const WALLET_HISTORY_PAGE_LIMIT = 20;

/**
 * Load state of the payment list. `loading` is the first load (nothing is
 * shown yet), `ready` has a list (possibly empty), `error` failed to load.
 */
export type WalletHistoryStatus = 'loading' | 'ready' | 'error';

/** State and actions of the `/wallet` payment list. */
export interface UseWalletHistoryResult {
  /** Load state. */
  status: WalletHistoryStatus;
  /** Loaded payments, newest first. */
  payments: WalletPayment[];
  /** True while another page may exist. */
  hasMore: boolean;
  /** Loads the next page; no-op while loading or at the end. */
  loadMore: () => void;
  /** Loads the list again after an error; the error stays shown until the result arrives. */
  retry: () => void;
}

/**
 * Fixed rows for the `?visual=history-rows` screenshot, relative to the
 * Playwright clock.
 *
 * @param now - Pinned instant in epoch ms.
 * @returns Four payments: a received one with a note, a sent one, a pending
 * received one, and a failed sent one.
 */
function fixturePayments(now: number): WalletPayment[] {
  const hour = 60 * 60 * 1000;
  return [
    {
      id: 'fixture-1',
      direction: 'received',
      amountSats: 21_000,
      timestamp: now - 2 * hour,
      status: 'completed',
      senderComment: 'Thank you for the coffee',
    },
    {
      id: 'fixture-2',
      direction: 'sent',
      amountSats: 5_000,
      timestamp: now - 26 * hour,
      status: 'completed',
      senderComment: null,
    },
    {
      id: 'fixture-3',
      direction: 'received',
      amountSats: 1_500,
      timestamp: now - 50 * hour,
      status: 'pending',
      senderComment: null,
    },
    {
      id: 'fixture-4',
      direction: 'sent',
      amountSats: 2_100,
      timestamp: now - 74 * hour,
      status: 'failed',
      senderComment: null,
    },
  ];
}

/**
 * Screenshot pin for the payment list (`?visual=history-…`), honoured only in
 * a Playwright build (`getE2eNow()` set).
 *
 * @returns The pinned list state, or `null` for the live list.
 */
function historyPin(): Pick<UseWalletHistoryResult, 'status' | 'payments'> | null {
  /* v8 ignore next 3 -- SSR has no window */
  if (typeof window === 'undefined') {
    return null;
  }
  const now = getE2eNow();
  if (now === null) {
    return null;
  }
  switch (new URLSearchParams(window.location.search).get('visual')) {
    case 'history-empty':
      return { status: 'ready', payments: [] };
    case 'history-rows':
      return { status: 'ready', payments: fixturePayments(Date.parse(now)) };
    case 'history-error':
      return { status: 'error', payments: [] };
    default:
      return null;
  }
}

/**
 * Appends `next` to `current`, skipping ids already present.
 *
 * @param current - Loaded payments.
 * @param next - A newly loaded page.
 * @returns The merged list.
 */
function appendPage(current: WalletPayment[], next: WalletPayment[]): WalletPayment[] {
  const seen = new Set(current.map((payment) => payment.id));
  return [...current, ...next.filter((payment) => !seen.has(payment.id))];
}

/**
 * Loads the connected wallet's payments, newest first, a page at a time.
 * Reloads every loaded page whenever the wallet store records a successful
 * read (after connect and after each SDK sync), so the list does not depend
 * on payment events. Only the latest load writes state.
 *
 * @returns The list state and paging actions.
 */
export function useWalletHistory(): UseWalletHistoryResult {
  const [pinned] = useState(historyPin);
  const syncCount = useWalletStore((state) => state.syncCount);
  const ready = useWalletStore((state) => state.status === 'ready');
  const [status, setStatus] = useState<WalletHistoryStatus>('loading');
  const [payments, setPayments] = useState<WalletPayment[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const loaded = useRef(0);
  const request = useRef(0);
  const busy = useRef(false);

  const reload = useCallback((): void => {
    request.current += 1;
    const mine = request.current;
    const limit = Math.max(WALLET_HISTORY_PAGE_LIMIT, loaded.current);
    busy.current = true;
    listWalletPayments({ offset: 0, limit }).then(
      (page) => {
        if (mine !== request.current) {
          return;
        }
        busy.current = false;
        loaded.current = page.length;
        setPayments(page);
        setHasMore(page.length === limit);
        setStatus('ready');
      },
      () => {
        if (mine !== request.current) {
          return;
        }
        busy.current = false;
        setStatus('error');
      },
    );
  }, []);

  const loadMore = useCallback((): void => {
    if (pinned !== null || busy.current || !hasMore) {
      return;
    }
    request.current += 1;
    const mine = request.current;
    const offset = loaded.current;
    busy.current = true;
    listWalletPayments({ offset, limit: WALLET_HISTORY_PAGE_LIMIT }).then(
      (page) => {
        if (mine !== request.current) {
          return;
        }
        busy.current = false;
        loaded.current = offset + page.length;
        setPayments((current) => appendPage(current, page));
        setHasMore(page.length === WALLET_HISTORY_PAGE_LIMIT);
      },
      () => {
        if (mine !== request.current) {
          return;
        }
        busy.current = false;
        setHasMore(false);
      },
    );
  }, [hasMore, pinned]);

  const retry = useCallback((): void => {
    if (pinned !== null) {
      return;
    }
    reload();
  }, [pinned, reload]);

  useEffect(() => {
    if (pinned !== null || !ready) {
      return;
    }
    reload();
  }, [pinned, ready, reload, syncCount]);

  if (pinned !== null) {
    return { ...pinned, hasMore: false, loadMore, retry };
  }
  return { status, payments, hasMore, loadMore, retry };
}
