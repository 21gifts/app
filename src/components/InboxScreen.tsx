'use client';

import { ArrowLeft, Loader2, Send } from 'lucide-react';
import { useRouter } from 'next/navigation';
import {
  type FormEvent,
  type ReactElement,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { AppShellContext, useAppShellScroller } from '@/components/AppShell';
import { useFiatPreference } from '@/components/FiatPreferenceProvider';
import { LinkedText } from '@/components/LinkedText';
import { useTranslations } from '@/components/LocaleProvider';
import { useNumberFormat } from '@/components/NumberFormatProvider';
import { preferredFiatSuffix } from '@/components/PreferredFiatSuffix';
import { QrCode } from '@/components/QrCode';
import { Button, Card, Field, IconButton, SegmentedControl } from '@/components/ui';
import {
  CONTACT_MESSAGE_MAX_LENGTH,
  type Conversation,
  type ConversationMessage,
} from '@/lib/api-types';
import { formatForumTime } from '@/lib/forum-time';
import type { NumberFormatStyle } from '@/lib/number-format';
import {
  formatBitcoin,
  formatFiatDisplay,
  satsToFiatAmount,
  type FiatCode,
  type FiatRateDay,
} from '@/lib/stats-money';
import {
  isAndroidUserAgent,
  isSmartphoneUserAgent,
  walletOfSatoshiHref,
  walletOfSatoshiIntentHref,
} from '@/lib/wos-deep-link';

/** Catalog key for each conversation.kind origin label. */
const CONVERSATION_ORIGIN_KEY = {
  member_member: 'inbox.origin.direct',
  member_platform: 'inbox.origin.contact',
  member_damus: 'inbox.origin.damus',
  moderator_group: 'moderate.groupLabel',
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

/** Compact last-text / last-sats chip vs muted inbound preview. */
function listPreviewClass(fromMe: boolean): string {
  return fromMe
    ? 'self-end w-fit max-w-full line-clamp-2 rounded-2xl rounded-br-md bg-app-btn px-3 py-1.5 text-sm text-app-btn-fg'
    : 'line-clamp-2 text-sm text-app-muted';
}

/**
 * Scrolls the AppShell scroller to the bottom, or the document when none is mounted.
 *
 * @param scroller - Inner overflow node from {@link useAppShellScroller}, or `null`.
 */
function shellScrollToBottom(scroller: HTMLElement | null): void {
  if (scroller !== null) {
    if (typeof scroller.scrollTo === 'function') {
      scroller.scrollTo(0, scroller.scrollHeight);
    } else {
      scroller.scrollTop = scroller.scrollHeight;
    }
    return;
  }
  window.scrollTo(0, document.documentElement.scrollHeight);
}

/**
 * Scrolls the AppShell scroller to the top, or the document when none is mounted.
 *
 * @param scroller - Inner overflow node from {@link useAppShellScroller}, or `null`.
 */
function shellScrollToTop(scroller: HTMLElement | null): void {
  if (scroller !== null) {
    if (typeof scroller.scrollTo === 'function') {
      scroller.scrollTo(0, 0);
    } else {
      scroller.scrollTop = 0;
    }
    return;
  }
  window.scrollTo(0, 0);
}

/** Client-side composer validation or request failure. */
export type InboxFormError =
  'empty' | 'tooLong' | 'request' | 'amount' | 'rateLimit' | 'authorWallet' | null;

/** Open Lightning invoice shown in the inbox pay sheet. */
export interface InboxInvoice {
  /** BOLT11 payment request. */
  pr: string;
  /** Whole satoshis on the invoice. */
  amountSats: number;
}

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
  /** True for a moderator: show Direct/Contact/Damus. Members see the full inbound list. */
  showFilter: boolean;
  /** Amount draft for the composer sats field. */
  amountDraft?: string;
  /** Called when the amount field changes. */
  onAmountDraftChange?: (value: string) => void;
  /** Open Lightning invoice, or `null` when no pay sheet is showing. */
  invoice?: InboxInvoice | null;
  /** Cancels the pay sheet and aborts the poll. */
  onPayCancel?: () => void;
  /** True while waiting for the gift row after invoice mint. */
  payWaiting?: boolean;
  /**
   * Show the sats Amount field beside the composer. Default true; the closed
   * staff room passes false (text only, no gifts).
   */
  showAmount?: boolean;
  /** Latest gift-day totals for the preferred-fiat suffix, or `null` without a usable rate. */
  rateDay?: FiatRateDay | null;
}

/** One thread message plus the paid gifts that belong to it. */
export interface ThreadGiftGroup {
  /** The triggering message, rendered as today. */
  message: ConversationMessage;
  /** Gifts whose `giftFor` points at `message.id`, in list order. */
  gifts: ConversationMessage[];
}

/**
 * Groups `giftFor` messages under the thread message they belong to.
 *
 * A message with `giftFor` equal to the id of a DIFFERENT message that is
 * present in `messages` is removed from the top level and appended to that
 * parent's `gifts`, in the original list order. A `giftFor` that matches no
 * message in the list, matches the message's own id, or names a message that
 * is itself a gift, is not a gift link: that message stays an ordinary
 * top-level entry, so no message is ever dropped. Messages without `giftFor`
 * are unchanged. The relative order of top-level messages is preserved.
 *
 * @param messages - Oldest-first thread messages.
 * @returns Ordered top-level groups, each with its own gifts in list order.
 */
export function groupThreadGifts(messages: ConversationMessage[]): ThreadGiftGroup[] {
  const ids = new Set(messages.map((message) => message.id));
  const pointsAtAnother = (message: ConversationMessage): boolean =>
    message.giftFor !== undefined && message.giftFor !== message.id && ids.has(message.giftFor);
  const candidateIds = new Set(messages.filter(pointsAtAnother).map((message) => message.id));
  // A gift hangs only on a top-level message, so a gift of a gift stays a bubble of its own.
  const parentOf = (message: ConversationMessage): string | undefined => {
    const target = message.giftFor;
    if (target === undefined || !pointsAtAnother(message) || candidateIds.has(target)) {
      return undefined;
    }
    return target;
  };

  const groups: ThreadGiftGroup[] = [];
  const byId = new Map<string, ThreadGiftGroup>();
  for (const message of messages) {
    if (parentOf(message) !== undefined) {
      continue;
    }
    const group: ThreadGiftGroup = { message, gifts: [] };
    groups.push(group);
    byId.set(message.id, group);
  }
  for (const message of messages) {
    const parentId = parentOf(message);
    if (parentId === undefined) {
      continue;
    }
    /* v8 ignore next -- a parent id is always a top-level message, so its group exists */
    byId.get(parentId)?.gifts.push(message);
  }
  return groups;
}

/** Plain-text ₿ amount plus optional fiat suffix for a nested gift `aria-label`. */
function giftAmountText(
  sats: number,
  rateDay: FiatRateDay | null,
  fiat: FiatCode,
  numberFormat: NumberFormatStyle,
): string {
  const bitcoin = formatBitcoin(sats, numberFormat);
  if (rateDay === null) {
    return bitcoin;
  }
  const amount = satsToFiatAmount(sats, rateDay, fiat);
  return amount === null
    ? bitcoin
    : `${bitcoin} · ${formatFiatDisplay(amount, fiat, numberFormat)}`;
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
 * a 500-character composer and a sats amount field (`showAmount` false
 * hides it; the staff room is text only). Members (`showFilter`
 * false) see inbound rows except `moderator_group`. Moderators
 * (`showFilter` true) see the origin control (Direct / Contact / Damus);
 * default Direct. Rows with `kind` `moderator_group` are never listed (the
 * closed staff room lives on `/moderate/group`). Origin labels come from
 * {@link Conversation} `kind` (Direct, Contact, Damus, or Moderators).
 * Outbound last-text previews use `inbox.sentPreview` as a filled chip.
 * Gift-only last rows (`lastText` empty, `lastSats` &gt; 0) show
 * `formatBitcoin(lastSats)` with the same chip vs muted split. Incoming
 * thread messages are full-width muted note cards; `fromMe` messages render
 * as filled `app-btn` bubbles on the right labelled `inbox.you`. Gift-only
 * bubbles use `forum.giftReply`; text+sats show the amount under the body.
 * An open `invoice` shows the Wallet of Satoshi / QR pay sheet. The
 * open-thread heading is the counterpart name plus origin caption (no in-card
 * back). Unread inbound rows use a semibold counterpart name and `text-app-fg`
 * last-text (read inbound last-text stays muted) plus `aria-label`
 * `inbox.threadUnread`. Heading and incoming author names with a non-empty
 * `accountId` are `inbox.authorProfile` buttons to `/members/:id`; `fromMe`
 * stays `inbox.you` text; Damus or a missing id stays plain text.
 * An open thread pins the AppShell scroller (document fallback) to the bottom
 * after messages render, and again when an invoice pay sheet opens. Leaving a
 * thread scrolls that scroller to the top once so the conversation list is not
 * left at the thread offset.
 *
 * @param props - List/thread/composer state from {@link InboxLoader} or
 *   {@link ModeratorGroupScreen}.
 * @returns The inbox card.
 */
export function InboxScreen({
  conversations,
  error,
  loading,
  onRetry,
  openId,
  onOpen,
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
  amountDraft = '',
  onAmountDraftChange = () => undefined,
  invoice = null,
  onPayCancel = () => undefined,
  payWaiting = false,
  showAmount = true,
  rateDay = null,
}: InboxScreenProps): ReactElement {
  const { t, locale } = useTranslations();
  const router = useRouter();
  const { numberFormat } = useNumberFormat();
  const { fiat } = useFiatPreference();
  const inShell = useContext(AppShellContext) !== null;
  const scroller = useAppShellScroller();
  const hadOpenThreadRef = useRef(false);
  const paySheetWasOpen = useRef(false);
  const payWaitingWasOn = useRef(false);
  const payQrWasOn = useRef(false);
  const [filter, setFilter] = useState<InboxFilter>('direct');
  const [showPaymentQr, setShowPaymentQr] = useState(false);

  const messagesReady = messages !== null;
  let lastMessageId = '';
  if (messages !== null && messages.length > 0) {
    const last = messages[messages.length - 1];
    /* v8 ignore next -- length > 0, so the last index exists */
    lastMessageId = last === undefined ? '' : last.id;
  }

  useEffect(() => {
    /* v8 ignore next 3 -- SSR has no navigator */
    setShowPaymentQr(
      typeof navigator !== 'undefined' ? !isSmartphoneUserAgent(navigator.userAgent) : false,
    );
  }, []);

  useLayoutEffect(() => {
    if (inShell && scroller === null) {
      return;
    }
    const threadOpen = openId !== null && openId !== '';
    if (threadOpen) {
      hadOpenThreadRef.current = true;
      if (messagesReady && messagesLoading === false && messagesError === false) {
        shellScrollToBottom(scroller);
      }
      return;
    }
    if (hadOpenThreadRef.current) {
      shellScrollToTop(scroller);
      hadOpenThreadRef.current = false;
    }
  }, [openId, messagesReady, messagesLoading, messagesError, lastMessageId, scroller, inShell]);

  useLayoutEffect(() => {
    if (inShell && scroller === null) {
      return;
    }
    const threadOpen = openId !== null && openId !== '';
    const paySheetOpen = invoice !== null;
    const sheetOpened = paySheetOpen && !paySheetWasOpen.current;
    const waitingAppeared = paySheetOpen && payWaiting && !payWaitingWasOn.current;
    const qrAppeared = paySheetOpen && showPaymentQr && !payQrWasOn.current;
    paySheetWasOpen.current = paySheetOpen;
    payWaitingWasOn.current = paySheetOpen && payWaiting;
    payQrWasOn.current = paySheetOpen && showPaymentQr;
    if (
      threadOpen &&
      messagesReady &&
      messagesLoading === false &&
      messagesError === false &&
      (sheetOpened || waitingAppeared || qrAppeared)
    ) {
      shellScrollToBottom(scroller);
    }
  }, [
    openId,
    messagesReady,
    messagesLoading,
    messagesError,
    scroller,
    inShell,
    invoice,
    payWaiting,
    showPaymentQr,
  ]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    onPost();
  };

  const filtered =
    conversations === null
      ? []
      : showFilter
        ? conversations.filter((row) => row.kind === FILTER_KIND[filter])
        : conversations.filter((row) => row.kind !== 'moderator_group');

  const open =
    openId === null || conversations === null
      ? null
      : (conversations.find((row) => row.id === openId) ?? null);

  /* v8 ignore next 8 -- SSR has no navigator */
  const isSmartphone =
    typeof navigator !== 'undefined' ? isSmartphoneUserAgent(navigator.userAgent) : false;
  /* v8 ignore start -- Android vs iOS wallet href */
  const android =
    typeof navigator !== 'undefined' ? isAndroidUserAgent(navigator.userAgent) : false;
  const wosHref =
    invoice === null
      ? null
      : android
        ? walletOfSatoshiIntentHref(invoice.pr)
        : walletOfSatoshiHref(invoice.pr);
  /* v8 ignore stop */

  const openWalletOfSatoshi = (href: string): void => {
    window.location.href = href;
  };

  const walletButton =
    wosHref === null ? null : (
      <Button
        type="button"
        aria-label={t('forum.payOpenWalletAria')}
        icon={
          <img
            src="/wos-icon.png"
            alt=""
            width={20}
            height={20}
            aria-hidden="true"
            className="h-5 w-5 rounded-md ring-1 ring-white/30"
          />
        }
        onClick={() => {
          openWalletOfSatoshi(wosHref);
        }}
      >
        {t('forum.payOpenWallet')}
      </Button>
    );

  let body: ReactElement;
  if (openId !== null) {
    body = (
      <div className="flex w-full flex-col gap-4">
        <div>
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
            {groupThreadGifts(messages).map(({ message, gifts }) => (
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
                {message.text !== '' ? (
                  <LinkedText
                    text={message.text}
                    className={
                      message.fromMe
                        ? 'mt-2 whitespace-pre-wrap text-sm text-app-btn-fg'
                        : 'mt-2 whitespace-pre-wrap text-sm text-app-fg'
                    }
                  />
                ) : message.sats > 0 ? (
                  /* v8 ignore next 13 -- inbound vs outbound gift-only class names */
                  <p
                    className={
                      message.fromMe
                        ? 'mt-2 text-sm tabular-nums lining-nums text-app-btn-fg'
                        : 'mt-2 text-sm tabular-nums lining-nums text-app-fg'
                    }
                  >
                    {t('forum.giftReply', {
                      amount: formatBitcoin(message.sats, numberFormat),
                    })}
                    {preferredFiatSuffix(message.sats, rateDay, fiat, numberFormat)}
                  </p>
                ) : null}
                {message.text !== '' && message.sats > 0 ? (
                  <p
                    className={
                      message.fromMe
                        ? 'mt-1 text-sm tabular-nums lining-nums text-app-btn-fg/80'
                        : 'mt-1 text-sm tabular-nums lining-nums text-app-muted'
                    }
                  >
                    {formatBitcoin(message.sats, numberFormat)}
                    {preferredFiatSuffix(message.sats, rateDay, fiat, numberFormat)}
                  </p>
                ) : null}
                {gifts.map((gift) => (
                  <div
                    key={gift.id}
                    role="note"
                    aria-label={t('inbox.giftForLabel', {
                      name: gift.name,
                      amount: giftAmountText(gift.sats, rateDay, fiat, numberFormat),
                    })}
                    data-message-id={gift.id}
                    data-gift-for={message.id}
                    className={
                      message.fromMe
                        ? 'mt-3 border-t border-app-btn-fg/20 pt-2'
                        : 'mt-3 border-t border-app-border pt-2'
                    }
                  >
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <span
                        className={
                          message.fromMe
                            ? 'text-xs tabular-nums lining-nums text-app-btn-fg/80'
                            : 'text-xs tabular-nums lining-nums text-app-muted'
                        }
                      >
                        {gift.name}
                        {' · '}
                        {formatBitcoin(gift.sats, numberFormat)}
                        {preferredFiatSuffix(gift.sats, rateDay, fiat, numberFormat)}
                      </span>
                      <time
                        dateTime={gift.createdAt}
                        className={
                          message.fromMe ? 'text-xs text-app-btn-fg/70' : 'text-xs text-app-subtle'
                        }
                      >
                        {formatForumTime(gift.createdAt, locale)}
                      </time>
                    </div>
                  </div>
                ))}
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
          {showAmount ? (
            <Field
              className="w-24"
              label={t('inbox.amountLabel')}
              type="text"
              inputMode="numeric"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              placeholder={t('forum.payAmountPlaceholder')}
              value={amountDraft}
              disabled={posting || messagesLoading}
              onChange={(event) => onAmountDraftChange(event.target.value)}
            />
          ) : null}
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
        {formError === 'amount' ? (
          <p role="alert" className="text-center text-sm text-app-danger">
            {t('inbox.errorAmount')}
          </p>
        ) : null}
        {formError === 'rateLimit' ? (
          <p role="alert" className="text-center text-sm text-app-danger">
            {t('inbox.errorRateLimit')}
          </p>
        ) : null}
        {formError === 'authorWallet' ? (
          <p role="alert" className="text-center text-sm text-app-danger">
            {t('inbox.errorAuthorWallet')}
          </p>
        ) : null}
        {invoice !== null && isSmartphone ? (
          <div className="relative mt-3 flex flex-col gap-3 rounded-xl border border-app-border bg-app-card p-3 pl-11 pt-10">
            <IconButton
              type="button"
              size="sm"
              variant="ghost"
              aria-label={t('forum.payBack')}
              onClick={onPayCancel}
              className="absolute left-2 top-2"
            >
              <ArrowLeft aria-hidden="true" className="h-4 w-4" />
            </IconButton>
            {walletButton}
            {/* v8 ignore next 3 -- waiting copy after mint */}
            {payWaiting ? (
              <p className="text-center text-xs text-app-muted">{t('forum.payWaiting')}</p>
            ) : null}
          </div>
        ) : null}
        {invoice !== null && !isSmartphone ? (
          <div className="relative mt-3 flex flex-col items-center gap-3 rounded-xl border border-app-border bg-app-card p-4">
            <IconButton
              type="button"
              size="sm"
              variant="ghost"
              aria-label={t('forum.payBack')}
              onClick={onPayCancel}
              className="absolute left-2 top-2"
            >
              <ArrowLeft aria-hidden="true" className="h-4 w-4" />
            </IconButton>
            <p className="px-10 text-center text-sm text-app-muted">
              {t('forum.payConfirm', {
                amount: formatBitcoin(invoice.amountSats, numberFormat),
              })}
              {preferredFiatSuffix(invoice.amountSats, rateDay, fiat, numberFormat)}
            </p>
            {showPaymentQr ? <QrCode value={invoice.pr} label={t('forum.payInvoiceQr')} /> : null}
            {walletButton}
            {/* v8 ignore start -- payWaiting is true only after invoice mint while polling */}
            {payWaiting ? (
              <p className="text-center text-xs text-app-muted">{t('forum.payWaiting')}</p>
            ) : null}
            {/* v8 ignore stop */}
          </div>
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
                  aria-label={row.unread ? t('inbox.threadUnread', { name: row.name }) : undefined}
                  onClick={() => {
                    onOpen(row.id);
                  }}
                  className="flex w-full flex-col items-start gap-1 rounded-2xl border border-app-border bg-app-card-muted px-4 py-3 text-left transition hover:bg-app-hover"
                >
                  <span className="flex w-full items-baseline justify-between gap-2">
                    <span
                      className={
                        row.unread
                          ? 'text-sm font-semibold text-app-fg'
                          : 'text-sm font-medium text-app-fg'
                      }
                    >
                      {row.name}
                    </span>
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
                          ? listPreviewClass(true)
                          : row.unread
                            ? 'line-clamp-2 text-sm text-app-fg'
                            : listPreviewClass(false)
                      }
                    >
                      {row.lastFromMe
                        ? t('inbox.sentPreview', { text: row.lastText })
                        : row.lastText}
                    </span>
                  ) : row.lastSats > 0 ? (
                    <span className={listPreviewClass(row.lastFromMe)}>
                      {formatBitcoin(row.lastSats, numberFormat)}
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

  return (
    <Card maxWidth="xl" surface={false}>
      {body}
    </Card>
  );
}
