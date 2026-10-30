'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { deleteHeldShareBox } from '@/lib/api';
import { heldShareBoxKey } from '@/lib/held-share-box';
import { keepHeldShare, loadHeldShares, type HeldShare } from '@/lib/held-shares';
import { parseShareCode } from '@/lib/recovery-share-code';
import { peekSessionPhrase } from '@/lib/tab-phrase';
import { settlePhraseDerivations } from '@/lib/wallet/wallet-phrase';
import { useWalletPhrase, type WalletPhraseErrorKind } from '@/hooks/useWalletPhrase';
import { useAuthStore } from '@/stores/auth-store';

/** What `/settings/held-shares` shows: the list, the camera, or one share's code. */
export type HeldSharesView = 'list' | 'scan' | { qr: HeldShare };

/**
 * Where reading the boxes is: the words are looked up (`opening`, also while
 * the boxes load), the passkey must open them (`unlock`), the boxes could not
 * be read (`loadError`), or they are read (`ready`).
 */
export type HeldSharesLoad = 'opening' | 'unlock' | 'loadError' | 'ready';

/**
 * The line over the list after a scan or a failed delete: the share was kept,
 * or why it was not (`invalid` payload, the member's `own` share, a
 * `duplicate` of a share of that setup among the member's boxes, or a box the
 * api did not save), or a delete the api did not do. `username` is the owner
 * named in a readable payload.
 */
export interface HeldSharesNotice {
  /** What happened. */
  kind: 'stored' | 'invalid' | 'own' | 'duplicate' | 'saveError' | 'deleteError';
  /** Username of the share's owner, when the payload was readable. */
  username?: string;
}

/** State and actions of `/settings/held-shares`. */
export interface UseHeldSharesResult {
  /** Where reading the boxes is. */
  load: HeldSharesLoad;
  /** Whether the passkey prompt of **Open my shares** runs. */
  unlocking: boolean;
  /** Why the last passkey prompt did not open the shares, or `null`. */
  unlockError: WalletPhraseErrorKind | null;
  /** The shares that opened, by owner username. */
  shares: HeldShare[];
  /** How many boxes do not open with the current words. */
  lockedCount: number;
  /** Whether a scanned share is being kept. */
  saving: boolean;
  /** The view on screen. */
  view: HeldSharesView;
  /** The line over the list, or `null`. */
  notice: HeldSharesNotice | null;
  /** Box id of the share whose delete waits for a confirm, or `null`. */
  confirmDelete: string | null;
  /** Whether the delete of the boxes that do not open waits for a confirm. */
  confirmDeleteLocked: boolean;
  /** **Open my shares**: the passkey gives the words. */
  unlock: () => void;
  /** **Try again** after `loadError`. */
  reload: () => void;
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
  /** Asks to confirm the delete of the boxes that do not open. */
  askDeleteLocked: () => void;
  /** Deletes the boxes that do not open (the confirmed delete). */
  removeLocked: () => void;
  /** Closes the delete confirm. */
  cancel: () => void;
  /** The top-left arrow: from the camera or a code back to the list. */
  back: () => boolean;
}

/**
 * The holder side of social recovery for the signed-in member
 * (`/settings/held-shares`): the shares other members gave them, kept as
 * encrypted boxes on the api under the member's own login
 * ({@link loadHeldShares}). The boxes open with a key from the member's 12
 * words: the words of the open wallet in tab memory ({@link peekSessionPhrase},
 * after {@link settlePhraseDerivations}, no prompt), otherwise **Open my
 * shares** asks for the passkey as the recovery phrase does
 * ({@link useWalletPhrase}); only the key stays in memory, and only for the
 * account it was derived for: another account in this tab looks its words up
 * again and starts from an empty list, and an answer that arrives for the
 * previous account (key, read, keep, delete, or a passkey prompt started for
 * it) changes nothing. A box deleted here stays out of, and a share kept here
 * is added to, a read that was already running. Boxes that do not
 * open with these words are counted and can be deleted together, never on
 * their own. **Keep a share** opens the camera; a scanned payload is kept in
 * a new box ({@link keepHeldShare}) and the list comes back with a notice:
 * kept for the owner's username, or refused as not a share, the member's own,
 * a second share of one setup, or a box the api did not save. The QR icon
 * shows a share's code for its owner; the trash icon asks to confirm, and the
 * confirmed delete removes the box ({@link deleteHeldShareBox}; a box the api
 * did not delete stays and gives the delete notice). The top-left arrow steps
 * from the camera or a code back to the list, otherwise it leaves. Without an
 * account every action does nothing.
 *
 * @returns Load state, shares, view, notice, the pending delete, and the actions.
 */
export function useHeldShares(): UseHeldSharesResult {
  const session = useAuthStore((state) => state.session);
  const holderAccountId = useAuthStore((state) => state.account?.id ?? null);
  const phrase = useWalletPhrase();
  const { hidePhrase, words: phraseWords } = phrase;
  const [load, setLoad] = useState<HeldSharesLoad>('opening');
  const [shares, setShares] = useState<HeldShare[]>([]);
  const [lockedIds, setLockedIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [view, setView] = useState<HeldSharesView>('list');
  const [notice, setNotice] = useState<HeldSharesNotice | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [confirmDeleteLocked, setConfirmDeleteLocked] = useState(false);
  const [tries, setTries] = useState(0);
  /** The box key and the account it was derived for; a key never serves another account. */
  const keyRef = useRef<{ accountId: string; key: CryptoKey } | null>(null);
  const runRef = useRef(0);
  /** The account this page shows; a change starts a new epoch. */
  const accountRef = useRef<string | null>(null);
  /** Advanced on every account change; an answer of an older epoch changes nothing. */
  const epochRef = useRef(0);
  /** Boxes deleted on this page for the account, left out of a read that was already running. */
  const deletedRef = useRef<Set<string>>(new Set());
  /** Shares kept on this page for the account, added to a read that was already running. */
  const keptRef = useRef<Map<string, HeldShare>>(new Map());
  /** The passkey prompt of **Open my shares**: the epoch and account it was started for. */
  const unlockRef = useRef<{ epoch: number; accountId: string } | null>(null);
  /** Whether a scanned share is being kept, set before the state so a second scan waits. */
  const savingRef = useRef(false);

  /** Reads the boxes with `key`; an answer of an older read is dropped. */
  const read = useCallback(
    async (key: CryptoKey): Promise<void> => {
      if (session === null || holderAccountId === null) {
        return;
      }
      const run = ++runRef.current;
      setLoad('opening');
      try {
        const held = await loadHeldShares(session, holderAccountId, key);
        if (runRef.current === run) {
          const deleted = deletedRef.current;
          const listed = new Set(held.shares.map((share) => share.boxId));
          const kept = [...keptRef.current.values()].filter((share) => !listed.has(share.boxId));
          setShares(
            [...held.shares, ...kept]
              .filter((share) => !deleted.has(share.boxId))
              .sort((a, b) => a.ownerUsername.localeCompare(b.ownerUsername)),
          );
          setLockedIds(held.lockedIds.filter((id) => !deleted.has(id)));
          setLoad('ready');
        }
      } catch {
        if (runRef.current === run) {
          setLoad('loadError');
        }
      }
    },
    [holderAccountId, session],
  );

  /** Derives the key from `words`, keeps only the key, and reads the boxes. */
  const open = useCallback(
    async (words: string, accountId: string): Promise<void> => {
      const epoch = epochRef.current;
      let key: CryptoKey;
      try {
        key = await heldShareBoxKey(words);
      } catch {
        if (epochRef.current === epoch) {
          setLoad('loadError');
        }
        return;
      }
      if (epochRef.current !== epoch) {
        return;
      }
      keyRef.current = { accountId, key };
      await read(key);
    },
    [read],
  );

  useEffect(() => {
    if (accountRef.current !== holderAccountId) {
      accountRef.current = holderAccountId;
      epochRef.current += 1;
      runRef.current += 1;
      keyRef.current = null;
      deletedRef.current = new Set();
      keptRef.current = new Map();
      unlockRef.current = null;
      savingRef.current = false;
      setShares([]);
      setLockedIds([]);
      setSaving(false);
      setView('list');
      setNotice(null);
      setConfirmDelete(null);
      setConfirmDeleteLocked(false);
    }
    if (session === null || holderAccountId === null) {
      return;
    }
    let cancelled = false;
    const held = keyRef.current;
    if (held !== null) {
      void read(held.key);
      return;
    }
    setLoad('opening');
    void settlePhraseDerivations().then(() => {
      if (cancelled) {
        return;
      }
      const words = peekSessionPhrase();
      if (words === null) {
        setLoad('unlock');
        return;
      }
      void open(words, holderAccountId);
    });
    return () => {
      cancelled = true;
    };
  }, [holderAccountId, open, read, session, tries]);

  useEffect(() => {
    if (phraseWords.length !== 12) {
      return;
    }
    const words = phraseWords.join(' ');
    hidePhrase();
    const started = unlockRef.current;
    unlockRef.current = null;
    if (load === 'unlock' && started !== null && started.epoch === epochRef.current) {
      void open(words, started.accountId);
    }
  }, [hidePhrase, load, open, phraseWords]);

  const unlock = useCallback((): void => {
    if (holderAccountId === null) {
      return;
    }
    unlockRef.current = { epoch: epochRef.current, accountId: holderAccountId };
    void phrase.showPhrase();
  }, [holderAccountId, phrase]);

  const reload = useCallback((): void => {
    setTries((count) => count + 1);
  }, []);

  const scan = useCallback((): void => {
    if (holderAccountId === null || load !== 'ready' || saving) {
      return;
    }
    setNotice(null);
    setConfirmDelete(null);
    setConfirmDeleteLocked(false);
    setView('scan');
  }, [holderAccountId, load, saving]);

  const onScanResult = useCallback(
    (text: string): void => {
      const held = keyRef.current;
      if (
        session === null ||
        holderAccountId === null ||
        held?.accountId !== holderAccountId ||
        savingRef.current
      ) {
        return;
      }
      const key = held.key;
      setView('list');
      const username = parseShareCode(text)?.ownerUsername;
      savingRef.current = true;
      setSaving(true);
      const epoch = epochRef.current;
      void keepHeldShare(session, holderAccountId, key, shares, text).then((result) => {
        if (epochRef.current !== epoch) {
          return;
        }
        savingRef.current = false;
        setSaving(false);
        if (result.ok) {
          keptRef.current.set(result.share.boxId, result.share);
          setShares((current) =>
            [...current, result.share].sort((a, b) =>
              a.ownerUsername.localeCompare(b.ownerUsername),
            ),
          );
          setNotice({ kind: 'stored', username: result.share.ownerUsername });
          return;
        }
        const kind = result.reason === 'save' ? 'saveError' : result.reason;
        setNotice(username === undefined ? { kind } : { kind, username });
      });
    },
    [holderAccountId, session, shares],
  );

  const showQr = useCallback((share: HeldShare): void => {
    setNotice(null);
    setConfirmDelete(null);
    setConfirmDeleteLocked(false);
    setView({ qr: share });
  }, []);

  const askDelete = useCallback((share: HeldShare): void => {
    setConfirmDeleteLocked(false);
    setConfirmDelete(share.boxId);
  }, []);

  const remove = useCallback(
    (share: HeldShare): void => {
      if (session === null) {
        return;
      }
      setConfirmDelete(null);
      setNotice(null);
      const epoch = epochRef.current;
      deleteHeldShareBox(session, share.boxId).then(
        () => {
          if (epochRef.current === epoch) {
            deletedRef.current.add(share.boxId);
            keptRef.current.delete(share.boxId);
            setShares((current) => current.filter((kept) => kept.boxId !== share.boxId));
          }
        },
        () => {
          if (epochRef.current === epoch) {
            setNotice({ kind: 'deleteError' });
          }
        },
      );
    },
    [session],
  );

  const askDeleteLocked = useCallback((): void => {
    setConfirmDelete(null);
    setConfirmDeleteLocked(true);
  }, []);

  const removeLocked = useCallback((): void => {
    if (session === null) {
      return;
    }
    setConfirmDeleteLocked(false);
    setNotice(null);
    const epoch = epochRef.current;
    void (async () => {
      const left: string[] = [];
      for (const id of lockedIds) {
        try {
          await deleteHeldShareBox(session, id);
          if (epochRef.current === epoch) {
            deletedRef.current.add(id);
          }
        } catch {
          left.push(id);
        }
      }
      if (epochRef.current !== epoch) {
        return;
      }
      setLockedIds(left);
      if (left.length > 0) {
        setNotice({ kind: 'deleteError' });
      }
    })();
  }, [lockedIds, session]);

  const cancel = useCallback((): void => {
    setConfirmDelete(null);
    setConfirmDeleteLocked(false);
  }, []);

  const back = (): boolean => {
    if (view === 'list') {
      return false;
    }
    setView('list');
    return true;
  };

  return {
    load,
    unlocking: phrase.status === 'busy',
    unlockError: phrase.error,
    shares,
    lockedCount: lockedIds.length,
    saving,
    view,
    notice,
    confirmDelete,
    confirmDeleteLocked,
    unlock,
    reload,
    scan,
    onScanResult,
    showQr,
    askDelete,
    remove,
    askDeleteLocked,
    removeLocked,
    cancel,
    back,
  };
}
