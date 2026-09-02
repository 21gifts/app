'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState, type ReactElement } from 'react';
import { flushSync } from 'react-dom';
import {
  ForumBoard,
  type ForumFormError,
  type ForumPayError,
  type ForumPayInvoice,
} from '@/components/ForumBoard';
import { RequirementsOverlay } from '@/components/RequirementsOverlay';
import {
  dismissForumLaws,
  fetchMessagePhoto,
  fetchMessages,
  fetchReplies,
  openConversation,
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
import {
  MissingRequirementsError,
  nextPostRequirement,
  type MissingRequirement,
} from '@/lib/missing-requirements';
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
  /* v8 ignore next 3 -- non-Error throw is defensive; callers always reject with Error */
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
  /* v8 ignore next 3 -- non-Error throw is defensive; pay path always rejects with Error */
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
  const prevById = new Map(prev.map((message) => [message.id, message]));
  const mergedNext = next.map((message) => {
    const prior = prevById.get(message.id);
    if (prior === undefined) {
      return message;
    }
    return {
      ...message,
      replyCount: Math.max(prior.replyCount, message.replyCount),
    };
  });
  const ids = new Set(next.map((message) => message.id));
  const extra = prev.filter((message) => !ids.has(message.id));
  return [...extra, ...mergedNext];
}

/**
 * Client loader for the public forum on `/welcome`.
 *
 * Reads the session and account from the auth store, fetches messages with a
 * cancelled-flag pattern matching {@link StatsLoader}, loads photos via Bearer
 * + blob URLs, owns composer draft/photo/video/post state, the Active/All/Most
 * popular feed mode, pay-on-note invoice + sats-poll state, expand/replies
 * (`fetchReplies`, reply composer via `postMessage` with `inReplyTo`), PM
 * (`openConversation` → `/messages?c=`), and persists dismiss of the
 * living-room laws hint on the account. Also polls until unsigned notes
 * become payable. Silently re-fetches when the document becomes visible again
 * (`visibilitychange` hidden→visible, `pageshow` with `persisted`) and when
 * the board pull-to-refresh fires; silent refresh keeps an existing list on
 * screen (no loading copy) and does not auto-scroll the composer. Renders
 * nothing when there is no session.
 *
 * @returns The forum board, or `null` without a session.
 */
export function ForumLoader(): ReactElement | null {
  const session = useAuthStore((state) => state.session);
  const account = useAuthStore((state) => state.account);
  const router = useRouter();
  const setAccount = useAuthStore((state) => state.setAccount);
  const [messages, setMessages] = useState<ForumMessage[] | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
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
  const expandedIdRef = useRef(expandedId);
  expandedIdRef.current = expandedId;
  const prevExpandedIdRef = useRef<string | null>(null);
  const [replies, setReplies] = useState<ForumMessage[] | null>(null);
  const repliesRef = useRef(replies);
  repliesRef.current = replies;
  const [repliesLoading, setRepliesLoading] = useState(false);
  const [repliesError, setRepliesError] = useState(false);
  const [repliesAttempt, setRepliesAttempt] = useState(0);
  const [replyDraft, setReplyDraft] = useState('');
  const [replyPosting, setReplyPosting] = useState(false);
  const [pmBusyId, setPmBusyId] = useState<string | null>(null);
  const [replyFormError, setReplyFormError] = useState<ForumFormError>(null);
  const [overlayRequirement, setOverlayRequirement] = useState<'name' | 'rules' | null>(null);
  const pendingPostRef = useRef<(() => Promise<void>) | null>(null);
  const payPollGeneration = useRef(0);
  const payablePollGeneration = useRef(0);
  const refreshGeneration = useRef(0);
  const wasHiddenRef = useRef(false);
  const pendingRefreshRef = useRef(false);
  const messagesRef = useRef(messages);
  messagesRef.current = messages;
  const loadingRef = useRef(loading);
  loadingRef.current = loading;
  const refreshingRef = useRef(refreshing);
  refreshingRef.current = refreshing;
  const postingRef = useRef(posting);
  postingRef.current = posting;
  const preparingRef = useRef(preparing);
  preparingRef.current = preparing;
  const payBusyRef = useRef(payBusy);
  payBusyRef.current = payBusy;
  const payWaitingRef = useRef(payWaiting);
  payWaitingRef.current = payWaiting;
  const payMessageIdRef = useRef(payMessageId);
  payMessageIdRef.current = payMessageId;
  const replyPostingRef = useRef(replyPosting);
  replyPostingRef.current = replyPosting;
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

  /**
   * Shared fetch + merge + payable-poll path for mount/retry and silent refresh.
   *
   * @param activeSession - Session token for the fetch.
   * @param shouldContinue - False when the caller was cancelled or superseded.
   * @returns `ok` when the list was applied, `error` on failure, `aborted` when skipped.
   */
  const loadMessagesOnce = async (
    activeSession: string,
    shouldContinue: () => boolean,
  ): Promise<'ok' | 'error' | 'aborted' | 'requirements'> => {
    try {
      const next = await fetchMessages(activeSession);
      if (!shouldContinue()) {
        return 'aborted';
      }
      setMessages((prev) => mergeMessages(prev, next));
      if (next.some((message) => message.payable === false)) {
        startPayablePoll(activeSession);
      }
      return 'ok';
    } catch (err) {
      if (!shouldContinue()) {
        return 'aborted';
      }
      if (err instanceof MissingRequirementsError) {
        return 'requirements';
      }
      return 'error';
    }
  };

  const openOverlayForMissing = (missing: readonly MissingRequirement[]): boolean => {
    const next = nextPostRequirement(missing);
    if (next === null) {
      return false;
    }
    setOverlayRequirement(next);
    return true;
  };

  const refreshMessages = (): void => {
    /* v8 ignore next 3 -- board unmounts without a session */
    if (session === null) {
      return;
    }
    if (loadingRef.current || refreshingRef.current) {
      return;
    }
    if (
      postingRef.current ||
      preparingRef.current ||
      payBusyRef.current ||
      payWaitingRef.current ||
      payMessageIdRef.current !== null ||
      replyPostingRef.current
    ) {
      pendingRefreshRef.current = true;
      return;
    }
    pendingRefreshRef.current = false;
    const activeSession = session;
    const generation = ++refreshGeneration.current;
    refreshingRef.current = true;
    setRefreshing(true);
    void (async () => {
      const result = await loadMessagesOnce(
        activeSession,
        () => generation === refreshGeneration.current,
      );
      if (generation !== refreshGeneration.current) {
        return;
      }
      // Commit setMessages from loadMessagesOnce while refreshing is still true
      // so ForumBoard's newestId effect skips composer scroll.
      flushSync(() => {
        if (result === 'ok') {
          setError(false);
        } else if (result === 'requirements') {
          router.replace('/setup/rules');
        } else if (result === 'error') {
          if (messagesRef.current === null) {
            setError(true);
          }
        }
      });
      refreshingRef.current = false;
      setRefreshing(false);
    })();
  };

  const refreshMessagesRef = useRef(refreshMessages);
  refreshMessagesRef.current = refreshMessages;

  const onRefresh = useCallback((): void => {
    refreshMessagesRef.current();
  }, []);

  useEffect(() => {
    if (pendingRefreshRef.current) {
      refreshMessagesRef.current();
    }
  }, [posting, preparing, payBusy, payWaiting, payMessageId, replyPosting]);

  useEffect(() => {
    if (session === null) {
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(false);
    void (async () => {
      const result = await loadMessagesOnce(session, () => !cancelled);
      if (!cancelled && result === 'requirements') {
        router.replace('/setup/rules');
        return;
      }
      if (!cancelled && result === 'error') {
        setError(true);
      }
      if (!cancelled) {
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [attempt, router, session]);

  useEffect(() => {
    if (session === null) {
      return;
    }
    const onVisibilityChange = (): void => {
      if (document.visibilityState === 'hidden') {
        wasHiddenRef.current = true;
        return;
      }
      if (document.visibilityState === 'visible' && wasHiddenRef.current) {
        wasHiddenRef.current = false;
        refreshMessagesRef.current();
      }
    };
    const onPageShow = (event: Event): void => {
      const persisted = 'persisted' in event && (event as PageTransitionEvent).persisted === true;
      if (persisted) {
        refreshMessagesRef.current();
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('pageshow', onPageShow);
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('pageshow', onPageShow);
    };
  }, [session]);

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
      refreshGeneration.current += 1;
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
    /* v8 ignore next 3 -- render already returned null without a session */
    if (session === null) {
      return;
    }
    if (expandedId === null) {
      prevExpandedIdRef.current = null;
      return;
    }
    const expandedChanged = prevExpandedIdRef.current !== expandedId;
    prevExpandedIdRef.current = expandedId;
    let cancelled = false;
    setRepliesLoading(true);
    setRepliesError(false);
    if (expandedChanged) {
      setReplies(null);
    }
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

  const applyCreatedNote = (
    created: ForumMessage,
    pendingPhoto: ForumPhotoPayload | null,
    pendingVideo: ForumVideoPayload | null,
  ): void => {
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
  };

  const runNotePost = async (
    trimmed: string,
    pendingPhoto: ForumPhotoPayload | null,
    pendingVideo: ForumVideoPayload | null,
    isRetry: boolean,
  ): Promise<void> => {
    setPosting(true);
    setFormError(null);
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
      applyCreatedNote(created, pendingPhoto, pendingVideo);
      pendingPostRef.current = null;
    } catch (err) {
      if (err instanceof MissingRequirementsError) {
        if (!isRetry && openOverlayForMissing(err.missing)) {
          pendingPostRef.current = () => runNotePost(trimmed, pendingPhoto, pendingVideo, true);
          return;
        }
        setFormError('request');
        return;
      }
      setFormError(isRateLimitError(err) ? 'rateLimit' : 'request');
    } finally {
      setPosting(false);
    }
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
    const missing = account?.missing ?? [];
    if (openOverlayForMissing(missing)) {
      const pendingPhoto = photoDraft;
      const pendingVideo = videoDraft;
      pendingPostRef.current = () => runNotePost(trimmed, pendingPhoto, pendingVideo, true);
      return;
    }
    pickGeneration.current += 1;
    const pendingPhoto = photoDraft;
    const pendingVideo = videoDraft;
    void runNotePost(trimmed, pendingPhoto, pendingVideo, false);
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
    /* v8 ignore start -- native submit blocked; button disabled when draft empty */
    if (rawAmount === '' || !/^\d+$/.test(rawAmount)) {
      setPayError('amount');
      return;
    }
    /* v8 ignore stop */
    const sats = Number.parseInt(rawAmount, 10);
    /* v8 ignore next 4 -- /^\d+$/ parseInt is non-negative; 0 and overflow are defensive */
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
    /* v8 ignore start -- expand/collapse is covered via ForumBoard */
    if (replyPosting) {
      return;
    }
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
    setReplies(null);
    setRepliesLoading(true);
    setRepliesError(false);
    setReplyDraft('');
    setReplyFormError(null);
    setRepliesAttempt((n) => n + 1);
    /* v8 ignore stop */
  };

  const applyCreatedReply = (
    created: ForumMessage,
    parentId: string,
    parentBaseline: number,
  ): void => {
    const stillParent = expandedIdRef.current === parentId;
    let alreadyListed = false;
    if (stillParent) {
      alreadyListed =
        repliesRef.current !== null &&
        repliesRef.current.some((message) => message.id === created.id);
      const wasEmpty = repliesRef.current === null;
      setRepliesError(false);
      setRepliesLoading(false);
      setReplies((prev) => {
        /* v8 ignore next 3 -- first successful post before fetch returns */
        if (prev === null) {
          return [created];
        }
        /* v8 ignore next 3 -- duplicate id already in the list */
        if (prev.some((message) => message.id === created.id)) {
          return prev;
        }
        return [...prev, created];
      });
      setReplyDraft('');
      if (wasEmpty) {
        setRepliesAttempt((n) => n + 1);
      }
    }
    if (!alreadyListed) {
      setMessages((prev) => {
        /* v8 ignore next 3 -- parent list not loaded */
        if (prev === null) {
          return prev;
        }
        return prev.map((message) =>
          message.id === parentId
            ? {
                ...message,
                replyCount: Math.max(message.replyCount, parentBaseline + 1),
              }
            : message,
        );
      });
    }
  };

  const runReplyPost = async (
    trimmed: string,
    parentId: string,
    parentBaseline: number,
    isRetry: boolean,
  ): Promise<void> => {
    setReplyPosting(true);
    setReplyFormError(null);
    /* v8 ignore start -- async reply success/error after post */
    try {
      const created = await postMessage(session, { text: trimmed, inReplyTo: parentId });
      applyCreatedReply(created, parentId, parentBaseline);
      pendingPostRef.current = null;
    } catch (err) {
      if (err instanceof MissingRequirementsError) {
        if (!isRetry && openOverlayForMissing(err.missing)) {
          pendingPostRef.current = () => runReplyPost(trimmed, parentId, parentBaseline, true);
          return;
        }
        setReplyFormError('request');
        return;
      }
      /* v8 ignore next 3 -- reply error after the thread was closed */
      if (expandedIdRef.current === parentId) {
        setReplyFormError(isRateLimitError(err) ? 'rateLimit' : 'request');
      }
    } finally {
      setReplyPosting(false);
    }
    /* v8 ignore stop */
  };

  const onReplyPost = (): void => {
    /* v8 ignore next 3 -- reply composer only mounts when expanded */
    if (expandedId === null || replyPosting || repliesLoading || repliesError || replies === null) {
      return;
    }
    const trimmed = replyDraft.trim();
    /* v8 ignore start -- empty or over-long reply */
    if (trimmed === '') {
      setReplyFormError('empty');
      return;
    }
    if (trimmed.length > FORUM_MESSAGE_MAX_LENGTH) {
      setReplyFormError('tooLong');
      return;
    }
    /* v8 ignore stop */
    const parentId = expandedId;
    const parentRow = messagesRef.current?.find((message) => message.id === parentId);
    /* v8 ignore next -- expanded parent is always in the loaded list */
    const parentBaseline = parentRow === undefined ? 0 : parentRow.replyCount;
    const missing = account?.missing ?? [];
    if (openOverlayForMissing(missing)) {
      pendingPostRef.current = () => runReplyPost(trimmed, parentId, parentBaseline, true);
      return;
    }
    void runReplyPost(trimmed, parentId, parentBaseline, false);
  };

  const onOverlaySatisfied = (): void => {
    const current = useAuthStore.getState().account;
    const still = nextPostRequirement(current?.missing ?? []);
    if (still !== null) {
      setOverlayRequirement(still);
      return;
    }
    setOverlayRequirement(null);
    const pending = pendingPostRef.current;
    /* v8 ignore next 3 -- overlay cannot satisfy without a queued post */
    if (pending === null) {
      return;
    }
    void pending();
  };

  return (
    <>
      {overlayRequirement !== null ? (
        <RequirementsOverlay
          requirement={overlayRequirement}
          onDismiss={() => {
            setOverlayRequirement(null);
            pendingPostRef.current = null;
          }}
          onSatisfied={onOverlaySatisfied}
        />
      ) : null}
      <ForumBoard
        messages={messages}
        error={error}
        loading={loading}
        refreshing={refreshing}
        onRefresh={onRefresh}
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
        ownName={account?.name ?? null}
        ownAccountId={account?.id ?? null}
        pmBusyId={pmBusyId}
        onPm={(messageId) => {
          /* v8 ignore next 3 -- second PM click while the first is in flight */
          if (pmBusyId !== null) {
            return;
          }
          setPmBusyId(messageId);
          void (async () => {
            try {
              const thread = await openConversation(session, messageId);
              router.push(`/messages?c=${encodeURIComponent(thread.id)}`);
            } catch {
              setPmBusyId(null);
            }
          })();
        }}
      />
    </>
  );
}
