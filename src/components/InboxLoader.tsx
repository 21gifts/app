'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState, type ReactElement } from 'react';
import { InboxScreen, type InboxFormError } from '@/components/InboxScreen';
import { fetchConversation, fetchConversations, postConversationMessage } from '@/lib/api';
import {
  CONTACT_MESSAGE_MAX_LENGTH,
  type Conversation,
  type ConversationMessage,
} from '@/lib/api-types';
import { useAuthStore } from '@/stores/auth-store';

/**
 * Client loader for the signed-in inbox on `/messages`.
 *
 * Reads the session from the auth store, fetches the conversation list, and
 * opens `?c=` when present. Renders nothing when there is no session.
 *
 * @returns The inbox screen, or `null` without a session.
 */
export function InboxLoader(): ReactElement | null {
  const session = useAuthStore((state) => state.session);
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
  const [posting, setPosting] = useState(false);
  const [formError, setFormError] = useState<InboxFormError>(null);
  const openIdRef = useRef(openId);
  if (openIdRef.current !== openId) {
    // Same render as ?c= so the previous thread is not painted and a late post cannot attach.
    setMessages(null);
    setMessagesError(false);
    setMessagesLoading(openId !== null && openId !== '');
    setDraft('');
    setFormError(null);
  }
  openIdRef.current = openId;

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
        if (cancelled) {
          return;
        }
        setConversations(next);
      } catch {
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
    if (session === null || openId === null || openId === '') {
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
        if (cancelled) {
          return;
        }
        setMessages(next);
      } catch {
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
  }, [session, openId, messagesAttempt]);

  if (session === null) {
    return null;
  }

  const onPost = (): void => {
    /* v8 ignore next 3 -- composer is hidden until a thread is open */
    if (openId === null || openId === '') {
      return;
    }
    const trimmed = draft.trim();
    if (trimmed === '') {
      setFormError('empty');
      return;
    }
    if (trimmed.length > CONTACT_MESSAGE_MAX_LENGTH) {
      setFormError('tooLong');
      return;
    }
    const conversationId = openId;
    setPosting(true);
    setFormError(null);
    void (async () => {
      try {
        const created = await postConversationMessage(session, conversationId, trimmed);
        if (openIdRef.current === conversationId) {
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
              ? { ...row, lastText: created.text, lastAt: created.createdAt }
              : row,
          );
          const opened = next.find((row) => row.id === conversationId);
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

  return (
    <InboxScreen
      conversations={conversations}
      error={error}
      loading={loading}
      onRetry={() => {
        setAttempt((n) => n + 1);
      }}
      openId={openId === '' ? null : openId}
      onOpen={(id) => {
        setDraft('');
        setFormError(null);
        router.push(`/messages?c=${encodeURIComponent(id)}`);
      }}
      onBack={() => {
        setDraft('');
        setFormError(null);
        router.push('/messages');
      }}
      messages={openId === null || openId === '' ? null : messages}
      messagesLoading={openId !== null && openId !== '' && messagesLoading}
      messagesError={openId !== null && openId !== '' && messagesError}
      onRetryMessages={() => {
        setMessagesAttempt((n) => n + 1);
      }}
      draft={draft}
      onDraftChange={(value) => {
        setDraft(value);
        setFormError(null);
      }}
      onPost={onPost}
      posting={posting}
      formError={formError}
    />
  );
}
