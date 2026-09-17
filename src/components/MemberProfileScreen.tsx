'use client';

import { Loader2, Mail } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type ReactElement } from 'react';
import { AboutMeSection } from '@/components/AboutMeSection';
import { AccountActivityChart } from '@/components/AccountActivityChart';
import { MemberTrustActions } from '@/components/MemberTrustActions';
import {
  ForumBoard,
  type ForumFormError,
  type ForumReplyFormError,
  type ForumPayError,
  type ForumPayInvoice,
} from '@/components/ForumBoard';
import { useTranslations } from '@/components/LocaleProvider';
import { RequirementsOverlay } from '@/components/RequirementsOverlay';
import { Button, Card } from '@/components/ui';
import {
  fetchGiftStats,
  fetchMemberPosts,
  fetchMemberReplies,
  fetchMessagePhoto,
  fetchPublicMessage,
  fetchPublicMessagePhoto,
  fetchReplies,
  openConversation,
  postMessage,
  postMessageInvoice,
} from '@/lib/api';
import {
  FORUM_MESSAGE_MAX_LENGTH,
  type ForumMessage,
  type AccountActivity,
  type MemberProfile,
} from '@/lib/api-types';
import type { MessageKey } from '@/lib/messages';
import {
  MissingRequirementsError,
  nextPostRequirement,
  type MissingRequirement,
} from '@/lib/missing-requirements';
import { latestRateDay, type FiatRateDay } from '@/lib/stats-money';
import { useAuthStore } from '@/stores/auth-store';

/** Delay between pay polls (ms). */
const PAY_POLL_MS = 2000;

/**
 * True when the signed-in account may reply without paying.
 *
 * @param account - Live account, or `null` when the snapshot is missing.
 * @param parentAccountId - Parent note `accountId`, or the profile id when omitted.
 * @returns Whether `POST /messages` is allowed without a zap.
 */
function isReplyPaymentExempt(
  account: { id: string; role: 'basis' | 'verified' | 'moderator' | 'founder' } | null,
  parentAccountId: string | undefined,
): boolean {
  if (account === null) {
    return false;
  }
  if (account.role === 'founder' || account.role === 'moderator' || account.role === 'verified') {
    return true;
  }
  return parentAccountId !== undefined && parentAccountId === account.id;
}

/** Default invoice amount when the pay or gift-only reply amount field is empty or whitespace-only. */
const DEFAULT_FORUM_PAY_SATS = 21;

/**
 * Parses the reply-composer sats draft.
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

/* v8 ignore start -- ForumBoard defaults for on-demand member feeds */
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
  replyFormError: null as ForumReplyFormError,
  composerHidden: true,
};
/* v8 ignore stop */

/**
 * Signed-in member identity card: chart, About me, name, location, Lightning
 * Address, role pill, copy-profile-link, optional Message, post/reply counts,
 * stacked activity feeds, and staff Trust Chain actions when the viewer is
 * founder/moderator and the subject is someone else. About me is not a forum post.
 *
 * @param props - Member profile and both activity series for the chart.
 * @returns The presentational member profile.
 */
export function MemberProfileScreen({
  profile,
  received,
  donated = [],
}: {
  profile: MemberProfile;
  received: AccountActivity['receivedOverTime'];
  donated?: AccountActivity['donatedOverTime'];
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
  const [replyDraft, setReplyDraft] = useState('');
  const [replyAmountDraft, setReplyAmountDraft] = useState('');
  const [replyPosting, setReplyPosting] = useState(false);
  const [replyFormError, setReplyFormError] = useState<ForumReplyFormError>(null);
  const [overlayRequirement, setOverlayRequirement] = useState<
    'name' | 'rules' | 'lightning-address' | null
  >(null);
  const pendingPostRef = useRef<(() => Promise<void>) | null>(null);
  const [listedProfile, setListedProfile] = useState(profile);
  const [activity, setActivity] = useState<null | 'posts' | 'replies'>(null);
  const [posts, setPosts] = useState<ForumMessage[] | null>(null);
  const [postsLoading, setPostsLoading] = useState(false);
  const [postsError, setPostsError] = useState(false);
  const [activityReplies, setActivityReplies] = useState<ForumMessage[] | null>(null);
  const [activityRepliesLoading, setActivityRepliesLoading] = useState(false);
  const [activityRepliesError, setActivityRepliesError] = useState(false);
  const postsLoadGen = useRef(0);
  const repliesLoadGen = useRef(0);
  const address = listedProfile.lightningAddress;

  const [rateDay, setRateDay] = useState<FiatRateDay | null>(null);
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});
  const photoUrlsRef = useRef(photoUrls);
  photoUrlsRef.current = photoUrls;

  const photoSource: ForumMessage[] = [];
  if (activity === 'posts' && posts !== null) {
    photoSource.push(...posts);
  }
  if (activity === 'replies' && activityReplies !== null) {
    photoSource.push(...activityReplies);
  }
  if (replies !== null) {
    photoSource.push(...replies);
  }
  const photoSourceRef = useRef(photoSource);
  photoSourceRef.current = photoSource;
  const photoIdsKey = photoSource
    .filter((message) => message.hasPhoto)
    .map((message) => message.id)
    .sort()
    .join('\0');

  useEffect(() => {
    let cancelled = false;
    void fetchGiftStats()
      .then((stats) => {
        if (!cancelled) {
          setRateDay(latestRateDay(stats.spendOverTime));
        }
      })
      .catch(() => {
        if (!cancelled) {
          setRateDay(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (session === null || photoIdsKey === '') {
      return;
    }
    const listed = photoSourceRef.current;
    let cancelled = false;
    const missing = listed.filter(
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
      for (const url of Object.values(photoUrlsRef.current)) {
        URL.revokeObjectURL(url);
      }
    };
  }, []);

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
          if (generation !== payPollGeneration.current || signal.aborted) {
            return;
          }
          if (next !== null && next.sats > baselineSats) {
            setPosts((prev) => {
              /* v8 ignore next 3 -- pay poll starts from a listed posts-feed card */
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
            setActivityReplies((prev) => {
              if (prev === null) {
                return prev;
              }
              return prev.map((row) => (row.id === next.id ? { ...row, ...next } : row));
            });
            setReplies((prev) => {
              if (prev === null) {
                return prev;
              }
              return prev.map((row) => (row.id === next.id ? { ...row, ...next } : row));
            });
            setPayWaiting(false);
            setPayInvoice(null);
            setPayMessageId(null);
            setPayDraft('');
            setPayError(null);
            const current = useAuthStore.getState();
            if (current.session !== session) {
              return;
            }
            if (current.account !== null) {
              setAccount({ ...current.account, hasPosted: true });
            }
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
        if (generation !== payPollGeneration.current || signal.aborted) {
          return;
        }
        await new Promise((resolve) => {
          setTimeout(resolve, PAY_POLL_MS);
        });
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
        setPosts((prev) => {
          /* v8 ignore next 3 -- posts list is null until the posts feed opens */
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
      if (isReplyPaymentError(err)) {
        const parentRowNow = posts?.find((message) => message.id === parentId);
        /* v8 ignore next -- expanded parent is a loaded post */
        const parentSatsNow = parentRowNow === undefined ? 0 : parentRowNow.sats;
        await runPaidReply(token, trimmed, parentId, 1, isRetry, parentSatsNow);
        return;
      }
      if (expandedIdRef.current === parentId) {
        setReplyFormError(isRateLimitError(err) ? 'rateLimit' : 'request');
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
  /* v8 ignore next -- SSR: no window */
  const [origin, setOrigin] = useState(typeof window === 'undefined' ? '' : window.location.origin);
  const [pmBusy, setPmBusy] = useState(false);
  const [roleHintOpen, setRoleHintOpen] = useState(false);
  const tagged =
    listedProfile.role === 'founder' ||
    listedProfile.role === 'moderator' ||
    listedProfile.role === 'verified'
      ? listedProfile.role
      : null;
  const roleKeys = tagged !== null ? ROLE_TAG_KEYS[tagged] : null;
  const showMessage =
    session !== null && account?.id !== profile.id && profile.profileMessage !== null;
  /* v8 ignore next -- SSR first paint: origin empty until client */
  const profileUrl = origin !== '' ? `${origin}/members/${profile.id}` : '';

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const onMessage = (): void => {
    /* v8 ignore next 4 -- button disabled while pmBusy; session and profileMessage already gated by showMessage */
    if (session === null || profile.profileMessage === null || pmBusy) {
      return;
    }
    const token = session;
    const messageId = profile.profileMessage.id;
    setPmBusy(true);
    void (async () => {
      try {
        const thread = await openConversation(token, messageId);
        if (useAuthStore.getState().session !== token) {
          setPmBusy(false);
          return;
        }
        router.push(`/messages?c=${encodeURIComponent(thread.id)}`);
      } catch {
        setPmBusy(false);
      }
    })();
  };

  const handlePayOpen = (messageId: string): void => {
    bumpPayPollGeneration();
    setPayMessageId(messageId);
    setPayDraft('');
    setPayError(null);
    setPayInvoice(null);
    setPayWaiting(false);
    setPayBusy(false);
  };

  const handlePaySubmit = (): void | Promise<ForumPayInvoice | null> => {
    /* v8 ignore next 3 -- Continue is disabled while payBusy; feed pay is session-gated */
    if (session === null || payMessageId === null || payBusy) {
      return;
    }
    const rawAmount = payDraft.trim();
    let sats: number;
    if (rawAmount === '') {
      sats = DEFAULT_FORUM_PAY_SATS;
    } else if (!/^\d+$/.test(rawAmount)) {
      setPayError('amount');
      return;
    } else {
      sats = Number.parseInt(rawAmount, 10);
      if (sats <= 0 || !Number.isSafeInteger(sats)) {
        setPayError('amount');
        return;
      }
    }
    const token = session;
    const messageId = payMessageId;
    const listed =
      posts?.find((message) => message.id === messageId) ??
      activityReplies?.find((message) => message.id === messageId) ??
      replies?.find((message) => message.id === messageId);
    /* v8 ignore next 3 -- sheet only opens on a payable row */
    if (listed === undefined || listed.payable !== true) {
      return;
    }
    const baselineSats = listed.sats;
    const continuePay = (isRetry: boolean): Promise<ForumPayInvoice | null> => {
      const generation = payPollGeneration.current;
      setPayBusy(true);
      setPayError(null);
      return (async () => {
        let minted: ForumPayInvoice | null = null;
        try {
          const invoice = await postMessageInvoice(token, messageId, sats);
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
          startPayPoll(messageId, baselineSats);
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
          setPayError('request');
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
    const token = session;
    const parentId = expandedId;
    const parentRow = posts?.find((message) => message.id === parentId);
    const exempt = isReplyPaymentExempt(account, parentRow?.accountId ?? profile.id);
    const continueReply = (isRetry: boolean): Promise<void> => {
      if (parsed === 'invalid') {
        setReplyFormError('amount');
        return Promise.resolve();
      }
      /* v8 ignore next -- expanded parent is always in the loaded list */
      const baselineSats = parentRow === undefined ? 0 : parentRow.sats;
      if (trimmed === '' && parsed === 'empty') {
        return runPaidReply(
          token,
          trimmed,
          parentId,
          DEFAULT_FORUM_PAY_SATS,
          isRetry,
          baselineSats,
        );
      }
      if (parsed === 'empty' && exempt) {
        return runReplyPost(token, trimmed, parentId, isRetry);
      }
      const sats = parsed === 'empty' ? 1 : parsed;
      return runPaidReply(token, trimmed, parentId, sats, isRetry, baselineSats);
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

  const sharedForumProps = {
    photoUrls,
    rateDay,
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
  };

  const activityMessages = activity === 'posts' ? (posts ?? []) : (activityReplies ?? []);
  const activityCount = activity === 'posts' ? profile.postCount : profile.replyCount;
  const activityLoading = activity === 'posts' ? postsLoading : activityRepliesLoading;
  const activityError = activity === 'posts' ? postsError : activityRepliesError;
  const profileMessagePhotoId =
    profile.profileMessage !== null && profile.profileMessage.hasPhoto
      ? profile.profileMessage.id
      : undefined;

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
        <Card>
          <h1 className="text-center text-2xl font-semibold tracking-tight sm:text-3xl">
            {t('profile.title')}
          </h1>
          <AccountActivityChart received={received} donated={donated} />
          <AboutMeSection
            mode="public"
            aboutMe={profile.aboutMe}
            name={profile.name}
            hasPhoto={profile.aboutMeHasPhoto === true || profile.profileMessage?.hasPhoto === true}
            {...(profileMessagePhotoId !== undefined
              ? {
                  loadPhoto: () =>
                    session !== null
                      ? fetchMessagePhoto(session, profileMessagePhotoId)
                      : fetchPublicMessagePhoto(profileMessagePhotoId),
                }
              : {})}
            /* v8 ignore next -- SSR first paint: origin empty so no copy URL */
            {...(profileUrl !== '' ? { profileUrl } : {})}
          />
          {showMessage ? (
            <Button
              type="button"
              variant="secondary"
              size="md"
              disabled={pmBusy}
              icon={
                pmBusy ? (
                  <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
                ) : (
                  <Mail aria-hidden="true" className="h-4 w-4" />
                )
              }
              onClick={onMessage}
            >
              {t('profile.message')}
            </Button>
          ) : null}
          <div className="flex w-full flex-col items-stretch gap-3 border-t border-app-border pt-6">
            <p className="text-center text-xs tracking-widest text-app-subtle uppercase">
              {t('name.heading')}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <p className="min-w-0 truncate text-sm text-app-fg">
                {listedProfile.name ?? t('view.unnamed')}
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
          {account !== null &&
          (account.role === 'founder' || account.role === 'moderator') &&
          listedProfile.id !== account.id ? (
            <MemberTrustActions profile={listedProfile} onUpdated={setListedProfile} />
          ) : null}
        </Card>
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
