'use client';

import { useEffect, useRef, useState, type ReactElement } from 'react';
import {
  ForumBoard,
  type ForumFormError,
  type ForumPayError,
  type ForumPayInvoice,
} from '@/components/ForumBoard';
import {
  dismissForumLaws,
  fetchMessagePhoto,
  fetchMessages,
  fetchReplies,
  postMessage,
  postMessageInvoice,
  postMessageVideo,
} from '@/lib/api';
import { FORUM_MESSAGE_MAX_LENGTH, type ForumMessage } from '@/lib/api-types';
import {
  DEFAULT_FORUM_FEED_MODE,
  type ForumFeedMode,
  visibleForumMessages,
} from '@/lib/forum-feed';
import { prepareForumPhoto, type ForumPhotoPayload } from '@/lib/forum-photo';
import { isForumVideoFile, prepareForumVideo, type ForumVideoPayload } from '@/lib/forum-video';
import { useAuthStore } from '@/stores/auth-store';

/** How many times to poll `GET /messages` for pay confirmation or payable status. */
const PAY_POLL_ATTEMPTS = 8;

/** Delay between `GET /messages` polls (ms). */
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

/** Revokes a blob object URL when present; no-op for undefined or empty. */
function revokeObjectUrlIfPresent(url: string | undefined): void {
  if (url !== undefined && url !== '') {
    URL.revokeObjectURL(url);
  }
}

/**
 * True when a thrown value is the api author's-wallet rejection for payments.
 *
 * @param err - Caught rejection.
 * @returns Whether the message looks like an author's-wallet error.
 */
function isAuthorWalletError(err: unknown): boolean {
  /* v8 ignore next 3 */
  if (!(err instanceof Error)) {
    return false;
  }
  return /author's wallet cannot receive this Bitcoin payment/i.test(err.message);
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
 * Reads the session and account from the auth store, fetches messages with a
 * cancelled-flag pattern matching {@link StatsLoader}, loads photos via Bearer
 * + blob URLs, owns composer draft/photo/video/post state, the Active/All/Most
 * popular feed mode, pay-on-note invoice + sats-poll state, and persists
 * dismiss of the living-room laws hint on the account. Also polls until
 * unsigned notes become payable. Renders nothing when there is no session.
 *
 * @returns The forum board, or `null` without a session.
 */
export function ForumLoader(): ReactElement | null {
  const session = useAuthStore((state) => state.session);
  const account = useAuthStore((state) => state.account);
  const setAccount = useAuthStore((state) => state.setAccount);
  const [messages, setMessages] = useState<ForumMessage[] | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
  const [draft, setDraft] = useState('');
  const [photoDraft, setPhotoDraft] = useState<ForumPhotoPayload | null>(null);
  const [videoDraft, setVideoDraft] = useState<ForumVideoPayload | null>(null);
  const videoDraftRef = useRef(videoDraft);
  videoDraftRef.current = videoDraft;
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});
  const photoUrlsRef = useRef(photoUrls);
  photoUrlsRef.current = photoUrls;
  const [videoUrls, setVideoUrls] = useState<Record<string, string>>({});
  const videoUrlsRef = useRef(videoUrls);
  videoUrlsRef.current = videoUrls;
  const pickGeneration = useRef(0);
  const [posting, setPosting] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [formError, setFormError] = useState<ForumFormError>(null);
  const [feedMode, setFeedMode] = useState<ForumFeedMode>(DEFAULT_FORUM_FEED_MODE);
  const [payMessageId, setPayMessageId] = useState<string | null>(null);
  const [payDraft, setPayDraft] = useState('');
  const [payBusy, setPayBusy] = useState(false);
  const [payError, setPayError] = useState<ForumPayError>(null);
  const [payInvoice, setPayInvoice] = useState<ForumPayInvoice | null>(null);
  const [payWaiting, setPayWaiting] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [replies, setReplies] = useState<ForumMessage[] | null>(null);
  const [repliesLoading, setRepliesLoading] = useState(false);
  const [repliesError, setRepliesError] = useState(false);
  const [repliesAttempt, setRepliesAttempt] = useState(0);
  const [replyDraft, setReplyDraft] = useState('');
  const [replyPosting, setReplyPosting] = useState(false);
  const [replyFormError, setReplyFormError] = useState<ForumFormError>(null);
  const payPollGeneration = useRef(0);
  const payablePollGeneration = useRef(0);
  const messagesRef = useRef(messages);
  messagesRef.current = messages;
  const photoIdsKey =
    messages === null
      ? ''
      : visibleForumMessages(messages, feedMode)
          .filter((message) => message.hasPhoto)
          .map((message) => message.id)
          .sort()
          .join('\0');

  /**
   * Polls `GET /messages` until every merged row is payable or attempts run out.
   * Stop uses `messagesRef` + merge outside setState (empty GET keeps local unsigned extras);
   * store update is `setMessages((prev) => mergeMessages(prev, next))`.
   *
   * @param activeSession - Session token for the fetch.
   */
  const startPayablePoll = (activeSession: string): void => {
    const generation = ++payablePollGeneration.current;
    void (async () => {
      for (let i = 0; i < PAY_POLL_ATTEMPTS; i += 1) {
        await new Promise((resolve) => {
          setTimeout(resolve, PAY_POLL_MS);
        });
        if (generation !== payablePollGeneration.current) {
          return;
        }
        try {
          const next = await fetchMessages(activeSession);
          if (generation !== payablePollGeneration.current) {
            return;
          }
          const merged = mergeMessages(messagesRef.current, next);
          setMessages((prev) => mergeMessages(prev, next));
          if (merged.length > 0 && merged.every((message) => message.payable)) {
            return;
          }
        } catch {
          // Keep polling until attempts are exhausted; do not set board error.
        }
      }
    })();
  };

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
          if (next.some((message) => message.payable === false)) {
            startPayablePoll(session);
          }
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
    if (session === null || photoIdsKey === '') {
      return;
    }
    const listed = messagesRef.current;
    /* v8 ignore start -- photoIdsKey is empty when messages is null */
    if (listed === null) {
      return;
    }
    /* v8 ignore stop */
    let cancelled = false;
    const visible = visibleForumMessages(listed, feedMode);
    const missing = visible.filter(
      (message) => message.hasPhoto && photoUrlsRef.current[message.id] === undefined,
    );
    if (missing.length === 0) {
      return;
    }
    void (async () => {
      for (const message of missing) {
        /* v8 ignore start -- skip ids filled while earlier fetches in this loop ran */
        if (photoUrlsRef.current[message.id] !== undefined) {
          continue;
        }
        /* v8 ignore stop */
        let blob: Blob;
        try {
          blob = await fetchMessagePhoto(session, message.id);
        } catch {
          if (cancelled) {
            return;
          }
          try {
            blob = await fetchMessagePhoto(session, message.id);
          } catch {
            if (cancelled) {
              return;
            }
            // Leave the row text-only when the photo cannot load.
            continue;
          }
        }
        if (cancelled) {
          return;
        }
        const url = URL.createObjectURL(blob);
        if (cancelled) {
          URL.revokeObjectURL(url);
          return;
        }
        setPhotoUrls((prev) => {
          /* v8 ignore start -- race if the same id was filled while the fetch was in flight */
          if (prev[message.id] !== undefined) {
            URL.revokeObjectURL(url);
            return prev;
          }
          /* v8 ignore stop */
          return { ...prev, [message.id]: url };
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [photoIdsKey, session]);

  useEffect(() => {
    return () => {
      payPollGeneration.current += 1;
      payablePollGeneration.current += 1;
      pickGeneration.current += 1;
      for (const url of Object.values(photoUrlsRef.current)) {
        URL.revokeObjectURL(url);
      }
      for (const url of Object.values(videoUrlsRef.current)) {
        URL.revokeObjectURL(url);
      }
      revokeObjectUrlIfPresent(videoDraftRef.current?.previewUrl);
    };
  }, []);

  useEffect(() => {
    if (session === null || expandedId === null) {
      return;
    }
    let cancelled = false;
    setRepliesLoading(true);
    setRepliesError(false);
    setReplies(null);
    void (async () => {
      try {
        const next = await fetchReplies(session, expandedId);
        if (!cancelled) {
          setReplies(next);
        }
      } catch {
        if (!cancelled) {
          setRepliesError(true);
        }
      } finally {
        if (!cancelled) {
          setRepliesLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [session, expandedId, repliesAttempt]);

  const lawsVisible = account?.forumLawsDismissed !== true;

  const onDismissLaws = (): void => {
    const snapshot = useAuthStore.getState();
    /* v8 ignore next 3 -- ForumLoader returns null without a session */
    if (snapshot.session === null || snapshot.account === null) {
      return;
    }
    /* v8 ignore next 3 -- dismiss control is hidden when already dismissed */
    if (snapshot.account.forumLawsDismissed === true) {
      return;
    }
    const token = snapshot.session;
    const previousDismissed = snapshot.account.forumLawsDismissed;
    setAccount({ ...snapshot.account, forumLawsDismissed: true });
    void (async () => {
      try {
        const updated = await dismissForumLaws(token);
        const current = useAuthStore.getState();
        if (current.session !== token || current.account === null) {
          return;
        }
        setAccount({ ...current.account, forumLawsDismissed: updated.forumLawsDismissed });
      } catch {
        const current = useAuthStore.getState();
        if (current.session !== token || current.account === null) {
          return;
        }
        setAccount({ ...current.account, forumLawsDismissed: previousDismissed });
      }
    })();
  };

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

  const onPickPhoto = (file: File): void => {
    const generation = pickGeneration.current + 1;
    pickGeneration.current = generation;
    setPreparing(true);
    void (async () => {
      try {
        if (isForumVideoFile(file)) {
          const result = await prepareForumVideo(file);
          if (generation !== pickGeneration.current) {
            if (result.ok) {
              revokeObjectUrlIfPresent(result.video.previewUrl);
            }
            return;
          }
          if (!result.ok) {
            revokeObjectUrlIfPresent(videoDraftRef.current?.previewUrl);
            setVideoDraft(null);
            setFormError(result.error);
            return;
          }
          revokeObjectUrlIfPresent(videoDraftRef.current?.previewUrl);
          setPhotoDraft(null);
          setVideoDraft(result.video);
          setFormError(null);
          return;
        }
        const result = await prepareForumPhoto(file);
        if (generation !== pickGeneration.current) {
          return;
        }
        if (!result.ok) {
          setPhotoDraft(null);
          setFormError(result.error);
          return;
        }
        revokeObjectUrlIfPresent(videoDraftRef.current?.previewUrl);
        setVideoDraft(null);
        setPhotoDraft(result.photo);
        setFormError(null);
      } catch {
        if (generation !== pickGeneration.current) {
          return;
        }
        setPhotoDraft(null);
        setFormError('unsupported');
      } finally {
        if (generation === pickGeneration.current) {
          setPreparing(false);
        }
      }
    })();
  };

  const onPost = (): void => {
    const trimmed = draft.trim();
    if (trimmed === '' && photoDraft === null && videoDraft === null) {
      setFormError('empty');
      return;
    }
    if (trimmed.length > FORUM_MESSAGE_MAX_LENGTH) {
      setFormError('tooLong');
      return;
    }
    pickGeneration.current += 1;
    setPosting(true);
    setFormError(null);
    const pendingPhoto = photoDraft;
    const pendingVideo = videoDraft;
    void (async () => {
      try {
        const created =
          pendingVideo !== null
            ? await postMessageVideo(session, {
                text: trimmed,
                video: pendingVideo.file,
                poster: pendingVideo.poster,
              })
            : await postMessage(session, {
                text: trimmed,
                ...(pendingPhoto === null
                  ? {}
                  : { photo: { contentType: pendingPhoto.contentType, data: pendingPhoto.data } }),
              });
        setMessages((prev) => {
          if (prev === null) {
            return [created];
          }
          if (prev.some((message) => message.id === created.id)) {
            return prev;
          }
          return [created, ...prev];
        });
        if (created.sats === 0) {
          setFeedMode('all');
        }
        if (created.hasPhoto && pendingPhoto !== null) {
          setPhotoUrls((prev) => {
            if (prev[created.id] !== undefined) {
              return prev;
            }
            return { ...prev, [created.id]: pendingPhoto.previewUrl };
          });
        }
        if (created.hasVideo && pendingVideo !== null) {
          if (videoUrlsRef.current[created.id] !== undefined) {
            revokeObjectUrlIfPresent(pendingVideo.previewUrl);
          } else {
            setVideoUrls((prev) => {
              /* v8 ignore start -- race if the same id was filled while posting */
              if (prev[created.id] !== undefined) {
                return prev;
              }
              /* v8 ignore stop */
              return { ...prev, [created.id]: pendingVideo.previewUrl };
            });
          }
        } else if (pendingVideo !== null) {
          revokeObjectUrlIfPresent(pendingVideo.previewUrl);
        }
        setDraft('');
        setPhotoDraft(null);
        setVideoDraft(null);
        startPayablePoll(session);
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
        setPayError(
          isRateLimitError(err)
            ? 'rateLimit'
            : isAuthorWalletError(err)
              ? 'authorWallet'
              : 'request',
        );
      } finally {
        if (generation === payPollGeneration.current) {
          setPayBusy(false);
        }
      }
    })();
  };

  const onModeChange = (next: ForumFeedMode): void => {
    if (
      payMessageId !== null &&
      messages !== null &&
      !visibleForumMessages(messages, next).some((message) => message.id === payMessageId)
    ) {
      clearPaySheet();
      setFeedMode(next);
      return;
    }
    setFeedMode(next);
  };

  const onToggleExpand = (messageId: string): void => {
    if (expandedId === messageId) {
      setExpandedId(null);
      setReplies(null);
      setRepliesError(false);
      setRepliesLoading(false);
      setReplyDraft('');
      setReplyFormError(null);
      return;
    }
    setExpandedId(messageId);
    setReplyDraft('');
    setReplyFormError(null);
    setRepliesAttempt((n) => n + 1);
  };

  const onReplyPost = (): void => {
    /* v8 ignore next 3 -- reply composer only mounts when expanded */
    if (expandedId === null || replyPosting) {
      return;
    }
    const trimmed = replyDraft.trim();
    if (trimmed === '') {
      setReplyFormError('empty');
      return;
    }
    if (trimmed.length > FORUM_MESSAGE_MAX_LENGTH) {
      setReplyFormError('tooLong');
      return;
    }
    const parentId = expandedId;
    setReplyPosting(true);
    setReplyFormError(null);
    void (async () => {
      try {
        const created = await postMessage(session, { text: trimmed, inReplyTo: parentId });
        setReplies((prev) => {
          if (prev === null) {
            return [created];
          }
          if (prev.some((message) => message.id === created.id)) {
            return prev;
          }
          return [...prev, created];
        });
        setMessages((prev) => {
          if (prev === null) {
            return prev;
          }
          return prev.map((message) =>
            message.id === parentId
              ? { ...message, replyCount: message.replyCount + 1 }
              : message,
          );
        });
        setReplyDraft('');
      } catch (err) {
        setReplyFormError(isRateLimitError(err) ? 'rateLimit' : 'request');
      } finally {
        setReplyPosting(false);
      }
    })();
  };

  return (
    <ForumBoard
      messages={messages}
      error={error}
      loading={loading}
      posting={posting || preparing}
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
      photoDraft={photoDraft}
      videoDraft={videoDraft}
      onPickPhoto={onPickPhoto}
      onClearPhoto={() => {
        revokeObjectUrlIfPresent(videoDraftRef.current?.previewUrl);
        pickGeneration.current += 1;
        setPhotoDraft(null);
        setVideoDraft(null);
        setFormError(null);
      }}
      photoUrls={photoUrls}
      videoUrls={videoUrls}
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
      mode={feedMode}
      onModeChange={onModeChange}
      lawsVisible={lawsVisible}
      onDismissLaws={onDismissLaws}
      expandedId={expandedId}
      onToggleExpand={onToggleExpand}
      replies={expandedId === null ? null : replies}
      repliesLoading={expandedId !== null && repliesLoading}
      repliesError={expandedId !== null && repliesError}
      onRetryReplies={() => {
        setRepliesAttempt((n) => n + 1);
      }}
      replyDraft={replyDraft}
      onReplyDraftChange={(value) => {
        setReplyDraft(value);
        setReplyFormError(null);
      }}
      onReplyPost={onReplyPost}
      replyPosting={replyPosting}
      replyFormError={replyFormError}
    />
  );
}
