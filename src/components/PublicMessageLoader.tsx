'use client';

import Link from 'next/link';
import { useEffect, useState, type ReactElement } from 'react';
import { useTranslations } from '@/components/LocaleProvider';
import { Button, Card } from '@/components/ui';
import { useHydrateSession } from '@/hooks/useHydrateSession';
import { fetchPublicMessage, fetchPublicMessagePhoto } from '@/lib/api';
import type { ForumMessage } from '@/lib/api-types';
import { formatForumTime } from '@/lib/forum-time';
import { forumVideoSrc } from '@/lib/forum-video';
import { formatBitcoin } from '@/lib/stats-money';
import { useAuthStore } from '@/stores/auth-store';

const MESSAGE_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Client loader for `/messages/[id]`: validates the UUID, fetches the public
 * note (and optional photo blob), and shows a Log in / Back to the forum link
 * from session hydrate state. No pay sheet, no composer, no copy control.
 *
 * @param props - Dynamic route `id`.
 * @returns Loading, missing, error, or the read-only note card.
 */
export function PublicMessageLoader({ id }: { id: string }): ReactElement {
  const { t, locale } = useTranslations();
  const { ready } = useHydrateSession();
  const account = useAuthStore((state) => state.account);
  const [status, setStatus] = useState<'loading' | 'missing' | 'error' | 'ready'>(() =>
    MESSAGE_ID_RE.test(id) ? 'loading' : 'missing',
  );
  const [message, setMessage] = useState<ForumMessage | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [videoFailed, setVideoFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!MESSAGE_ID_RE.test(id)) {
      setStatus('missing');
      setMessage(null);
      return;
    }

    let cancelled = false;
    setStatus('loading');
    setMessage(null);
    setVideoFailed(false);

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
        setMessage(next);
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
    if (message === null || !message.hasPhoto) {
      setPhotoUrl(null);
      return;
    }

    let cancelled = false;
    let objectUrl: string | null = null;

    void (async () => {
      try {
        const blob = await fetchPublicMessagePhoto(message.id);
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
  }, [message]);

  if (status === 'loading') {
    return <p className="text-center text-sm text-app-muted">{t('forum.loading')}</p>;
  }

  if (status === 'missing') {
    return <p className="text-center text-sm text-app-muted">{t('view.missing')}</p>;
  }

  if (status === 'error') {
    return (
      <div className="flex flex-col items-center gap-4">
        <p className="text-center text-sm text-app-muted">{t('view.error')}</p>
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

  const note = message as ForumMessage;

  return (
    <div className="flex w-full flex-col items-center gap-4">
      <Card maxWidth="md" className="items-stretch text-left">
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
            className="mx-auto block h-auto w-auto max-h-80 max-w-full rounded-2xl object-contain"
            onError={() => {
              setVideoFailed(true);
            }}
          />
        ) : photoUrl !== null ? (
          /* eslint-disable-next-line @next/next/no-img-element -- blob URL from fetchPublicMessagePhoto */
          <img
            src={photoUrl}
            alt={t('forum.photoAlt', { name: note.name })}
            className="max-h-80 w-full rounded-2xl object-contain"
          />
        ) : null}
        {note.text !== '' ? (
          <p className="whitespace-pre-wrap text-sm text-app-fg">{note.text}</p>
        ) : null}
        <p className="text-sm font-medium text-app-fg">{formatBitcoin(note.sats, locale)}</p>
      </Card>
      {ready ? (
        account === null ? (
          <Link href="/login" className="text-sm font-medium text-app-fg underline">
            {t('login.submit')}
          </Link>
        ) : (
          <Link href="/welcome" className="text-sm font-medium text-app-fg underline">
            {t('profile.back')}
          </Link>
        )
      ) : (
        <p className="text-center text-sm text-app-muted">{t('forum.loading')}</p>
      )}
    </div>
  );
}
