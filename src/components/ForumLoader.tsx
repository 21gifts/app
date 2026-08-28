'use client';

import { useEffect, useState, type ReactElement } from 'react';
import { ForumBoard } from '@/components/ForumBoard';
import { fetchMessages, postMessage } from '@/lib/api';
import { FORUM_MESSAGE_MAX_LENGTH, type ForumMessage } from '@/lib/api-types';
import { useAuthStore } from '@/stores/auth-store';

/**
 * Client loader for the public forum on `/welcome`.
 *
 * Reads the session from the auth store, fetches messages with a cancelled-flag
 * pattern matching {@link StatsLoader}, and owns composer draft/post state.
 * Renders nothing when there is no session.
 *
 * @returns The forum board, or `null` without a session.
 */
export function ForumLoader(): ReactElement | null {
  const session = useAuthStore((state) => state.session);
  const [messages, setMessages] = useState<ForumMessage[] | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
  const [draft, setDraft] = useState('');
  const [posting, setPosting] = useState(false);
  const [formError, setFormError] = useState<'empty' | 'tooLong' | 'request' | null>(null);

  useEffect(() => {
    if (session === null) {
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(false);
    void (async () => {
      try {
        const next = await fetchMessages(session);
        if (!cancelled) {
          setMessages((prev) => {
            if (prev === null) {
              return next;
            }
            const ids = new Set(next.map((message) => message.id));
            const extra = prev.filter((message) => !ids.has(message.id));
            return [...extra, ...next];
          });
        }
      } catch {
        if (!cancelled) {
          setError(true);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [attempt, session]);

  if (session === null) {
    return null;
  }

  const onPost = (): void => {
    const trimmed = draft.trim();
    if (trimmed === '') {
      setFormError('empty');
      return;
    }
    if (trimmed.length > FORUM_MESSAGE_MAX_LENGTH) {
      setFormError('tooLong');
      return;
    }
    setPosting(true);
    setFormError(null);
    void (async () => {
      try {
        const created = await postMessage(session, trimmed);
        setMessages((prev) => {
          if (prev === null) {
            return [created];
          }
          if (prev.some((message) => message.id === created.id)) {
            return prev;
          }
          return [created, ...prev];
        });
        setDraft('');
      } catch {
        setFormError('request');
      } finally {
        setPosting(false);
      }
    })();
  };

  return (
    <ForumBoard
      messages={messages}
      error={error}
      loading={loading}
      posting={posting}
      draft={draft}
      onDraftChange={(value) => {
        setDraft(value);
        setFormError(null);
      }}
      onPost={onPost}
      onRetry={() => {
        setAttempt((n) => n + 1);
      }}
      formError={formError}
    />
  );
}
