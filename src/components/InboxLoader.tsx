'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState, type ReactElement } from 'react';
import { InboxScreen, type InboxFormError, type InboxInvoice } from '@/components/InboxScreen';
import { useLatestRateDay } from '@/hooks/useLatestRateDay';
import {
  CONVERSATION_LIVE_POLL_MS,
  fetchConversation,
  fetchConversationMessagePhoto,
  fetchConversations,
  fetchModeratorGroup,
  markConversationRead,
  postConversationInvoice,
  postConversationMessage,
} from '@/lib/api';
import { bumpUnreadAppBadgeEpoch, refreshUnreadAppBadge } from '@/lib/app-badge';
import {
  CONTACT_MESSAGE_MAX_LENGTH,
  type Conversation,
  type ConversationMessage,
} from '@/lib/api-types';
import { prepareForumPhoto, type ForumPhotoPayload } from '@/lib/forum-photo';
import { roleAtLeast } from '@/lib/roles';
import { useAuthStore } from '@/stores/auth-store';

/** Revoke a blob URL; data URLs from {@link prepareForumPhoto} are left alone. */
function revokeIfBlob(url: string): void {
  if (url.startsWith('blob:')) {
    URL.revokeObjectURL(url);
  }
}

/**
 * Parses the inbox composer amount draft.
 *
 * @param raw - Amount field value.
 * @returns Whole sats (`0` becomes `1`), `'empty'` when blank, or `'invalid'`.
 */
function parseReplySats(raw: string): number | 'empty' | 'invalid' {
  const trimmed = raw.trim();
  if (trimmed === '') {
    return 'empty';
  }
  if (!/^\d+$/.test(trimmed)) {
    return 'invalid';
  }
  const sats = Number.parseInt(trimmed, 10);
  if (!Number.isSafeInteger(sats)) {
    return 'invalid';
  }
  return sats < 1 ? 1 : sats;
}

/**
 * True when a thrown value is the api rate-limit copy for messages or payments.
 *
 * @param err - Caught rejection.
 * @returns Whether the message looks like a rate-limit error.
 */
function isRateLimitError(err: unknown): boolean {
  /* v8 ignore next 3 -- non-Error throw is defensive; callers always reject with Error */
  if (!(err instanceof Error)) {
    return false;
  }
  return /too many (messages|payments)/i.test(err.message);
}

/**
 * True when a thrown value is the api author's-wallet rejection for payments.
 *
 * @param err - Caught rejection.
 * @returns Whether the message looks like an author's-wallet error.
 */
function isAuthorWalletError(err: unknown): boolean {
  /* v8 ignore next 3 -- non-Error throw is defensive; pay path always rejects with Error */
  if (!(err instanceof Error)) {
    return false;
  }
  return /author's wallet cannot receive this Bitcoin payment/i.test(err.message);
}

/**
 * True when a conversation poll stopped because its abort signal was cancelled.
 *
 * @param err - Caught rejection.
 * @returns Whether the rejection is an AbortError.
 */
function isAbortError(err: unknown): boolean {
  return err instanceof Error && err.name === 'AbortError';
}

function appendUnseenMessages(
  prev: readonly ConversationMessage[],
  page: readonly ConversationMessage[],
): ConversationMessage[] {
  const ids = new Set(prev.map((message) => message.id));
  const fresh = page.filter((message) => !ids.has(message.id));
  if (fresh.length === 0) {
    return prev as ConversationMessage[];
  }
  return [...prev, ...fresh].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

/**
 * Client loader for the signed-in inbox on `/messages`.
 *
 * Reads the session from the auth store, fetches the conversation list, and
 * opens `?c=` only after that list loaded, unless the list has that id as
 * `moderator_group` (new empty PMs are not yet listed). When the role is at
 * least moderator, an unlisted `?c=` first resolves {@link fetchModeratorGroup}
 * once per id, with neutral loading instead of the list; a match never
 * opens, other roles and a failed lookup fall through. The composer sends
 * free text
 * directly, or mints an invoice from its amount field and long-polls for the
 * paid gift row. Threads load the newest 20-message page first; an
 * IntersectionObserver near the oldest bubble prepends unique older pages.
 * Prepending keeps the loaded thread visible and does not toggle its loading
 * state; {@link InboxScreen} stays pinned while stuck to the bottom.
 * Open Direct / Contact / Damus threads attach JPEG/PNG/WebP stills via
 * {@link prepareForumPhoto} (cap 10); photo-only send is allowed. Thread stills
 * load via {@link fetchConversationMessagePhoto} (no fetch without a session).
 * Blob URLs are revoked on unmount, when leaving a thread, and on session loss.
 * Composer drafts and preparing are dropped
 * on thread switch (`?c=`) and session loss (`pickGeneration` bump).
 * The gift invoice path stays text/sats only. The list has no attach.
 * Renders nothing when there is no session.
 * Moderators get the origin filter; members see the full inbound list.
 * After a successful thread load and mark-read, bumps the badge epoch and
 * refreshes the home-screen badge to notifications unread plus remaining
 * inbox unread.
 * While the thread is open and the tab is visible, the newest page is fetched
 * every CONVERSATION_LIVE_POLL_MS and unseen messages are appended; a hidden
 * tab does not poll; a failed poll keeps the thread.
 *
 * @returns The inbox screen, or `null` without a session.
 */
export function InboxLoader(): ReactElement | null {
  const session = useAuthStore((state) => state.session);
  const account = useAuthStore((state) => state.account);
  const router = useRouter();
  const searchParams = useSearchParams();
  const rateDay = useLatestRateDay();
  const openId = searchParams.get('c');
  const [conversations, setConversations] = useState<Conversation[] | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
  const [messages, setMessages] = useState<ConversationMessage[] | null>(null);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [messagesError, setMessagesError] = useState(false);
  const [messagesAttempt, setMessagesAttempt] = useState(0);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [nearStartElement, setNearStartElement] = useState<HTMLLIElement | null>(null);
  const loadingMoreRef = useRef(false);
  const paginationGeneration = useRef(0);
  const [draft, setDraft] = useState('');
  const [amountDraft, setAmountDraft] = useState('');
  const [posting, setPosting] = useState(false);
  const [formError, setFormError] = useState<InboxFormError>(null);
  const [invoice, setInvoice] = useState<InboxInvoice | null>(null);
  const [payWaiting, setPayWaiting] = useState(false);
  const [staffRoomId, setStaffRoomId] = useState<string | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [photoDrafts, setPhotoDrafts] = useState<ForumPhotoPayload[]>([]);
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});
  const photoUrlsRef = useRef(photoUrls);
  photoUrlsRef.current = photoUrls;
  const pickGeneration = useRef(0);
  const payPollRef = useRef<AbortController | null>(null);
  const openIdRef = useRef(openId);
  /* v8 ignore start -- render-phase reset when ?c= changes; one frame of the old thread is not allowed */
  if (openIdRef.current !== openId) {
    paginationGeneration.current += 1;
    loadingMoreRef.current = false;
    setNextCursor(null);
    setNearStartElement(null);
    setMessages(null);
    setMessagesError(false);
    setMessagesLoading(openId !== null && openId !== '');
    setDraft('');
    setAmountDraft('');
    setFormError(null);
    setInvoice(null);
    setPayWaiting(false);
    setStaffRoomId(null);
    pickGeneration.current += 1;
    setPhotoDrafts([]);
    setPreparing(false);
    const urls = photoUrlsRef.current;
    for (const url of Object.values(urls)) {
      revokeIfBlob(url);
    }
    if (Object.keys(urls).length > 0) {
      setPhotoUrls({});
    }
    payPollRef.current?.abort();
    payPollRef.current = null;
  }
  /* v8 ignore stop */
  openIdRef.current = openId;

  const listed =
    conversations === null || openId === null || openId === ''
      ? undefined
      : conversations.find((row) => row.id === openId);
  const staff = roleAtLeast(account?.role, 'moderator');
  const waitingStaffRoom =
    staff &&
    conversations !== null &&
    openId !== null &&
    openId !== '' &&
    listed === undefined &&
    staffRoomId === null;
  const threadAllowed =
    conversations !== null &&
    openId !== null &&
    openId !== '' &&
    listed?.kind !== 'moderator_group' &&
    staffRoomId !== openId &&
    !waitingStaffRoom;

  useEffect(() => {
    if (session === null) {
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(false);
    void (async () => {
      try {
        const next = await fetchConversations(session);
        /* v8 ignore next 3 -- unmount during list fetch */
        if (cancelled) {
          return;
        }
        setConversations(next);
      } catch {
        /* v8 ignore next 3 -- unmount during list fetch error */
        if (cancelled) {
          return;
        }
        setConversations(null);
        setError(true);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [session, attempt]);

  useEffect(() => {
    if (
      session === null ||
      !staff ||
      openId === null ||
      openId === '' ||
      conversations === null ||
      listed !== undefined ||
      staffRoomId !== null
    ) {
      return;
    }
    let cancelled = false;
    void fetchModeratorGroup(session)
      .then((row) => {
        if (!cancelled) {
          setStaffRoomId(row.id);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setStaffRoomId('');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [session, staff, openId, conversations, listed, staffRoomId]);

  useEffect(() => {
    if (session === null || openId === null || openId === '' || !threadAllowed) {
      setMessages(null);
      setMessagesError(false);
      setMessagesLoading(false);
      return;
    }
    let cancelled = false;
    paginationGeneration.current += 1;
    loadingMoreRef.current = false;
    setNextCursor(null);
    setMessages(null);
    setMessagesLoading(true);
    setMessagesError(false);
    void (async () => {
      try {
        const page = await fetchConversation(session, openId);
        /* v8 ignore next 3 -- unmount during fetch */
        if (cancelled) {
          return;
        }
        setMessages(page.messages);
        setNextCursor(page.nextCursor);
        /* v8 ignore next -- a thread only opens after the inbox list loaded */
        const listedRows = conversations ?? [];
        const remaining = listedRows.filter((row) => row.id !== openId && row.unread).length;
        setConversations((prev) => {
          /* v8 ignore next 3 -- list cleared while the thread was loading */
          if (prev === null) {
            return prev;
          }
          return prev.map((row) =>
            row.id === openId ? { ...row, unread: false, unreadMessageCount: 0 } : row,
          );
        });
        void markConversationRead(session, openId).catch(() => undefined);
        bumpUnreadAppBadgeEpoch();
        void refreshUnreadAppBadge(session, remaining).catch(() => undefined);
      } catch {
        /* v8 ignore next 3 -- unmount during fetch error */
        if (cancelled) {
          return;
        }
        setMessages(null);
        setMessagesError(true);
      } finally {
        if (!cancelled) {
          setMessagesLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
      paginationGeneration.current += 1;
      loadingMoreRef.current = false;
    };
  }, [session, openId, messagesAttempt, threadAllowed]);

  const nearStartRef = useCallback((node: HTMLLIElement | null): void => {
    setNearStartElement(node);
  }, []);

  useEffect(() => {
    if (
      session === null ||
      openId === null ||
      openId === '' ||
      !threadAllowed ||
      nearStartElement === null ||
      nextCursor === null
    ) {
      return;
    }
    let cancelled = false;
    const activeSession = session;
    const activeId = openId;
    const activeCursor = nextCursor;
    const generation = paginationGeneration.current;
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting) || loadingMoreRef.current) {
        return;
      }
      loadingMoreRef.current = true;
      void (async () => {
        try {
          const page = await fetchConversation(activeSession, activeId, {
            cursor: activeCursor,
          });
          /* v8 ignore next 7 -- unmount or thread change during cursor fetch */
          if (
            cancelled ||
            generation !== paginationGeneration.current ||
            openIdRef.current !== activeId
          ) {
            return;
          }
          setMessages((prev) => {
            /* v8 ignore next -- the sentinel only renders after page one is in state */
            if (prev === null) return page.messages;
            const ids = new Set(prev.map((message) => message.id));
            const older = page.messages.filter((message) => !ids.has(message.id));
            return [...older, ...prev];
          });
          setNextCursor(page.nextCursor);
        } catch {
          // Keep the current pages and cursor so a later intersection may retry.
        } finally {
          if (!cancelled && generation === paginationGeneration.current) {
            loadingMoreRef.current = false;
          }
        }
      })();
    });
    observer.observe(nearStartElement);
    return () => {
      cancelled = true;
      loadingMoreRef.current = false;
      observer.disconnect();
    };
  }, [nearStartElement, nextCursor, openId, session, threadAllowed]);

  useEffect(() => {
    if (session === null) {
      pickGeneration.current += 1;
      setPreparing(false);
      setPhotoDrafts([]);
      setFormError(null);
      const urls = photoUrlsRef.current;
      for (const url of Object.values(urls)) {
        revokeIfBlob(url);
      }
      if (Object.keys(urls).length > 0) {
        setPhotoUrls({});
      }
    }
  }, [session]);

  useEffect(() => {
    if (
      session === null ||
      openId === null ||
      openId === '' ||
      !threadAllowed ||
      messages === null
    ) {
      if (session === null || openId === null || openId === '' || !threadAllowed) {
        const urls = photoUrlsRef.current;
        for (const url of Object.values(urls)) {
          revokeIfBlob(url);
        }
        if (Object.keys(urls).length > 0) {
          setPhotoUrls({});
        }
      }
      return;
    }
    const conversationId = openId;
    let cancelled = false;
    const liveKeys = new Set(
      messages.flatMap((message) => {
        const count = message.photoCount > 0 ? message.photoCount : message.hasPhoto ? 1 : 0;
        return Array.from({ length: count }, (_, index) => `${message.id}:${index}`);
      }),
    );
    const stale = Object.entries(photoUrlsRef.current).filter(([key]) => !liveKeys.has(key));
    if (stale.length > 0) {
      for (const [, url] of stale) {
        revokeIfBlob(url);
      }
      setPhotoUrls((prev) => {
        const next = { ...prev };
        for (const [key] of stale) {
          delete next[key];
        }
        return next;
      });
    }
    const missing = messages.flatMap((message) => {
      const count = message.photoCount > 0 ? message.photoCount : message.hasPhoto ? 1 : 0;
      return Array.from({ length: count }, (_, index) => ({
        id: message.id,
        index,
        key: `${message.id}:${index}`,
      })).filter(({ key }) => photoUrlsRef.current[key] === undefined);
    });
    if (missing.length === 0) {
      return;
    }
    void (async () => {
      for (const photo of missing) {
        /* v8 ignore next 3 -- skip ids filled while earlier fetches in this loop ran */
        if (photoUrlsRef.current[photo.key] !== undefined) {
          continue;
        }
        let blob: Blob;
        try {
          blob = await fetchConversationMessagePhoto(
            session,
            conversationId,
            photo.id,
            photo.index,
          );
        } catch {
          /* v8 ignore next 3 -- unmount during a failed fetch */
          if (cancelled) {
            return;
          }
          continue;
        }
        /* v8 ignore next 3 -- unmount after a successful fetch */
        if (cancelled) {
          return;
        }
        const url = URL.createObjectURL(blob);
        /* v8 ignore next 4 -- unmount after createObjectURL */
        if (cancelled || openIdRef.current !== conversationId) {
          URL.revokeObjectURL(url);
          return;
        }
        setPhotoUrls((prev) => {
          /* v8 ignore next 4 -- race if the same id was filled while the fetch was in flight */
          if (cancelled || openIdRef.current !== conversationId || prev[photo.key] !== undefined) {
            URL.revokeObjectURL(url);
            return prev;
          }
          return { ...prev, [photo.key]: url };
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [session, messages, openId, threadAllowed]);

  useEffect(() => {
    return () => {
      pickGeneration.current += 1;
      for (const url of Object.values(photoUrlsRef.current)) {
        revokeIfBlob(url);
      }
    };
  }, []);

  const threadLoaded = messages !== null;
  const messagesRef = useRef(messages);
  messagesRef.current = messages;
  useEffect(() => {
    if (session === null || openId === null || openId === '' || !threadAllowed || !threadLoaded) {
      return;
    }
    let cancelled = false;
    let inFlight = false;
    const pull = (): void => {
      if (document.visibilityState === 'hidden' || inFlight || cancelled) {
        return;
      }
      inFlight = true;
      void fetchConversation(session, openId)
        .then((page) => {
          if (cancelled || openIdRef.current !== openId) {
            return;
          }
          const prev = messagesRef.current;
          /* v8 ignore next -- the poll starts only after the thread is loaded */
          if (prev === null) return;
          const fresh = page.messages.filter(
            (message) => !prev.some((row) => row.id === message.id),
          );
          setMessages((current) => {
            /* v8 ignore next -- the poll starts only after the thread is loaded */
            if (current === null) return current;
            return appendUnseenMessages(current, page.messages);
          });
          if (fresh.length === 0) return;
          const last = fresh[fresh.length - 1];
          /* v8 ignore next -- fresh is non-empty when this runs */
          if (last === undefined) return;
          /* v8 ignore next -- a thread only polls after the inbox list has loaded */
          if (conversations === null) return;
          const remaining = conversations.filter((row) => row.id !== openId && row.unread).length;
          setConversations((rows) => {
            /* v8 ignore next -- the list is loaded before a thread can poll */
            if (rows === null) return rows;
            const updated = rows.map((row) => {
              if (row.id !== openId) return row;
              const newerThanList = last.createdAt >= row.lastAt;
              return {
                ...row,
                lastText: newerThanList ? last.text : row.lastText,
                lastSats: newerThanList ? last.sats : row.lastSats,
                lastFromMe: newerThanList ? last.fromMe : row.lastFromMe,
                lastAt: newerThanList ? last.createdAt : row.lastAt,
                unread: false,
                unreadMessageCount: 0,
              };
            });
            const opened = updated.find((row) => row.id === openId);
            /* v8 ignore next 3 -- a listed thread always has this row */
            if (opened === undefined) {
              return updated;
            }
            return [opened, ...updated.filter((row) => row.id !== openId)];
          });
          void markConversationRead(session, openId).catch(() => undefined);
          bumpUnreadAppBadgeEpoch();
          void refreshUnreadAppBadge(session, remaining).catch(() => undefined);
        })
        .catch(() => undefined)
        .finally(() => {
          inFlight = false;
        });
    };
    const intervalId = setInterval(pull, CONVERSATION_LIVE_POLL_MS);
    const onVisibilityChange = (): void => {
      if (document.visibilityState === 'visible') {
        pull();
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      cancelled = true;
      clearInterval(intervalId);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [session, openId, threadAllowed, threadLoaded]);

  if (session === null) {
    return null;
  }

  const onPickFiles = (files: FileList): void => {
    if (posting || payWaiting || invoice !== null) {
      return;
    }
    const generation = ++pickGeneration.current;
    const selected = Array.from(files);
    setPreparing(true);
    void (async () => {
      const nextPhotos = photoDrafts.slice(0, 10);
      let nextError: InboxFormError = null;
      const remaining = 10 - nextPhotos.length;
      if (selected.length > remaining) {
        nextError = 'tooMany';
      }
      try {
        for (const file of selected.slice(0, Math.max(0, remaining))) {
          try {
            const result = await prepareForumPhoto(file);
            /* v8 ignore next 3 -- a newer pick replaced this generation */
            if (generation !== pickGeneration.current) {
              return;
            }
            if (result.ok) {
              nextPhotos.push(result.photo);
            } else if (nextError !== 'tooMany') {
              nextError = result.error;
            }
          } catch {
            /* v8 ignore next 3 -- a newer pick replaced this generation */
            if (generation !== pickGeneration.current) {
              return;
            }
            if (nextError !== 'tooMany') {
              nextError = 'unsupported';
            }
          }
        }
        /* v8 ignore next 3 -- a newer pick replaced this generation */
        if (generation !== pickGeneration.current) {
          return;
        }
        setPhotoDrafts(nextPhotos);
        setFormError(nextError);
      } finally {
        /* v8 ignore next 3 -- a newer pick replaced this generation */
        if (generation === pickGeneration.current) {
          setPreparing(false);
        }
      }
    })();
  };

  const onRemovePhoto = (index: number): void => {
    setPhotoDrafts((current) => current.filter((_, photoIndex) => photoIndex !== index));
    setFormError(null);
  };

  const onPost = (): void => {
    /* v8 ignore next 3 -- composer is hidden until a thread is open */
    if (openId === null || openId === '') {
      return;
    }
    if (posting || preparing || payWaiting || invoice !== null) {
      return;
    }
    const trimmed = draft.trim();
    const sats = parseReplySats(amountDraft);
    if (trimmed === '' && sats === 'empty' && photoDrafts.length === 0) {
      setFormError('empty');
      return;
    }
    if (sats === 'invalid') {
      setFormError('amount');
      return;
    }
    if (trimmed.length > CONTACT_MESSAGE_MAX_LENGTH) {
      setFormError('tooLong');
      return;
    }
    const conversationId = openId;
    setPosting(true);
    setFormError(null);
    if (sats !== 'empty') {
      pickGeneration.current += 1;
      setPhotoDrafts([]);
      setPreparing(false);
      void (async () => {
        let minted;
        try {
          minted = await postConversationInvoice(
            session,
            conversationId,
            sats,
            trimmed === '' ? undefined : trimmed,
          );
        } catch (err) {
          if (openIdRef.current === conversationId) {
            setFormError(
              isRateLimitError(err)
                ? 'rateLimit'
                : isAuthorWalletError(err)
                  ? 'authorWallet'
                  : 'request',
            );
          }
          setPosting(false);
          return;
        }

        setPosting(false);
        if (openIdRef.current !== conversationId) {
          return;
        }
        setInvoice({ pr: minted.pr, amountSats: minted.amountSats });
        setPayWaiting(true);
        const controller = new AbortController();
        /* v8 ignore next -- no in-flight poll on first mint */
        payPollRef.current?.abort();
        payPollRef.current = controller;
        try {
          const page = await fetchConversation(session, conversationId, {
            sinceMessageId: minted.messageId,
            signal: controller.signal,
          });
          if (controller.signal.aborted || openIdRef.current !== conversationId) {
            return;
          }
          setMessages((prev) => {
            if (prev === null) {
              setNextCursor(page.nextCursor);
              setMessagesError(false);
              return page.messages;
            }
            const freshIds = new Set(page.messages.map((message) => message.id));
            return [...prev.filter((message) => !freshIds.has(message.id)), ...page.messages];
          });
          setDraft('');
          setAmountDraft('');
          pickGeneration.current += 1;
          setPhotoDrafts([]);
          setPreparing(false);
          setInvoice(null);
          setPayWaiting(false);
          const gift =
            page.messages.find((message) => message.id === minted.messageId) ??
            page.messages.at(-1);
          if (gift !== undefined) {
            setConversations((prev) => {
              /* v8 ignore next 3 -- poll after the list was cleared */
              if (prev === null) {
                return prev;
              }
              const updated = prev.map((row) =>
                row.id === conversationId
                  ? {
                      ...row,
                      lastText: gift.text,
                      lastSats: gift.sats,
                      lastFromMe: gift.fromMe,
                      lastAt: gift.createdAt,
                      unread: false,
                      unreadMessageCount: 0,
                    }
                  : row,
              );
              const opened = updated.find((row) => row.id === conversationId);
              /* v8 ignore next 3 -- paid thread vanished from the list */
              if (opened === undefined) {
                return updated;
              }
              return [opened, ...updated.filter((row) => row.id !== conversationId)];
            });
          }
        } catch (err) {
          if (
            !isAbortError(err) &&
            !controller.signal.aborted &&
            openIdRef.current === conversationId
          ) {
            setFormError('request');
            setPayWaiting(false);
            setInvoice(null);
          }
        } finally {
          if (payPollRef.current === controller) {
            payPollRef.current = null;
          }
        }
      })();
      return;
    }
    pickGeneration.current += 1;
    const pendingPhotos = photoDrafts;
    void (async () => {
      try {
        const created =
          pendingPhotos.length === 0
            ? await postConversationMessage(session, conversationId, trimmed)
            : await postConversationMessage(
                session,
                conversationId,
                trimmed,
                pendingPhotos.map((photo) => ({
                  contentType: photo.contentType,
                  data: photo.data,
                  ...(typeof photo.takenAt === 'string' && photo.takenAt !== ''
                    ? { takenAt: photo.takenAt }
                    : {}),
                })),
              );
        if (openIdRef.current === conversationId) {
          setMessages((prev) => {
            /* v8 ignore next -- first message in an empty thread */
            if (prev === null) return [created];
            if (prev.some((message) => message.id === created.id)) {
              return prev;
            }
            return [...prev, created];
          });
          setDraft('');
          setPhotoDrafts([]);
          if (created.hasPhoto) {
            setPhotoUrls((prev) => {
              const next = { ...prev };
              pendingPhotos.forEach((photo, index) => {
                next[`${created.id}:${index}`] = photo.previewUrl;
              });
              return next;
            });
          }
        }
        setConversations((prev) => {
          /* v8 ignore next 3 -- post after the list was cleared */
          if (prev === null) {
            return prev;
          }
          const next = prev.map((row) =>
            row.id === conversationId
              ? {
                  ...row,
                  lastText: created.text,
                  lastSats: created.sats,
                  lastAt: created.createdAt,
                  lastFromMe: true,
                  unread: false,
                  unreadMessageCount: 0,
                }
              : row,
          );
          const opened = next.find((row) => row.id === conversationId);
          /* v8 ignore next 3 -- posted thread vanished from the list */
          if (opened === undefined) {
            return next;
          }
          return [opened, ...next.filter((row) => row.id !== conversationId)];
        });
      } catch {
        if (openIdRef.current === conversationId) {
          setFormError('request');
        }
      } finally {
        setPosting(false);
      }
    })();
  };

  /* v8 ignore next -- empty ?c= is the same as no thread */
  const threadId = threadAllowed ? openId : null;
  const showFilter = staff;
  return (
    <InboxScreen
      conversations={waitingStaffRoom ? null : conversations}
      error={error}
      loading={loading || waitingStaffRoom}
      onRetry={() => {
        /* v8 ignore next -- retry increments the list loader */
        setAttempt((n) => n + 1);
      }}
      openId={threadId}
      onOpen={(id) => {
        /* v8 ignore next -- no poll unless a pay sheet is open */
        payPollRef.current?.abort();
        payPollRef.current = null;
        setDraft('');
        setAmountDraft('');
        setFormError(null);
        setInvoice(null);
        setPayWaiting(false);
        pickGeneration.current += 1;
        setPhotoDrafts([]);
        setPreparing(false);
        router.push(`/messages?c=${encodeURIComponent(id)}`);
      }}
      messages={threadId === null ? null : messages}
      messagesLoading={
        threadId !== null && (messagesLoading || (messages === null && !messagesError))
      }
      messagesError={threadId !== null && messagesError}
      onRetryMessages={() => {
        setMessagesAttempt((n) => n + 1);
      }}
      nearStartRef={nearStartRef}
      draft={draft}
      onDraftChange={(value) => {
        setDraft(value);
        setFormError(null);
      }}
      amountDraft={amountDraft}
      onAmountDraftChange={(value) => {
        setAmountDraft(value);
        setFormError(null);
      }}
      onPost={onPost}
      posting={posting || preparing}
      formError={formError}
      showFilter={showFilter}
      invoice={invoice}
      onPayCancel={() => {
        payPollRef.current?.abort();
        payPollRef.current = null;
        setInvoice(null);
        setPayWaiting(false);
      }}
      payWaiting={payWaiting}
      rateDay={rateDay}
      showAttach={threadId !== null}
      photoDrafts={photoDrafts}
      onPickFiles={onPickFiles}
      onRemovePhoto={onRemovePhoto}
      photoUrls={photoUrls}
    />
  );
}
