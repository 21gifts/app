'use client';

import { ArrowLeft, Loader2, Send } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { type FormEvent, type ReactElement, useState } from 'react';
import { useTranslations } from '@/components/LocaleProvider';
import { Button, Card, IconButton, SegmentedControl } from '@/components/ui';
import {
  CONTACT_MESSAGE_MAX_LENGTH,
  type Conversation,
  type ConversationMessage,
} from '@/lib/api-types';
import { formatForumTime } from '@/lib/forum-time';

/** Catalog key for each conversation.kind origin label. */
const CONVERSATION_ORIGIN_KEY = {
  member_member: 'inbox.origin.direct',
  member_platform: 'inbox.origin.contact',
  member_damus: 'inbox.origin.damus',
} as const;

/** Origin filter on the conversation list. Default Direct. */
type InboxFilter = 'direct' | 'contact' | 'damus';

const FILTER_KIND: Record<InboxFilter, Conversation['kind']> = {
  direct: 'member_member',
  contact: 'member_platform',
  damus: 'member_damus',
};

const FILTER_EMPTY_KEY = {
  direct: 'inbox.empty',
  contact: 'inbox.empty.contact',
  damus: 'inbox.empty.damus',
} as const;

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
  /** True for founder/moderator: show Direct/Contact/Damus. Members see the full inbound list. */
  showFilter: boolean;
}

/**
 * Whether an inbox name should open a member profile.
 *
 * @param accountId - Optional 21.gifts counterpart or sender id.
 * @returns True when `accountId` is a non-empty string.
 */
function hasInboxAccountId(accountId: string | undefined): accountId is string {
  return typeof accountId === 'string' && accountId !== '';
}

/**
 * Profile-link button for an inbox heading or incoming author name.
 *
 * @param name - Display name.
 * @param accountId - Non-empty 21.gifts account id.
 * @param className - Text classes plus underline for this context.
 * @param label - `inbox.authorProfile` aria-label.
 * @param push - `useRouter().push`.
 * @returns The profile button.
 */
function inboxAuthorProfileButton(
  name: string,
  accountId: string,
  className: string,
  label: string,
  push: (href: string) => void,
): ReactElement {
  return (
    <button
      type="button"
      aria-label={label}
      className={className}
      onClick={() => {
        push(`/members/${accountId}`);
      }}
    >
      {name}
    </button>
  );
}

/**
 * Presentational signed-in inbox: conversation list or one open thread with
 * a 500-character composer. Members (`showFilter` false) see the unfiltered
 * inbound list. Founder/moderator (`showFilter` true) see the origin control
 * (Direct / Contact / Damus); default Direct. Origin labels come from
 * {@link Conversation} `kind`. Outbound last-text previews use
 * `inbox.sentPreview` as a filled chip. Incoming thread messages are full-width
 * muted note cards; `fromMe` messages render as filled `app-btn` bubbles on the
 * right labelled `inbox.you`. Heading and incoming author names with a
 * non-empty `accountId` are `inbox.authorProfile` buttons to `/members/:id`;
 * `fromMe` stays `inbox.you` text; Damus or a missing id stays plain text.
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
  showFilter,
}: InboxScreenProps): ReactElement {
  const { t, locale } = useTranslations();
  const router = useRouter();
  const [filter, setFilter] = useState<InboxFilter>('direct');

  const handleSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    onPost();
  };

  const filtered =
    conversations === null
      ? []
      : showFilter
        ? conversations.filter((row) => row.kind === FILTER_KIND[filter])
        : conversations;

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
          <div className="min-w-0 flex-1">
            {open !== null && hasInboxAccountId(open.accountId) ? (
              <h1
                className="text-center text-2xl font-semibold tracking-tight text-app-fg sm:text-3xl"
                aria-label={open.name}
              >
                {inboxAuthorProfileButton(
                  open.name,
                  open.accountId,
                  'text-center text-2xl font-semibold tracking-tight text-app-fg sm:text-3xl underline underline-offset-2',
                  t('inbox.authorProfile'),
                  (href) => {
                    router.push(href);
                  },
                )}
              </h1>
            ) : (
              <h1 className="text-center text-2xl font-semibold tracking-tight text-app-fg sm:text-3xl">
                {open?.name ?? t('inbox.heading')}
              </h1>
            )}
            {open !== null ? (
              <p className="text-center text-xs text-app-subtle">
                {t(CONVERSATION_ORIGIN_KEY[open.kind])}
              </p>
            ) : null}
          </div>
        </div>
        {messagesLoading && messages === null ? (
          <p className="text-center text-sm text-app-muted">{t('inbox.loading')}</p>
        ) : null}
        {messagesError && messages === null ? (
          <div className="flex flex-col items-center gap-3">
            <p role="alert" className="text-center text-sm text-app-danger">
              {t('inbox.error')}
            </p>
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
                data-from-me={message.fromMe ? 'true' : 'false'}
                className={
                  message.fromMe
                    ? 'self-end w-fit max-w-[85%] rounded-2xl rounded-br-md bg-app-btn px-4 py-3 text-app-btn-fg'
                    : 'rounded-2xl border border-app-border bg-app-card-muted px-4 py-3'
                }
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  {message.fromMe ? (
                    <span className="text-sm font-medium text-app-btn-fg">{t('inbox.you')}</span>
                  ) : hasInboxAccountId(message.accountId) ? (
                    inboxAuthorProfileButton(
                      message.name,
                      message.accountId,
                      'text-sm font-medium text-app-fg underline underline-offset-2',
                      t('inbox.authorProfile'),
                      (href) => {
                        router.push(href);
                      },
                    )
                  ) : (
                    <span className="text-sm font-medium text-app-fg">{message.name}</span>
                  )}
                  <time
                    dateTime={message.createdAt}
                    className={
                      message.fromMe ? 'text-xs text-app-btn-fg/70' : 'text-xs text-app-subtle'
                    }
                  >
                    {formatForumTime(message.createdAt, locale)}
                  </time>
                </div>
                <p
                  className={
                    message.fromMe
                      ? 'mt-2 whitespace-pre-wrap text-sm text-app-btn-fg'
                      : 'mt-2 whitespace-pre-wrap text-sm text-app-fg'
                  }
                >
                  {message.text}
                </p>
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
            className="min-h-11 min-w-0 flex-1 resize-none rounded-2xl border border-app-border-strong px-4 py-2.5 text-base text-app-fg transition disabled:opacity-50"
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
        <h1 className="text-center text-2xl font-semibold tracking-tight text-app-fg sm:text-3xl">
          {t('inbox.heading')}
        </h1>
        <p className="text-center text-sm text-app-muted">{t('inbox.loading')}</p>
      </>
    );
  } else if (error && conversations === null) {
    body = (
      <>
        <h1 className="text-center text-2xl font-semibold tracking-tight text-app-fg sm:text-3xl">
          {t('inbox.heading')}
        </h1>
        <p role="alert" className="text-center text-sm text-app-danger">
          {t('inbox.error')}
        </p>
        <Button type="button" variant="secondary" onClick={onRetry}>
          {t('inbox.retry')}
        </Button>
      </>
    );
  } else {
    body = (
      <>
        <h1 className="text-center text-2xl font-semibold tracking-tight text-app-fg sm:text-3xl">
          {t('inbox.heading')}
        </h1>
        {showFilter ? (
          <SegmentedControl
            value={filter}
            options={[
              { value: 'direct', label: t('inbox.origin.direct') },
              { value: 'contact', label: t('inbox.origin.contact') },
              { value: 'damus', label: t('inbox.origin.damus') },
            ]}
            onChange={setFilter}
            ariaLabel={t('inbox.filterLabel')}
            tone="neutral"
          />
        ) : null}
        {filtered.length === 0 ? (
          <p className="text-center text-sm text-app-muted">
            {t(showFilter ? FILTER_EMPTY_KEY[filter] : 'inbox.empty')}
          </p>
        ) : (
          <ul aria-label={t('inbox.listLabel')} className="flex w-full flex-col gap-3">
            {filtered.map((row) => (
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
                  <span className="text-xs text-app-subtle">
                    {t(CONVERSATION_ORIGIN_KEY[row.kind])}
                  </span>
                  {row.lastText !== '' ? (
                    <span
                      className={
                        row.lastFromMe
                          ? 'self-end w-fit max-w-full line-clamp-2 rounded-2xl rounded-br-md bg-app-btn px-3 py-1.5 text-sm text-app-btn-fg'
                          : 'line-clamp-2 text-sm text-app-muted'
                      }
                    >
                      {row.lastFromMe
                        ? t('inbox.sentPreview', { text: row.lastText })
                        : row.lastText}
                    </span>
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
        )}
      </>
    );
  }

  return <Card maxWidth="xl">{body}</Card>;
}
