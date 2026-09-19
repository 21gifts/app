'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState, type ReactElement } from 'react';
import { InboxScreen, type InboxFormError, type InboxInvoice } from '@/components/InboxScreen';
import {
  fetchConversation,
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
import { useAuthStore } from '@/stores/auth-store';

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

/**
 * Client loader for the signed-in inbox on `/messages`.
 *
 * Reads the session from the auth store, fetches the conversation list, and
 * opens `?c=` only after that list loaded, unless the list has that id as
 * `moderator_group` (new empty PMs are not yet listed). For a confirmed
 * moderator an unlisted `?c=` first
 * resolves {@link fetchModeratorGroup} once per id, with neutral loading
 * instead of the list; a match never opens, other roles and a failed lookup
 * fall through. The composer sends free text
 * directly, or mints an invoice from its amount field and long-polls for the
 * paid gift row. Renders nothing when there is no session.
 * Founder/moderator get the origin filter; members see the full inbound list.
 * After a successful thread load and mark-read, bumps the badge epoch and
 * refreshes the home-screen badge to notifications unread plus remaining
 * inbox unread.
 *
 * @returns The inbox screen, or `null` without a session.
 */
export function InboxLoader(): ReactElement | null {
  const session = useAuthStore((state) => state.session);
  const account = useAuthStore((state) => state.account);
  const router = useRouter();
  const searchParams = useSearchParams();
  const openId = searchParams.get('c');
  const [conversations, setConversations] = useState<Conversation[] | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
  const [messages, setMessages] = useState<ConversationMessage[] | null>(null);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [messagesError, setMessagesError] = useState(false);
  const [messagesAttempt, setMessagesAttempt] = useState(0);
  const [draft, setDraft] = useState('');
  const [amountDraft, setAmountDraft] = useState('');
  const [posting, setPosting] = useState(false);
  const [formError, setFormError] = useState<InboxFormError>(null);
  const [invoice, setInvoice] = useState<InboxInvoice | null>(null);
  const [payWaiting, setPayWaiting] = useState(false);
  const [staffRoomId, setStaffRoomId] = useState<string | null>(null);
  const payPollRef = useRef<AbortController | null>(null);
  const openIdRef = useRef(openId);
  /* v8 ignore start -- render-phase reset when ?c= changes; one frame of the old thread is not allowed */
  if (openIdRef.current !== openId) {
    setMessages(null);
    setMessagesError(false);
    setMessagesLoading(openId !== null && openId !== '');
    setDraft('');
    setAmountDraft('');
    setFormError(null);
    setInvoice(null);
    setPayWaiting(false);
    setStaffRoomId(null);
    payPollRef.current?.abort();
    payPollRef.current = null;
  }
  /* v8 ignore stop */
  openIdRef.current = openId;

  const listed =
    conversations === null || openId === null || openId === ''
      ? undefined
      : conversations.find((row) => row.id === openId);
  const waitingStaffRoom =
    account?.role === 'moderator' &&
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
      account?.role !== 'moderator' ||
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
  }, [session, account?.role, openId, conversations, listed, staffRoomId]);

  useEffect(() => {
    if (session === null || openId === null || openId === '' || !threadAllowed) {
      setMessages(null);
      setMessagesError(false);
      setMessagesLoading(false);
      return;
    }
    let cancelled = false;
    setMessages(null);
    setMessagesLoading(true);
    setMessagesError(false);
    void (async () => {
      try {
        const next = await fetchConversation(session, openId);
        /* v8 ignore next 3 -- unmount during fetch */
        if (cancelled) {
          return;
        }
        setMessages(next);
        /* v8 ignore next -- a thread only opens after the inbox list loaded */
        const listedRows = conversations ?? [];
        const remaining = listedRows.filter((row) => row.id !== openId && row.unread).length;
        setConversations((prev) => {
          /* v8 ignore next 3 -- list cleared while the thread was loading */
          if (prev === null) {
            return prev;
          }
          return prev.map((row) => (row.id === openId ? { ...row, unread: false } : row));
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
    };
  }, [session, openId, messagesAttempt, threadAllowed]);

  if (session === null) {
    return null;
  }

  const onPost = (): void => {
    /* v8 ignore next 3 -- composer is hidden until a thread is open */
    if (openId === null || openId === '') {
      return;
    }
    if (posting || payWaiting || invoice !== null) {
      return;
    }
    const trimmed = draft.trim();
    const sats = parseReplySats(amountDraft);
    if (trimmed === '' && sats === 'empty') {
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
          const next = await fetchConversation(session, conversationId, {
            sinceMessageId: minted.messageId,
            signal: controller.signal,
          });
          if (controller.signal.aborted || openIdRef.current !== conversationId) {
            return;
          }
          setMessages(next);
          setDraft('');
          setAmountDraft('');
          setInvoice(null);
          setPayWaiting(false);
          const gift = next.find((message) => message.id === minted.messageId) ?? next.at(-1);
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
    void (async () => {
      try {
        const created = await postConversationMessage(session, conversationId, trimmed);
        if (openIdRef.current === conversationId) {
          /* v8 ignore next -- first message in an empty thread */
          setMessages((prev) => (prev === null ? [created] : [...prev, created]));
          setDraft('');
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
  const showFilter = account?.role === 'moderator' || account?.role === 'founder';
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
      posting={posting}
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
    />
  );
}
