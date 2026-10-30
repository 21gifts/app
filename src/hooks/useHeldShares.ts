'use client';

import { useCallback, useState } from 'react';
import {
  deleteHeldShare,
  keepHeldShare,
  loadHeldShares,
  type HeldShare,
} from '@/lib/recovery-holder-store';
import { parseShareCode } from '@/lib/recovery-share-code';
import { useAuthStore } from '@/stores/auth-store';

/** What `/settings/held-shares` shows: the list, the camera, or one share's code. */
export type HeldSharesView = 'list' | 'scan' | { qr: HeldShare };

/**
 * The line over the list after a scan or a failed delete: the share was kept,
 * or why it was not (`invalid` payload, the member's `own` share, a
 * `duplicate` of a share of that setup in this browser, or `storage` that
 * could not be written). `username` is the owner named in a readable payload.
 */
export interface HeldSharesNotice {
  /** What happened. */
  kind: 'stored' | 'invalid' | 'own' | 'duplicate' | 'storage';
  /** Username of the share's owner, when the payload was readable. */
  username?: string;
}

/** State and actions of `/settings/held-shares`. */
export interface UseHeldSharesResult {
  /** The shares the signed-in member keeps, newest first. */
  shares: HeldShare[];
  /** The view on screen. */
  view: HeldSharesView;
  /** The line over the list, or `null`. */
  notice: HeldSharesNotice | null;
  /** Payload (`code`) of the share whose delete waits for a confirm, or `null`. */
  confirmDelete: string | null;
  /** Opens the camera. */
  scan: () => void;
  /** Keeps the scanned text and returns to the list with its notice. */
  onScanResult: (text: string) => void;
  /** Shows one share's code. */
  showQr: (share: HeldShare) => void;
  /** Asks to confirm the delete of one share. */
  askDelete: (share: HeldShare) => void;
  /** Deletes one share (the confirmed delete). */
  remove: (share: HeldShare) => void;
  /** Closes the delete confirm. */
  cancel: () => void;
  /** The top-left arrow: from the camera or a code back to the list. */
  back: () => boolean;
}

/**
 * The shares of one keeping member, or none without an account.
 *
 * @param holderAccountId - The signed-in member, or `null`.
 * @returns The shares, newest first.
 */
function readShares(holderAccountId: string | null): HeldShare[] {
  return holderAccountId === null ? [] : loadHeldShares(holderAccountId);
}

/**
 * The holder side of social recovery for the signed-in member
 * (`/settings/held-shares`): the shares other members gave them, kept in this
 * browser under the member's own account id ({@link loadHeldShares}). **Keep
 * a share** opens the camera; a scanned payload is kept with
 * {@link keepHeldShare} and the list comes back with a notice: kept for the
 * owner's username, or refused as not a share, the member's own, a second
 * share of one setup in this browser, or storage that cannot be written.
 * The QR icon shows a share's code for its owner; the trash icon asks to
 * confirm, and the confirmed delete uses {@link deleteHeldShare} (a share that
 * could not be deleted stays and gives the storage notice). The top-left arrow
 * steps from the camera or a code back to the list, otherwise it leaves.
 * Nothing is sent to the api, and without an account every action does
 * nothing.
 *
 * @returns Shares, view, notice, the pending delete, and the actions.
 */
export function useHeldShares(): UseHeldSharesResult {
  const holderAccountId = useAuthStore((state) => state.account?.id ?? null);
  const [shares, setShares] = useState<HeldShare[]>(() => readShares(holderAccountId));
  const [view, setView] = useState<HeldSharesView>('list');
  const [notice, setNotice] = useState<HeldSharesNotice | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const scan = useCallback((): void => {
    if (holderAccountId === null) {
      return;
    }
    setNotice(null);
    setConfirmDelete(null);
    setView('scan');
  }, [holderAccountId]);

  const onScanResult = useCallback(
    (text: string): void => {
      if (holderAccountId === null) {
        return;
      }
      setView('list');
      const parsed = parseShareCode(text);
      if (parsed === null) {
        setNotice({ kind: 'invalid' });
        return;
      }
      const result = keepHeldShare(holderAccountId, text, Date.now());
      setNotice({ kind: result.ok ? 'stored' : result.reason, username: parsed.ownerUsername });
      if (result.ok) {
        setShares(readShares(holderAccountId));
      }
    },
    [holderAccountId],
  );

  const showQr = useCallback((share: HeldShare): void => {
    setNotice(null);
    setConfirmDelete(null);
    setView({ qr: share });
  }, []);

  const askDelete = useCallback((share: HeldShare): void => {
    setConfirmDelete(share.code);
  }, []);

  const remove = useCallback(
    (share: HeldShare): void => {
      if (holderAccountId === null) {
        return;
      }
      deleteHeldShare(holderAccountId, share.ownerAccountId, share.identifier);
      const left = readShares(holderAccountId);
      setShares(left);
      setConfirmDelete(null);
      setNotice(left.some((kept) => kept.code === share.code) ? { kind: 'storage' } : null);
    },
    [holderAccountId],
  );

  const cancel = useCallback((): void => {
    setConfirmDelete(null);
  }, []);

  const back = (): boolean => {
    if (view === 'list') {
      return false;
    }
    setView('list');
    return true;
  };

  return {
    shares,
    view,
    notice,
    confirmDelete,
    scan,
    onScanResult,
    showQr,
    askDelete,
    remove,
    cancel,
    back,
  };
}
