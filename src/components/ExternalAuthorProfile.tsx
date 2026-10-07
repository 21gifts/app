'use client';

import { Check, Copy } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState, type ReactElement } from 'react';
import {
  ForumBoard,
  type ForumFormError,
  type ForumPayError,
  type ForumPayInvoice,
  type ForumReplyFormError,
} from '@/components/ForumBoard';
import { useTranslations } from '@/components/LocaleProvider';
import { Button, Card, IconButton } from '@/components/ui';
import { useSpotRate } from '@/hooks/useSpotRate';
import {
  fetchExternalAuthorPosts,
  fetchExternalAuthorProfile,
  fetchExternalAuthorReplies,
} from '@/lib/api';
import type {
  ExternalAuthorProfile as ExternalAuthorProfileData,
  ForumMessage,
} from '@/lib/api-types';
import { useHeartTip } from '@/lib/heart-tip';

/** Copied-icon flash duration, matching {@link ForumBoard}. */
const COPY_RESET_MS = 1200;

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
  payWaiting: false,
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

/** Props for {@link ExternalAuthorProfile}. */
export interface ExternalAuthorProfileProps {
  /** Forum message id whose external author to load. */
  messageId: string;
  /**
   * Card name until the profile loads, and when the fetch returns null.
   * Empty means view.unnamed.
   */
  fallbackName: string;
}

/**
 * Copy `text` via a hidden textarea and `document.execCommand('copy')`.
 *
 * @param text - String to put on the clipboard.
 * @returns Whether the browser reported a successful copy.
 */
function fallbackCopy(text: string): boolean {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.setAttribute('aria-hidden', 'true');
  ta.className = 'fixed opacity-0';
  ta.readOnly = true;
  document.body.appendChild(ta);
  ta.select();
  let ok = false;
  try {
    ok = document.execCommand('copy');
  } catch {
    ok = false;
  }
  ta.remove();
  return ok;
}

/**
 * True when both feed counts are numbers (0 is a number).
 *
 * @param profile - Parsed external author profile, or null.
 * @returns Whether count buttons and the feed may render.
 */
function hasAuthorCounts(
  profile: ExternalAuthorProfileData | null,
): profile is ExternalAuthorProfileData & { postCount: number; replyCount: number } {
  return (
    profile !== null &&
    typeof profile.postCount === 'number' &&
    typeof profile.replyCount === 'number'
  );
}

/**
 * Member-profile card for a forum author with no 21.gifts account.
 *
 * Same sections as the member card (name, optional addresses, npub to copy).
 * When both postCount and replyCount are numbers, the same count buttons as a
 * member open a read-only feed under the card. Not a dialog: no overlay, portal,
 * close control, or hint paragraph.
 *
 * @param props - See {@link ExternalAuthorProfileProps}.
 * @returns The profile card, and the read-only feed while a count panel is open.
 */
export function ExternalAuthorProfile({
  messageId,
  fallbackName,
}: ExternalAuthorProfileProps): ReactElement {
  const { t } = useTranslations();
  const router = useRouter();
  const rateDay = useSpotRate();
  const { onHeartTip, heartTipViews } = useHeartTip({ readOnly: true });
  const [profile, setProfile] = useState<ExternalAuthorProfileData | null>(null);
  const [copied, setCopied] = useState(false);
  const [activity, setActivity] = useState<'posts' | 'replies' | null>(null);
  const [posts, setPosts] = useState<ForumMessage[] | null>(null);
  const [replies, setReplies] = useState<ForumMessage[] | null>(null);
  const [postsLoading, setPostsLoading] = useState(false);
  const [repliesLoading, setRepliesLoading] = useState(false);
  const [postsError, setPostsError] = useState(false);
  const [repliesError, setRepliesError] = useState(false);
  const [feedMessageId, setFeedMessageId] = useState(messageId);
  const copyMounted = useRef(true);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const copyGen = useRef(0);
  const postsLoadGen = useRef(0);
  const repliesLoadGen = useRef(0);
  const profileLoadGen = useRef(0);

  if (feedMessageId !== messageId) {
    setFeedMessageId(messageId);
    setProfile(null);
    setCopied(false);
    setActivity(null);
    setPosts(null);
    setReplies(null);
    setPostsLoading(false);
    setRepliesLoading(false);
    setPostsError(false);
    setRepliesError(false);
    postsLoadGen.current += 1;
    repliesLoadGen.current += 1;
    profileLoadGen.current += 1;
    copyGen.current += 1;
    if (copyTimer.current !== null) {
      clearTimeout(copyTimer.current);
      copyTimer.current = null;
    }
  }

  useEffect(() => {
    copyMounted.current = true;
    return () => {
      copyMounted.current = false;
      if (copyTimer.current !== null) {
        clearTimeout(copyTimer.current);
      }
    };
  }, []);

  const flashCopied = useCallback((): void => {
    setCopied(true);
    if (copyTimer.current !== null) {
      clearTimeout(copyTimer.current);
    }
    copyTimer.current = setTimeout(() => {
      setCopied(false);
      copyTimer.current = null;
    }, COPY_RESET_MS);
  }, []);

  useEffect(() => {
    const gen = profileLoadGen.current;
    let cancelled = false;
    void (async () => {
      const next = await fetchExternalAuthorProfile(messageId);
      if (profileLoadGen.current !== gen || cancelled) {
        return;
      }
      setProfile(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [messageId]);

  const displayName =
    profile === null
      ? fallbackName.trim() !== ''
        ? fallbackName
        : t('view.unnamed')
      : profile.name;
  const nip05 = (profile?.nip05 ?? '').trim();
  const lud16 = (profile?.lud16 ?? '').trim();
  const showNip05 = nip05 !== '';
  const showLud16 = lud16 !== '' && lud16.toLowerCase() !== nip05.toLowerCase();

  const copyNpub = async (): Promise<void> => {
    /* v8 ignore next 3 -- Copy renders only after a profile has loaded */
    if (profile === null) {
      return;
    }
    const gen = copyGen.current;
    const npub = profile.npub;
    try {
      await navigator.clipboard.writeText(npub);
      if (!copyMounted.current || copyGen.current !== gen) {
        return;
      }
      flashCopied();
    } catch {
      if (!copyMounted.current || copyGen.current !== gen) {
        return;
      }
      if (fallbackCopy(npub)) {
        flashCopied();
      }
    }
  };

  const loadFeed = async (kind: 'posts' | 'replies'): Promise<void> => {
    const setLoading = kind === 'posts' ? setPostsLoading : setRepliesLoading;
    const setError = kind === 'posts' ? setPostsError : setRepliesError;
    const setList = kind === 'posts' ? setPosts : setReplies;
    const fetchFn = kind === 'posts' ? fetchExternalAuthorPosts : fetchExternalAuthorReplies;
    const loadGen = kind === 'posts' ? postsLoadGen : repliesLoadGen;
    const gen = ++loadGen.current;
    setLoading(true);
    setError(false);
    try {
      const next = await fetchFn(messageId);
      if (loadGen.current === gen) {
        setList(next);
      }
    } catch {
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
        void loadFeed('posts');
      }
      return;
    }
    if ((replies === null || repliesError) && !repliesLoading) {
      void loadFeed('replies');
    }
  };

  const counted = hasAuthorCounts(profile) ? profile : null;
  const activityMessages = activity === 'posts' ? (posts ?? []) : (replies ?? []);

  return (
    <div className="flex w-full max-w-sm flex-col items-center gap-6">
      <Card surface={false}>
        <h1 className="text-center text-2xl font-semibold tracking-tight sm:text-3xl">
          {t('profile.title')}
        </h1>
        <div className="flex w-full flex-col items-stretch gap-3 border-t border-app-border pt-6">
          <p className="text-center text-xs tracking-widest text-app-subtle uppercase">
            {t('name.heading')}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <p className="min-w-0 truncate text-sm text-app-fg">{displayName}</p>
            <span className="rounded-full border border-app-border-strong px-2 py-0.5 text-xs font-medium text-app-muted">
              {t('forum.via.nostr')}
            </span>
          </div>
        </div>
        {showNip05 ? (
          <div className="flex w-full flex-col items-stretch gap-3 border-t border-app-border pt-6">
            <p className="text-center text-xs tracking-widest text-app-subtle uppercase">
              {t('forum.externalProfileNip05')}
            </p>
            <p className="min-w-0 break-all text-center text-sm text-app-fg">{nip05}</p>
          </div>
        ) : null}
        {showLud16 ? (
          <div className="flex w-full flex-col items-stretch gap-3 border-t border-app-border pt-6">
            <p className="text-center text-xs tracking-widest text-app-subtle uppercase">
              {t('forum.externalProfileLud16')}
            </p>
            <p className="min-w-0 break-all text-center text-sm text-app-fg">{lud16}</p>
          </div>
        ) : null}
        {profile !== null ? (
          <div className="flex w-full flex-col items-stretch gap-3 border-t border-app-border pt-6">
            <p className="text-center text-xs tracking-widest text-app-subtle uppercase">
              {t('forum.externalProfileNpub')}
            </p>
            <p className="min-w-0 break-all text-center text-sm text-app-fg">{profile.npub}</p>
            <div className="flex items-center justify-center">
              <IconButton
                type="button"
                variant="secondary"
                size="md"
                aria-label={
                  copied ? t('forum.externalProfileCopied') : t('forum.externalProfileCopy')
                }
                title={copied ? t('forum.externalProfileCopied') : t('forum.externalProfileCopy')}
                onClick={() => {
                  void copyNpub();
                }}
              >
                {copied ? (
                  <Check aria-hidden="true" className="h-4 w-4" />
                ) : (
                  <Copy aria-hidden="true" className="h-4 w-4" />
                )}
              </IconButton>
            </div>
          </div>
        ) : null}
        {counted !== null ? (
          <div className="flex w-full flex-wrap justify-center gap-2 border-t border-app-border pt-6">
            <Button
              type="button"
              size="sm"
              variant={activity === 'posts' ? 'primary' : 'secondary'}
              aria-pressed={activity === 'posts'}
              onClick={() => openActivity('posts')}
            >
              {t('profile.postCount', { count: String(counted.postCount) })}
            </Button>
            <Button
              type="button"
              size="sm"
              variant={activity === 'replies' ? 'primary' : 'secondary'}
              aria-pressed={activity === 'replies'}
              onClick={() => openActivity('replies')}
            >
              {t('profile.replyCount', { count: String(counted.replyCount) })}
            </Button>
          </div>
        ) : null}
      </Card>
      {counted !== null && (activity === 'posts' || activity === 'replies') ? (
        (activity === 'posts' ? postsLoading : repliesLoading) ? (
          <p className="text-center text-sm text-app-muted">{t('forum.loading')}</p>
        ) : (activity === 'posts' ? postsError : repliesError) ? (
          <div className="flex flex-col items-center gap-4">
            <p role="alert" className="text-center text-sm text-app-danger">
              {t('forum.error')}
            </p>
            <Button
              type="button"
              onClick={() => {
                void loadFeed(activity);
              }}
            >
              {t('view.retry')}
            </Button>
          </div>
        ) : (
          <>
            <ForumBoard
              {...IDLE_BOARD}
              messages={activityMessages}
              rateDay={rateDay}
              readOnly
              composerHidden
              modeSelector={false}
              onHeartTip={onHeartTip}
              heartTipViews={heartTipViews}
              onToggleExpand={(noteId) => {
                if (activity === 'posts') {
                  router.push(`/messages/${noteId}`);
                  return;
                }
                const parentId = activityMessages.find(
                  (message) => message.id === noteId,
                )?.parentId;
                if (typeof parentId === 'string' && parentId.trim() !== '') {
                  router.push(`/messages/${parentId}`);
                }
              }}
            />
            {activityMessages.length <
            (activity === 'posts' ? counted.postCount : counted.replyCount) ? (
              <p role="status" className="text-center text-sm text-app-muted">
                {t('profile.activityLatest', {
                  shown: String(activityMessages.length),
                  total: String(activity === 'posts' ? counted.postCount : counted.replyCount),
                })}
              </p>
            ) : null}
          </>
        )
      ) : null}
    </div>
  );
}
