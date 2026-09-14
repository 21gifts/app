'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type ReactElement } from 'react';
import { AccountActivityChart } from '@/components/AccountActivityChart';
import {
  ForumBoard,
  type ForumFormError,
  type ForumPayError,
  type ForumPayInvoice,
} from '@/components/ForumBoard';
import { useTranslations } from '@/components/LocaleProvider';
import { RequirementsOverlay } from '@/components/RequirementsOverlay';
import { Button } from '@/components/ui';
import {
  fetchMemberPosts,
  fetchMemberReplies,
  fetchPublicMessage,
  fetchReplies,
  openConversation,
  postMessage,
  postMessageInvoice,
} from '@/lib/api';
import {
  FORUM_MESSAGE_MAX_LENGTH,
  type ForumMessage,
  type GiftStats,
  type MemberProfile,
} from '@/lib/api-types';
import type { MessageKey } from '@/lib/messages';
import {
  MissingRequirementsError,
  nextPostRequirement,
  type MissingRequirement,
} from '@/lib/missing-requirements';
import { useAuthStore } from '@/stores/auth-store';

/** Delay between pay polls (ms). */
const PAY_POLL_MS = 2000;

/**
 * True when the signed-in account may reply without paying.
 *
 * @param account - Live account, or `null` when the snapshot is missing.
 * @param parentAccountId - Profile note `accountId`, if the api sent one.
 * @returns Whether `POST /messages` is allowed without a zap.
 */
function isReplyPaymentExempt(
  account: { id: string; role: 'basis' | 'verified' | 'moderator' | 'founder' } | null,
  parentAccountId: string | undefined,
): boolean {
  if (account === null) {
    return false;
  }
  if (account.role === 'founder' || account.role === 'moderator') {
    return true;
  }
  return parentAccountId !== undefined && parentAccountId === account.id;
}

/**
 * Parses the reply-composer sats draft.
 *
 * @param raw - Amount field value.
 * @returns Whole sats, `'empty'` when blank, or `'invalid'`.
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
  /* v8 ignore next 3 -- /^\d+$/ parseInt is non-negative; overflow is defensive */
  if (sats <= 0 || !Number.isSafeInteger(sats)) {
    return 'invalid';
  }
  return sats;
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
 * True when a thrown value is the api rate-limit copy for posts or payments.
 *
 * @param err - Caught rejection.
 * @returns Whether the message looks like a rate-limit error.
 */
function isRateLimitError(err: unknown): boolean {
  /* v8 ignore next 3 -- non-Error throw is defensive */
  if (!(err instanceof Error)) {
    return false;
  }
  return /too many (messages|payments)/i.test(err.message);
}

/** Roles that show a clickable tag beside the author name. */
type MemberTaggedRole = 'founder' | 'moderator' | 'verified';

const ROLE_TAG_KEYS: Record<MemberTaggedRole, { label: MessageKey; hint: MessageKey }> = {
  founder: { label: 'forum.role.founder', hint: 'forum.role.founderHint' },
  moderator: { label: 'forum.role.moderator', hint: 'forum.role.moderatorHint' },
  verified: { label: 'forum.role.verified', hint: 'forum.role.verifiedHint' },
};

/* v8 ignore start -- ForumBoard defaults unused on the single profile note card */
const IDLE_BOARD = {
  error: false,
  loading: false,
  posting: false,
  draft: '',
  onDraftChange: (): void => undefined,
  onPost: (): void => undefined,
  onRetry: (): void => undefined,
  formError: null as ForumFormError,
  payMessageId: null as string | null,
  payDraft: '',
  payBusy: false,
  payError: null as ForumPayError,
  payInvoice: null as ForumPayInvoice | null,
  payWaiting: false,
  onPayOpen: (): void => undefined,
  onPayDraftChange: (): void => undefined,
  onPaySubmit: (): void => undefined,
  onPayCancel: (): void => undefined,
  mode: 'all' as const,
  onModeChange: (): void => undefined,
  lawsVisible: false,
  onDismissLaws: (): void => undefined,
  photoDraft: null,
  onPickPhoto: (): void => undefined,
  onClearPhoto: (): void => undefined,
  photoUrls: {},
  expandedId: null as string | null,
  onToggleExpand: (): void => undefined,
  replies: null as ForumMessage[] | null,
  repliesLoading: false,
  repliesError: false,
  onRetryReplies: (): void => undefined,
  replyDraft: '',
  onReplyDraftChange: (): void => undefined,
  onReplyPost: (): void => undefined,
  replyPosting: false,
  replyFormError: null as ForumFormError,
  ownName: null as string | null,
  ownAccountId: null as string | null,
  onPm: (): void => undefined,
  pmBusyId: null as string | null,
  composerHidden: true,
};
/* v8 ignore stop */

/**
 * Signed-in member identity card: chart, name, location, Lightning Address,
 * role pill, post/reply counts, optional pinned forum note, and stacked
 * activity feeds.
 *
 * @param props - Member profile and receive series for the chart.
 * @returns The presentational member profile.
 */
export function MemberProfileScreen({
  profile,
  received,
}: {
  profile: MemberProfile;
  received: GiftStats['spendOverTime'];
}): ReactElement {
  const { t } = useTranslations();
  const router = useRouter();
  const session = useAuthStore((state) => state.session);
  const account = useAuthStore((state) => state.account);
  const setAccount = useAuthStore((state) => state.setAccount);
  const [payMessageId, setPayMessageId] = useState<string | null>(null);
  const [payDraft, setPayDraft] = useState('');
  const [payBusy, setPayBusy] = useState(false);
  const [payError, setPayError] = useState<ForumPayError>(null);
  const [payInvoice, setPayInvoice] = useState<ForumPayInvoice | null>(null);
  const [payWaiting, setPayWaiting] = useState(false);
  const payPollAbortRef = useRef<AbortController | null>(null);
  const payPollGeneration = useRef(0);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const expandedIdRef = useRef(expandedId);
  expandedIdRef.current = expandedId;
  const expandGen = useRef(0);
  const [replies, setReplies] = useState<ForumMessage[] | null>(null);
  const [repliesLoading, setRepliesLoading] = useState(false);
  const [repliesError, setRepliesError] = useState(false);
  const [pmBusyId, setPmBusyId] = useState<string | null>(null);
  const [replyDraft, setReplyDraft] = useState('');
  const [replyAmountDraft, setReplyAmountDraft] = useState('');
  const [replyPosting, setReplyPosting] = useState(false);
  const [replyFormError, setReplyFormError] = useState<ForumFormError>(null);
  const [overlayRequirement, setOverlayRequirement] = useState<
    'name' | 'rules' | 'lightning-address' | null
  >(null);
  const pendingPostRef = useRef<(() => Promise<void>) | null>(null);
  const [listedNote, setListedNote] = useState(profile.profileMessage);
  const [activity, setActivity] = useState<null | 'posts' | 'replies'>(null);
  const [posts, setPosts] = useState<ForumMessage[] | null>(null);
  const [postsLoading, setPostsLoading] = useState(false);
  const [postsError, setPostsError] = useState(false);
  const [activityReplies, setActivityReplies] = useState<ForumMessage[] | null>(null);
  const [activityRepliesLoading, setActivityRepliesLoading] = useState(false);
  const [activityRepliesError, setActivityRepliesError] = useState(false);
  const postsLoadGen = useRef(0);
  const repliesLoadGen = useRef(0);
  const address = profile.lightningAddress;

  const loadActivityFeed = async (kind: 'posts' | 'replies'): Promise<void> => {
    const setLoading = kind === 'posts' ? setPostsLoading : setActivityRepliesLoading;
    const setError = kind === 'posts' ? setPostsError : setActivityRepliesError;
    const setList = kind === 'posts' ? setPosts : setActivityReplies;
    const fetchFn = kind === 'posts' ? fetchMemberPosts : fetchMemberReplies;
    const loadGen = kind === 'posts' ? postsLoadGen : repliesLoadGen;
    const gen = ++loadGen.current;
    setLoading(true);
    setError(false);
    if (session === null) {
      setLoading(false);
      setError(true);
      return;
    }
    try {
      const next = await fetchFn(session, profile.id);
      if (loadGen.current === gen) {
        setList(next);
      }
    } catch (err) {
      if (err instanceof MissingRequirementsError) {
        router.replace('/setup/rules');
        return;
      }
      if (loadGen.current === gen) {
        setError(true);
      }
    } finally {
      if (loadGen.current === gen) {
        setLoading(false);
      }
    }
  };

  const openActivity = (next: 'posts' | 'replies'): void => {
    if (activity === next) {
      setActivity(null);
      return;
    }
    setActivity(next);
    if (next === 'posts') {
      if ((posts === null || postsError) && !postsLoading) {
        void loadActivityFeed('posts');
      }
      return;
    }
    if ((activityReplies === null || activityRepliesError) && !activityRepliesLoading) {
      void loadActivityFeed('replies');
    }
  };

  const bumpPayPollGeneration = (): number => {
    payPollAbortRef.current?.abort();
    payPollAbortRef.current = new AbortController();
    payPollGeneration.current += 1;
    return payPollGeneration.current;
  };

  useEffect(() => {
    return () => {
      bumpPayPollGeneration();
    };
  }, []);

  const startPayPoll = (messageId: string, baselineSats: number): void => {
    const generation = bumpPayPollGeneration();
    const controller = payPollAbortRef.current;
    /* v8 ignore next 3 -- bumpPayPollGeneration always assigns a controller */
    if (controller === null) {
      return;
    }
    const signal = controller.signal;
    setPayWaiting(true);
    void (async () => {
      for (;;) {
        try {
          const next = await fetchPublicMessage(messageId, {
            sinceSats: baselineSats,
            signal,
          });
          /* v8 ignore next 3 -- aborted while the public fetch was in flight */
          if (generation !== payPollGeneration.current || signal.aborted) {
            return;
          }
          if (next !== null && next.sats > baselineSats) {
            setListedNote((prev) => {
              if (prev === null || prev.id !== next.id) {
                return prev;
              }
              return {
                ...prev,
                ...next,
                replyCount: Math.max(prev.replyCount, next.replyCount),
              };
            });
            setPosts((prev) => {
              if (prev === null) {
                return prev;
              }
              return prev.map((row) =>
                row.id === next.id
                  ? {
                      ...row,
                      ...next,
                      replyCount: Math.max(row.replyCount, next.replyCount),
                    }
                  : row,
              );
            });
            setPayWaiting(false);
            setPayInvoice(null);
            setPayMessageId(null);
            setPayDraft('');
            setPayError(null);
            const current = useAuthStore.getState();
            if (current.session !== session || current.account === null) {
              return;
            }
            setAccount({ ...current.account, hasPosted: true });
            if (expandedIdRef.current === messageId && current.session !== null) {
              const gen = ++expandGen.current;
              setRepliesLoading(true);
              setRepliesError(false);
              try {
                const repliesNext = await fetchReplies(current.session, messageId);
                if (expandGen.current === gen) {
                  setReplies(repliesNext);
                }
              } catch {
                if (expandGen.current === gen) {
                  setRepliesError(true);
                }
              } finally {
                if (expandGen.current === gen) {
                  setRepliesLoading(false);
                }
              }
            }
            return;
          }
        } catch {
          // Keep waiting while the sheet is open.
        }
        /* v8 ignore next 3 -- aborted after a poll error */
        if (generation !== payPollGeneration.current || signal.aborted) {
          return;
        }
        await new Promise((resolve) => {
          setTimeout(resolve, PAY_POLL_MS);
        });
        /* v8 ignore next 3 -- aborted during the poll delay */
        if (generation !== payPollGeneration.current) {
          return;
        }
      }
    })();
  };

  const openOverlayForMissing = (missing: readonly MissingRequirement[]): boolean => {
    const next = nextPostRequirement(missing);
    if (next === null) {
      return false;
    }
    setOverlayRequirement(next);
    return true;
  };

  const runReplyPost = async (
    token: string,
    trimmed: string,
    parentId: string,
    isRetry: boolean,
  ): Promise<void> => {
    setReplyPosting(true);
    setReplyFormError(null);
    try {
      const created = await postMessage(token, { text: trimmed, inReplyTo: parentId });
      let alreadyListed = false;
      if (expandedIdRef.current === parentId) {
        setReplies((prev) => {
          /* v8 ignore next 3 -- composer only posts after the thread loaded */
          if (prev === null) {
            return [created];
          }
          alreadyListed = prev.some((message) => message.id === created.id);
          /* v8 ignore next 3 -- duplicate id already in the list */
          if (alreadyListed) {
            return prev;
          }
          return [...prev, created];
        });
        setReplyDraft('');
      }
      if (!alreadyListed) {
        setListedNote((prev) => {
          /* v8 ignore next 3 -- reply composer only mounts with a profile note */
          if (prev === null) {
            return prev;
          }
          if (prev.id !== parentId) {
            return prev;
          }
          return { ...prev, replyCount: Math.max(prev.replyCount, prev.replyCount + 1) };
        });
        setPosts((prev) => {
          if (prev === null) {
            return prev;
          }
          return prev.map((message) =>
            message.id === parentId
              ? { ...message, replyCount: Math.max(message.replyCount, message.replyCount + 1) }
              : message,
          );
        });
      }
      setReplyAmountDraft('');
      pendingPostRef.current = null;
      const current = useAuthStore.getState();
      if (current.session !== token || current.account === null) {
        return;
      }
      setAccount({ ...current.account, hasPosted: true });
    } catch (err) {
      if (err instanceof MissingRequirementsError) {
        if (!isRetry && openOverlayForMissing(err.missing)) {
          pendingPostRef.current = () => runReplyPost(token, trimmed, parentId, true);
          return;
        }
        if (expandedIdRef.current === parentId) {
          setReplyFormError('request');
        }
        return;
      }
      if (expandedIdRef.current === parentId) {
        setReplyFormError(
          isReplyPaymentError(err) ? 'amount' : isRateLimitError(err) ? 'rateLimit' : 'request',
        );
      }
    } finally {
      setReplyPosting(false);
    }
  };

  const runPaidReply = async (
    token: string,
    trimmed: string,
    parentId: string,
    sats: number,
    isRetry: boolean,
    baselineSats: number,
  ): Promise<void> => {
    setReplyPosting(true);
    setReplyFormError(null);
    const generation = payPollGeneration.current;
    try {
      const invoice =
        trimmed === ''
          ? await postMessageInvoice(token, parentId, sats)
          : await postMessageInvoice(token, parentId, sats, trimmed);
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
          pendingPostRef.current = () =>
            runPaidReply(token, trimmed, parentId, sats, true, baselineSats);
          return;
        }
        setReplyFormError('request');
        return;
      }
      setReplyFormError(
        err instanceof Error && /1[-–]500 characters/i.test(err.message)
          ? 'tooLong'
          : isRateLimitError(err)
            ? 'rateLimit'
            : 'request',
      );
    } finally {
      setReplyPosting(false);
    }
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
    /* v8 ignore next 3 -- overlay cannot satisfy without a queued reply */
    if (pending === null) {
      return;
    }
    void pending();
  };
  const [roleHintOpen, setRoleHintOpen] = useState(false);
  const tagged =
    profile.role === 'founder' || profile.role === 'moderator' || profile.role === 'verified'
      ? profile.role
      : null;
  const roleKeys = tagged !== null ? ROLE_TAG_KEYS[tagged] : null;

  const handlePayOpen = (messageId: string): void => {
    bumpPayPollGeneration();
    setPayMessageId(messageId);
    setPayDraft('');
    setPayError(null);
    setPayInvoice(null);
    setPayWaiting(false);
    setPayBusy(false);
  };

  const handlePaySubmit = (): void => {
    if (session === null || payMessageId === null || payBusy) {
      return;
    }
    const sats = Number.parseInt(payDraft.trim(), 10);
    if (!Number.isSafeInteger(sats) || sats <= 0) {
      setPayError('amount');
      return;
    }
    const token = session;
    const messageId = payMessageId;
    const parent =
      listedNote?.id === messageId
        ? listedNote
        : posts?.find((message) => message.id === messageId);
    /* v8 ignore next 3 -- pay sheet only opens on a listed note */
    const baselineSats = parent === undefined ? 0 : parent.sats;
    const continuePay = (isRetry: boolean): Promise<void> => {
      const generation = payPollGeneration.current;
      setPayBusy(true);
      setPayError(null);
      return (async () => {
        try {
          const invoice = await postMessageInvoice(token, messageId, sats);
          if (generation !== payPollGeneration.current) {
            return;
          }
          setPayInvoice({
            messageId,
            pr: invoice.pr,
            amountSats: invoice.amountSats,
          });
          setPayBusy(false);
          startPayPoll(messageId, baselineSats);
        } catch (err) {
          if (generation !== payPollGeneration.current) {
            return;
          }
          if (err instanceof MissingRequirementsError) {
            if (!isRetry && openOverlayForMissing(err.missing)) {
              pendingPostRef.current = () => continuePay(true);
              return;
            }
            /* v8 ignore next 3 -- isRetry after overlay; sheet may already be closed */
            setPayError('request');
            return;
          }
          setPayError('request');
        } finally {
          if (generation === payPollGeneration.current) {
            setPayBusy(false);
          }
        }
      })();
    };
    if (account !== null && openOverlayForMissing(account.missing)) {
      pendingPostRef.current = () => continuePay(true);
      return;
    }
    void continuePay(false);
  };

  const handlePayCancel = (): void => {
    bumpPayPollGeneration();
    setPayMessageId(null);
    setPayDraft('');
    setPayError(null);
    setPayInvoice(null);
    setPayBusy(false);
    setPayWaiting(false);
    setReplyPosting(false);
  };

  const handleToggleExpand = (messageId: string): void => {
    if (replyPosting) {
      return;
    }
    if (expandedId === messageId) {
      ++expandGen.current;
      setExpandedId(null);
      setReplies(null);
      setRepliesError(false);
      setRepliesLoading(false);
      setReplyDraft('');
      setReplyAmountDraft('');
      setReplyFormError(null);
      return;
    }
    const gen = ++expandGen.current;
    setExpandedId(messageId);
    setReplies(null);
    setRepliesLoading(true);
    setRepliesError(false);
    setReplyDraft('');
    setReplyAmountDraft('');
    setReplyFormError(null);
    if (session === null) {
      setRepliesLoading(false);
      setRepliesError(true);
      return;
    }
    void (async () => {
      try {
        const next = await fetchReplies(session, messageId);
        if (expandGen.current === gen) {
          setReplies(next);
        }
      } catch {
        if (expandGen.current === gen) {
          setRepliesError(true);
        }
      } finally {
        if (expandGen.current === gen) {
          setRepliesLoading(false);
        }
      }
    })();
  };

  const handleReplyPost = (): void => {
    if (session === null || expandedId === null || replyPosting) {
      return;
    }
    const trimmed = replyDraft.trim();
    if (trimmed.length > FORUM_MESSAGE_MAX_LENGTH) {
      setReplyFormError('tooLong');
      return;
    }
    const parsed = parseReplySats(replyAmountDraft);
    if (trimmed === '' && parsed === 'empty') {
      setReplyFormError('empty');
      return;
    }
    const token = session;
    const parentId = expandedId;
    const parentRow =
      listedNote?.id === parentId ? listedNote : posts?.find((message) => message.id === parentId);
    const exempt = isReplyPaymentExempt(account, parentRow?.accountId);
    const continueReply = (isRetry: boolean): Promise<void> => {
      if (parsed === 'invalid' || (!exempt && parsed === 'empty')) {
        setReplyFormError('amount');
        return Promise.resolve();
      }
      if (parsed === 'empty') {
        return runReplyPost(token, trimmed, parentId, isRetry);
      }
      /* v8 ignore next 3 -- expanded parent is always in the loaded list */
      const baselineSats = parentRow === undefined ? 0 : parentRow.sats;
      return runPaidReply(token, trimmed, parentId, parsed, isRetry, baselineSats);
    };
    const missing = account?.missing ?? [];
    if (openOverlayForMissing(missing)) {
      pendingPostRef.current = () => continueReply(true);
      return;
    }
    void continueReply(false);
  };

  const handleRetryReplies = (): void => {
    if (expandedId === null || session === null) {
      return;
    }
    const gen = ++expandGen.current;
    setRepliesLoading(true);
    setRepliesError(false);
    const messageId = expandedId;
    void (async () => {
      try {
        const next = await fetchReplies(session, messageId);
        if (expandGen.current === gen) {
          setReplies(next);
        }
      } catch {
        if (expandGen.current === gen) {
          setRepliesError(true);
        }
      } finally {
        if (expandGen.current === gen) {
          setRepliesLoading(false);
        }
      }
    })();
  };

  const handlePm = (messageId: string): void => {
    if (session === null || pmBusyId !== null) {
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
  };

  const sharedForumProps = {
    payMessageId,
    payDraft,
    payBusy,
    payError,
    payInvoice,
    payWaiting,
    onPayOpen: handlePayOpen,
    onPayDraftChange: (value: string): void => {
      setPayDraft(value);
      setPayError(null);
    },
    onPaySubmit: handlePaySubmit,
    onPayCancel: handlePayCancel,
    expandedId,
    onToggleExpand: handleToggleExpand,
    replies: expandedId === null ? null : replies,
    repliesLoading: expandedId !== null && repliesLoading,
    repliesError: expandedId !== null && repliesError,
    replyDraft,
    onReplyDraftChange: (value: string): void => {
      setReplyDraft(value);
      setReplyFormError(null);
    },
    replyAmountDraft,
    onReplyAmountDraftChange: (value: string): void => {
      setReplyAmountDraft(value);
      setReplyFormError(null);
    },
    replyPosting,
    replyFormError,
    onReplyPost: handleReplyPost,
    onRetryReplies: handleRetryReplies,
    ownName: account?.name ?? null,
    ownAccountId: account?.id ?? null,
    pmBusyId,
    onPm: handlePm,
  };

  const activityMessages = activity === 'posts' ? (posts ?? []) : (activityReplies ?? []);
  const activityCount = activity === 'posts' ? profile.postCount : profile.replyCount;
  const activityLoading = activity === 'posts' ? postsLoading : activityRepliesLoading;
  const activityError = activity === 'posts' ? postsError : activityRepliesError;

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
      <div className="flex w-full max-w-sm flex-col items-center gap-6">
        <section className="flex w-full flex-col items-center gap-6 rounded-3xl border border-app-border bg-app-card p-8 shadow-sm">
          <h1 className="text-center text-2xl font-semibold tracking-tight sm:text-3xl">
            {t('profile.title')}
          </h1>
          <AccountActivityChart received={received} />
          <div className="flex w-full flex-col items-stretch gap-3 border-t border-app-border pt-6">
            <p className="text-center text-xs tracking-widest text-app-subtle uppercase">
              {t('name.heading')}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <p className="min-w-0 truncate text-sm text-app-fg">
                {profile.name ?? t('view.unnamed')}
              </p>
              {roleKeys !== null ? (
                <button
                  type="button"
                  aria-expanded={roleHintOpen}
                  onClick={() => {
                    setRoleHintOpen((open) => !open);
                  }}
                  className="rounded-full border border-app-border-strong px-2 py-0.5 text-xs font-medium text-app-muted"
                >
                  {t(roleKeys.label)}
                </button>
              ) : null}
            </div>
            {roleHintOpen && roleKeys !== null ? (
              <p role="status" className="text-center text-xs text-app-muted">
                {t(roleKeys.hint)}
              </p>
            ) : null}
          </div>
          <div className="flex w-full flex-col items-stretch gap-3 border-t border-app-border pt-6">
            <p className="text-center text-xs tracking-widest text-app-subtle uppercase">
              {t('location.heading')}
            </p>
            <p className="min-w-0 truncate text-sm text-app-fg">
              {profile.location !== null && profile.location.trim() !== ''
                ? profile.location
                : t('location.unset')}
            </p>
          </div>
          <div className="flex w-full flex-col items-stretch gap-3 border-t border-app-border pt-6">
            <p className="text-center text-xs tracking-widest text-app-subtle uppercase">
              {t('la.heading')}
            </p>
            {address !== null && address.trim() !== '' ? (
              <p className="min-w-0 truncate font-mono text-sm text-app-fg">{address}</p>
            ) : (
              <p className="min-w-0 truncate text-sm text-app-fg">{t('view.noAddress')}</p>
            )}
          </div>
          <div className="flex w-full flex-wrap justify-center gap-2 border-t border-app-border pt-6">
            <Button
              type="button"
              size="sm"
              variant={activity === 'posts' ? 'primary' : 'secondary'}
              aria-pressed={activity === 'posts'}
              onClick={() => openActivity('posts')}
            >
              {t('profile.postCount', { count: String(profile.postCount) })}
            </Button>
            <Button
              type="button"
              size="sm"
              variant={activity === 'replies' ? 'primary' : 'secondary'}
              aria-pressed={activity === 'replies'}
              onClick={() => openActivity('replies')}
            >
              {t('profile.replyCount', { count: String(profile.replyCount) })}
            </Button>
          </div>
        </section>
        {listedNote !== null && activity !== 'posts' ? (
          <ForumBoard {...IDLE_BOARD} messages={[listedNote]} {...sharedForumProps} />
        ) : null}
        {activity === 'posts' || activity === 'replies' ? (
          activityLoading ? (
            <p className="text-center text-sm text-app-muted">{t('forum.loading')}</p>
          ) : activityError ? (
            <div className="flex flex-col items-center gap-4">
              <p role="alert" className="text-center text-sm text-app-danger">
                {t('forum.error')}
              </p>
              <Button type="button" onClick={() => void loadActivityFeed(activity)}>
                {t('view.retry')}
              </Button>
            </div>
          ) : (
            <>
              {activity === 'posts' ? (
                <ForumBoard {...IDLE_BOARD} messages={activityMessages} {...sharedForumProps} />
              ) : (
                <ForumBoard
                  {...IDLE_BOARD}
                  messages={activityMessages}
                  {...sharedForumProps}
                  onToggleExpand={(messageId) => {
                    const parentId = activityReplies?.find(
                      (message) => message.id === messageId,
                    )?.parentId;
                    if (typeof parentId === 'string' && parentId.trim() !== '') {
                      router.push(`/messages/${parentId}`);
                    }
                  }}
                />
              )}
              {activityMessages.length < activityCount ? (
                <p role="status" className="text-center text-sm text-app-muted">
                  {t('profile.activityLatest', {
                    shown: String(activityMessages.length),
                    total: String(activityCount),
                  })}
                </p>
              ) : null}
            </>
          )
        ) : null}
      </div>
    </>
  );
}
