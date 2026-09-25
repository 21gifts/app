'use client';

import { MapPin } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState, type ReactElement } from 'react';
import { useFiatPreference } from '@/components/FiatPreferenceProvider';
import { ForumGoalBar } from '@/components/ForumGoalBar';
import { ForumPhotoGallery } from '@/components/ForumPhotoGallery';
import { useTranslations } from '@/components/LocaleProvider';
import { TranslatableNoteBody } from '@/components/TranslatableNoteBody';
import { ForumQuotedBody } from '@/components/QuotedForumNote';
import { useNumberFormat } from '@/components/NumberFormatProvider';
import { preferredFiatSuffix } from '@/components/PreferredFiatSuffix';
import { PublicMessageThread } from '@/components/PublicMessageThread';
import { Button, Card } from '@/components/ui';
import { useHydrateSession } from '@/hooks/useHydrateSession';
import {
  fetchForumMessage,
  fetchGiftStats,
  fetchPublicMessage,
  fetchPublicMessagePhoto,
  fetchPublicReplies,
  fetchReplies,
} from '@/lib/api';
import type { ForumMessage } from '@/lib/api-types';
import { formatForumTime } from '@/lib/forum-time';
import { forumVideoSrc } from '@/lib/forum-video';
import { roleAtLeast } from '@/lib/roles';
import { formatBitcoin, latestRateDay, type FiatCode, type FiatRateDay } from '@/lib/stats-money';
import { useAuthStore } from '@/stores/auth-store';

const MESSAGE_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function PublicThreadCard({
  note,
  highlight,
  indent,
  rateDay,
  fiat,
  knownNotes,
}: {
  note: ForumMessage;
  highlight: boolean;
  indent: boolean;
  rateDay: FiatRateDay | null;
  fiat: FiatCode;
  knownNotes: readonly ForumMessage[];
}): ReactElement {
  const { t, locale } = useTranslations();
  const { numberFormat } = useNumberFormat();
  const [photoUrls, setPhotoUrls] = useState<Record<number, string>>({});
  const [videoFailed, setVideoFailed] = useState(false);
  const photoCount = note.photoCount ?? (note.hasPhoto ? 1 : 0);

  useEffect(() => {
    if (photoCount === 0) {
      setPhotoUrls({});
      return;
    }

    let cancelled = false;
    const objectUrls: string[] = [];

    void (async () => {
      const next: Record<number, string> = {};
      for (let index = 0; index < photoCount; index += 1) {
        try {
          const blob = await fetchPublicMessagePhoto(note.id, index);
          if (cancelled) {
            return;
          }
          const objectUrl = URL.createObjectURL(blob);
          objectUrls.push(objectUrl);
          next[index] = objectUrl;
        } catch {
          // Leave only this image out when its public photo request fails.
        }
      }
      if (!cancelled) {
        setPhotoUrls(next);
      }
    })();

    return () => {
      cancelled = true;
      for (const objectUrl of objectUrls) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [note.id, photoCount]);

  const photoUrl = photoUrls[0];
  const loadedPhotoUrls = Array.from({ length: photoCount }, (_, index) => ({
    index,
    url: photoUrls[index],
  })).filter((photo): photo is { index: number; url: string } => photo.url !== undefined);
  const fiatSuffix = preferredFiatSuffix(note.sats, rateDay, fiat, numberFormat, note);

  const card = (
    <Card
      maxWidth="md"
      className={`items-stretch text-left${highlight ? ' ring-1 ring-app-fg' : ''}`}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        {note.via === 'nostr' ? (
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-app-fg">{note.name}</span>
            <span className="rounded-full border border-app-border-strong px-2 py-0.5 text-xs font-medium text-app-muted">
              {t('forum.via.nostr')}
            </span>
          </span>
        ) : (
          <span className="text-sm font-medium text-app-fg">{note.name}</span>
        )}
        <time dateTime={note.createdAt} className="text-xs text-app-subtle">
          {formatForumTime(note.createdAt, locale)}
        </time>
      </div>
      {note.hasVideo && !videoFailed ? (
        <video
          src={forumVideoSrc(note.id, note.videoContentType)}
          poster={photoUrl ?? undefined}
          controls
          playsInline
          preload="metadata"
          className="mx-auto block h-auto w-auto max-h-80 max-w-full rounded-xl object-contain"
          onError={() => {
            setVideoFailed(true);
          }}
        />
      ) : photoCount <= 1 && photoUrl !== undefined ? (
        /* eslint-disable-next-line @next/next/no-img-element -- blob URL from fetchPublicMessagePhoto */
        <img
          src={photoUrl}
          alt={t('forum.photoAlt', { name: note.name })}
          className="max-h-80 w-full rounded-xl object-contain"
        />
      ) : photoCount > 1 && loadedPhotoUrls.length > 0 ? (
        <ForumPhotoGallery
          photos={loadedPhotoUrls}
          alt={t('forum.photoAlt', { name: note.name })}
        />
      ) : null}
      {note.text !== '' ? (
        note.via === 'nostr' ? (
          <TranslatableNoteBody
            messageId={note.id}
            plain
            text={note.text}
            truncate={false}
            className="whitespace-pre-wrap text-sm text-app-fg"
          />
        ) : (
          <ForumQuotedBody
            text={note.text}
            knownNotes={knownNotes}
            excludeId={note.id}
            rateDay={rateDay}
            fiat={fiat}
            truncate={false}
          />
        )
      ) : null}
      {note.parentId === undefined && note.place !== undefined ? (
        <Link
          href={`/map?pin=${encodeURIComponent(note.id)}`}
          className="mt-2 inline-flex items-center gap-1 text-sm text-app-fg underline"
        >
          <MapPin aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
          {note.place.label ?? `${note.place.lat.toFixed(5)}, ${note.place.lng.toFixed(5)}`}
        </Link>
      ) : null}
      <p
        className={
          fiatSuffix === null
            ? 'text-sm font-medium text-app-fg'
            : 'text-sm font-medium tabular-nums lining-nums text-app-fg'
        }
      >
        {formatBitcoin(note.sats, numberFormat)}
        {fiatSuffix}
      </p>
      {note.parentId === undefined && typeof note.goalSats === 'number' && note.goalSats > 0 ? (
        <ForumGoalBar sats={note.sats} goalSats={note.goalSats} rateDay={rateDay} />
      ) : null}
    </Card>
  );

  if (!indent) {
    return card;
  }

  return (
    <div
      className="w-full max-w-md pl-4"
      {...(highlight ? { 'data-permalink-target': 'true' } : {})}
    >
      {card}
    </div>
  );
}

/**
 * Client loader for `/messages/[id]`: validates the UUID, waits for session
 * hydrate, then fetches the note. Staff (moderator/founder) use bearer
 * {@link fetchForumMessage} / {@link fetchReplies} so a soft-hidden row can
 * load with a hide notice; everyone else uses the public fetch (404 → missing).
 * Opening a reply UUID still shows the parent thread. Unsigned visitors keep
 * the read-only cards. When hydrate is ready and both session and account are
 * set, mounts {@link PublicMessageThread} (`ForumBoard` with `composerHidden`)
 * so copy, reply, Gift on a payable nested reply, and staff delete work.
 * Passes optional `seedReply` when the highlighted row is a hidden reply. No
 * OnboardingGate, top-level composer, or envelope.
 *
 * @param props - Dynamic route `id`.
 * @returns Loading, missing, error, unsigned cards, or the signed-in thread.
 */
export function PublicMessageLoader({ id }: { id: string }): ReactElement {
  const { t, locale } = useTranslations();
  const { fiat } = useFiatPreference();
  const { ready } = useHydrateSession();
  const session = useAuthStore((state) => state.session);
  const account = useAuthStore((state) => state.account);
  const [status, setStatus] = useState<'loading' | 'missing' | 'error' | 'ready'>(() =>
    MESSAGE_ID_RE.test(id) ? 'loading' : 'missing',
  );
  const [root, setRoot] = useState<ForumMessage | null>(null);
  const [replies, setReplies] = useState<ForumMessage[]>([]);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [rateDay, setRateDay] = useState<FiatRateDay | null>(null);

  useEffect(() => {
    if (!MESSAGE_ID_RE.test(id)) {
      setStatus('missing');
      setRoot(null);
      setReplies([]);
      setHighlightId(null);
      return;
    }

    if (!ready) {
      return;
    }

    let cancelled = false;
    setStatus('loading');
    setRoot(null);
    setReplies([]);
    setHighlightId(null);

    const staff = session !== null && roleAtLeast(account?.role, 'moderator');
    const loadNote =
      staff && session
        ? (noteId: string) => fetchForumMessage(session, noteId)
        : fetchPublicMessage;
    const loadReplies =
      staff && session ? (rootId: string) => fetchReplies(session, rootId) : fetchPublicReplies;

    void (async () => {
      try {
        const next = await loadNote(id);
        if (cancelled) {
          return;
        }
        if (next === null) {
          setStatus('missing');
          return;
        }
        let rootNote = next;
        if (next.parentId !== undefined && next.parentId !== '') {
          const parent = await loadNote(next.parentId);
          if (cancelled) {
            return;
          }
          if (parent === null) {
            setStatus('missing');
            return;
          }
          rootNote = parent;
        }
        const nextReplies = await loadReplies(rootNote.id);
        if (cancelled) {
          return;
        }
        const highlight = next.parentId !== undefined && next.parentId !== '' ? id : null;
        const replies =
          highlight !== null &&
          next.deletedAt !== undefined &&
          !nextReplies.some((row) => row.id === next.id)
            ? [...nextReplies, next]
            : nextReplies;
        setRoot(rootNote);
        setReplies(replies);
        setHighlightId(highlight);
        setStatus('ready');
      } catch {
        if (!cancelled) {
          setStatus('error');
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [id, attempt, ready, session, account?.role]);

  useEffect(() => {
    if (!MESSAGE_ID_RE.test(id)) {
      return;
    }
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
  }, [id]);

  if (status === 'missing') {
    return <p className="text-center text-sm text-app-muted">{t('view.missing')}</p>;
  }

  if (status === 'error') {
    return (
      <div className="flex flex-col items-center gap-4">
        <p role="alert" className="text-center text-sm text-app-danger">
          {t('view.error')}
        </p>
        <Button
          type="button"
          onClick={() => {
            setAttempt((n) => n + 1);
          }}
        >
          {t('view.retry')}
        </Button>
      </div>
    );
  }

  if (root === null) {
    return <p className="text-center text-sm text-app-muted">{t('forum.loading')}</p>;
  }

  const signedInThread = ready && session !== null && account !== null;
  const seedReply =
    highlightId !== null
      ? replies.find((row) => row.id === highlightId && row.deletedAt !== undefined)
      : undefined;
  const highlighted =
    highlightId !== null ? replies.find((reply) => reply.id === highlightId) : undefined;
  const hiddenNoticeSource =
    root.deletedAt !== undefined && root.deletedBy !== undefined
      ? root
      : highlighted !== undefined &&
          highlighted.deletedAt !== undefined &&
          highlighted.deletedBy !== undefined
        ? highlighted
        : null;

  return (
    <div className="flex w-full flex-col items-center gap-4">
      {hiddenNoticeSource !== null &&
      hiddenNoticeSource.deletedAt !== undefined &&
      hiddenNoticeSource.deletedBy !== undefined ? (
        <p role="status" className="text-center text-sm text-app-muted">
          {t('forum.hiddenNotice', {
            name: hiddenNoticeSource.deletedBy.name ?? t('moderate.unnamed'),
            time: formatForumTime(hiddenNoticeSource.deletedAt, locale),
          })}
        </p>
      ) : null}
      {signedInThread ? (
        <PublicMessageThread
          root={root}
          highlightId={highlightId}
          {...(seedReply !== undefined ? { seedReply } : {})}
          onRootDeleted={() => {
            setStatus('missing');
            setRoot(null);
            setReplies([]);
          }}
        />
      ) : (
        <>
          <PublicThreadCard
            note={root}
            highlight={false}
            indent={false}
            rateDay={rateDay}
            fiat={fiat}
            knownNotes={[root, ...replies]}
          />
          {replies.map((reply) => (
            <PublicThreadCard
              key={reply.id}
              note={reply}
              highlight={highlightId === reply.id}
              indent
              rateDay={rateDay}
              fiat={fiat}
              knownNotes={[root, ...replies]}
            />
          ))}
        </>
      )}
      {ready ? (
        account === null ? (
          <Link
            href="/login"
            className="text-sm font-medium text-app-fg underline underline-offset-2"
          >
            {t('login.submit')}
          </Link>
        ) : (
          <Link
            href="/welcome"
            className="text-sm font-medium text-app-fg underline underline-offset-2"
          >
            {t('profile.back')}
          </Link>
        )
      ) : (
        <p className="text-center text-sm text-app-muted">{t('forum.loading')}</p>
      )}
    </div>
  );
}
