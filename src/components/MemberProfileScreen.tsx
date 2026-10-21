'use client';

import { Loader2, Mail } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import { AboutMeSection } from '@/components/AboutMeSection';
import { AccountActivityChart } from '@/components/AccountActivityChart';
import { CannotReceiveLabel } from '@/components/CannotReceiveLabel';
import { LoanBalanceChart } from '@/components/LoanBalanceChart';
import { LocationForm } from '@/components/LocationForm';
import { MemberIdentityPills } from '@/components/MemberIdentityPills';
import { MemberTrustActions } from '@/components/MemberTrustActions';
import { NameForm } from '@/components/NameForm';
import { ProfileImages } from '@/components/ProfileImages';
import {
  ForumBoard,
  type ForumFormError,
  type ForumReplyFormError,
  type ForumPayError,
  type ForumPayInvoice,
} from '@/components/ForumBoard';
import { useTranslations } from '@/components/LocaleProvider';
import { QrCode } from '@/components/QrCode';
import { RequirementsOverlay } from '@/components/RequirementsOverlay';
import { ShopStickerOverlay } from '@/components/ShopStickerOverlay';
import { Button, Card } from '@/components/ui';
import {
  CannotReceiveError,
  fetchAboutMePhoto,
  fetchComposeTarget,
  fetchMemberPosts,
  fetchMemberReplies,
  fetchMemberShops,
  fetchMemberCredits,
  fetchMessagePhoto,
  fetchProfilePhoto,
  fetchPublicMessage,
  fetchPublicMessagePhoto,
  fetchReplies,
  fetchWideBanner,
  putAboutMe,
  putProfilePhoto,
  putWideBanner,
  markNotificationsReadForMessage,
  NoteDeletedError,
  openConversation,
  postMessage,
  postMessageInvoice,
  WalletRequiredError,
} from '@/lib/api';
import {
  FORUM_MESSAGE_MAX_LENGTH,
  type AmountUnit,
  type ForumMessage,
  type AccountActivity,
  type MemberProfile,
} from '@/lib/api-types';
import { MissingRequirementsError, nextPostRequirement } from '@/lib/missing-requirements';
import { giftsLightningAddress, openCryptoPayQrValue } from '@/lib/gifts-address';
import { useHeartTip } from '@/lib/heart-tip';
import { profileQrLogo } from '@/lib/profile-qr-logo';
import { shopStickerLangFromLocation } from '@/lib/shop-sticker';
import { shortResourceUrl } from '@/lib/short-link';
import { authorCannotReceive, isOwnNote, isReplyPaymentExempt, roleAtLeast } from '@/lib/roles';
import { useFiatPreference } from '@/components/FiatPreferenceProvider';
import { useSpotRate } from '@/hooks/useSpotRate';
import { paySatsFromDraft, replySatsFromDraft, shownFiatForSats } from '@/lib/stats-money';
import { returnToView } from '@/lib/view-history';
import { useAuthStore } from '@/stores/auth-store';

/** Delay between pay polls (ms). */
const PAY_POLL_MS = 2000;

/** Default invoice amount when the pay or gift-only reply amount field is empty or whitespace-only. */
const DEFAULT_FORUM_PAY_SATS = 21;

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

/**
 * True when a thrown value is the api answer that the receiving wallet
 * cannot take this payment: a {@link CannotReceiveError}, recognised by the
 * api's `code` only.
 *
 * @param err - Caught rejection.
 * @returns Whether the receiver's wallet refused the payment.
 */
function isAuthorWalletError(err: unknown): boolean {
  return err instanceof CannotReceiveError;
}

/**
 * Loads the public round photo and wide image for a visitor card.
 *
 * A missing slot stays null, so the card draws nothing for it. Not the
 * About me note photo. Disabled on the owner facts card, which loads
 * `/pictures/me` and `/banners/me` itself.
 *
 * @param accountId - Member id. The same-origin routes are `/pictures/:id` and `/banners/:id`.
 * @param enabled - When false, no request is made.
 * @returns Object URLs, or null while missing.
 */
function useVisitorProfileImages(
  accountId: string,
  enabled: boolean,
): { pictureUrl: string | null; bannerUrl: string | null } {
  const [pictureUrl, setPictureUrl] = useState<string | null>(null);
  const [bannerUrl, setBannerUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) {
      return;
    }
    let cancelled = false;
    const created: string[] = [];
    const load = async (slot: 'pictures' | 'banners'): Promise<string | null> => {
      try {
        const response = await fetch(`/${slot}/${accountId}`);
        if (!response.ok) {
          return null;
        }
        const blob = await response.blob();
        if (!blob.type.startsWith('image/') || blob.size === 0) {
          return null;
        }
        const url = URL.createObjectURL(blob);
        created.push(url);
        return url;
      } catch {
        return null;
      }
    };
    void (async () => {
      const [picture, banner] = await Promise.all([load('pictures'), load('banners')]);
      if (cancelled) {
        for (const url of created) {
          URL.revokeObjectURL(url);
        }
        return;
      }
      if (picture !== null) {
        setPictureUrl(picture);
      }
      if (banner !== null) {
        setBannerUrl(banner);
      }
    })();
    return () => {
      cancelled = true;
      for (const url of created) {
        URL.revokeObjectURL(url);
      }
    };
  }, [accountId, enabled]);

  return { pictureUrl, bannerUrl };
}

/**
 * Resting public header: the wide image and the round photo visitors see.
 * Neither is the About me note photo. A missing slot is absent, not an add button.
 *
 * @param props - Object URLs. Both null renders nothing.
 * @returns The header, or null.
 */
function PublicProfileHeader({
  pictureUrl,
  bannerUrl,
}: {
  pictureUrl: string | null;
  bannerUrl: string | null;
}): ReactElement | null {
  const { t } = useTranslations();
  if (bannerUrl !== null) {
    const overlapped = pictureUrl !== null;
    return (
      <div className="flex w-full flex-col items-center gap-4">
        <div className={`relative w-full${overlapped ? ' mb-8' : ''}`}>
          {/* eslint-disable-next-line @next/next/no-img-element -- object URL from the public wide image */}
          <img
            src={bannerUrl}
            alt={t('profile.about.bannerAlt')}
            className="aspect-[5/2] w-full rounded-2xl object-cover"
          />
          {pictureUrl !== null ? (
            // eslint-disable-next-line @next/next/no-img-element -- object URL from the public profile photo
            <img
              src={pictureUrl}
              alt={t('profile.about.portraitAlt')}
              className="absolute bottom-0 left-1/2 h-16 w-16 -translate-x-1/2 translate-y-1/2 rounded-full object-cover ring-4 ring-app-card"
            />
          ) : null}
        </div>
      </div>
    );
  }
  if (pictureUrl !== null) {
    return (
      <div className="flex w-full flex-col items-center gap-4">
        {/* eslint-disable-next-line @next/next/no-img-element -- object URL from the public profile photo */}
        <img
          src={pictureUrl}
          alt={t('profile.about.portraitAlt')}
          className="mx-auto h-16 w-16 rounded-full object-cover"
        />
      </div>
    );
  }
  return null;
}

/* v8 ignore start -- ForumBoard defaults for on-demand member feeds */
const IDLE_BOARD = {
  error: false,
  loading: false,
  posting: false,
  draft: '',
  onDraftChange: (): void => undefined,
  askDraft: '',
  onAskDraftChange: (): void => undefined,
  onPost: (): void => undefined,
  onRetry: (): void => undefined,
  formError: null as ForumFormError,
  payMessageId: null as string | null,
  payDraft: '',
  payBusy: false,
  payError: null as ForumPayError,
  payInvoice: null as ForumPayInvoice | null,
  onPayOpen: (): void => undefined,
  onPayDraftChange: (): void => undefined,
  onPaySubmit: (): void => undefined,
  onPayCancel: (): void => undefined,
  mode: 'all' as const,
  onModeChange: (): void => undefined,
  lawsVisible: false,
  onDismissLaws: (): void => undefined,
  photoDrafts: [],
  onPickFiles: (): void => undefined,
  onRemovePhoto: (): void => undefined,
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
 * Address, role pill, optional funding-program icon-only button (HandHeart;
 * accessible name is participation since the date; pressing it reveals that
 * sentence; the resting shot does not cover the press) when `fundingReviewedAt`
 * is a number, copy-profile-link, optional Message, post/reply counts, optional
 * positive shop and credit counts, stacked activity feeds, and staff Trust Chain actions
 * when the viewer is a moderator, the subject is someone else, and the card is
 * not the public share payload (`loadPublicList` unset). About me is
 * not a forum post. When the member cannot receive yet (`lightningAddress`
 * null), the gifts block shows a "Can't receive yet" label instead of the
 * address, QR, and shop sticker.
 *
 * @param props - Member profile and gift/loan activity series for the charts.
 *   `factsOnly` (default false) keeps every hook and returns only the public
 *   pills, gifts block, post/reaction/shop/credit counts, and activity feed.
 *   `omitPills` (default false) hides those pills. The routed pages do not
 *   use either flag. When the signed-in account id equals this profile, the
 *   full card shows the owner photo, About me, name, and location editors.
 *   The role, staff, and funding marks stay beside the name. Visitor images
 *   load only when `factsOnly` is false and the viewer is not the owner. A
 *   missing public photo or wide image draws nothing. `activityFailed`
 *   (default false) is passed to both charts as `failed`. `loadPublicList`
 *   loads the four feeds without a session (the share link). `loadAboutPhoto`
 *   loads the About me photo on that link when the card has no profile-note id.
 *   `shareViewKey`, when set, is the route key the copy button writes, including
 *   when the signed-in account is the owner. `/profile` passes the owner view
 *   key. `/view/:viewKey` passes the open key. Without it, the button writes
 *   the short `/l/` link, including for the owner on `/members/:id`.
 * @returns The presentational member profile.
 */
export function MemberProfileScreen({
  profile,
  received,
  donated = [],
  owed = [],
  credit = [],
  factsOnly = false,
  omitPills = false,
  activityFailed = false,
  loadPublicList,
  loadAboutPhoto,
  shareViewKey,
}: {
  profile: MemberProfile;
  received: AccountActivity['receivedOverTime'];
  donated?: AccountActivity['donatedOverTime'];
  owed?: NonNullable<AccountActivity['owedOverTime']>;
  credit?: NonNullable<AccountActivity['creditOverTime']>;
  factsOnly?: boolean;
  omitPills?: boolean;
  activityFailed?: boolean;
  loadPublicList?: (kind: 'posts' | 'replies' | 'shops' | 'credits') => Promise<ForumMessage[]>;
  loadAboutPhoto?: () => Promise<Blob>;
  shareViewKey?: string;
}): ReactElement {
  const { t } = useTranslations();
  const router = useRouter();
  const session = useAuthStore((state) => state.session);
  const account = useAuthStore((state) => state.account);
  const owner =
    session !== null && account !== null && account.id === profile.id ? { session, account } : null;
  const { fiat } = useFiatPreference();
  const visitorImages = useVisitorProfileImages(
    profile.id,
    !factsOnly && owner === null && profile.id !== '',
  );
  const [imageEpoch, setImageEpoch] = useState(0);
  const amountUnit = account?.amountUnit ?? 'btc';
  const [payShownUnit, setPayShownUnit] = useState<AmountUnit>(amountUnit);
  const [replyShownUnit, setReplyShownUnit] = useState<AmountUnit>(amountUnit);
  const setAccount = useAuthStore((state) => state.setAccount);
  const [payMessageId, setPayMessageId] = useState<string | null>(null);
  const [payDraft, setPayDraft] = useState('');
  const [payBusy, setPayBusy] = useState(false);
  const [payError, setPayError] = useState<ForumPayError>(null);
  const [payInvoice, setPayInvoice] = useState<ForumPayInvoice | null>(null);
  const [payHost, setPayHost] = useState<'composer' | 'card' | null>(null);
  const payPollAbortRef = useRef<AbortController | null>(null);
  const payPollGeneration = useRef(0);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const expandedIdRef = useRef(expandedId);
  expandedIdRef.current = expandedId;
  const expandGen = useRef(0);
  const [replies, setReplies] = useState<ForumMessage[] | null>(null);
  const repliesRef = useRef(replies);
  repliesRef.current = replies;
  const [repliesLoading, setRepliesLoading] = useState(false);
  const [repliesError, setRepliesError] = useState(false);
  const [replyDraft, setReplyDraft] = useState('');
  const [replyAmountDraft, setReplyAmountDraft] = useState('');
  // A paid reaction's text while its pay sheet is open: the form keeps it, disabled, behind the sheet.
  const [replyPayPreview, setReplyPayPreview] = useState<string | null>(null);
  const [replyPosting, setReplyPosting] = useState(false);
  const [replyFormError, setReplyFormError] = useState<ForumReplyFormError>(null);
  const [overlayRequirement, setOverlayRequirement] = useState<
    'name' | 'username' | 'rules' | 'wallet' | null
  >(null);
  const pendingPostRef = useRef<(() => Promise<void>) | null>(null);
  const pendingComposeTextRef = useRef<string | null>(null);
  const [listedProfile, setListedProfile] = useState(profile);
  useEffect(() => {
    setListedProfile(profile);
  }, [profile]);
  const [activity, setActivity] = useState<null | 'posts' | 'replies' | 'shops' | 'credits'>(null);
  const [posts, setPosts] = useState<ForumMessage[] | null>(null);
  const [postsLoading, setPostsLoading] = useState(false);
  const [postsError, setPostsError] = useState(false);
  const [activityReplies, setActivityReplies] = useState<ForumMessage[] | null>(null);
  const [activityRepliesLoading, setActivityRepliesLoading] = useState(false);
  const [activityRepliesError, setActivityRepliesError] = useState(false);
  const [shops, setShops] = useState<ForumMessage[] | null>(null);
  const [shopsLoading, setShopsLoading] = useState(false);
  const [shopsError, setShopsError] = useState(false);
  const [credits, setCredits] = useState<ForumMessage[] | null>(null);
  const [creditsLoading, setCreditsLoading] = useState(false);
  const [creditsError, setCreditsError] = useState(false);
  const heartCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    const shown =
      activity === 'posts'
        ? (posts ?? [])
        : activity === 'replies'
          ? (activityReplies ?? [])
          : activity === 'shops'
            ? (shops ?? [])
            : activity === 'credits'
              ? (credits ?? [])
              : [];
    for (const message of shown) {
      counts[message.id] = message.heartCount;
    }
    const boardReplies = expandedId === null ? null : replies;
    if (boardReplies !== null) {
      for (const message of boardReplies) {
        counts[message.id] = message.heartCount;
      }
    }
    return counts;
  }, [activity, posts, activityReplies, shops, credits, expandedId, replies]);
  const { onHeartTip, heartTipViews } = useHeartTip({
    readOnly: session === null,
    heartCounts,
  });
  const postsLoadGen = useRef(0);
  const repliesLoadGen = useRef(0);
  const shopsLoadGen = useRef(0);
  const creditsLoadGen = useRef(0);
  /* v8 ignore next -- SSR: no window */
  const host = typeof window === 'undefined' ? '21.gifts' : window.location.hostname;
  // The api sends `lightningAddress: null` when this member cannot receive yet.
  const cannotReceive = listedProfile.lightningAddress === null;
  const address = cannotReceive ? null : giftsLightningAddress(listedProfile.username, host);
  const qr = cannotReceive ? null : openCryptoPayQrValue(listedProfile.username, host);
  const [showQr, setShowQr] = useState(false);
  const [stickerOpen, setStickerOpen] = useState(false);
  const kikambaStickerOpened = useRef(false);

  useEffect(() => {
    setShowQr(true);
  }, []);

  useEffect(() => {
    if (kikambaStickerOpened.current) return;
    if (shopStickerLangFromLocation() !== 'kikamba') return;
    if (qr === null || address === null) return;
    kikambaStickerOpened.current = true;
    setStickerOpen(true);
  }, [qr, address]);

  const rateDay = useSpotRate();
  /** The rate the last reply amount was read with, so a retry stores fiat from that same rate. */
  const replyRateRef = useRef(rateDay);
  const [photoVersions, setPhotoVersions] = useState<Record<string, string>>({});

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

  const loadActivityFeed = async (
    kind: 'posts' | 'replies' | 'shops' | 'credits',
  ): Promise<void> => {
    const setLoading =
      kind === 'posts'
        ? setPostsLoading
        : kind === 'replies'
          ? setActivityRepliesLoading
          : kind === 'credits'
            ? setCreditsLoading
            : setShopsLoading;
    const setError =
      kind === 'posts'
        ? setPostsError
        : kind === 'replies'
          ? setActivityRepliesError
          : kind === 'credits'
            ? setCreditsError
            : setShopsError;
    const setList =
      kind === 'posts'
        ? setPosts
        : kind === 'replies'
          ? setActivityReplies
          : kind === 'credits'
            ? setCredits
            : setShops;
    const fetchFn =
      kind === 'posts'
        ? fetchMemberPosts
        : kind === 'replies'
          ? fetchMemberReplies
          : kind === 'credits'
            ? fetchMemberCredits
            : fetchMemberShops;
    const loadGen =
      kind === 'posts'
        ? postsLoadGen
        : kind === 'replies'
          ? repliesLoadGen
          : kind === 'credits'
            ? creditsLoadGen
            : shopsLoadGen;
    const gen = ++loadGen.current;
    setLoading(true);
    setError(false);
    const token = session;
    try {
      let next: ForumMessage[];
      if (loadPublicList !== undefined) {
        next = await loadPublicList(kind);
      } else if (token === null) {
        setError(true);
        return;
      } else {
        next = await fetchFn(token, profile.id);
      }
      if (loadGen.current === gen) {
        setList(next);
      }
    } catch (err) {
      if (err instanceof MissingRequirementsError) {
        returnToView('/setup/rules', router);
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

  const handlePayCancel = (): void => {
    bumpPayPollGeneration();
    setPayMessageId(null);
    setPayDraft('');
    setPayError(null);
    setPayInvoice(null);
    setPayBusy(false);
    setPayHost(null);
    setReplyPayPreview(null);
    setReplyPosting(false);
  };

  const openActivity = (next: 'posts' | 'replies' | 'shops' | 'credits'): void => {
    // A paid reaction's sheet is open over a card: the feeds stay as they are until the sheet closes.
    if (replyPayPreview !== null) {
      return;
    }
    if (
      payMessageId !== null &&
      ((replies !== null && replies.some((row) => row.id === payMessageId)) ||
        (activityReplies !== null && activityReplies.some((row) => row.id === payMessageId)))
    ) {
      handlePayCancel();
    }
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
    if (next === 'replies') {
      if ((activityReplies === null || activityRepliesError) && !activityRepliesLoading) {
        void loadActivityFeed('replies');
      }
      return;
    }
    if (next === 'credits') {
      if ((credits === null || creditsError) && !creditsLoading) {
        void loadActivityFeed('credits');
      }
      return;
    }
    if ((shops === null || shopsError) && !shopsLoading) {
      void loadActivityFeed('shops');
    }
  };

  useEffect(() => {
    return () => {
      bumpPayPollGeneration();
    };
  }, []);

  const startPayPoll = (
    messageId: string,
    baselineSats: number,
    replyParentId: string | null = null,
    baselineReceivedSats?: number,
    clearReplyDraft = false,
  ): void => {
    const generation = bumpPayPollGeneration();
    const controller = payPollAbortRef.current;
    /* v8 ignore next 3 -- bumpPayPollGeneration always assigns a controller */
    if (controller === null) {
      return;
    }
    const signal = controller.signal;
    void (async () => {
      const composePay = replyParentId !== null;
      const countOwn = async (): Promise<number> => {
        const expected = pendingComposeTextRef.current;
        const me = useAuthStore.getState().account?.id;
        const sess = useAuthStore.getState().session;
        /* v8 ignore next 3 -- compose-pay always sets pending text, session, and parent */
        if (expected === null || me === undefined || sess === null || replyParentId === null) {
          return 0;
        }
        const replies = await fetchReplies(sess, replyParentId);
        return replies.filter((row) => row.accountId === me && row.text === expected).length;
      };
      let baselineOwn: number | null = null;
      if (composePay) {
        try {
          baselineOwn = await countOwn();
        } catch {
          // Without a baseline, any own row with this text after the sats rise is the new one.
          baselineOwn = null;
        }
      }
      for (;;) {
        try {
          const next = await fetchPublicMessage(
            messageId,
            typeof baselineReceivedSats === 'number'
              ? { sinceReceivedSats: baselineReceivedSats, signal }
              : { sinceSats: baselineSats, signal },
          );
          if (generation !== payPollGeneration.current || signal.aborted) {
            return;
          }
          if (
            next !== null &&
            (typeof baselineReceivedSats === 'number'
              ? (next.receivedSats ?? 0) > baselineReceivedSats
              : next.sats > baselineSats)
          ) {
            let ownContent = !composePay;
            if (composePay) {
              try {
                ownContent = (await countOwn()) > (baselineOwn ?? 0);
                /* v8 ignore start -- a failed own-content lookup keeps the poll waiting */
              } catch {
                ownContent = false;
              }
              /* v8 ignore stop */
            }
            if (ownContent) {
              pendingComposeTextRef.current = null;
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
              setShops((prev) => {
                /* v8 ignore next 3 -- shops list is null until that feed opens */
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
              setCredits((prev) => {
                /* v8 ignore next 3 -- credits list is null until that feed opens */
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
              setPayInvoice(null);
              setPayMessageId(null);
              setPayHost(null);
              setPayDraft('');
              setPayError(null);
              setReplyPosting(false);
              // The paid reaction went out: its text and amount leave the form with the sheet.
              if (clearReplyDraft) {
                setReplyDraft('');
                setReplyAmountDraft('');
              }
              setReplyPayPreview(null);
              const current = useAuthStore.getState();
              if (current.session !== session) {
                return;
              }
              if (current.account !== null) {
                setAccount({ ...current.account, hasPosted: true });
              }
              if (replyParentId !== null && replyParentId !== next.id) {
                /* v8 ignore start -- compose-pay reply increment is asserted in tests; identity/empty-activity arms are fixture-only */
                setPosts((prev) => {
                  /* v8 ignore next 3 -- pay poll starts from a listed posts-feed card */
                  if (prev === null) {
                    return prev;
                  }
                  return prev.map((row) => {
                    /* v8 ignore next 2 -- other listed notes keep their counts */
                    if (row.id !== replyParentId) {
                      return row;
                    }
                    return { ...row, replyCount: row.replyCount + 1 };
                  });
                });
                /* v8 ignore stop */
                setShops((prev) => {
                  /* v8 ignore next 3 -- shops list is null until that feed opens */
                  if (prev === null) {
                    return prev;
                  }
                  return prev.map((row) => {
                    /* v8 ignore next 3 -- other listed shop notes keep their counts */
                    if (row.id !== replyParentId) {
                      return row;
                    }
                    return { ...row, replyCount: row.replyCount + 1 };
                  });
                });
                setCredits((prev) => {
                  /* v8 ignore next 3 -- credits list is null until that feed opens */
                  if (prev === null) {
                    return prev;
                  }
                  return prev.map((row) => {
                    /* v8 ignore next 3 -- other listed credit notes keep their counts */
                    if (row.id !== replyParentId) {
                      return row;
                    }
                    return { ...row, replyCount: row.replyCount + 1 };
                  });
                });
                /* v8 ignore start -- compose-pay reply increment is asserted in tests; identity/empty-activity arms are fixture-only */
                setActivityReplies((prev) => {
                  /* v8 ignore next 8 -- activity replies feed is empty on the posts-card path */
                  if (prev === null) {
                    return prev;
                  }
                  return prev.map((row) => {
                    /* v8 ignore next 2 -- other listed notes keep their counts */
                    if (row.id !== replyParentId) {
                      return row;
                    }
                    return { ...row, replyCount: row.replyCount + 1 };
                  });
                });
                /* v8 ignore stop */
              }
              const threadId = expandedIdRef.current;
              const paidNestedReply = (repliesRef.current ?? []).some(
                (row) => row.id === messageId,
              );
              if (threadId !== null && current.session !== null && !paidNestedReply) {
                const gen = ++expandGen.current;
                setRepliesLoading(true);
                setRepliesError(false);
                try {
                  const repliesNext = await fetchReplies(current.session, threadId);
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

  const openOverlayForMissing = (missing: readonly string[]): boolean => {
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
    ownNote = false,
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
        setShops((prev) => {
          /* v8 ignore next 3 -- shops list is null until that feed opens */
          if (prev === null) {
            return prev;
          }
          return prev.map((message) => {
            /* v8 ignore next 3 -- other listed shop notes keep their counts */
            if (message.id !== parentId) {
              return message;
            }
            return {
              ...message,
              replyCount: Math.max(message.replyCount, message.replyCount + 1),
            };
          });
        });
        setCredits((prev) => {
          /* v8 ignore next 3 -- credits list is null until that feed opens */
          if (prev === null) {
            return prev;
          }
          return prev.map((message) => {
            /* v8 ignore next 3 -- other listed credit notes keep their counts */
            if (message.id !== parentId) {
              return message;
            }
            return {
              ...message,
              replyCount: Math.max(message.replyCount, message.replyCount + 1),
            };
          });
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
          pendingPostRef.current = () => runReplyPost(token, trimmed, parentId, true, ownNote);
          return;
        }
        if (expandedIdRef.current === parentId) {
          setReplyFormError('request');
        }
        return;
      }
      if (isReplyPaymentError(err)) {
        // A reply on your own note is never paid; the api owes it unpaid.
        if (ownNote) {
          setReplyFormError('request');
          return;
        }
        await runComposePay(token, trimmed, parentId, 1, isRetry);
        return;
      }
      if (err instanceof NoteDeletedError) {
        /* v8 ignore next 3 -- reply error after the thread was closed */
        if (expandedIdRef.current === parentId) {
          setReplyFormError('deleted');
        }
        return;
      }
      if (expandedIdRef.current === parentId) {
        setReplyFormError(isRateLimitError(err) ? 'rateLimit' : 'request');
      }
    } finally {
      setReplyPosting(false);
    }
  };

  const runComposePay = async (
    token: string,
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
      const target = await fetchComposeTarget(token);
      const invoice = await postMessageInvoice(
        token,
        target.messageId,
        sats,
        `inReplyTo:${parentId}\n${trimmed}`,
        shownFiatForSats(sats, replyRateRef.current),
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
        sparkInvoice: invoice.sparkInvoice,
        postsOnPay: true,
      });
      setPayHost('composer');
      setReplyDraft('');
      setReplyAmountDraft('');
      pendingPostRef.current = null;
      pendingComposeTextRef.current = trimmed;
      startPayPoll(target.messageId, target.sats, parentId);
      awaitingPay = true;
    } catch (err) {
      /* v8 ignore start -- pay sheet closed while the compose invoice failed */
      if (generation !== payPollGeneration.current) {
        return;
      }
      /* v8 ignore stop */
      if (err instanceof WalletRequiredError) {
        setOverlayRequirement('wallet');
        return;
      }
      if (err instanceof MissingRequirementsError) {
        if (!isRetry && openOverlayForMissing(err.missing)) {
          pendingPostRef.current = () => runComposePay(token, trimmed, parentId, sats, true);
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
          ? await postMessageInvoice(
              token,
              parentId,
              sats,
              undefined,
              shownFiatForSats(sats, replyRateRef.current),
            )
          : await postMessageInvoice(
              token,
              parentId,
              sats,
              trimmed,
              shownFiatForSats(sats, replyRateRef.current),
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
        sparkInvoice: invoice.sparkInvoice,
      });
      setPayHost('card');
      setReplyPayPreview(trimmed);
      pendingPostRef.current = null;
      setReplyPosting(false);
      startPayPoll(parentId, baselineSats, null, undefined, true);
    } catch (err) {
      if (generation !== payPollGeneration.current) {
        return;
      }
      if (err instanceof WalletRequiredError) {
        setOverlayRequirement('wallet');
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
      if (err instanceof NoteDeletedError) {
        setReplyFormError('deleted');
        return;
      }
      setReplyFormError(
        err instanceof Error && /1[-–]8000 characters/i.test(err.message)
          ? 'tooLong'
          : isRateLimitError(err)
            ? 'rateLimit'
            : isAuthorWalletError(err)
              ? 'authorWallet'
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
  const showMessage =
    session !== null && account?.id !== profile.id && profile.profileMessage !== null;
  const memberPath = `/members/${profile.id}`;
  let profileUrl =
    shareViewKey !== undefined
      ? `${origin}/view/${shareViewKey}`
      : shortResourceUrl(origin, profile.id, memberPath);
  /* v8 ignore next 3 -- SSR first paint: origin is empty until the client effect */
  if (origin === '') {
    profileUrl = '';
  }

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
    setPayHost('card');
    setPayDraft('');
    setPayError(null);
    setPayInvoice(null);
    setReplyPayPreview(null);
    setPayBusy(false);
  };

  const handlePaySubmit = (): void | Promise<ForumPayInvoice | null> => {
    /* v8 ignore next 3 -- Continue is disabled while payBusy; feed pay is session-gated */
    if (session === null || payMessageId === null || payBusy) {
      return;
    }
    const sats = paySatsFromDraft(payDraft, payShownUnit, rateDay, fiat);
    // The fiat stored with the invoice uses the same rate as these sats, also on a retry.
    const payRate = rateDay;
    if (sats === 'invalid') {
      setPayError('amount');
      return;
    }
    const token = session;
    const messageId = payMessageId;
    const visibleList = activity === 'replies' ? activityReplies : replies;
    const listed = visibleList?.find((message) => message.id === messageId);
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
          const invoice = await postMessageInvoice(
            token,
            messageId,
            sats,
            undefined,
            shownFiatForSats(sats, payRate),
          );
          if (generation !== payPollGeneration.current) {
            return null;
          }
          minted = {
            messageId,
            pr: invoice.pr,
            amountSats: invoice.amountSats,
            sparkInvoice: invoice.sparkInvoice,
          };
          setPayInvoice(minted);
          setPayBusy(false);
          if (listed.parentId) {
            startPayPoll(messageId, baselineSats, null, listed.receivedSats ?? 0);
          } else {
            startPayPoll(messageId, baselineSats);
          }
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
          if (err instanceof NoteDeletedError) {
            setPayError('deleted');
            return null;
          }
          if (err instanceof WalletRequiredError) {
            setPayError(null);
            setOverlayRequirement('wallet');
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

  const handleToggleExpand = (messageId: string): void => {
    if (replyPosting) {
      return;
    }
    // A paid reaction's sheet is open over this card: its form stays as it is until the sheet closes.
    if (replyPayPreview !== null) {
      return;
    }
    if (
      payMessageId !== null &&
      replies !== null &&
      replies.some((row) => row.id === payMessageId)
    ) {
      handlePayCancel();
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
    void markNotificationsReadForMessage(session, messageId).catch(() => undefined);
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
    const parsed = replySatsFromDraft(replyAmountDraft, replyShownUnit, rateDay, fiat);
    replyRateRef.current = rateDay;
    const token = session;
    const parentId = expandedId;
    const parentList = activity === 'credits' ? credits : activity === 'shops' ? shops : posts;
    const parentRow = parentList?.find((message) => message.id === parentId);
    const parentAccountId = parentRow?.accountId;
    const own = isOwnNote(account?.id, parentAccountId);
    const exempt = isReplyPaymentExempt(account, parentAccountId);
    const authorUnknown = parentAccountId === undefined;
    const blocked = parentRow !== undefined && authorCannotReceive(parentRow, account?.id);
    const continueReply = (isRetry: boolean): Promise<void> => {
      // Your own note shows no amount field: the reply is posted without a payment.
      if (own) {
        if (trimmed === '') {
          setReplyFormError('empty');
          return Promise.resolve();
        }
        return runReplyPost(token, trimmed, parentId, isRetry, true);
      }
      // The author cannot receive yet: the amount field is disabled, so the
      // reply never invoices a gift to the author.
      if (blocked) {
        if (trimmed === '') {
          setReplyFormError('empty');
          return Promise.resolve();
        }
        return exempt
          ? runReplyPost(token, trimmed, parentId, isRetry)
          : runComposePay(token, trimmed, parentId, 1, isRetry);
      }
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
      if (parsed === 'empty') {
        if (exempt || authorUnknown) {
          return runReplyPost(token, trimmed, parentId, isRetry);
        }
        return runComposePay(token, trimmed, parentId, 1, isRetry);
      }
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

  const sharedForumProps = {
    photoUrls: {},
    photoVersions,
    rateDay,
    payMessageId,
    payHost,
    payDraft,
    payBusy,
    payError,
    payInvoice,
    replyPayPreview,
    onPayOpen: handlePayOpen,
    onPayDraftChange: (value: string): void => {
      setPayDraft(value);
      setPayError(null);
    },
    onPayUnitChange: setPayShownUnit,
    onReplyUnitChange: setReplyShownUnit,
    onPaySubmit: handlePaySubmit,
    onPayCancel: handlePayCancel,
    viewerAccountId: account?.id ?? null,
    ...(factsOnly
      ? {}
      : {
          repayLink: true,
        }),
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
    heartViewerId: account?.id ?? null,
    onHeartTip,
    heartTipViews,
  };

  const creditCount = typeof profile.creditCount === 'number' ? profile.creditCount : 0;
  const activityMessages =
    activity === 'posts'
      ? (posts ?? [])
      : activity === 'replies'
        ? (activityReplies ?? [])
        : activity === 'credits'
          ? (credits ?? [])
          : (shops ?? []);
  const activityCount =
    activity === 'posts'
      ? profile.postCount
      : activity === 'replies'
        ? profile.replyCount
        : activity === 'credits'
          ? creditCount
          : (profile.shopCount ?? 0);
  const activityLoading =
    activity === 'posts'
      ? postsLoading
      : activity === 'replies'
        ? activityRepliesLoading
        : activity === 'credits'
          ? creditsLoading
          : shopsLoading;
  const activityError =
    activity === 'posts'
      ? postsError
      : activity === 'replies'
        ? activityRepliesError
        : activity === 'credits'
          ? creditsError
          : shopsError;
  const profileMessagePhotoId =
    profile.profileMessage !== null && profile.profileMessage.hasPhoto
      ? profile.profileMessage.id
      : undefined;
  const publicAboutMessageId =
    profile.profileMessage !== null && profile.profileMessage.id !== ''
      ? profile.profileMessage.id
      : typeof profile.aboutMessageId === 'string' && profile.aboutMessageId !== ''
        ? profile.aboutMessageId
        : undefined;

  const giftsBlock = (
    <div className="flex w-full flex-col items-stretch gap-3 border-t border-app-border pt-6">
      <p className="text-center text-xs tracking-widest text-app-subtle uppercase">
        {t('profile.giftsHeading')}
      </p>
      {cannotReceive ? (
        <p className="text-center">
          <CannotReceiveLabel />
        </p>
      ) : address !== null && address.trim() !== '' ? (
        <p className="min-w-0 truncate text-center font-mono text-sm text-app-fg">{address}</p>
      ) : (
        <p className="min-w-0 truncate text-center text-sm text-app-fg">
          {t('view.noGiftsAddress')}
        </p>
      )}
      {showQr && qr !== null ? (
        <div className="flex flex-col items-center gap-3">
          <QrCode value={qr} label={t('profile.giftsQr')} logo={profileQrLogo} />
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => {
              setStickerOpen(true);
            }}
          >
            {t('profile.shopSticker')}
          </Button>
        </div>
      ) : null}
      {stickerOpen && qr !== null && address !== null ? (
        <ShopStickerOverlay
          qrValue={qr}
          handle={address}
          onClose={() => {
            setStickerOpen(false);
          }}
        />
      ) : null}
    </div>
  );
  const countButtons = (
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
      {typeof profile.shopCount === 'number' && profile.shopCount > 0 ? (
        <Button
          type="button"
          size="sm"
          variant={activity === 'shops' ? 'primary' : 'secondary'}
          aria-pressed={activity === 'shops'}
          onClick={() => openActivity('shops')}
        >
          {t('profile.shopCount', { count: String(profile.shopCount) })}
        </Button>
      ) : null}
      {creditCount > 0 ? (
        <Button
          type="button"
          size="sm"
          variant={activity === 'credits' ? 'primary' : 'secondary'}
          aria-pressed={activity === 'credits'}
          onClick={() => openActivity('credits')}
        >
          {t('profile.creditCount', { count: String(creditCount) })}
        </Button>
      ) : null}
    </div>
  );
  const activityFeed =
    activity === 'posts' ||
    activity === 'replies' ||
    activity === 'shops' ||
    activity === 'credits' ? (
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
          {activity === 'posts' || activity === 'shops' || activity === 'credits' ? (
            <ForumBoard
              {...IDLE_BOARD}
              messages={activityMessages}
              {...sharedForumProps}
              {...(activity !== 'credits' &&
              account !== null &&
              roleAtLeast(account.role, 'moderator')
                ? {
                    shopNoteEdit: true as const,
                    onShopNoteUpdated: (updated: ForumMessage) => {
                      setPhotoVersions((prev) => ({ ...prev, [updated.id]: String(Date.now()) }));
                      const applyShopEdit = (
                        prev: ForumMessage[] | null,
                      ): ForumMessage[] | null => {
                        /* v8 ignore next 3 -- the pencil mounts only after the post list has loaded */
                        if (prev === null) {
                          return prev;
                        }
                        return prev.map((row) => {
                          if (row.id !== updated.id) {
                            return row;
                          }
                          const next = {
                            ...row,
                            text: updated.text,
                            hasPhoto: updated.hasPhoto,
                            photoCount: updated.photoCount,
                            hasVideo: updated.hasVideo,
                          };
                          if (updated.place === undefined) {
                            delete next.place;
                          } else {
                            next.place = updated.place;
                          }
                          if (updated.shopAccount === undefined) {
                            delete next.shopAccount;
                          } else {
                            next.shopAccount = updated.shopAccount;
                          }
                          return next;
                        });
                      };
                      setPosts(applyShopEdit);
                      setShops(applyShopEdit);
                    },
                  }
                : {})}
            />
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
    ) : null;

  const requirementOverlay =
    overlayRequirement !== null ? (
      <RequirementsOverlay
        requirement={overlayRequirement}
        onDismiss={() => {
          setOverlayRequirement(null);
          pendingPostRef.current = null;
        }}
        onSatisfied={onOverlaySatisfied}
      />
    ) : null;

  if (factsOnly) {
    return (
      <>
        {requirementOverlay}
        {omitPills ? null : (
          <MemberIdentityPills profile={listedProfile}>
            {(marks, hints) => (
              <>
                {marks !== null ? (
                  <div className="flex w-full flex-wrap items-center justify-center gap-2">
                    {marks}
                  </div>
                ) : null}
                {hints}
              </>
            )}
          </MemberIdentityPills>
        )}
        {giftsBlock}
        {countButtons}
        {activityFeed}
      </>
    );
  }

  return (
    <>
      {requirementOverlay}
      <div className="flex w-full max-w-sm flex-col items-center gap-6">
        <Card surface={false}>
          {owner !== null ? (
            <ProfileImages
              key={owner.session}
              imageEpoch={imageEpoch}
              loadPicture={() => fetchProfilePhoto(owner.session)}
              loadBanner={() => fetchWideBanner(owner.session)}
              onSavePicture={async (photo) => {
                await putProfilePhoto(owner.session, photo);
                setImageEpoch((epoch) => epoch + 1);
              }}
              onSaveBanner={async (photo) => {
                await putWideBanner(owner.session, photo);
                setImageEpoch((epoch) => epoch + 1);
              }}
            />
          ) : (
            <PublicProfileHeader
              pictureUrl={visitorImages.pictureUrl}
              bannerUrl={visitorImages.bannerUrl}
            />
          )}
          <h1 className="text-center text-2xl font-semibold tracking-tight sm:text-3xl">
            {t('profile.title')}
          </h1>
          <AccountActivityChart received={received} donated={donated} failed={activityFailed} />
          <LoanBalanceChart owed={owed} credit={credit} failed={activityFailed} />
          {owner !== null ? (
            <AboutMeSection
              mode="owner"
              aboutMe={owner.account.aboutMe}
              name={owner.account.name}
              {...(typeof owner.account.aboutMessageId === 'string' &&
              owner.account.aboutMessageId !== ''
                ? { messageId: owner.account.aboutMessageId }
                : {})}
              hasPhoto={owner.account.aboutMeHasPhoto === true}
              loadPhoto={() => fetchAboutMePhoto(owner.session)}
              loadPicture={() => fetchProfilePhoto(owner.session)}
              onSavePicture={async (photo) => {
                await putProfilePhoto(owner.session, photo);
                setImageEpoch((epoch) => epoch + 1);
              }}
              loadBanner={() => fetchWideBanner(owner.session)}
              onSaveBanner={async (photo) => {
                await putWideBanner(owner.session, photo);
                setImageEpoch((epoch) => epoch + 1);
              }}
              omitEmptySlotAdds
              imageEpoch={imageEpoch}
              /* v8 ignore next -- SSR first paint: origin empty so no copy URL */
              {...(profileUrl !== '' ? { profileUrl } : {})}
              onSave={async (text, photo) => {
                const token = owner.session;
                try {
                  const updated =
                    photo === undefined
                      ? await putAboutMe(token, text)
                      : await putAboutMe(token, text, photo);
                  if (useAuthStore.getState().session !== token) {
                    return false;
                  }
                  const current = useAuthStore.getState().account;
                  if (current === null) {
                    return false;
                  }
                  const nextAboutId = updated.aboutMessageId;
                  setAccount({
                    ...current,
                    aboutMe: updated.aboutMe,
                    aboutMeHasPhoto: updated.aboutMeHasPhoto,
                    ...(nextAboutId === undefined || nextAboutId === ''
                      ? {}
                      : { aboutMessageId: nextAboutId }),
                  });
                } catch (err) {
                  if (useAuthStore.getState().session !== token) {
                    return false;
                  }
                  if (err instanceof MissingRequirementsError) {
                    if (err.missing.includes('rules')) {
                      returnToView('/setup/rules', router);
                      return;
                    }
                    throw err;
                  }
                  throw err;
                }
              }}
            />
          ) : (
            <AboutMeSection
              mode="public"
              aboutMe={profile.aboutMe}
              name={profile.name}
              {...(profile.aboutMe !== null && publicAboutMessageId !== undefined
                ? { messageId: publicAboutMessageId }
                : {})}
              hasPhoto={
                profile.aboutMeHasPhoto === true || profile.profileMessage?.hasPhoto === true
              }
              {...(profileMessagePhotoId !== undefined
                ? {
                    loadPhoto: () =>
                      session !== null
                        ? fetchMessagePhoto(session, profileMessagePhotoId)
                        : fetchPublicMessagePhoto(profileMessagePhotoId),
                  }
                : loadAboutPhoto !== undefined
                  ? { loadPhoto: loadAboutPhoto }
                  : {})}
              /* v8 ignore next -- SSR first paint: origin empty so no copy URL */
              {...(profileUrl !== '' ? { profileUrl } : {})}
            />
          )}
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
          {owner !== null ? (
            <MemberIdentityPills profile={listedProfile}>
              {(marks, hints) => (
                <>
                  <NameForm variant="profile" besideName={marks} belowName={hints} />
                  <LocationForm />
                </>
              )}
            </MemberIdentityPills>
          ) : (
            <>
              <MemberIdentityPills profile={listedProfile}>
                {(marks, hints) => (
                  <div className="flex w-full flex-col items-stretch gap-3 border-t border-app-border pt-6">
                    <p className="text-center text-xs tracking-widest text-app-subtle uppercase">
                      {t('name.heading')}
                    </p>
                    <div className="flex flex-wrap items-center justify-center gap-2">
                      <p className="min-w-0 truncate text-sm text-app-fg">
                        {listedProfile.name ?? t('view.unnamed')}
                      </p>
                      {marks}
                    </div>
                    {hints}
                  </div>
                )}
              </MemberIdentityPills>
              <div className="flex w-full flex-col items-stretch gap-3 border-t border-app-border pt-6">
                <p className="text-center text-xs tracking-widest text-app-subtle uppercase">
                  {t('location.heading')}
                </p>
                <p className="min-w-0 truncate text-center text-sm text-app-fg">
                  {profile.location !== null && profile.location.trim() !== ''
                    ? profile.location
                    : t('location.unset')}
                </p>
              </div>
            </>
          )}
          {giftsBlock}
          {countButtons}
          {account !== null &&
          loadPublicList === undefined &&
          roleAtLeast(account.role, 'moderator') &&
          listedProfile.id !== account.id ? (
            <MemberTrustActions profile={listedProfile} onUpdated={setListedProfile} />
          ) : null}
        </Card>
        {activityFeed}
      </div>
    </>
  );
}
