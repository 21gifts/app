'use client';

import { ArrowLeft, Loader2, Send } from 'lucide-react';
import { type FormEvent, type ReactElement } from 'react';
import { useTranslations } from '@/components/LocaleProvider';
import { Button, Card, IconButton } from '@/components/ui';
import {
  CONTACT_MESSAGE_MAX_LENGTH,
  type Conversation,
  type ConversationMessage,
} from '@/lib/api-types';
import { formatForumTime } from '@/lib/forum-time';

/** Client-side composer validation or request failure. */
export type InboxFormError = 'empty' | 'tooLong' | 'request' | null;

/** Props for {@link InboxScreen}. */
export interface InboxScreenProps {
  /** Loaded threads newest-last-message first, or `null` before the first successful load. */
  conversations: Conversation[] | null;
  /** True when the latest list fetch failed. */
  error: boolean;
  /** True while a list fetch is in flight. */
  loading: boolean;
  /** Retry handler for a failed list fetch. */
  onRetry: () => void;
  /** Open conversation id, or `null` for the thread list. */
  openId: string | null;
  /** Opens a thread from the list. */
  onOpen: (id: string) => void;
  /** Returns to the thread list. */
  onBack: () => void;
  /** Messages for the open thread (oldest-first), or `null` when not ready. */
  messages: ConversationMessage[] | null;
  /** True while messages are loading for the open thread. */
  messagesLoading: boolean;
  /** True when the latest thread fetch failed. */
  messagesError: boolean;
  /** Retry handler for a failed thread fetch. */
  onRetryMessages: () => void;
  /** Composer draft text. */
  draft: string;
  /** Called when the composer value changes. */
  onDraftChange: (value: string) => void;
  /** Called when the composer form is submitted. */
  onPost: () => void;
  /** True while a reply is in flight. */
  posting: boolean;
  /** Client-side composer validation or request failure. */
  formError: InboxFormError;
}

/**
 * Presentational signed-in inbox: conversation list or one open thread with
 * a 500-character composer.
 *
 * @param props - List/thread/composer state from {@link InboxLoader}.
 * @returns The inbox card.
 */
export function InboxScreen({
  conversations,
  error,
  loading,
  onRetry,
  openId,
  onOpen,
  onBack,
  messages,
  messagesLoading,
  messagesError,
  onRetryMessages,
  draft,
  onDraftChange,
  onPost,
  posting,
  formError,
}: InboxScreenProps): ReactElement {
  const { t, locale } = useTranslations();

  const handleSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    onPost();
  };

  const open =
    openId === null || conversations === null
      ? null
      : (conversations.find((row) => row.id === openId) ?? null);

  let body: ReactElement;
  if (openId !== null) {
    body = (
      <div className="flex w-full flex-col gap-4">
        <div className="flex w-full items-center gap-2">
          <IconButton
            type="button"
            size="sm"
            variant="ghost"
            aria-label={t('inbox.back')}
            onClick={onBack}
          >
            <ArrowLeft aria-hidden="true" className="h-4 w-4" />
          </IconButton>
          <h1 className="text-center text-2xl font-semibold tracking-tight text-app-fg">
            {open?.name ?? t('inbox.heading')}
          </h1>
        </div>
        {messagesLoading && messages === null ? (
          <p className="text-center text-sm text-app-muted">{t('inbox.loading')}</p>
        ) : null}
        {messagesError && messages === null ? (
          <div className="flex flex-col items-center gap-3">
            <p className="text-center text-sm text-app-fg">{t('inbox.error')}</p>
            <Button type="button" variant="secondary" onClick={onRetryMessages}>
              {t('inbox.retry')}
            </Button>
          </div>
        ) : null}
        {messages !== null ? (
          <ul aria-label={t('inbox.threadLabel')} className="flex w-full flex-col gap-3">
            {messages.map((message) => (
              <li
                key={message.id}
                data-message-id={message.id}
                className="rounded-2xl border border-app-border bg-app-card-muted px-4 py-3"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="text-sm font-medium text-app-fg">{message.name}</span>
                  <time dateTime={message.createdAt} className="text-xs text-app-subtle">
                    {formatForumTime(message.createdAt, locale)}
                  </time>
                </div>
                <p className="mt-2 whitespace-pre-wrap text-sm text-app-fg">{message.text}</p>
              </li>
            ))}
          </ul>
        ) : null}
        <form onSubmit={handleSubmit} className="flex w-full items-end gap-2">
          <textarea
            aria-label={t('inbox.composerLabel')}
            placeholder={t('inbox.placeholder')}
            value={draft}
            onChange={(event) => onDraftChange(event.target.value)}
            maxLength={CONTACT_MESSAGE_MAX_LENGTH}
            rows={2}
            disabled={posting || messagesLoading}
            className="min-h-11 min-w-0 flex-1 resize-none rounded-2xl border border-app-border-strong px-4 py-2.5 text-sm text-app-fg outline-none transition focus:border-app-border-strong disabled:opacity-50"
          />
          <IconButton
            type="submit"
            size="lg"
            variant="primary"
            disabled={posting || messagesLoading}
            aria-label={t('inbox.send')}
          >
            {posting ? (
              <Loader2 aria-hidden="true" className="block h-5 w-5 shrink-0 animate-spin" />
            ) : (
              <Send aria-hidden="true" className="block h-5 w-5 shrink-0" />
            )}
          </IconButton>
        </form>
        {formError === 'empty' ? (
          <p role="alert" className="text-center text-sm text-app-danger">
            {t('inbox.errorEmpty')}
          </p>
        ) : null}
        {formError === 'tooLong' ? (
          <p role="alert" className="text-center text-sm text-app-danger">
            {t('inbox.errorTooLong')}
          </p>
        ) : null}
        {formError === 'request' ? (
          <p role="alert" className="text-center text-sm text-app-danger">
            {t('inbox.errorRequest')}
          </p>
        ) : null}
      </div>
    );
  } else if (loading && conversations === null) {
    body = (
      <>
        <h1 className="text-center text-2xl font-semibold tracking-tight text-app-fg">
          {t('inbox.heading')}
        </h1>
        <p className="text-center text-sm text-app-muted">{t('inbox.loading')}</p>
      </>
    );
  } else if (error && conversations === null) {
    body = (
      <>
        <h1 className="text-center text-2xl font-semibold tracking-tight text-app-fg">
          {t('inbox.heading')}
        </h1>
        <p className="text-center text-sm text-app-fg">{t('inbox.error')}</p>
        <Button type="button" variant="secondary" onClick={onRetry}>
          {t('inbox.retry')}
        </Button>
      </>
    );
  } else if (conversations !== null && conversations.length === 0) {
    body = (
      <>
        <h1 className="text-center text-2xl font-semibold tracking-tight text-app-fg">
          {t('inbox.heading')}
        </h1>
        <p className="text-center text-sm text-app-muted">{t('inbox.empty')}</p>
      </>
    );
  } else {
    body = (
      <>
        <h1 className="text-center text-2xl font-semibold tracking-tight text-app-fg">
          {t('inbox.heading')}
        </h1>
        <ul aria-label={t('inbox.listLabel')} className="flex w-full flex-col gap-3">
          {/* v8 ignore next -- list view only renders when conversations is non-null */}
          {(conversations ?? []).map((row) => (
            <li key={row.id}>
              <button
                type="button"
                onClick={() => {
                  onOpen(row.id);
                }}
                className="flex w-full flex-col items-start gap-1 rounded-2xl border border-app-border bg-app-card-muted px-4 py-3 text-left transition hover:bg-app-hover"
              >
                <span className="flex w-full items-baseline justify-between gap-2">
                  <span className="text-sm font-medium text-app-fg">{row.name}</span>
                  <time dateTime={row.lastAt} className="text-xs text-app-subtle">
                    {formatForumTime(row.lastAt, locale)}
                  </time>
                </span>
                {row.lastText !== '' ? (
                  <span className="line-clamp-2 text-sm text-app-muted">{row.lastText}</span>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      </>
    );
  }

  return <Card maxWidth="xl">{body}</Card>;
}
