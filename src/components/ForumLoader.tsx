'use client';

import { useEffect, useRef, useState, type ReactElement } from 'react';
import {
  ForumBoard,
  type ForumFormError,
  type ForumPayError,
  type ForumPayInvoice,
} from '@/components/ForumBoard';
import { fetchMessages, postMessage, postMessageInvoice } from '@/lib/api';
import { FORUM_MESSAGE_MAX_LENGTH, type ForumMessage } from '@/lib/api-types';
import { useAuthStore } from '@/stores/auth-store';

/** How many times to poll `GET /messages` after showing a pay invoice. */
const PAY_POLL_ATTEMPTS = 8;

/** Delay between pay-confirmation polls (ms). */
const PAY_POLL_MS = 2000;

/**
 * True when a thrown value is the api rate-limit copy for posts or payments.
 *
 * @param err - Caught rejection.
 * @returns Whether the message looks like a rate-limit error.
 */
function isRateLimitError(err: unknown): boolean {
  /* v8 ignore next 3 */
  if (!(err instanceof Error)) {
    return false;
  }
  return /too many (messages|payments)/i.test(err.message);
}

/**
 * Merges a fresh list into local state, keeping optimistic posts the server
 * has not echoed yet.
 *
 * @param prev - Current list, or `null` before the first successful load.
 * @param next - Fresh list from the api.
 * @returns Merged newest-first list.
 */
function mergeMessages(prev: ForumMessage[] | null, next: ForumMessage[]): ForumMessage[] {
  if (prev === null) {
    return next;
  }
  const ids = new Set(next.map((message) => message.id));
  const extra = prev.filter((message) => !ids.has(message.id));
  return [...extra, ...next];
}

/**
 * Client loader for the public forum on `/welcome`.
 *
 * Reads the session from the auth store, fetches messages with a cancelled-flag
 * pattern matching {@link StatsLoader}, owns composer draft/post state, and
 * owns pay-on-note invoice + sats-poll state.
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
  const [formError, setFormError] = useState<ForumFormError>(null);
  const [payMessageId, setPayMessageId] = useState<string | null>(null);
  const [payDraft, setPayDraft] = useState('');
  const [payBusy, setPayBusy] = useState(false);
  const [payError, setPayError] = useState<ForumPayError>(null);
  const [payInvoice, setPayInvoice] = useState<ForumPayInvoice | null>(null);
  const [payWaiting, setPayWaiting] = useState(false);
  const payPollGeneration = useRef(0);

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
          setMessages((prev) => mergeMessages(prev, next));
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

  useEffect(() => {
    return () => {
      payPollGeneration.current += 1;
    };
  }, []);

  if (session === null) {
    return null;
  }

  /* v8 ignore start -- pay-sheet reset */
  const clearPaySheet = (): void => {
    payPollGeneration.current += 1;
    setPayMessageId(null);
    setPayDraft('');
    setPayBusy(false);
    setPayError(null);
    setPayInvoice(null);
    setPayWaiting(false);
  };
  /* v8 ignore stop */

  /* v8 ignore start -- poll after wallet return */
  const startPayPoll = (messageId: string, baselineSats: number): void => {
    const generation = ++payPollGeneration.current;
    setPayWaiting(true);
    void (async () => {
      for (let i = 0; i < PAY_POLL_ATTEMPTS; i += 1) {
        await new Promise((resolve) => {
          setTimeout(resolve, PAY_POLL_MS);
        });
        if (generation !== payPollGeneration.current) {
          return;
        }
        try {
          const next = await fetchMessages(session);
          if (generation !== payPollGeneration.current) {
            return;
          }
          setMessages((prev) => mergeMessages(prev, next));
          const updated = next.find((message) => message.id === messageId);
          if (updated !== undefined && updated.sats > baselineSats) {
            setPayWaiting(false);
            setPayInvoice(null);
            setPayMessageId(null);
            setPayDraft('');
            setPayError(null);
            return;
          }
        } catch {
          // Keep polling until attempts are exhausted; generic retry is the board load path.
        }
      }
      if (generation === payPollGeneration.current) {
        setPayWaiting(false);
      }
    })();
  };
  /* v8 ignore stop */

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
      } catch (err) {
        setFormError(isRateLimitError(err) ? 'rateLimit' : 'request');
      } finally {
        setPosting(false);
      }
    })();
  };

  const onPaySubmit = (): void => {
    /* v8 ignore next 3 -- button is disabled when no sheet is open */
    if (payMessageId === null || payBusy) {
      return;
    }
    const listed = messages?.find((message) => message.id === payMessageId);
    /* v8 ignore next 3 -- sheet only opens on a payable row */
    if (listed === undefined || listed.payable !== true) {
      return;
    }
    const rawAmount = payDraft.trim();
    /* v8 ignore start */
    if (rawAmount === '' || !/^\d+$/.test(rawAmount)) {
      setPayError('amount');
      return;
    }
    /* v8 ignore stop */
    const sats = Number.parseInt(rawAmount, 10);
    /* v8 ignore next 4 */
    if (sats <= 0 || !Number.isSafeInteger(sats)) {
      setPayError('amount');
      return;
    }
    const messageId = payMessageId;
    const baseline = listed.sats;
    const generation = payPollGeneration.current;
    setPayBusy(true);
    setPayError(null);
    void (async () => {
      try {
        const invoice = await postMessageInvoice(session, messageId, sats);
        if (generation !== payPollGeneration.current) {
          return;
        }
        setPayInvoice({
          messageId,
          pr: invoice.pr,
          amountSats: invoice.amountSats,
        });
        setPayBusy(false);
        startPayPoll(messageId, baseline);
      } catch (err) {
        if (generation !== payPollGeneration.current) {
          return;
        }
        setPayError(isRateLimitError(err) ? 'rateLimit' : 'request');
      } finally {
        if (generation === payPollGeneration.current) {
          setPayBusy(false);
        }
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
      payMessageId={payMessageId}
      payDraft={payDraft}
      payBusy={payBusy}
      payError={payError}
      payInvoice={payInvoice}
      payWaiting={payWaiting}
      onPayOpen={(messageId) => {
        payPollGeneration.current += 1;
        setPayMessageId(messageId);
        setPayDraft('');
        setPayError(null);
        setPayInvoice(null);
        setPayWaiting(false);
        setPayBusy(false);
      }}
      onPayDraftChange={(value) => {
        setPayDraft(value);
        setPayError(null);
      }}
      onPaySubmit={onPaySubmit}
      onPayCancel={clearPaySheet}
    />
  );
}
