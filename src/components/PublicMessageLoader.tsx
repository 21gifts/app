'use client';

import Link from 'next/link';
import { useEffect, useState, type ReactElement } from 'react';
import { useFiatPreference } from '@/components/FiatPreferenceProvider';
import { useTranslations } from '@/components/LocaleProvider';
import { ForumQuotedBody } from '@/components/QuotedForumNote';
import { useNumberFormat } from '@/components/NumberFormatProvider';
import { Button, Card } from '@/components/ui';
import { useHydrateSession } from '@/hooks/useHydrateSession';
import {
  fetchGiftStats,
  fetchPublicMessage,
  fetchPublicMessagePhoto,
  fetchPublicReplies,
} from '@/lib/api';
import type { ForumMessage } from '@/lib/api-types';
import { formatForumTime } from '@/lib/forum-time';
import { forumVideoSrc } from '@/lib/forum-video';
import {
  formatBitcoin,
  formatFiatDisplay,
  latestRateDay,
  satsToFiatAmount,
  type FiatCode,
  type FiatRateDay,
} from '@/lib/stats-money';
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
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [videoFailed, setVideoFailed] = useState(false);

  useEffect(() => {
    if (!note.hasPhoto) {
      setPhotoUrl(null);
      return;
    }

    let cancelled = false;
    let objectUrl: string | null = null;

    void (async () => {
      try {
        const blob = await fetchPublicMessagePhoto(note.id);
        if (cancelled) {
          return;
        }
        objectUrl = URL.createObjectURL(blob);
        setPhotoUrl(objectUrl);
      } catch {
        if (!cancelled) {
          setPhotoUrl(null);
        }
      }
    })();

    return () => {
      cancelled = true;
      if (objectUrl !== null) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [note.hasPhoto, note.id]);

  const card = (
    <Card
      maxWidth="md"
      chrome={false}
      className={`items-stretch text-left${highlight ? ' ring-1 ring-app-fg' : ''}`}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-sm font-medium text-app-fg">{note.name}</span>
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
      ) : photoUrl !== null ? (
        /* eslint-disable-next-line @next/next/no-img-element -- blob URL from fetchPublicMessagePhoto */
        <img
          src={photoUrl}
          alt={t('forum.photoAlt', { name: note.name })}
          className="max-h-80 w-full rounded-xl object-contain"
        />
      ) : null}
      {note.text !== '' ? (
        <ForumQuotedBody
          text={note.text}
          knownNotes={knownNotes}
          excludeId={note.id}
          rateDay={rateDay}
          fiat={fiat}
        />
      ) : null}
      <p
        className={
          rateDay === null || satsToFiatAmount(note.sats, rateDay, fiat) === null
            ? 'text-sm font-medium text-app-fg'
            : 'text-sm font-medium tabular-nums lining-nums text-app-fg'
        }
      >
        {formatBitcoin(note.sats, numberFormat)}
        {rateDay !== null && satsToFiatAmount(note.sats, rateDay, fiat) !== null ? (
          <>
            <span aria-hidden="true"> · </span>
            <span>
              {formatFiatDisplay(satsToFiatAmount(note.sats, rateDay, fiat), fiat, numberFormat)}
            </span>
          </>
        ) : null}
      </p>
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
 * Client loader for `/messages/[id]`: validates the UUID, fetches the public
 * parent and live replies (and optional photo blobs), and shows a Log in /
 * Back to the forum link from session hydrate state. Opening a reply UUID
 * still shows the parent thread. No pay sheet, no composer, no copy control.
 *
 * @param props - Dynamic route `id`.
 * @returns Loading, missing, error, or the read-only thread cards.
 */
export function PublicMessageLoader({ id }: { id: string }): ReactElement {
  const { t } = useTranslations();
  const { fiat } = useFiatPreference();
  const { ready } = useHydrateSession();
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

    let cancelled = false;
    setStatus('loading');
    setRoot(null);
    setReplies([]);
    setHighlightId(null);

    void (async () => {
      try {
        const next = await fetchPublicMessage(id);
        if (cancelled) {
          return;
        }
        if (next === null) {
          setStatus('missing');
          return;
        }
        let rootNote = next;
        if (next.parentId !== undefined && next.parentId !== '') {
          const parent = await fetchPublicMessage(next.parentId);
          if (cancelled) {
            return;
          }
          if (parent === null) {
            setStatus('missing');
            return;
          }
          rootNote = parent;
        }
        const nextReplies = await fetchPublicReplies(rootNote.id);
        if (cancelled) {
          return;
        }
        setRoot(rootNote);
        setReplies(nextReplies);
        setHighlightId(next.parentId !== undefined && next.parentId !== '' ? id : null);
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
  }, [id, attempt]);

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

  return (
    <div className="flex w-full flex-col items-center gap-4">
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
