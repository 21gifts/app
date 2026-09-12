'use client';

import { type ReactElement } from 'react';
import { useTranslations } from '@/components/LocaleProvider';
import { Button, Card } from '@/components/ui';
import type { Notification } from '@/lib/api-types';
import { formatForumTime } from '@/lib/forum-time';

/** Props for {@link NotificationsScreen}. */
export interface NotificationsScreenProps {
  /** Loaded rows newest-first, or `null` before the first successful load. */
  notifications: Notification[] | null;
  /** True when the latest list fetch failed. */
  error: boolean;
  /** True while a list fetch is in flight. */
  loading: boolean;
  /** Retry handler for a failed list fetch. */
  onRetry: () => void;
  /** Opens the public forum note for a notification row. */
  onOpen: (parentId: string, id: string) => void;
}

/**
 * Presentational signed-in notifications list of forum replies to the
 * session's posts. There is no composer and no thread view.
 *
 * @param props - List state from {@link NotificationsLoader}.
 * @returns The notifications card.
 */
export function NotificationsScreen({
  notifications,
  error,
  loading,
  onRetry,
  onOpen,
}: NotificationsScreenProps): ReactElement {
  const { t, locale } = useTranslations();

  let body: ReactElement;
  if (loading && notifications === null) {
    body = (
      <>
        <h1 className="text-center text-2xl font-semibold tracking-tight text-app-fg sm:text-3xl">
          {t('notifications.heading')}
        </h1>
        <p className="text-center text-sm text-app-muted">{t('notifications.loading')}</p>
      </>
    );
  } else if (error && notifications === null) {
    body = (
      <>
        <h1 className="text-center text-2xl font-semibold tracking-tight text-app-fg sm:text-3xl">
          {t('notifications.heading')}
        </h1>
        <p className="text-center text-sm text-app-fg">{t('notifications.error')}</p>
        <Button type="button" variant="secondary" onClick={onRetry}>
          {t('notifications.retry')}
        </Button>
      </>
    );
  } else if (notifications === null || notifications.length === 0) {
    body = (
      <>
        <h1 className="text-center text-2xl font-semibold tracking-tight text-app-fg sm:text-3xl">
          {t('notifications.heading')}
        </h1>
        <p className="text-center text-sm text-app-muted">{t('notifications.empty')}</p>
      </>
    );
  } else {
    body = (
      <>
        <h1 className="text-center text-2xl font-semibold tracking-tight text-app-fg sm:text-3xl">
          {t('notifications.heading')}
        </h1>
        <ul aria-label={t('notifications.listLabel')} className="flex w-full flex-col gap-3">
          {notifications.map((row) => {
            const unread = row.readAt === null;
            return (
              <li key={row.id}>
                <button
                  type="button"
                  onClick={() => {
                    onOpen(row.parentId, row.id);
                  }}
                  className="flex w-full flex-col items-start gap-1 rounded-2xl border border-app-border bg-app-card-muted px-4 py-3 text-left transition hover:bg-app-hover"
                >
                  <span className="flex w-full items-baseline justify-between gap-2">
                    <span
                      className={
                        unread
                          ? 'text-sm font-semibold text-app-fg'
                          : 'text-sm font-medium text-app-fg'
                      }
                    >
                      {t('notifications.reply', { name: row.name })}
                    </span>
                    <time dateTime={row.createdAt} className="text-xs text-app-subtle">
                      {formatForumTime(row.createdAt, locale)}
                    </time>
                  </span>
                  <span
                    className={
                      unread ? 'text-sm font-semibold text-app-fg' : 'text-sm text-app-muted'
                    }
                  >
                    {row.text !== '' ? row.text : t('notifications.photoOnly')}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </>
    );
  }

  return <Card maxWidth="xl">{body}</Card>;
}
