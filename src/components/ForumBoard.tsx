'use client';

import { Loader2 } from 'lucide-react';
import { type FormEvent, type ReactElement } from 'react';
import { useTranslations } from '@/components/LocaleProvider';
import type { ForumMessage } from '@/lib/api-types';
import { formatForumTime } from '@/lib/forum-time';

/** Props for {@link ForumBoard}. */
export interface ForumBoardProps {
  /** Loaded messages newest-first, or `null` before the first successful load. */
  messages: ForumMessage[] | null;
  /** True when the latest fetch failed. Copy comes from `forum.error`. */
  error: boolean;
  /** True while a fetch is in flight. */
  loading: boolean;
  /** True while a post is in flight. */
  posting: boolean;
  /** Composer draft text. */
  draft: string;
  /** Called when the composer value changes. */
  onDraftChange: (value: string) => void;
  /** Called when the composer form is submitted. */
  onPost: () => void;
  /** Retry handler for a failed fetch. */
  onRetry: () => void;
  /** Client-side composer validation or request failure. */
  formError: 'empty' | 'request' | null;
}

/**
 * Presentational public forum: heading, list or empty/loading/error, and composer.
 *
 * Always shows the heading and composer so validation errors can surface even
 * when the list is empty. Light neutral palette to match {@link WelcomeScreen}.
 *
 * @param props - Messages payload plus loading/error/composer state.
 * @returns The forum board element.
 */
export function ForumBoard({
  messages,
  error,
  loading,
  posting,
  draft,
  onDraftChange,
  onPost,
  onRetry,
  formError,
}: ForumBoardProps): ReactElement {
  const { t, locale } = useTranslations();

  const handleSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    onPost();
  };

  let middle: ReactElement;
  if (loading && messages === null) {
    middle = <p className="text-center text-sm text-neutral-500">{t('forum.loading')}</p>;
  } else if (error && messages === null) {
    middle = (
      <div className="flex flex-col items-center gap-3">
        <p className="text-center text-sm text-neutral-700">{t('forum.error')}</p>
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex items-center rounded-full border border-neutral-300 px-5 py-2 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50"
        >
          {t('forum.retry')}
        </button>
      </div>
    );
  } else if (messages !== null && messages.length === 0) {
    middle = <p className="text-center text-sm text-neutral-500">{t('forum.empty')}</p>;
  } else if (messages !== null) {
    middle = (
      <ul aria-label={t('forum.listLabel')} className="flex flex-col gap-4">
        {messages.map((message) => (
          <li
            key={message.id}
            className="rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="text-sm font-medium text-neutral-900">{message.name}</span>
              <time dateTime={message.createdAt} className="text-xs text-neutral-400">
                {formatForumTime(message.createdAt, locale)}
              </time>
            </div>
            <p className="mt-2 whitespace-pre-wrap text-sm text-neutral-700">{message.text}</p>
          </li>
        ))}
      </ul>
    );
  } else {
    middle = <p className="text-center text-sm text-neutral-500">{t('forum.loading')}</p>;
  }

  return (
    <div className="flex w-full flex-col gap-4 border-t border-neutral-200 pt-6">
      <h2 className="text-center text-lg font-semibold tracking-tight text-neutral-900">
        {t('forum.heading')}
      </h2>
      <p className="text-center text-sm text-neutral-500">{t('forum.lead')}</p>

      {middle}

      <form onSubmit={handleSubmit} className="flex flex-col items-stretch gap-3">
        <textarea
          aria-label={t('forum.composerLabel')}
          placeholder={t('forum.placeholder')}
          value={draft}
          onChange={(event) => onDraftChange(event.target.value)}
          rows={3}
          disabled={posting}
          className="w-full resize-y rounded-2xl border border-neutral-300 px-4 py-3 text-sm text-neutral-900 outline-none transition focus:border-neutral-500 disabled:opacity-50"
        />
        <div className="flex items-center justify-center">
          <button
            type="submit"
            disabled={posting}
            className="inline-flex items-center gap-2 rounded-full bg-neutral-900 px-5 py-2 text-sm font-medium text-white transition hover:bg-neutral-700 disabled:opacity-50"
          >
            {posting ? <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> : null}
            {t('forum.post')}
          </button>
        </div>
      </form>

      {formError === 'empty' ? (
        <p role="alert" className="text-center text-sm text-red-600">
          {t('forum.errorEmpty')}
        </p>
      ) : null}
      {formError === 'request' ? (
        <p role="alert" className="text-center text-sm text-red-600">
          {t('forum.errorRequest')}
        </p>
      ) : null}
    </div>
  );
}
