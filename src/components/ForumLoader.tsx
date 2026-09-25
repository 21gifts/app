'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState, type ReactElement } from 'react';
import { flushSync } from 'react-dom';
import { useAppShellScroller } from '@/components/AppShell';
import type { ForumAskCadence } from '@/components/ForumAskWizard';
import {
  ForumBoard,
  type ForumAskStep,
  type ForumComposeIntent,
  type ForumFormError,
  type ForumReplyFormError,
  type ForumPayError,
  type ForumPayInvoice,
} from '@/components/ForumBoard';
import { RequirementsOverlay } from '@/components/RequirementsOverlay';
import { useFiatPreference } from '@/components/FiatPreferenceProvider';
import { useLatestRateDay } from '@/hooks/useLatestRateDay';
import {
  fiatDraftForSats,
  parseAmountDraft,
  paySatsFromDraft,
  replySatsFromDraft,
  shownFiatForSats,
} from '@/lib/stats-money';
import {
  dismissForumLaws,
  fetchMessagePhoto,
  fetchMessages,
  fetchNotifications,
  fetchPublicMessage,
  fetchReplies,
  markNotificationRead,
  postMessage,
  fetchComposeTarget,
  postMessageInvoice,
  postMessageVideo,
} from '@/lib/api';
import {
  FORUM_MESSAGE_MAX_LENGTH,
  type AmountUnit,
  type ForumMessage,
  type ForumPlacePin,
} from '@/lib/api-types';
import {
  DEFAULT_FORUM_FEED_MODE,
  FORUM_HOME_EVENT,
  FORUM_LIST_POLL_MS,
  hasUnseenForumPosts,
  type ForumFeedMode,
  unpaidNewCount,
  visibleForumMessages,
} from '@/lib/forum-feed';
import { parseForumAskAmountInUnit } from '@/lib/forum-goal';
import { prepareForumPhoto, type ForumPhotoPayload } from '@/lib/forum-photo';
import { SHOP_HASHTAG, ensureShopHashtag, isShopNote } from '@/lib/forum-shop';
import { loadUnpaidSeenAt, saveUnpaidSeenAt } from '@/lib/forum-unpaid-seen';
import { isForumVideoFile, prepareForumVideo, type ForumVideoPayload } from '@/lib/forum-video';
import { MissingRequirementsError, nextPostRequirement } from '@/lib/missing-requirements';
import { isReplyPaymentExempt, roleAtLeast } from '@/lib/roles';
import { useAuthStore } from '@/stores/auth-store';

/** How many times to poll `GET /messages` for payable status. */
const PAY_POLL_ATTEMPTS = 8;

/** Delay between pay / payable polls (ms). */
const PAY_POLL_MS = 2000;

/** Number of notes requested for each forum feed page. */
const FORUM_PAGE_LIMIT = 20;

/** Default invoice amount when the pay sheet amount field is empty or whitespace-only. */
const DEFAULT_FORUM_PAY_SATS = 21;

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
 * Scroll offset of the AppShell scroller, or the document when none is mounted.
 *
 * @param scroller - Inner overflow node from {@link useAppShellScroller}, or `null`.
 * @returns Current scrollTop in pixels.
 */
function shellScrollTop(scroller: HTMLElement | null): number {
  if (scroller !== null) return scroller.scrollTop;
  return window.scrollY || document.documentElement.scrollTop || 0;
}

/**
 * Scrolls the AppShell scroller to the top, or the document when none is mounted.
 *
 * @param scroller - Inner overflow node from {@link useAppShellScroller}, or `null`.
 */
function shellScrollToTop(scroller: HTMLElement | null): void {
  if (scroller !== null) {
    scroller.scrollTo(0, 0);
    return;
  }
  window.scrollTo(0, 0);
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
 * True when the api rejected an unpaid reply.
 *
 * @param err - Caught rejection.
 * @returns Whether the message is the unpaid-reply copy.
 */
function isReplyPaymentError(err: unknown): boolean {
  /* v8 ignore next 3 -- non-Error throw is defensive */
  if (!(err instanceof Error)) {
    return false;
  }
  return /reply needs a bitcoin payment/i.test(err.message);
}

/**
 * Server replyCount minus session-hidden replies. When the server count
 * drops, shrink hidden — those deletes are already reflected in `incoming`.
 */
function combineReplyCount(
  incoming: number,
  hidden: number,
  lastIncoming: number,
  prior: number,
): { replyCount: number; hidden: number; lastIncoming: number } {
  const drop = hidden > 0 ? Math.max(0, lastIncoming - incoming) : 0;
  const nextHidden = Math.max(0, hidden - drop);
  const stale = hidden === 0 && prior > incoming;
  return {
    replyCount: Math.max(prior, Math.max(0, incoming - nextHidden)),
    hidden: nextHidden,
    lastIncoming: stale ? lastIncoming : incoming,
  };
}

function applySessionReplyCount(
  id: string,
  incoming: number,
  hiddenReplyCounts: Map<string, number>,
  lastServerReplyCount: Map<string, number>,
  prior: number,
): number {
  const combined = combineReplyCount(
    incoming,
    hiddenReplyCounts.get(id) ?? 0,
    lastServerReplyCount.get(id) ?? incoming,
    prior,
  );
  hiddenReplyCounts.set(id, combined.hidden);
  lastServerReplyCount.set(id, combined.lastIncoming);
  return combined.replyCount;
}

/**
 * Merges a fresh page one before previously loaded rows.
 *
 * @param prev - Current list, or `null` before the first successful load.
 * @param next - Fresh list from the api.
 * @param hiddenReplyCounts - Session-deleted reply counts keyed by parent id.
 * @param lastServerReplyCount - Last merged server replyCount per parent id.
 * @returns Merged newest-first list.
 */
function mergePageOne(
  prev: ForumMessage[] | null,
  next: ForumMessage[],
  hiddenReplyCounts: Map<string, number>,
  lastServerReplyCount: Map<string, number>,
): ForumMessage[] {
  const prevById = new Map((prev ?? []).map((message) => [message.id, message]));
  const withHiddenCount = (message: ForumMessage): ForumMessage => ({
    ...message,
    replyCount: applySessionReplyCount(
      message.id,
      message.replyCount,
      hiddenReplyCounts,
      lastServerReplyCount,
      prevById.get(message.id)?.replyCount ?? 0,
    ),
  });
  if (prev === null) {
    return next.map(withHiddenCount);
  }
  const mergedNext = next.map(withHiddenCount);
  const ids = new Set(next.map((message) => message.id));
  const older = prev.filter((message) => !ids.has(message.id));
  return [...mergedNext, ...older];
}

/**
 * Appends unseen rows from a later page without reordering loaded rows.
 *
 * @param prev - Current loaded pages, or `null` before page one.
 * @param next - Later page returned by the api.
 * @param hiddenReplyCounts - Session-deleted reply counts keyed by parent id.
 * @param lastServerReplyCount - Last merged server replyCount per parent id.
 * @returns The deduplicated loaded pages in their existing order.
 */
function appendMessages(
  prev: ForumMessage[] | null,
  next: ForumMessage[],
  hiddenReplyCounts: Map<string, number>,
  lastServerReplyCount: Map<string, number>,
): ForumMessage[] {
  /* v8 ignore next 3 -- load-more only appends after page one is in state */
  if (prev === null) {
    return next;
  }
  const ids = new Set(prev.map((message) => message.id));
  const appended = next
    .filter((message) => !ids.has(message.id))
    .map((message) => ({
      ...message,
      replyCount: applySessionReplyCount(
        message.id,
        message.replyCount,
        hiddenReplyCounts,
        lastServerReplyCount,
        0,
      ),
    }));
  return [...prev, ...appended];
}

/**
 * Updates sats/payable on ids already in `prev`. Does not insert unseen ids
 * (those wait behind the New posts pill while the visitor is scrolled down).
 *
 * @param prev - Current list, or `null` before the first successful load.
 * @param next - Fresh list from the payable poll GET.
 * @returns Same-length list as `prev`, or `next` when `prev` is null.
 */
function mergePayableStatus(prev: ForumMessage[] | null, next: ForumMessage[]): ForumMessage[] {
  /* v8 ignore next 3 -- payable poll starts only after a listed fetch */
  if (prev === null) {
    return next;
  }
  const byId = new Map(next.map((message) => [message.id, message]));
  return prev.map((row) => {
    const fresh = byId.get(row.id);
    if (fresh === undefined || (fresh.payable === row.payable && fresh.sats === row.sats)) {
      return row;
    }
    return { ...row, payable: fresh.payable, sats: fresh.sats };
  });
}

/**
 * Client loader for the public forum on `/welcome`. Also used on `/shops` with
 * `feed="shops"` (hashtag filter, no laws hint, compose appends `#21GiftsShop`).
 *
 * Reads the session and account from the auth store, fetches the first page of
 * 20 messages for the current mode with a cancelled-flag pattern matching
 * {@link StatsLoader}, refetches page one on mode changes, loads photos via Bearer
 * + blob URLs, owns composer draft/photo/video/post state, the Active/No gifts
 * yet/All/Most popular feed mode, and `21gifts.forum-unpaid-seen` (hydrates the
 * last-visit stamp on mount, not in the state initializer; stamps on entering
 * unpaid and while unpaid as the list refreshes; mode itself is still not
 * persisted), payable-reply invoice + sats-poll state, expand/replies
 * (`fetchReplies`, reply composer via invoice or unpaid `postMessage` when
 * exempt), and persists dismiss of the
 * living-room laws hint on the account. After a successful top-level post or
 * reply, sets `hasPosted: true` on the session account when the session token
 * is unchanged and an account is still present (no persist-flag POST). Also
 * polls until unsigned notes become payable. An IntersectionObserver sentinel
 * prefetches the next cursor page near the end of the visible list. Silently
 * re-fetches page one when the
 * document becomes visible again
 * (`visibilitychange` hidden→visible, `pageshow` with `persisted`) and when
 * the board pull-to-refresh fires, plus every 30 seconds while the tab is
 * visible. A silent refresh holds unseen ids behind a New posts pill while the
 * visitor is scrolled down; the pill, welcome wordmark, and already-home menu
 * action scroll to top and force-apply a refetch. With a session, fetches
 * notifications and, when an unread `moderator_appointed` row exists, shows a
 * matching pill that marks that row read and stays on `/welcome` without
 * auto-scroll. Silent refresh keeps an existing list on screen (no loading
 * copy) and does not auto-scroll the newest note. Renders nothing when there
 * is no session.
 *
 * @param feed - Optional `'living-room'` (default) or `'shops'`.
 * @returns The forum board, or `null` without a session.
 */
export function ForumLoader({
  feed = 'living-room',
}: {
  feed?: 'living-room' | 'shops';
} = {}): ReactElement | null {
  const session = useAuthStore((state) => state.session);
  const account = useAuthStore((state) => state.account);
  const { fiat } = useFiatPreference();
  const amountUnit = account?.amountUnit ?? 'btc';
  const [payShownUnit, setPayShownUnit] = useState<AmountUnit>(amountUnit);
  const [replyShownUnit, setReplyShownUnit] = useState<AmountUnit>(amountUnit);
  const router = useRouter();
  const scroller = useAppShellScroller();
  const setAccount = useAuthStore((state) => state.setAccount);
  /** Session-local hidden message ids (posts and replies) so stale GETs cannot resurrect either. */
  const deletedIds = useRef(new Set<string>());
  /** Session-deleted nested reply counts keyed by parent id. */
  const hiddenReplyCounts = useRef(new Map<string, number>());
  /** Last merged server replyCount per parent, for shrinking hidden on catch-up. */
  const lastServerReplyCount = useRef(new Map<string, number>());
  /** Last known parent id for each loaded reply, kept after collapse. */
  const replyParentById = useRef(new Map<string, string>());
  const [messages, setMessages] = useState<ForumMessage[] | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [newPostsAvailable, setNewPostsAvailable] = useState(false);
  const [moderatorAppointedId, setModeratorAppointedId] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [draft, setDraft] = useState('');
  const [askDraft, setAskDraft] = useState('');
  const [askDraftUnit, setAskDraftUnit] = useState<AmountUnit>(amountUnit);
  const askUnit = useRef(askDraftUnit);
  askUnit.current = askDraftUnit;
  const [composeIntent, setComposeIntent] = useState<ForumComposeIntent>('post');
  const [askStep, setAskStep] = useState<ForumAskStep>(1);
  const [askCadence, setAskCadence] = useState<ForumAskCadence>('once');
  const [photoDrafts, setPhotoDrafts] = useState<ForumPhotoPayload[]>([]);
  const photoDraftsRef = useRef(photoDrafts);
  photoDraftsRef.current = photoDrafts;
  const [videoDraft, setVideoDraft] = useState<ForumVideoPayload | null>(null);
  const videoDraftRef = useRef(videoDraft);
  videoDraftRef.current = videoDraft;
  const [placeDraft, setPlaceDraft] = useState<ForumPlacePin | null>(null);
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});
  const photoUrlsRef = useRef(photoUrls);
  photoUrlsRef.current = photoUrls;
  const [videoUrls, setVideoUrls] = useState<Record<string, string>>({});
  const videoUrlsRef = useRef(videoUrls);
  videoUrlsRef.current = videoUrls;
  const pickGeneration = useRef(0);
  const [posting, setPosting] = useState(false);
  // Sync guard: posting state alone updates only after render.
  const notePostInFlightRef = useRef(false);
  const [preparing, setPreparing] = useState(false);
  const [formError, setFormError] = useState<ForumFormError>(null);
  const [feedMode, setFeedMode] = useState<ForumFeedMode>(
    feed === 'shops' ? 'all' : DEFAULT_FORUM_FEED_MODE,
  );
  const feedModeRef = useRef(feedMode);
  feedModeRef.current = feedMode;
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const nextCursorRef = useRef(nextCursor);
  nextCursorRef.current = nextCursor;
  const [nearEndElement, setNearEndElement] = useState<HTMLLIElement | null>(null);
  const loadingMoreRef = useRef(false);
  const paginationGeneration = useRef(0);
  const optimisticMessages = useRef(new Map<string, ForumMessage>());
  const [unpaidSeenAt, setUnpaidSeenAt] = useState<string | null>(null);
  const [payMessageId, setPayMessageId] = useState<string | null>(null);
  const [payDraft, setPayDraft] = useState('');
  const [payBusy, setPayBusy] = useState(false);
  const [payError, setPayError] = useState<ForumPayError>(null);
  const [payInvoice, setPayInvoice] = useState<ForumPayInvoice | null>(null);
  const [payWaiting, setPayWaiting] = useState(false);
  const [payHost, setPayHost] = useState<'composer' | 'card' | null>(null);
  const rateDay = useLatestRateDay();
  const rateDayRef = useRef(rateDay);
  rateDayRef.current = rateDay;
  useEffect(() => {
    if (askUnit.current === amountUnit) {
      return;
    }
    if (askStep === 1) {
      return;
    }
    const from = askUnit.current;
    const adopt = (): void => {
      askUnit.current = amountUnit;
      setAskDraftUnit(amountUnit);
    };
    setAskDraft((draft) => {
      const parsed = parseAmountDraft(from, draft, rateDay, fiat);
      /* v8 ignore next 4 -- an empty ask cannot leave step 1 */
      if (parsed.kind === 'empty') {
        adopt();
        return draft;
      }
      /* v8 ignore next 3 -- an unparsable ask cannot leave step 1; a missing rate retries */
      if (parsed.kind !== 'sats') {
        return draft;
      }
      if (amountUnit === 'btc') {
        adopt();
        return String(parsed.sats);
      }
      const next = fiatDraftForSats(parsed.sats, rateDay, fiat);
      if (next === null) {
        return draft;
      }
      adopt();
      return next;
    });
  }, [amountUnit, askStep, fiat, rateDay]);
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
  const [replyAmountDraft, setReplyAmountDraft] = useState('');
  const [replyPosting, setReplyPosting] = useState(false);
  const [replyFormError, setReplyFormError] = useState<ForumReplyFormError>(null);
  const [overlayRequirement, setOverlayRequirement] = useState<
    'name' | 'username' | 'rules' | 'lightning-address' | null
  >(null);
  const pendingPostRef = useRef<(() => Promise<void>) | null>(null);
  const pendingComposeTextRef = useRef<string | null>(null);
  const pendingComposePhotosRef = useRef<ForumPhotoPayload[]>([]);
  const pendingComposeVideoRef = useRef<ForumVideoPayload | null>(null);
  const pendingComposeGoalRef = useRef<number | undefined>(undefined);
  const pendingComposePlaceRef = useRef<ForumPlacePin | null>(null);
  const composeFeePaidRef = useRef(false);
  const payPollGeneration = useRef(0);
  const payPollAbortRef = useRef<AbortController | null>(null);
  const payablePollGeneration = useRef(0);

  const bumpPayPollGeneration = (): number => {
    payPollAbortRef.current?.abort();
    payPollAbortRef.current = new AbortController();
    payPollGeneration.current += 1;
    return payPollGeneration.current;
  };
  const refreshGeneration = useRef(0);
  const wasHiddenRef = useRef(false);
  const pendingRefreshRef = useRef(false);
  const forceApplyRef = useRef(false);
  const mountedRef = useRef(true);
  const messagesRef = useRef(messages);
  messagesRef.current = messages;
  const loadingRef = useRef(loading);
  loadingRef.current = loading;
  const refreshingRef = useRef(refreshing);
  refreshingRef.current = refreshing;
  const replaceInFlightRef = useRef(false);
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
          .map((message) => ({
            id: message.id,
            count: message.photoCount ?? (message.hasPhoto ? 1 : 0),
          }))
          .filter(({ count }) => count > 0)
          .map(({ id, count }) => `${id}:${count}`)
          .sort()
          .join('\0');

  const feedHashtag = feed === 'shops' ? SHOP_HASHTAG : undefined;
  const forumPageArgs = (
    mode: ForumFeedMode,
    extras: { cursor?: string } = {},
  ): {
    mode: ForumFeedMode;
    limit: number;
    hashtag?: string;
    cursor?: string;
  } => ({
    mode,
    limit: FORUM_PAGE_LIMIT,
    ...(feedHashtag !== undefined ? { hashtag: feedHashtag } : {}),
    ...(extras.cursor !== undefined ? { cursor: extras.cursor } : {}),
  });

  const filterListed = (rows: ForumMessage[]): ForumMessage[] =>
    feed === 'shops' ? rows.filter((row) => isShopNote(row.text)) : rows;

  const listedNotes = (rows: ForumMessage[] | null): ForumMessage[] | null =>
    rows === null ? null : filterListed(rows);

  /**
   * Polls `GET /messages` until every merged row is payable or attempts run out.
   * Stop uses `messagesRef` + merge outside setState (empty GET keeps local unsigned extras).
   * Excludes ids in `deletedIds` so a stale GET cannot restore a post already hidden this session.
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
          const next = await fetchMessages(activeSession, forumPageArgs(feedModeRef.current));
          if (generation !== payablePollGeneration.current) {
            return;
          }
          const merged = mergePayableStatus(messagesRef.current, next.messages);
          setMessages((prev) =>
            mergePayableStatus(prev, next.messages).filter(
              (row) => !deletedIds.current.has(row.id),
            ),
          );
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
   * @param activeMode - Feed mode whose first page is being requested.
   * @param shouldContinue - False when the caller was cancelled or superseded.
   * @param forceApply - True when the visitor asked to apply (pill / home); skips the hold.
   * @param replace - True for mount, retry, and mode-switch page-one replacement.
   * @returns `ok` when the list was applied, `error` on failure, `aborted` when skipped.
   */
  const loadMessagesOnce = async (
    activeSession: string,
    activeMode: ForumFeedMode,
    shouldContinue: () => boolean,
    forceApply = false,
    replace = false,
  ): Promise<'ok' | 'error' | 'aborted' | 'requirements'> => {
    try {
      const next = await fetchMessages(activeSession, forumPageArgs(activeMode));
      if (!shouldContinue()) {
        return 'aborted';
      }
      const atTop = shellScrollTop(scroller) < 8;
      const visibleNext = next.messages.filter((message) => !deletedIds.current.has(message.id));
      const currentListed = listedNotes(messagesRef.current);
      const fetchedListed = filterListed(visibleNext);
      if (!replace && !forceApply && !atTop && hasUnseenForumPosts(currentListed, fetchedListed)) {
        setNewPostsAvailable(true);
        return 'ok';
      }
      const serverIds = new Set(visibleNext.map((message) => message.id));
      for (const id of serverIds) {
        optimisticMessages.current.delete(id);
      }
      if (replace) {
        const optimistic = visibleForumMessages(
          [...optimisticMessages.current.values()],
          activeMode,
        ).filter((message) => !serverIds.has(message.id) && !deletedIds.current.has(message.id));
        const pageOne = mergePageOne(
          null,
          visibleNext,
          hiddenReplyCounts.current,
          lastServerReplyCount.current,
        );
        setMessages([...optimistic, ...pageOne]);
        nextCursorRef.current = next.nextCursor;
        setNextCursor(next.nextCursor);
      } else {
        const optimistic = visibleForumMessages(
          [...optimisticMessages.current.values()],
          activeMode,
        ).filter((message) => !serverIds.has(message.id) && !deletedIds.current.has(message.id));
        const optimisticIds = new Set(optimistic.map((message) => message.id));
        setMessages((prev) => {
          const merged = mergePageOne(
            prev,
            visibleNext,
            hiddenReplyCounts.current,
            lastServerReplyCount.current,
          ).filter((row) => !deletedIds.current.has(row.id));
          return [...optimistic, ...merged.filter((row) => !optimisticIds.has(row.id))];
        });
        if (messagesRef.current === null) {
          nextCursorRef.current = next.nextCursor;
          setNextCursor(next.nextCursor);
        }
      }
      setNewPostsAvailable(false);
      if (visibleNext.some((message) => message.payable === false)) {
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

  const openOverlayForMissing = (missing: readonly string[]): boolean => {
    const next = nextPostRequirement(missing);
    if (next === null) {
      return false;
    }
    setOverlayRequirement(next);
    return true;
  };

  const refreshMessages = (): boolean => {
    /* v8 ignore next 3 -- board unmounts without a session */
    if (session === null) {
      return false;
    }
    if (loadingRef.current) {
      return false;
    }
    if (replaceInFlightRef.current) {
      pendingRefreshRef.current = true;
      return false;
    }
    if (refreshingRef.current) {
      pendingRefreshRef.current = true;
      return false;
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
      return false;
    }
    pendingRefreshRef.current = false;
    const forceApply = forceApplyRef.current;
    forceApplyRef.current = false;
    const activeSession = session;
    const activeMode = feedModeRef.current;
    const generation = ++refreshGeneration.current;
    refreshingRef.current = true;
    setRefreshing(true);
    void (async () => {
      const result = await loadMessagesOnce(
        activeSession,
        activeMode,
        () => generation === refreshGeneration.current,
        forceApply,
      );
      if (generation === refreshGeneration.current) {
        // Commit setMessages from loadMessagesOnce while refreshing is still true
        // so ForumBoard's newestId effect skips newest-note scroll.
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
      }
      refreshingRef.current = false;
      setRefreshing(false);
      if (pendingRefreshRef.current && mountedRef.current) {
        refreshMessagesRef.current();
      }
    })();
    return true;
  };

  const refreshMessagesRef = useRef(refreshMessages);
  refreshMessagesRef.current = refreshMessages;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      payablePollGeneration.current += 1;
    };
  }, []);

  const nearEndRef = useCallback((node: HTMLLIElement | null): void => {
    setNearEndElement(node);
  }, []);

  useEffect(() => {
    if (session === null || nearEndElement === null || nextCursor === null) {
      return;
    }
    let cancelled = false;
    const activeSession = session;
    const activeMode = feedMode;
    const activeCursor = nextCursor;
    const generation = paginationGeneration.current;
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting) || loadingMoreRef.current) {
        return;
      }
      loadingMoreRef.current = true;
      void (async () => {
        try {
          const page = await fetchMessages(
            activeSession,
            forumPageArgs(activeMode, { cursor: activeCursor }),
          );
          if (
            cancelled ||
            generation !== paginationGeneration.current ||
            feedModeRef.current !== activeMode
          ) {
            return;
          }
          const appended = page.messages.filter((message) => !deletedIds.current.has(message.id));
          setMessages((prev) =>
            appendMessages(
              prev,
              appended,
              hiddenReplyCounts.current,
              lastServerReplyCount.current,
            ).filter((message) => !deletedIds.current.has(message.id)),
          );
          nextCursorRef.current = page.nextCursor;
          setNextCursor(page.nextCursor);
          if (appended.some((message) => message.payable === false)) {
            startPayablePoll(activeSession);
          }
        } catch {
          // Keep the current pages and cursor so a later intersection may retry.
        } finally {
          if (!cancelled && generation === paginationGeneration.current) {
            loadingMoreRef.current = false;
          }
        }
      })();
    });
    observer.observe(nearEndElement);
    return () => {
      cancelled = true;
      loadingMoreRef.current = false;
      observer.disconnect();
    };
  }, [feedHashtag, feedMode, nearEndElement, nextCursor, session]);

  const onRefresh = useCallback((): void => {
    refreshMessagesRef.current();
  }, []);

  const showNewPosts = useCallback((): void => {
    shellScrollToTop(scroller);
    forceApplyRef.current = true;
    const started = refreshMessagesRef.current();
    if (!started && !pendingRefreshRef.current) {
      forceApplyRef.current = false;
    }
  }, [scroller]);

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
    paginationGeneration.current += 1;
    loadingMoreRef.current = false;
    nextCursorRef.current = null;
    setNextCursor(null);
    setNewPostsAvailable(false);
    const initial = messagesRef.current === null;
    if (initial) {
      setLoading(true);
    }
    setError(false);
    replaceInFlightRef.current = true;
    void (async () => {
      const result = await loadMessagesOnce(session, feedMode, () => !cancelled, false, true);
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
      if (!cancelled) {
        replaceInFlightRef.current = false;
        if (pendingRefreshRef.current && mountedRef.current) {
          refreshMessagesRef.current();
        }
      }
    })();
    return () => {
      cancelled = true;
      replaceInFlightRef.current = false;
      paginationGeneration.current += 1;
      loadingMoreRef.current = false;
    };
    /* router.replace is used on 409; next/navigation's identity is not stable */
  }, [attempt, feedMode, session]);

  useEffect(() => {
    if (session === null) {
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const next = await fetchNotifications(session);
        if (cancelled) {
          return;
        }
        const unread = next.notifications.find(
          (row) => row.type === 'moderator_appointed' && row.readAt === null,
        );
        setModeratorAppointedId(unread === undefined ? null : unread.id);
      } catch {
        if (cancelled) {
          return;
        }
        setModeratorAppointedId(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [session]);

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
    if (session === null) {
      return;
    }
    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        refreshMessagesRef.current();
      }
    }, FORUM_LIST_POLL_MS);
    return () => {
      window.clearInterval(interval);
    };
  }, [session]);

  useEffect(() => {
    if (session === null) {
      return;
    }
    const onForumHome = (): void => {
      showNewPosts();
    };
    window.addEventListener(FORUM_HOME_EVENT, onForumHome);
    return () => {
      window.removeEventListener(FORUM_HOME_EVENT, onForumHome);
    };
  }, [session, showNewPosts]);

  useEffect(() => {
    if (session === null || !newPostsAvailable) {
      return;
    }
    const onScroll = (): void => {
      const atTop = shellScrollTop(scroller) < 8;
      if (atTop) {
        showNewPosts();
      }
    };
    if (scroller !== null) {
      scroller.addEventListener('scroll', onScroll);
      onScroll();
      return () => {
        scroller.removeEventListener('scroll', onScroll);
      };
    }
    window.addEventListener('scroll', onScroll);
    onScroll();
    return () => {
      window.removeEventListener('scroll', onScroll);
    };
  }, [newPostsAvailable, session, showNewPosts, scroller]);

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
    const missing = visible.flatMap((message) => {
      const count = message.photoCount ?? (message.hasPhoto ? 1 : 0);
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
        /* v8 ignore start -- skip ids filled while earlier fetches in this loop ran */
        if (photoUrlsRef.current[photo.key] !== undefined) {
          continue;
        }
        /* v8 ignore stop */
        let blob: Blob;
        try {
          blob = await fetchMessagePhoto(session, photo.id, photo.index);
        } catch {
          if (cancelled) {
            return;
          }
          try {
            blob = await fetchMessagePhoto(session, photo.id, photo.index);
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
          if (prev[photo.key] !== undefined) {
            URL.revokeObjectURL(url);
            return prev;
          }
          /* v8 ignore stop */
          return { ...prev, [photo.key]: url };
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [photoIdsKey, session]);

  useEffect(() => {
    return () => {
      bumpPayPollGeneration();
      payablePollGeneration.current += 1;
      refreshGeneration.current += 1;
      paginationGeneration.current += 1;
      loadingMoreRef.current = false;
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
          for (const row of next) {
            replyParentById.current.set(row.id, expandedId);
          }
          const filtered = next.filter((row) => !deletedIds.current.has(row.id));
          setReplies(filtered);
          const hiddenForThread = hiddenReplyCounts.current.get(expandedId);
          if (hiddenForThread !== undefined && hiddenForThread > 0) {
            setMessages((prev) => {
              /* v8 ignore next 3 -- expanded fetchReplies only runs after the list has loaded */
              if (prev === null) {
                return prev;
              }
              return prev.map((row) =>
                row.id === expandedId ? { ...row, replyCount: filtered.length } : row,
              );
            });
          }
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

  useEffect(() => {
    setUnpaidSeenAt(loadUnpaidSeenAt());
  }, []);

  useEffect(() => {
    if (feed === 'shops') return;
    if (feedMode !== 'unpaid') return;
    const iso = new Date().toISOString();
    saveUnpaidSeenAt(iso);
    setUnpaidSeenAt(iso);
  }, [feed, feedMode, messages]);

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

  const showModeratorAppointed = (): void => {
    const id = moderatorAppointedId;
    /* v8 ignore next 3 -- pill is omitted when the id is null */
    if (id === null) {
      return;
    }
    void markNotificationRead(session, id)
      .then(() => {
        const current = useAuthStore.getState();
        if (current.session !== session) {
          return;
        }
        setModeratorAppointedId(null);
      })
      .catch(() => undefined);
  };

  const clearPaySheet = (): void => {
    bumpPayPollGeneration();
    setPayMessageId(null);
    setPayDraft('');
    setPayBusy(false);
    setPayError(null);
    setPayInvoice(null);
    setPayWaiting(false);
    setReplyPosting(false);
    setPosting(false);
    notePostInFlightRef.current = false;
    setPayHost(null);
    const keptCaption = pendingComposeTextRef.current;
    if (keptCaption !== null && keptCaption !== '') {
      setDraft(keptCaption);
    }
  };

  const startPayPoll = (
    messageId: string,
    baselineSats: number,
    switchToAll = false,
    replyParentId: string | null = null,
    postAfterPay = false,
  ): void => {
    const generation = bumpPayPollGeneration();
    const controller = payPollAbortRef.current;
    /* v8 ignore next 3 -- bumpPayPollGeneration always assigns a controller */
    if (controller === null) {
      return;
    }
    const signal = controller.signal;
    setPayWaiting(true);
    void (async () => {
      const composePay = switchToAll || replyParentId !== null;
      const countOwn = async (): Promise<number> => {
        const expected = pendingComposeTextRef.current;
        const me = useAuthStore.getState().account?.id;
        const sess = useAuthStore.getState().session;
        /* v8 ignore next 3 -- compose-pay always sets pending text and session before polling */
        if (expected === null || me === undefined || sess === null) {
          return 0;
        }
        if (replyParentId !== null) {
          const replies = await fetchReplies(sess, replyParentId);
          return replies.filter((row) => row.accountId === me && row.text === expected).length;
        }
        const page = await fetchMessages(sess, forumPageArgs('all'));
        return page.messages.filter((row) => row.accountId === me && row.text === expected).length;
      };
      let baselineOwn: number | null = null;
      if (composePay && !postAfterPay) {
        try {
          baselineOwn = await countOwn();
          /* v8 ignore start -- a failed baseline count is retried after sats rise */
        } catch {
          baselineOwn = null;
        }
        /* v8 ignore stop */
      }
      for (;;) {
        try {
          const next = await fetchPublicMessage(messageId, {
            sinceSats: baselineSats,
            signal,
          });
          if (generation !== payPollGeneration.current || signal.aborted) {
            return;
          }
          if (next !== null && next.sats > baselineSats) {
            let ownContent = !composePay;
            if (composePay && postAfterPay) {
              ownContent = true;
            } else if (composePay) {
              try {
                if (baselineOwn !== null) {
                  ownContent = (await countOwn()) > baselineOwn;
                }
                /* v8 ignore start -- a failed own-content lookup keeps the poll waiting */
              } catch {
                ownContent = false;
              }
              /* v8 ignore stop */
            }
            if (ownContent) {
              if (postAfterPay || switchToAll) {
                setAskCadence('once');
              }
              if (postAfterPay) {
                /* v8 ignore next -- compose-pay always stores trimmed text, including '' */
                const caption = pendingComposeTextRef.current ?? '';
                const photos = pendingComposePhotosRef.current;
                const video = pendingComposeVideoRef.current;
                const goalSats = pendingComposeGoalRef.current;
                const pendingPlace = pendingComposePlaceRef.current;
                const placeFields = pendingPlace !== null ? { place: pendingPlace } : {};
                try {
                  const created =
                    video !== null
                      ? await postMessageVideo(session, {
                          text: caption,
                          video: video.file,
                          poster: video.poster,
                          /* v8 ignore next -- Ask plus a video clip is the photo path in tests */
                          ...(goalSats !== undefined ? { goalSats } : {}),
                          ...placeFields,
                        })
                      : await postMessage(session, {
                          text: caption,
                          /* v8 ignore next 3 -- postAfterPay with no video always has pending photos */
                          ...(photos.length === 0
                            ? {}
                            : {
                                photos: photos.map(({ contentType, data, takenAt }) => ({
                                  contentType,
                                  data,
                                  ...(takenAt === undefined ? {} : { takenAt }),
                                })),
                              }),
                          ...(goalSats !== undefined ? { goalSats } : {}),
                          ...placeFields,
                        });
                  applyCreatedNote(created, photos, video);
                  composeFeePaidRef.current = false;
                  pendingComposeGoalRef.current = undefined;
                  pendingComposePlaceRef.current = null;
                } catch {
                  setFormError('request');
                  composeFeePaidRef.current = true;
                  const keptCaption = pendingComposeTextRef.current;
                  if (keptCaption !== null && keptCaption !== '') {
                    setDraft(keptCaption);
                  }
                  setPayWaiting(false);
                  setPayInvoice(null);
                  setPayMessageId(null);
                  setPayHost(null);
                  setPayDraft('');
                  setPayError(null);
                  setPosting(false);
                  notePostInFlightRef.current = false;
                  return;
                }
                pendingComposePhotosRef.current = [];
                pendingComposeVideoRef.current = null;
                setPhotoDrafts([]);
                setVideoDraft(null);
              }
              pendingComposeTextRef.current = null;
              setMessages((prev) => {
                /* v8 ignore next 3 -- pay poll only runs after the list has loaded */
                if (prev === null) {
                  return prev;
                }
                return prev
                  .map((row) =>
                    row.id === next.id
                      ? {
                          ...row,
                          ...next,
                          replyCount: applySessionReplyCount(
                            next.id,
                            next.replyCount,
                            hiddenReplyCounts.current,
                            lastServerReplyCount.current,
                            row.replyCount,
                          ),
                        }
                      : row,
                  )
                  .filter((row) => !deletedIds.current.has(row.id));
              });
              setReplies((prev) => {
                /* v8 ignore next 3 -- poll can finish after the thread is collapsed */
                if (prev === null) {
                  return prev;
                }
                return prev.map((row) => (row.id === next.id ? { ...row, ...next } : row));
              });
              setPayWaiting(false);
              setPayInvoice(null);
              setPayMessageId(null);
              setPayHost(null);
              setPayDraft('');
              setPayError(null);
              setPosting(false);
              setReplyPosting(false);
              notePostInFlightRef.current = false;
              const current = useAuthStore.getState();
              if (current.session !== session) {
                return;
              }
              if (current.account !== null) {
                setAccount({ ...current.account, hasPosted: true });
              }
              const expanded = expandedIdRef.current;
              /* v8 ignore next -- replies are loaded whenever an expanded poll settles */
              const paidNestedReply = (repliesRef.current ?? []).some(
                (row) => row.id === messageId,
              );
              if (expanded !== null && !paidNestedReply) {
                setRepliesAttempt((n) => n + 1);
              }
              if (replyParentId !== null && replyParentId !== next.id) {
                /* v8 ignore start -- compose-pay reply increment is asserted in tests; identity arm is fixture-only */
                setMessages((prev) => {
                  if (prev === null) {
                    return prev;
                  }
                  return prev.map((row) =>
                    row.id === replyParentId ? { ...row, replyCount: row.replyCount + 1 } : row,
                  );
                });
                /* v8 ignore stop */
              }
              payMessageIdRef.current = null;
              payWaitingRef.current = false;
              if (switchToAll && feedModeRef.current !== 'all') {
                replaceInFlightRef.current = true;
                paginationGeneration.current += 1;
                loadingMoreRef.current = false;
                refreshGeneration.current += 1;
                nextCursorRef.current = null;
                setNextCursor(null);
                setNewPostsAvailable(false);
                feedModeRef.current = 'all';
                setFeedMode('all');
              } else if (switchToAll) {
                refreshMessagesRef.current();
              }
              return;
            }
          }
        } catch {
          // Keep waiting while the sheet is open; generic retry is the board load path.
        }
        if (generation !== payPollGeneration.current || signal.aborted) {
          return;
        }
        await new Promise((resolve) => {
          setTimeout(resolve, PAY_POLL_MS);
        });
        if (generation !== payPollGeneration.current || signal.aborted) {
          return;
        }
      }
    })();
  };

  const onPickFiles = (files: File[]): void => {
    /* v8 ignore next 3 -- ForumBoard skips onPickFiles when the FileList is empty */
    if (files.length === 0) {
      return;
    }
    const generation = pickGeneration.current + 1;
    pickGeneration.current = generation;
    setPreparing(true);
    void (async () => {
      const videoFile = files.find(isForumVideoFile);
      try {
        if (videoFile !== undefined) {
          const result = await prepareForumVideo(videoFile);
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
          setPhotoDrafts([]);
          setVideoDraft(result.video);
          setFormError(null);
          return;
        }

        revokeObjectUrlIfPresent(videoDraftRef.current?.previewUrl);
        setVideoDraft(null);
        const nextPhotos = photoDraftsRef.current.slice(0, 10);
        let nextError: ForumFormError = null;
        const remaining = 10 - nextPhotos.length;
        if (files.length > remaining) {
          nextError = 'tooMany';
        }
        for (const file of files.slice(0, Math.max(0, remaining))) {
          try {
            const result = await prepareForumPhoto(file);
            if (generation !== pickGeneration.current) {
              return;
            }
            if (result.ok) {
              nextPhotos.push(result.photo);
            } else if (nextError !== 'tooMany') {
              nextError = result.error;
            }
          } catch {
            if (generation !== pickGeneration.current) {
              return;
            }
            if (nextError !== 'tooMany') {
              nextError = 'unsupported';
            }
          }
        }
        /* v8 ignore next 3 -- generation already checked after each await in the stills loop */
        if (generation !== pickGeneration.current) {
          return;
        }
        setPhotoDrafts(nextPhotos);
        setFormError(nextError);
      } catch {
        if (generation === pickGeneration.current) {
          setFormError('unsupported');
        }
      } finally {
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

  const applyCreatedNote = (
    created: ForumMessage,
    pendingPhotos: ForumPhotoPayload[],
    pendingVideo: ForumVideoPayload | null,
  ): void => {
    composeFeePaidRef.current = false;
    optimisticMessages.current.set(created.id, created);
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
      if (feedMode === 'unpaid' && feed !== 'shops') {
        const iso = new Date().toISOString();
        saveUnpaidSeenAt(iso);
        setUnpaidSeenAt(iso);
      }
      const askStaysOnActive = typeof created.goalSats === 'number' && created.goalSats > 0;
      if (askStaysOnActive && feedModeRef.current === 'popular') {
        replaceInFlightRef.current = true;
        paginationGeneration.current += 1;
        loadingMoreRef.current = false;
        refreshGeneration.current += 1;
        nextCursorRef.current = null;
        setNextCursor(null);
        setNewPostsAvailable(false);
        feedModeRef.current = 'active';
        setFeedMode('active');
      } else if (feedModeRef.current !== 'all' && !askStaysOnActive) {
        replaceInFlightRef.current = true;
        paginationGeneration.current += 1;
        loadingMoreRef.current = false;
        refreshGeneration.current += 1;
        nextCursorRef.current = null;
        setNextCursor(null);
        setNewPostsAvailable(false);
        feedModeRef.current = 'all';
        setFeedMode('all');
      }
    }
    if (created.hasPhoto && pendingPhotos.length > 0) {
      setPhotoUrls((prev) => {
        const next = { ...prev };
        for (const [index, pendingPhoto] of pendingPhotos.entries()) {
          const key = `${created.id}:${index}`;
          if (next[key] === undefined) {
            next[key] = pendingPhoto.previewUrl;
          }
        }
        return next;
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
    setAskDraft('');
    setComposeIntent('post');
    setAskStep(1);
    setAskCadence('once');
    setPlaceDraft(null);
    setPhotoDrafts([]);
    setVideoDraft(null);
    startPayablePoll(session);
  };

  const runNotePost = async (
    trimmed: string,
    pendingPhotos: ForumPhotoPayload[],
    pendingVideo: ForumVideoPayload | null,
    isRetry: boolean,
    goalSats: number | undefined,
    pendingPlace: ForumPlacePin | null,
  ): Promise<void> => {
    setPosting(true);
    setFormError(null);
    let awaitingPay = false;
    try {
      if (
        account !== null &&
        !roleAtLeast(account.role, 'verified') &&
        !composeFeePaidRef.current
      ) {
        const hasMedia = pendingPhotos.length > 0 || pendingVideo !== null;
        const postAfterPay = hasMedia || goalSats !== undefined || pendingPlace !== null;
        pendingComposePlaceRef.current = pendingPlace;
        const target = await fetchComposeTarget(session);
        const invoice = await postMessageInvoice(
          session,
          target.messageId,
          1,
          postAfterPay ? undefined : trimmed,
          shownFiatForSats(1, rateDayRef.current),
        );
        setPayMessageId(target.messageId);
        setPayError(null);
        setPayInvoice({
          messageId: target.messageId,
          pr: invoice.pr,
          amountSats: invoice.amountSats,
        });
        setPayHost('composer');
        pendingComposeTextRef.current = trimmed;
        pendingComposePhotosRef.current = pendingPhotos;
        pendingComposeVideoRef.current = pendingVideo;
        pendingComposeGoalRef.current = goalSats;
        startPayPoll(target.messageId, target.sats, goalSats === undefined, null, postAfterPay);
        pendingPostRef.current = null;
        setDraft('');
        if (!hasMedia) {
          setPhotoDrafts([]);
          setVideoDraft(null);
        }
        awaitingPay = true;
        return;
      }
      const placeFields = pendingPlace !== null ? { place: pendingPlace } : {};
      const created =
        pendingVideo !== null
          ? await postMessageVideo(session, {
              text: trimmed,
              video: pendingVideo.file,
              poster: pendingVideo.poster,
              ...(goalSats !== undefined ? { goalSats } : {}),
              ...placeFields,
            })
          : await postMessage(session, {
              text: trimmed,
              ...(pendingPhotos.length === 0
                ? {}
                : {
                    photos: pendingPhotos.map(({ contentType, data, takenAt }) => ({
                      contentType,
                      data,
                      ...(takenAt === undefined ? {} : { takenAt }),
                    })),
                  }),
              ...(goalSats !== undefined ? { goalSats } : {}),
              ...placeFields,
            });
      applyCreatedNote(created, pendingPhotos, pendingVideo);
      pendingPostRef.current = null;
      const current = useAuthStore.getState();
      if (current.session !== session || current.account === null) {
        return;
      }
      setAccount({ ...current.account, hasPosted: true });
    } catch (err) {
      if (err instanceof MissingRequirementsError) {
        if (!isRetry && openOverlayForMissing(err.missing)) {
          pendingPostRef.current = () => {
            startNotePost(trimmed, pendingPhotos, pendingVideo, true, goalSats, pendingPlace);
            return Promise.resolve();
          };
          return;
        }
        setFormError('request');
        return;
      }
      pendingComposePlaceRef.current = null;
      setFormError(isRateLimitError(err) ? 'rateLimit' : 'request');
    } finally {
      if (!awaitingPay) {
        notePostInFlightRef.current = false;
        setPosting(false);
      }
    }
  };

  const startNotePost = (
    trimmed: string,
    pendingPhotos: ForumPhotoPayload[],
    pendingVideo: ForumVideoPayload | null,
    isRetry: boolean,
    goalSats: number | undefined,
    pendingPlace: ForumPlacePin | null,
  ): void => {
    if (notePostInFlightRef.current) return;
    notePostInFlightRef.current = true;
    void runNotePost(trimmed, pendingPhotos, pendingVideo, isRetry, goalSats, pendingPlace);
  };

  const onPost = (): void => {
    const trimmed = draft.trim();
    if (trimmed === '' && photoDrafts.length === 0 && videoDraft === null) {
      setFormError('empty');
      return;
    }
    const body = feed === 'shops' ? ensureShopHashtag(trimmed) : trimmed;
    if (body.length > FORUM_MESSAGE_MAX_LENGTH) {
      setFormError('tooLong');
      return;
    }
    let goalSats: number | undefined;
    if (feed !== 'shops' && composeIntent === 'ask') {
      const parsed = parseForumAskAmountInUnit(askDraft, askUnit.current, rateDay, fiat);
      /* v8 ignore next 4 -- step 1 Continue already requires a parseable amount */
      if (parsed === null) {
        setFormError('ask');
        return;
      }
      goalSats = parsed;
    }
    const missing = account?.missing ?? [];
    const pendingPlace = placeDraft;
    if (openOverlayForMissing(missing)) {
      const pendingPhotos = photoDrafts;
      const pendingVideo = videoDraft;
      pendingPostRef.current = () => {
        startNotePost(body, pendingPhotos, pendingVideo, true, goalSats, pendingPlace);
        return Promise.resolve();
      };
      return;
    }
    pickGeneration.current += 1;
    const pendingPhotos = photoDrafts;
    const pendingVideo = videoDraft;
    startNotePost(body, pendingPhotos, pendingVideo, false, goalSats, pendingPlace);
  };

  const onPaySubmit = (): void | Promise<ForumPayInvoice | null> => {
    /* v8 ignore next 3 -- button is disabled when no sheet is open */
    if (payMessageId === null || payBusy) {
      return;
    }
    const listed =
      messages?.find((message) => message.id === payMessageId) ??
      replies?.find((message) => message.id === payMessageId);
    /* v8 ignore next 3 -- sheet only opens on a payable row */
    if (listed === undefined || listed.payable !== true) {
      return;
    }
    const sats = paySatsFromDraft(payDraft, payShownUnit, rateDay, fiat);
    if (sats === 'invalid') {
      setPayError('amount');
      return;
    }
    const messageId = payMessageId;
    const baseline = listed.sats;
    const continuePay = (isRetry: boolean): Promise<ForumPayInvoice | null> => {
      const generation = payPollGeneration.current;
      setPayBusy(true);
      setPayError(null);
      return (async () => {
        let minted: ForumPayInvoice | null = null;
        try {
          const invoice = await postMessageInvoice(
            session,
            messageId,
            sats,
            undefined,
            shownFiatForSats(sats, rateDayRef.current),
          );
          if (generation !== payPollGeneration.current) {
            return null;
          }
          minted = {
            messageId,
            pr: invoice.pr,
            amountSats: invoice.amountSats,
          };
          setPayInvoice(minted);
          setPayBusy(false);
          startPayPoll(messageId, baseline);
        } catch (err) {
          if (generation !== payPollGeneration.current) {
            return null;
          }
          if (err instanceof MissingRequirementsError) {
            if (!isRetry && openOverlayForMissing(err.missing)) {
              pendingPostRef.current = () => continuePay(true).then(() => undefined);
              return null;
            }
            setPayError('request');
            return null;
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
        return minted;
      })();
    };
    if (account !== null && openOverlayForMissing(account.missing)) {
      pendingPostRef.current = () => continuePay(true).then(() => undefined);
      return;
    }
    return continuePay(false);
  };

  const onModeChange = (next: ForumFeedMode): void => {
    if (next === feedMode) {
      return;
    }
    const listedParent =
      payMessageId !== null &&
      ((messages !== null &&
        visibleForumMessages(messages, next).some((message) => message.id === payMessageId)) ||
        (replies !== null && replies.some((message) => message.id === payMessageId)));
    if (payMessageId !== null && !listedParent && payHost !== 'composer') {
      clearPaySheet();
    }
    replaceInFlightRef.current = true;
    paginationGeneration.current += 1;
    loadingMoreRef.current = false;
    refreshGeneration.current += 1;
    nextCursorRef.current = null;
    setNextCursor(null);
    setNewPostsAvailable(false);
    feedModeRef.current = next;
    setFeedMode(next);
  };

  const onToggleExpand = (messageId: string): void => {
    if (replyPosting) {
      return;
    }
    if (
      payMessageId !== null &&
      replies !== null &&
      replies.some((row) => row.id === payMessageId)
    ) {
      clearPaySheet();
    }
    if (expandedId === messageId) {
      setExpandedId(null);
      setReplies(null);
      setRepliesError(false);
      setRepliesLoading(false);
      setReplyDraft('');
      setReplyAmountDraft('');
      setReplyFormError(null);
      return;
    }
    setExpandedId(messageId);
    setReplies(null);
    setRepliesLoading(true);
    setRepliesError(false);
    setReplyDraft('');
    setReplyAmountDraft('');
    setReplyFormError(null);
    setRepliesAttempt((n) => n + 1);
  };

  const applyCreatedReply = (
    created: ForumMessage,
    parentId: string,
    parentBaseline: number,
  ): void => {
    replyParentById.current.set(created.id, parentId);
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
      /* v8 ignore next 3 -- first successful post before fetch returns */
      if (wasEmpty) {
        setRepliesAttempt((n) => n + 1);
      }
    }
    if (!alreadyListed) {
      /* v8 ignore next -- page-one merge seeds the parent id before any created reply */
      const prevLast = lastServerReplyCount.current.get(parentId) ?? 0;
      lastServerReplyCount.current.set(parentId, Math.max(prevLast, parentBaseline + 1));
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
    try {
      const created = await postMessage(session, { text: trimmed, inReplyTo: parentId });
      applyCreatedReply(created, parentId, parentBaseline);
      pendingPostRef.current = null;
      const current = useAuthStore.getState();
      if (current.session !== session || current.account === null) {
        return;
      }
      setAccount({ ...current.account, hasPosted: true });
    } catch (err) {
      if (err instanceof MissingRequirementsError) {
        if (!isRetry && openOverlayForMissing(err.missing)) {
          pendingPostRef.current = () => runReplyPost(trimmed, parentId, parentBaseline, true);
          return;
        }
        setReplyFormError('request');
        return;
      }
      if (isReplyPaymentError(err)) {
        await runComposePay(trimmed, parentId, 1, isRetry);
        return;
      }
      /* v8 ignore next 3 -- reply error after the thread was closed */
      if (expandedIdRef.current === parentId) {
        setReplyFormError(isRateLimitError(err) ? 'rateLimit' : 'request');
      }
    } finally {
      setReplyPosting(false);
    }
  };

  const runPaidReply = async (
    trimmed: string,
    parentId: string,
    sats: number,
    baselineSats: number,
    isRetry: boolean,
  ): Promise<void> => {
    setReplyPosting(true);
    setReplyFormError(null);
    const generation = payPollGeneration.current;
    try {
      const invoice =
        trimmed === ''
          ? await postMessageInvoice(
              session,
              parentId,
              sats,
              undefined,
              shownFiatForSats(sats, rateDayRef.current),
            )
          : await postMessageInvoice(
              session,
              parentId,
              sats,
              trimmed,
              shownFiatForSats(sats, rateDayRef.current),
            );
      if (generation !== payPollGeneration.current) {
        return;
      }
      setPayMessageId(parentId);
      setPayError(null);
      setPayInvoice({
        messageId: parentId,
        pr: invoice.pr,
        amountSats: invoice.amountSats,
      });
      setPayHost('card');
      setReplyDraft('');
      setReplyAmountDraft('');
      pendingPostRef.current = null;
      setReplyPosting(false);
      startPayPoll(parentId, baselineSats);
    } catch (err) {
      if (generation !== payPollGeneration.current) {
        return;
      }
      if (err instanceof MissingRequirementsError) {
        if (!isRetry && openOverlayForMissing(err.missing)) {
          pendingPostRef.current = () => runPaidReply(trimmed, parentId, sats, baselineSats, true);
          return;
        }
        setReplyFormError('request');
        return;
      }
      if (expandedIdRef.current === parentId) {
        setReplyFormError(
          err instanceof Error && /1[-–]8000 characters/i.test(err.message)
            ? 'tooLong'
            : isRateLimitError(err)
              ? 'rateLimit'
              : 'request',
        );
      }
    } finally {
      setReplyPosting(false);
    }
  };

  const runComposePay = async (
    trimmed: string,
    parentId: string,
    sats: number,
    isRetry: boolean,
  ): Promise<void> => {
    const composeOverhead = `inReplyTo:${parentId}\n`.length;
    if (trimmed.length + composeOverhead > FORUM_MESSAGE_MAX_LENGTH) {
      setReplyFormError('tooLong');
      return;
    }
    setReplyPosting(true);
    setReplyFormError(null);
    const generation = payPollGeneration.current;
    let awaitingPay = false;
    try {
      const target = await fetchComposeTarget(session);
      const invoice = await postMessageInvoice(
        session,
        target.messageId,
        sats,
        `inReplyTo:${parentId}\n${trimmed}`,
        shownFiatForSats(sats, rateDayRef.current),
      );
      /* v8 ignore next 3 -- pay sheet closed while the compose invoice was minting */
      if (generation !== payPollGeneration.current) {
        return;
      }
      setPayMessageId(target.messageId);
      setPayError(null);
      setPayInvoice({
        messageId: target.messageId,
        pr: invoice.pr,
        amountSats: invoice.amountSats,
      });
      setPayHost('composer');
      setReplyDraft('');
      setReplyAmountDraft('');
      pendingPostRef.current = null;
      pendingComposeTextRef.current = trimmed;
      startPayPoll(target.messageId, target.sats, false, parentId);
      awaitingPay = true;
    } catch (err) {
      /* v8 ignore start -- pay sheet closed while the compose invoice failed */
      if (generation !== payPollGeneration.current) {
        return;
      }
      /* v8 ignore stop */
      if (err instanceof MissingRequirementsError) {
        if (!isRetry && openOverlayForMissing(err.missing)) {
          pendingPostRef.current = () => runComposePay(trimmed, parentId, sats, true);
          return;
        }
        setReplyFormError('request');
        return;
      }
      if (expandedIdRef.current === parentId) {
        setReplyFormError(isRateLimitError(err) ? 'rateLimit' : 'request');
      }
    } finally {
      if (!awaitingPay) {
        setReplyPosting(false);
      }
    }
  };

  const onReplyPost = (): void => {
    /* v8 ignore next 3 -- reply composer only mounts when expanded */
    if (expandedId === null || replyPosting || repliesLoading || repliesError || replies === null) {
      return;
    }
    const trimmed = replyDraft.trim();
    /* v8 ignore next 4 -- textarea maxLength */
    if (trimmed.length > FORUM_MESSAGE_MAX_LENGTH) {
      setReplyFormError('tooLong');
      return;
    }
    const parsed = replySatsFromDraft(replyAmountDraft, replyShownUnit, rateDay, fiat);
    const parentId = expandedId;
    const parentRow = messagesRef.current?.find((message) => message.id === parentId);
    /* v8 ignore next 2 -- expanded parent is always in the loaded list */
    const parentBaseline = parentRow === undefined ? 0 : parentRow.replyCount;
    const parentSats = parentRow === undefined ? 0 : parentRow.sats;
    const parentAccountId = parentRow?.accountId;
    const exempt = isReplyPaymentExempt(account, parentAccountId);
    const authorUnknown = parentAccountId === undefined;
    const composeOverhead = `inReplyTo:${parentId}\n`.length;
    if (!exempt && trimmed.length + composeOverhead > FORUM_MESSAGE_MAX_LENGTH) {
      setReplyFormError('tooLong');
      return;
    }
    const continueReply = (isRetry: boolean): Promise<void> => {
      if (parsed === 'invalid') {
        setReplyFormError('amount');
        return Promise.resolve();
      }
      if (trimmed === '' && parsed === 'empty') {
        return runPaidReply(trimmed, parentId, DEFAULT_FORUM_PAY_SATS, parentSats, isRetry);
      }
      if (parsed === 'empty') {
        if (exempt || authorUnknown) {
          return runReplyPost(trimmed, parentId, parentBaseline, isRetry);
        }
        return runComposePay(trimmed, parentId, 1, isRetry);
      }
      return runPaidReply(trimmed, parentId, parsed, parentSats, isRetry);
    };
    const missing = account?.missing ?? [];
    if (openOverlayForMissing(missing)) {
      pendingPostRef.current = () => continueReply(true);
      return;
    }
    void continueReply(false);
  };

  const onOverlaySatisfied = (): void => {
    const current = useAuthStore.getState().account;
    /* v8 ignore next 4 -- overlay onSatisfied is not invoked after the account vanishes */
    if (current === null) {
      setOverlayRequirement(null);
      return;
    }
    const still = nextPostRequirement(current.missing);
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

  const shopSuffixLen = `\n\n#${SHOP_HASHTAG}`.length; // 14
  const composerMaxLength =
    feed === 'shops' && !isShopNote(draft)
      ? FORUM_MESSAGE_MAX_LENGTH - shopSuffixLen
      : FORUM_MESSAGE_MAX_LENGTH;
  const listed = listedNotes(messages);

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
        messages={listed}
        {...(feed === 'shops' ? { emptyKey: 'shops.empty' as const } : {})}
        {...(feed === 'shops' ? { modeSelector: false as const } : {})}
        {...(feed === 'shops' ? { allowAsk: false as const } : {})}
        {...(feed === 'shops' ? { composerMaxLength } : {})}
        newPostsAvailable={newPostsAvailable}
        onShowNewPosts={showNewPosts}
        moderatorAppointedAvailable={moderatorAppointedId !== null}
        onShowModeratorAppointed={showModeratorAppointed}
        {...(account !== null && roleAtLeast(account.role, 'moderator')
          ? {
              onDeleted: (messageId: string) => {
                /* v8 ignore next 3 -- a second confirm for the same id is a remount race */
                if (deletedIds.current.has(messageId)) {
                  return;
                }
                deletedIds.current.add(messageId);
                const isListedPost =
                  messagesRef.current?.some((row) => row.id === messageId) === true;
                if (!isListedPost) {
                  const parentId = replyParentById.current.get(messageId);
                  if (expandedIdRef.current === parentId) {
                    setReplies((prev) => {
                      /* v8 ignore next 3 -- replies are null only before the first fetch returns */
                      if (prev === null) {
                        return prev;
                      }
                      return prev.filter((row) => !deletedIds.current.has(row.id));
                    });
                  }
                  if (payMessageIdRef.current === messageId) {
                    clearPaySheet();
                  }
                  /* v8 ignore next 3 -- a reply delete without a remembered parent cannot decrement */
                  if (parentId === undefined) {
                    return;
                  }
                  /* v8 ignore next -- applySessionReplyCount seeds the parent id with 0 before any delete */
                  const prevHidden = hiddenReplyCounts.current.get(parentId) ?? 0;
                  hiddenReplyCounts.current.set(parentId, prevHidden + 1);
                  setMessages((prev) =>
                    prev!.map((row) => {
                      if (row.id !== parentId) {
                        return row;
                      }
                      return {
                        ...row,
                        replyCount: Math.max(0, row.replyCount - 1),
                      };
                    }),
                  );
                  return;
                }
                setMessages((prev) => prev!.filter((row) => row.id !== messageId));
                const wasExpanded = expandedIdRef.current === messageId;
                if (wasExpanded) {
                  setExpandedId(null);
                  setReplies(null);
                }
                if (payMessageIdRef.current === messageId || wasExpanded) {
                  clearPaySheet();
                }
              },
            }
          : {})}
        error={error}
        loading={loading}
        refreshing={refreshing}
        onRefresh={onRefresh}
        posting={posting || preparing}
        draft={draft}
        placeDraft={placeDraft}
        onPlaceDraftChange={setPlaceDraft}
        onDraftChange={(value) => {
          setDraft(value);
          setFormError(null);
        }}
        askDraft={askDraft}
        askDraftUnit={askDraftUnit}
        onAskDraftUnit={setAskDraftUnit}
        onAskDraftChange={(value) => {
          setAskDraft(value);
          setFormError(null);
        }}
        composeIntent={composeIntent}
        onComposeIntentChange={(intent) => {
          setComposeIntent(intent);
          if (intent === 'ask') {
            setPlaceDraft(null);
            pendingComposePlaceRef.current = null;
          }
          if (intent === 'post') {
            setAskStep(1);
          }
          setFormError(null);
        }}
        askStep={askStep}
        onAskStepChange={setAskStep}
        askCadence={askCadence}
        onAskCadenceChange={setAskCadence}
        authorName={account?.name ?? ''}
        onPost={onPost}
        onRetry={() => {
          setAttempt((n) => n + 1);
        }}
        formError={formError}
        photoDrafts={photoDrafts}
        videoDraft={videoDraft}
        onPickFiles={onPickFiles}
        onRemovePhoto={onRemovePhoto}
        onClearPhoto={() => {
          revokeObjectUrlIfPresent(videoDraftRef.current?.previewUrl);
          pickGeneration.current += 1;
          setPhotoDrafts([]);
          setVideoDraft(null);
          setFormError(null);
        }}
        photoUrls={photoUrls}
        videoUrls={videoUrls}
        payMessageId={payMessageId}
        payHost={payHost}
        payDraft={payDraft}
        payBusy={payBusy}
        payError={payError}
        payInvoice={payInvoice}
        payWaiting={payWaiting}
        onPayOpen={(messageId) => {
          bumpPayPollGeneration();
          setPayMessageId(messageId);
          setPayHost('card');
          setPayDraft('');
          setPayError(null);
          setPayInvoice(null);
          setPayWaiting(false);
          setPayBusy(false);
        }}
        onPayUnitChange={setPayShownUnit}
        onReplyUnitChange={setReplyShownUnit}
        onPayDraftChange={(value) => {
          setPayDraft(value);
          setPayError(null);
        }}
        onPaySubmit={onPaySubmit}
        onPayCancel={clearPaySheet}
        rateDay={rateDay}
        mode={feedMode}
        onModeChange={onModeChange}
        nearEndRef={nearEndRef}
        unpaidNewCount={
          feedMode === 'unpaid' || messages === null
            ? 0
            : unpaidNewCount(filterListed(messages), unpaidSeenAt)
        }
        lawsVisible={feed === 'shops' ? false : lawsVisible}
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
        replyAmountDraft={replyAmountDraft}
        onReplyAmountDraftChange={(value) => {
          setReplyAmountDraft(value);
          setReplyFormError(null);
        }}
        onReplyPost={onReplyPost}
        replyPosting={replyPosting}
        replyFormError={replyFormError}
      />
    </>
  );
}
