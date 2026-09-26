'use client';

import { useCallback, useEffect, useRef, useState, type ReactElement } from 'react';
import { InboxScreen, type InboxFormError } from '@/components/InboxScreen';
import { useLocalSunday } from '@/components/SundayWritingGate';
import { useTranslations } from '@/components/LocaleProvider';
import { Button, Card } from '@/components/ui';
import { useLatestRateDay } from '@/hooks/useLatestRateDay';
import {
  CONVERSATION_LIVE_POLL_MS,
  fetchConversation,
  fetchConversationMessagePhoto,
  fetchModeratorGroup,
  markConversationRead,
  postConversationMessage,
} from '@/lib/api';
import {
  CONTACT_MESSAGE_MAX_LENGTH,
  type Conversation,
  type ConversationMessage,
} from '@/lib/api-types';
import { bumpUnreadAppBadgeEpoch, refreshUnreadAppBadge } from '@/lib/app-badge';
import { prepareForumPhoto, type ForumPhotoPayload } from '@/lib/forum-photo';
import { roleAtLeast } from '@/lib/roles';
import { useAuthStore } from '@/stores/auth-store';

/** Revoke a blob URL; data URLs from {@link prepareForumPhoto} are left alone. */
function revokeIfBlob(url: string): void {
  if (url.startsWith('blob:')) {
    URL.revokeObjectURL(url);
  }
}

function appendUnseenMessages(
  prev: readonly ConversationMessage[],
  page: readonly ConversationMessage[],
): ConversationMessage[] {
  const ids = new Set(prev.map((message) => message.id));
  const fresh = page.filter((message) => !ids.has(message.id));
  if (fresh.length === 0) {
    return prev as ConversationMessage[];
  }
  return [...prev, ...fresh].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

/**
 * Signed-in closed moderator-group thread.
 *
 * Moderators fetch {@link fetchModeratorGroup} then
 * {@link fetchConversation} and reuse {@link InboxScreen} as the open thread
 * (`showFilter` and `showAmount` false; `showAttach` true; the heading is
 * always the catalog `moderate.groupLabel`, never the api row name).
 * JPEG/PNG/WebP stills use {@link prepareForumPhoto} (cap 10); photo-only
 * send is allowed. Send is disabled while a pick is still preparing
 * (`posting || preparing`). Thread stills load via {@link fetchConversationMessagePhoto}.
 * Losing staff while mounted bumps `pickGeneration`, clears drafts and
 * preparing, and revokes blob URLs (same cleanup as unmount). Passes
 * `rateDay` from {@link useLatestRateDay} into {@link InboxScreen}.
 * After a successful group and thread fetch, marks the room read
 * (`markConversationRead`), bumps the badge epoch, and refreshes the
 * home-screen badge with staff-room unread `0`. The newest 20-message page
 * loads first; an IntersectionObserver near the oldest bubble prepends unique
 * older pages without returning to the loading card.
 * {@link InboxScreen} stays pinned while stuck to the bottom. While the room
 * is open and the tab is visible, the newest page is fetched every
 * {@link CONVERSATION_LIVE_POLL_MS} and unseen messages are appended; a hidden
 * tab does not poll; a failed poll keeps the thread. Other signed-in visitors
 * and a missing account see forbidden copy and do not fetch. Renders
 * nothing without a session. Back to the moderation hub is the page
 * chrome (no in-card back).
 *
 * @returns The group thread, forbidden copy, or `null` without a session.
 */
export function ModeratorGroupScreen(): ReactElement | null {
  const { t } = useTranslations();
  const sunday = useLocalSunday();
  const session = useAuthStore((state) => state.session);
  const account = useAuthStore((state) => state.account);
  const staff = roleAtLeast(account?.role, 'moderator');
  const rateDay = useLatestRateDay();
  const [group, setGroup] = useState<Conversation | null>(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [messages, setMessages] = useState<ConversationMessage[] | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [nearStartElement, setNearStartElement] = useState<HTMLLIElement | null>(null);
  const loadingMoreRef = useRef(false);
  const paginationGeneration = useRef(0);
  const [draft, setDraft] = useState('');
  const [posting, setPosting] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [formError, setFormError] = useState<InboxFormError>(null);
  const [photoDrafts, setPhotoDrafts] = useState<ForumPhotoPayload[]>([]);
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});
  const photoUrlsRef = useRef(photoUrls);
  photoUrlsRef.current = photoUrls;
  const pickGeneration = useRef(0);

  const nearStartRef = useCallback((node: HTMLLIElement | null): void => {
    setNearStartElement(node);
  }, []);

  useEffect(() => {
    if (session === null || !staff || sunday) {
      return;
    }
    let cancelled = false;
    paginationGeneration.current += 1;
    loadingMoreRef.current = false;
    setNextCursor(null);
    setError(false);
    void (async () => {
      try {
        const nextGroup = await fetchModeratorGroup(session);
        if (cancelled) {
          return;
        }
        const page = await fetchConversation(session, nextGroup.id);
        if (cancelled) {
          return;
        }
        setGroup({ ...nextGroup, unread: false });
        setMessages(page.messages);
        setNextCursor(page.nextCursor);
        void markConversationRead(session, nextGroup.id).catch(() => undefined);
        bumpUnreadAppBadgeEpoch();
        void refreshUnreadAppBadge(session, undefined, 0).catch(() => undefined);
      } catch {
        if (cancelled) {
          return;
        }
        setGroup(null);
        setMessages(null);
        setNextCursor(null);
        setError(true);
      }
    })();
    return () => {
      cancelled = true;
      paginationGeneration.current += 1;
      loadingMoreRef.current = false;
    };
  }, [session, staff, attempt, sunday]);

  useEffect(() => {
    if (session === null || !staff) {
      pickGeneration.current += 1;
      setPreparing(false);
      setPhotoDrafts([]);
      setFormError(null);
      const urls = photoUrlsRef.current;
      for (const url of Object.values(urls)) {
        revokeIfBlob(url);
      }
      if (Object.keys(urls).length > 0) {
        setPhotoUrls({});
      }
    }
  }, [session, staff]);

  useEffect(() => {
    if (session === null || !staff || messages === null || group === null) {
      return;
    }
    const conversationId = group.id;
    let cancelled = false;
    const liveKeys = new Set(
      messages.flatMap((message) => {
        const count = message.photoCount > 0 ? message.photoCount : message.hasPhoto ? 1 : 0;
        return Array.from({ length: count }, (_, index) => `${message.id}:${index}`);
      }),
    );
    const stale = Object.entries(photoUrlsRef.current).filter(([key]) => !liveKeys.has(key));
    if (stale.length > 0) {
      for (const [, url] of stale) {
        revokeIfBlob(url);
      }
      setPhotoUrls((prev) => {
        const next = { ...prev };
        for (const [key] of stale) {
          delete next[key];
        }
        return next;
      });
    }
    const missing = messages.flatMap((message) => {
      const count = message.photoCount > 0 ? message.photoCount : message.hasPhoto ? 1 : 0;
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
        /* v8 ignore next 3 -- skip ids filled while earlier fetches in this loop ran */
        if (photoUrlsRef.current[photo.key] !== undefined) {
          continue;
        }
        let blob: Blob;
        try {
          blob = await fetchConversationMessagePhoto(
            session,
            conversationId,
            photo.id,
            photo.index,
          );
        } catch {
          /* v8 ignore next 3 -- unmount during a failed fetch */
          if (cancelled) {
            return;
          }
          continue;
        }
        /* v8 ignore next 3 -- unmount after a successful fetch */
        if (cancelled) {
          return;
        }
        const url = URL.createObjectURL(blob);
        /* v8 ignore next 4 -- unmount after createObjectURL */
        if (cancelled) {
          URL.revokeObjectURL(url);
          return;
        }
        setPhotoUrls((prev) => {
          /* v8 ignore next 4 -- race if the same id was filled while the fetch was in flight */
          if (prev[photo.key] !== undefined) {
            URL.revokeObjectURL(url);
            return prev;
          }
          return { ...prev, [photo.key]: url };
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [session, staff, messages, group?.id]);

  useEffect(() => {
    return () => {
      pickGeneration.current += 1;
      for (const url of Object.values(photoUrlsRef.current)) {
        revokeIfBlob(url);
      }
    };
  }, []);
  useEffect(() => {
    if (
      sunday ||
      session === null ||
      group === null ||
      nearStartElement === null ||
      nextCursor === null
    ) {
      return;
    }
    let cancelled = false;
    const activeSession = session;
    const activeId = group.id;
    const activeCursor = nextCursor;
    const generation = paginationGeneration.current;
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting) || loadingMoreRef.current) {
        return;
      }
      loadingMoreRef.current = true;
      void (async () => {
        try {
          const page = await fetchConversation(activeSession, activeId, {
            cursor: activeCursor,
          });
          /* v8 ignore next 3 -- unmount during cursor fetch */
          if (cancelled || generation !== paginationGeneration.current) {
            return;
          }
          setMessages((prev) => {
            /* v8 ignore next -- the sentinel only renders after page one is in state */
            if (prev === null) return page.messages;
            const ids = new Set(prev.map((message) => message.id));
            const older = page.messages.filter((message) => !ids.has(message.id));
            return [...older, ...prev];
          });
          setNextCursor(page.nextCursor);
        } catch {
          // Keep the current pages and cursor so a later intersection may retry.
        } finally {
          if (!cancelled && generation === paginationGeneration.current) {
            loadingMoreRef.current = false;
          }
        }
      })();
    });
    observer.observe(nearStartElement);
    return () => {
      cancelled = true;
      loadingMoreRef.current = false;
      observer.disconnect();
    };
  }, [group, nearStartElement, nextCursor, session, sunday]);

  const groupId = group?.id ?? null;
  const threadLoaded = messages !== null && groupId !== null;
  const messagesRef = useRef(messages);
  messagesRef.current = messages;
  useEffect(() => {
    if (sunday || session === null || !staff || groupId === null || !threadLoaded) {
      return;
    }
    let cancelled = false;
    let inFlight = false;
    const activeId = groupId;
    const pull = (): void => {
      if (document.visibilityState === 'hidden' || inFlight || cancelled) {
        return;
      }
      inFlight = true;
      void fetchConversation(session, activeId)
        .then((page) => {
          if (cancelled) {
            return;
          }
          const prev = messagesRef.current;
          /* v8 ignore next -- the poll starts only after the thread is loaded */
          if (prev === null) return;
          const fresh = page.messages.filter(
            (message) => !prev.some((row) => row.id === message.id),
          );
          setMessages((current) => {
            /* v8 ignore next -- the poll starts only after the thread is loaded */
            if (current === null) return current;
            return appendUnseenMessages(current, page.messages);
          });
          if (fresh.length === 0) return;
          void markConversationRead(session, activeId).catch(() => undefined);
          bumpUnreadAppBadgeEpoch();
          void refreshUnreadAppBadge(session, undefined, 0).catch(() => undefined);
        })
        .catch(() => undefined)
        .finally(() => {
          inFlight = false;
        });
    };
    const intervalId = setInterval(pull, CONVERSATION_LIVE_POLL_MS);
    const onVisibilityChange = (): void => {
      if (document.visibilityState === 'visible') {
        pull();
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      cancelled = true;
      clearInterval(intervalId);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [session, staff, groupId, threadLoaded, sunday]);

  if (session === null) {
    return null;
  }

  if (sunday) {
    return (
      <Card maxWidth="xl" surface={false}>
        <h1 className="text-center text-2xl font-semibold tracking-tight text-app-fg sm:text-3xl">
          {t('moderate.groupLabel')}
        </h1>
        <p className="text-center text-sm text-app-muted" data-sunday-writing="paused">
          {t('sunday.moderatorChatPaused')}
        </p>
      </Card>
    );
  }

  const heading = (
    <h1 className="text-center text-2xl font-semibold tracking-tight text-app-fg sm:text-3xl">
      {t('moderate.groupLabel')}
    </h1>
  );

  if (!staff) {
    return (
      <Card maxWidth="xl" surface={false}>
        {heading}
        <p className="text-center text-sm text-app-muted">{t('moderate.groupForbidden')}</p>
      </Card>
    );
  }

  if (error && group === null) {
    return (
      <Card maxWidth="xl" surface={false}>
        {heading}
        <p role="alert" className="text-center text-sm text-app-danger">
          {t('moderate.groupError')}
        </p>
        <Button
          type="button"
          variant="secondary"
          onClick={() => {
            setAttempt((n) => n + 1);
          }}
        >
          {t('moderate.retry')}
        </Button>
      </Card>
    );
  }

  if (group === null || messages === null) {
    return (
      <Card maxWidth="xl" surface={false}>
        {heading}
        <p className="text-center text-sm text-app-muted">{t('moderate.loading')}</p>
      </Card>
    );
  }

  const onPickFiles = (files: FileList): void => {
    const generation = ++pickGeneration.current;
    const selected = Array.from(files);
    setPreparing(true);
    void (async () => {
      const nextPhotos = photoDrafts.slice(0, 10);
      let nextError: InboxFormError = null;
      const remaining = 10 - nextPhotos.length;
      if (selected.length > remaining) {
        nextError = 'tooMany';
      }
      try {
        for (const file of selected.slice(0, Math.max(0, remaining))) {
          try {
            const result = await prepareForumPhoto(file);
            /* v8 ignore next 3 -- a newer pick replaced this generation */
            if (generation !== pickGeneration.current) {
              return;
            }
            if (result.ok) {
              nextPhotos.push(result.photo);
            } else if (nextError !== 'tooMany') {
              nextError = result.error;
            }
          } catch {
            /* v8 ignore next 3 -- a newer pick replaced this generation */
            if (generation !== pickGeneration.current) {
              return;
            }
            if (nextError !== 'tooMany') {
              nextError = 'unsupported';
            }
          }
        }
        /* v8 ignore next 3 -- a newer pick replaced this generation */
        if (generation !== pickGeneration.current) {
          return;
        }
        setPhotoDrafts(nextPhotos);
        setFormError(nextError);
      } finally {
        /* v8 ignore next 3 -- a newer pick replaced this generation */
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

  const onPost = (): void => {
    const trimmed = draft.trim();
    if (trimmed === '' && photoDrafts.length === 0) {
      setFormError('empty');
      return;
    }
    if (trimmed.length > CONTACT_MESSAGE_MAX_LENGTH) {
      setFormError('tooLong');
      return;
    }
    pickGeneration.current += 1;
    const conversationId = group.id;
    const pendingPhotos = photoDrafts;
    setPosting(true);
    setFormError(null);
    void (async () => {
      try {
        const created =
          pendingPhotos.length === 0
            ? await postConversationMessage(session, conversationId, trimmed)
            : await postConversationMessage(
                session,
                conversationId,
                trimmed,
                pendingPhotos.map((photo) => ({
                  contentType: photo.contentType,
                  data: photo.data,
                  ...(typeof photo.takenAt === 'string' && photo.takenAt !== ''
                    ? { takenAt: photo.takenAt }
                    : {}),
                })),
              );
        setMessages((prev) => {
          /* v8 ignore next -- first message in an empty staff-room thread */
          if (prev === null) return [created];
          if (prev.some((message) => message.id === created.id)) {
            return prev;
          }
          return [...prev, created];
        });
        setDraft('');
        setPhotoDrafts([]);
        if (created.hasPhoto) {
          setPhotoUrls((prev) => {
            const next = { ...prev };
            pendingPhotos.forEach((photo, index) => {
              next[`${created.id}:${index}`] = photo.previewUrl;
            });
            return next;
          });
        }
        setGroup({
          ...group,
          lastText: created.text,
          lastAt: created.createdAt,
          lastFromMe: true,
          lastSats: created.sats,
        });
      } catch {
        setFormError('request');
      } finally {
        setPosting(false);
      }
    })();
  };

  return (
    <InboxScreen
      conversations={[{ ...group, name: t('moderate.groupLabel') }]}
      error={false}
      loading={false}
      /* v8 ignore next -- list retry is unused on the open staff-room thread */
      onRetry={() => undefined}
      openId={group.id}
      /* v8 ignore next -- the staff-room thread is already open */
      onOpen={() => undefined}
      messages={messages}
      messagesLoading={false}
      messagesError={false}
      /* v8 ignore next -- thread retry is unused while messages are loaded */
      onRetryMessages={() => undefined}
      nearStartRef={nearStartRef}
      draft={draft}
      onDraftChange={(value) => {
        setDraft(value);
        setFormError(null);
      }}
      onPost={onPost}
      posting={posting || preparing}
      formError={formError}
      showFilter={false}
      showAmount={false}
      rateDay={rateDay}
      showAttach
      photoDrafts={photoDrafts}
      onPickFiles={onPickFiles}
      onRemovePhoto={onRemovePhoto}
      photoUrls={photoUrls}
    />
  );
}
