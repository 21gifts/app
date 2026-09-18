'use client';

import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState, type ReactElement } from 'react';
import { useTranslations } from '@/components/LocaleProvider';
import { Button, Card } from '@/components/ui';
import { listHiddenMessages } from '@/lib/api';
import type { HiddenMessage } from '@/lib/api-types';
import { formatForumTime } from '@/lib/forum-time';
import { useAuthStore } from '@/stores/auth-store';

/**
 * True when `role` may use the hide tool and the hidden-notes list.
 *
 * @param role - Account role, or `undefined` when the account is missing.
 * @returns Whether the visitor is a founder or moderator.
 */
function isStaffRole(role: string | undefined): boolean {
  return role === 'founder' || role === 'moderator';
}

/**
 * Signed-in list of hidden living-room notes.
 *
 * Founders and moderators see the hide-tool copy and the hidden-note list
 * (newest-hidden first). Other signed-in visitors see a short forbidden
 * message and no list. Fetches {@link listHiddenMessages} itself. Renders
 * nothing without a session. In-card back goes to the moderation hub.
 *
 * @returns The hidden-notes card, forbidden copy, or `null` without a session.
 */
export function HiddenNotesScreen(): ReactElement | null {
  const { t, locale } = useTranslations();
  const session = useAuthStore((state) => state.session);
  const account = useAuthStore((state) => state.account);
  const staff = isStaffRole(account?.role);
  const [messages, setMessages] = useState<HiddenMessage[] | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (session === null || !staff) {
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(false);
    void (async () => {
      try {
        const next = await listHiddenMessages(session);
        if (cancelled) {
          return;
        }
        setMessages(next);
      } catch {
        if (cancelled) {
          return;
        }
        setMessages(null);
        setError(true);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [session, staff, attempt]);

  if (session === null) {
    return null;
  }

  const heading = (
    <div className="flex w-full items-center gap-2">
      <Link
        href="/moderate"
        aria-label={t('moderate.heading')}
        className="inline-flex h-11 w-11 items-center justify-center rounded-full text-app-muted transition hover:bg-app-hover hover:text-app-fg"
      >
        <ArrowLeft aria-hidden="true" className="h-5 w-5" />
      </Link>
      <div className="min-w-0 flex-1">
        <h1 className="text-center text-2xl font-semibold tracking-tight text-app-fg sm:text-3xl">
          {t('moderate.listLabel')}
        </h1>
      </div>
    </div>
  );

  if (!staff) {
    return (
      <Card maxWidth="xl">
        {heading}
        <p className="text-center text-sm text-app-muted">{t('moderate.forbidden')}</p>
      </Card>
    );
  }

  let body: ReactElement;
  if (loading && messages === null) {
    body = <p className="text-center text-sm text-app-muted">{t('moderate.loading')}</p>;
  } else if (error && messages === null) {
    body = (
      <>
        <p role="alert" className="text-center text-sm text-app-danger">
          {t('moderate.error')}
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
      </>
    );
  } else if (messages === null || messages.length === 0) {
    body = <p className="text-center text-sm text-app-muted">{t('moderate.empty')}</p>;
  } else {
    body = (
      <ul aria-label={t('moderate.listLabel')} className="flex w-full flex-col gap-3">
        {messages.map((row) => (
          <li key={row.id}>
            <div className="flex w-full flex-col items-start gap-1 rounded-2xl border border-app-border bg-app-card-muted px-4 py-3">
              <span className="flex w-full items-baseline justify-between gap-2">
                {row.via !== undefined ? (
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-app-fg">
                      {row.name !== '' ? row.name : t('moderate.unnamed')}
                    </span>
                    <span className="rounded-full border border-app-border-strong px-2 py-0.5 text-xs font-medium text-app-muted">
                      {t('forum.via.nostr')}
                    </span>
                  </span>
                ) : (
                  <span className="text-sm font-medium text-app-fg">
                    {row.name !== '' ? row.name : t('moderate.unnamed')}
                  </span>
                )}
                <time dateTime={row.createdAt} className="text-xs text-app-subtle">
                  {formatForumTime(row.createdAt, locale)}
                </time>
              </span>
              {row.text !== '' ? <span className="text-sm text-app-muted">{row.text}</span> : null}
              <span className="flex w-full items-baseline justify-between gap-2">
                <span className="text-sm text-app-muted">
                  {t('moderate.hiddenBy', {
                    name: row.deletedBy.name ?? t('moderate.unnamed'),
                  })}
                </span>
                <time dateTime={row.deletedAt} className="text-xs text-app-subtle">
                  {formatForumTime(row.deletedAt, locale)}
                </time>
              </span>
            </div>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <Card maxWidth="xl">
      {heading}
      <p className="text-center text-sm text-app-muted">{t('moderate.lead')}</p>
      {body}
    </Card>
  );
}
