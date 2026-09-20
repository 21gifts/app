'use client';

import { useEffect, useRef, useState, type ReactElement } from 'react';
import { InboxScreen, type InboxFormError } from '@/components/InboxScreen';
import { useTranslations } from '@/components/LocaleProvider';
import { Button, Card } from '@/components/ui';
import { useLatestRateDay } from '@/hooks/useLatestRateDay';
import {
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
 * Passes `rateDay` from {@link useLatestRateDay} into {@link InboxScreen}.
 * After a successful group and thread fetch, marks the room read
 * (`markConversationRead`), bumps the badge epoch, and refreshes the
 * home-screen badge with staff-room unread `0`. Other signed-in visitors
 * and a missing account see forbidden copy and do not fetch. Renders
 * nothing without a session. Back to the moderation hub is the page
 * chrome (no in-card back).
 *
 * @returns The group thread, forbidden copy, or `null` without a session.
 */
export function ModeratorGroupScreen(): ReactElement | null {
  const { t } = useTranslations();
  const session = useAuthStore((state) => state.session);
  const account = useAuthStore((state) => state.account);
  const staff = roleAtLeast(account?.role, 'moderator');
  const rateDay = useLatestRateDay();
  const [group, setGroup] = useState<Conversation | null>(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [messages, setMessages] = useState<ConversationMessage[] | null>(null);
  const [draft, setDraft] = useState('');
  const [posting, setPosting] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [formError, setFormError] = useState<InboxFormError>(null);
  const [photoDrafts, setPhotoDrafts] = useState<ForumPhotoPayload[]>([]);
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});
  const photoUrlsRef = useRef(photoUrls);
  photoUrlsRef.current = photoUrls;
  const pickGeneration = useRef(0);

  useEffect(() => {
    if (session === null || !staff) {
      return;
    }
    let cancelled = false;
    setError(false);
    void (async () => {
      try {
        const nextGroup = await fetchModeratorGroup(session);
        if (cancelled) {
          return;
        }
        const nextMessages = await fetchConversation(session, nextGroup.id);
        if (cancelled) {
          return;
        }
        setGroup({ ...nextGroup, unread: false });
        setMessages(nextMessages);
        void markConversationRead(session, nextGroup.id).catch(() => undefined);
        bumpUnreadAppBadgeEpoch();
        void refreshUnreadAppBadge(session, undefined, 0).catch(() => undefined);
      } catch {
        if (cancelled) {
          return;
        }
        setGroup(null);
        setMessages(null);
        setError(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [session, staff, attempt]);

  useEffect(() => {
    if (session === null || !staff || messages === null || group === null) {
      return;
    }
    const conversationId = group.id;
    let cancelled = false;
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

  if (session === null) {
    return null;
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
                })),
              );
        setMessages([...messages, created]);
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
