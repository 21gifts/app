'use client';

import { ArrowLeft, Bitcoin, Check, ImagePlus, Link2, Loader2, Mail, Send, X } from 'lucide-react';
import Link from 'next/link';
import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
  type MouseEvent,
  type ReactElement,
} from 'react';
import { useTranslations } from '@/components/LocaleProvider';
import { QrCode } from '@/components/QrCode';
import { Button, Field, IconButton } from '@/components/ui';
import { FORUM_MESSAGE_MAX_LENGTH, type ForumMessage } from '@/lib/api-types';
import { FORUM_FEED_MODES, type ForumFeedMode, visibleForumMessages } from '@/lib/forum-feed';
import type { ForumPhotoPayload } from '@/lib/forum-photo';
import { forumVideoSrc, type ForumVideoPayload } from '@/lib/forum-video';
import { formatForumTime } from '@/lib/forum-time';
import type { MessageKey } from '@/lib/messages';
import { formatBitcoin } from '@/lib/stats-money';
import {
  isAndroidUserAgent,
  isSmartphoneUserAgent,
  walletOfSatoshiHref,
  walletOfSatoshiIntentHref,
} from '@/lib/wos-deep-link';

/** Client-side composer validation or request failure. */
export type ForumFormError =
  'empty' | 'tooLong' | 'request' | 'rateLimit' | 'unsupported' | 'tooLarge' | null;

/** Pay-sheet validation or request failure. */
export type ForumPayError = 'amount' | 'request' | 'rateLimit' | 'authorWallet' | null;

/** Roles that show a clickable tag beside the author name. */
type ForumTaggedRole = 'founder' | 'moderator' | 'verified';

/** Catalog keys for a tagged role's label and explanation. */
const ROLE_TAG_KEYS: Record<ForumTaggedRole, { label: MessageKey; hint: MessageKey }> = {
  founder: { label: 'forum.role.founder', hint: 'forum.role.founderHint' },
  moderator: { label: 'forum.role.moderator', hint: 'forum.role.moderatorHint' },
  verified: { label: 'forum.role.verified', hint: 'forum.role.verifiedHint' },
};

const COPY_RESET_MS = 1200;

/** Active pay invoice shown under a forum card. */
export interface ForumPayInvoice {
  /** Message id the invoice belongs to. */
  messageId: string;
  /** BOLT11 payment request. */
  pr: string;
  /** Whole sats confirmed by the api. */
  amountSats: number;
}

/** Props for {@link ForumBoard}. */
export interface ForumBoardProps {
  /** Loaded messages newest-first (API window), or `null` before the first successful load. */
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
  formError: ForumFormError;
  /** Message id whose pay sheet is open, or `null`. */
  payMessageId: string | null;
  /** Amount draft for the open pay sheet. */
  payDraft: string;
  /** True while an invoice request is in flight. */
  payBusy: boolean;
  /** Pay-sheet validation or request failure. */
  payError: ForumPayError;
  /** Issued invoice for QR / wallet link, or `null`. */
  payInvoice: ForumPayInvoice | null;
  /** True while polling for an updated sats total after pay. */
  payWaiting: boolean;
  /** Opens the pay sheet for a payable message. */
  onPayOpen: (messageId: string) => void;
  /** Updates the pay amount draft. */
  onPayDraftChange: (value: string) => void;
  /** Submits the pay amount for an invoice. */
  onPaySubmit: () => void;
  /** Closes the pay sheet and clears invoice state. */
  onPayCancel: () => void;
  /** Selected feed mode. Default in the loader is Active. */
  mode: ForumFeedMode;
  /** Called when the visitor picks another mode. */
  onModeChange: (mode: ForumFeedMode) => void;
  /** When true, render the living-room laws hint box. */
  lawsVisible: boolean;
  /** Called when the user clicks the hint dismiss control. */
  onDismissLaws: () => void;
  /** Prepared photo waiting to post, or `null`. */
  photoDraft: ForumPhotoPayload | null;
  /** Prepared video waiting to post, or `null`. */
  videoDraft?: ForumVideoPayload | null;
  /** Called when the visitor picks a file from the attach control. */
  onPickPhoto: (file: File) => void;
  /** Clears the pending photo draft. */
  onClearPhoto: () => void;
  /** Message id → blob/object URL for inline photos already loaded. */
  photoUrls: Readonly<Record<string, string>>;
  /** Message id → blob/object URL for a just-posted video (local preview). */
  videoUrls?: Readonly<Record<string, string>>;
  /** Expanded note id, or `null` when all cards are collapsed. */
  expandedId: string | null;
  /** Opens or closes the in-card thread for a note. */
  onToggleExpand: (messageId: string) => void;
  /** Replies for the expanded note (oldest-first), or `null` when not ready. */
  replies: ForumMessage[] | null;
  /** True while replies are loading for the expanded note. */
  repliesLoading: boolean;
  /** True when the latest replies fetch failed. */
  repliesError: boolean;
  /** Retry handler for a failed replies fetch. */
  onRetryReplies: () => void;
  /** Reply composer draft. */
  replyDraft: string;
  /** Called when the reply draft changes. */
  onReplyDraftChange: (value: string) => void;
  /** Called when the reply form is submitted. */
  onReplyPost: () => void;
  /** True while a reply post is in flight. */
  replyPosting: boolean;
  /** Reply composer validation or request failure. */
  replyFormError: ForumFormError;
  /** Signed-in display name, used to hide PM on own notes and replies. */
  ownName: string | null;
  /** Opens a private thread with the note or reply author. */
  onPm: (messageId: string) => void;
  /** Forum message id whose PM request is in flight, or `null`. */
  pmBusyId: string | null;
}

const MODE_LABEL_KEY: Record<
  ForumFeedMode,
  'forum.modeActive' | 'forum.modeAll' | 'forum.modePopular'
> = {
  active: 'forum.modeActive',
  all: 'forum.modeAll',
  popular: 'forum.modePopular',
};

/**
 * Copy `text` via a hidden textarea and `document.execCommand('copy')`.
 *
 * @param text - Absolute URL to put on the clipboard.
 * @returns Whether the browser reported a successful copy.
 */
function fallbackCopy(text: string): boolean {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.setAttribute('aria-hidden', 'true');
  ta.className = 'fixed opacity-0';
  ta.readOnly = true;
  document.body.appendChild(ta);
  ta.select();
  let ok = false;
  try {
    ok = document.execCommand('copy');
  } catch {
    ok = false;
  }
  ta.remove();
  return ok;
}

/**
 * Presentational public forum: optional dismissible living-room laws hint,
 * Active/All/Most popular selector, list or empty/loading/error, board-bottom
 * composer (new notes only, photo or video attach), per-card expand for replies
 * + reply composer, copy-link control, PM control on other people's notes,
 * pay-on-note sheet, optional inline photos, and optional inline videos.
 *
 * @param props - Messages payload plus loading/error/composer/pay/mode/photo/video/laws/thread state.
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
  payMessageId,
  payDraft,
  payBusy,
  payError,
  payInvoice,
  payWaiting,
  onPayOpen,
  onPayDraftChange,
  onPaySubmit,
  onPayCancel,
  mode,
  onModeChange,
  lawsVisible,
  onDismissLaws,
  photoDraft,
  videoDraft = null,
  onPickPhoto,
  onClearPhoto,
  photoUrls,
  videoUrls = {},
  expandedId,
  onToggleExpand,
  replies,
  repliesLoading,
  repliesError,
  onRetryReplies,
  replyDraft,
  onReplyDraftChange,
  onReplyPost,
  replyPosting,
  replyFormError,
  ownName,
  onPm,
  pmBusyId,
}: ForumBoardProps): ReactElement {
  const { t, locale } = useTranslations();
  const composerRef = useRef<HTMLFormElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const newestId = messages?.[0]?.id ?? null;
  const [showPaymentQr, setShowPaymentQr] = useState(false);
  const [openRoleMessageId, setOpenRoleMessageId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const copyMounted = useRef(true);

  useEffect(() => {
    if (newestId === null) {
      return;
    }
    composerRef.current?.scrollIntoView({ block: 'end', behavior: 'auto' });
  }, [newestId]);

  useEffect(() => {
    setShowPaymentQr(!isSmartphoneUserAgent(navigator.userAgent));
  }, []);

  useEffect(() => {
    copyMounted.current = true;
    return () => {
      copyMounted.current = false;
      if (copyTimer.current !== null) {
        clearTimeout(copyTimer.current);
      }
    };
  }, []);

  const handleSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    onPost();
  };

  const handlePaySubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    onPaySubmit();
  };

  const handleReplySubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    onReplyPost();
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>): void => {
    const file = event.target.files?.[0];
    if (file !== undefined) {
      onPickPhoto(file);
    }
    event.target.value = '';
  };

  const flashCopied = (messageId: string): void => {
    setCopiedId(messageId);
    if (copyTimer.current !== null) {
      clearTimeout(copyTimer.current);
    }
    copyTimer.current = setTimeout(() => {
      setCopiedId(null);
      copyTimer.current = null;
    }, COPY_RESET_MS);
  };

  const copyMessageLink = async (messageId: string): Promise<void> => {
    const url = `${window.location.origin}/messages/${messageId}`;
    try {
      await navigator.clipboard.writeText(url);
      if (!copyMounted.current) {
        return;
      }
      flashCopied(messageId);
      return;
    } catch {
      if (!copyMounted.current) {
        return;
      }
      if (fallbackCopy(url)) {
        flashCopied(messageId);
        return;
      }
      console.error('Copy link failed');
    }
  };

  const errorBlock = (
    <div className="flex flex-col items-center gap-3">
      <p className="text-center text-sm text-app-fg">{t('forum.error')}</p>
      <Button type="button" variant="secondary" onClick={onRetry}>
        {t('forum.retry')}
      </Button>
    </div>
  );

  const visible = messages === null ? null : visibleForumMessages(messages, mode);

  let middle: ReactElement;
  if (loading && messages === null) {
    middle = <p className="text-center text-sm text-app-muted">{t('forum.loading')}</p>;
  } else if (error && messages === null) {
    middle = errorBlock;
  } else if (messages !== null && messages.length === 0) {
    middle = <p className="text-center text-sm text-app-muted">{t('forum.empty')}</p>;
  } else if (messages !== null && visible !== null && visible.length === 0) {
    middle = <p className="text-center text-sm text-app-muted">{t('forum.emptyPaid')}</p>;
  } else if (messages !== null && visible !== null) {
    const displayed = mode === 'popular' ? visible : visible.slice().reverse();
    middle = (
      <ul aria-label={t('forum.listLabel')} className="flex flex-col gap-4">
        {displayed.map((message) => {
          const photoUrl = message.hasPhoto ? photoUrls[message.id] : undefined;
          const videoSrc = message.hasVideo
            ? (videoUrls[message.id] ?? forumVideoSrc(message.id, message.videoContentType))
            : undefined;
          const sheetOpen = payMessageId === message.id;
          const invoiceForCard =
            payInvoice !== null && payInvoice.messageId === message.id ? payInvoice : null;
          /* v8 ignore start -- Android vs iOS wallet href */
          const android =
            typeof navigator !== 'undefined' ? isAndroidUserAgent(navigator.userAgent) : false;
          const wosHref =
            invoiceForCard === null
              ? null
              : android
                ? walletOfSatoshiIntentHref(invoiceForCard.pr)
                : walletOfSatoshiHref(invoiceForCard.pr);
          /* v8 ignore stop */

          const taggedRole =
            message.role === 'founder' ||
            message.role === 'moderator' ||
            message.role === 'verified'
              ? message.role
              : null;
          const roleKeys = taggedRole === null ? null : ROLE_TAG_KEYS[taggedRole];
          const roleHintOpen = openRoleMessageId === message.id;
          const expanded = expandedId === message.id;
          const copied = copiedId === message.id;

          const stopCardToggle = (event: MouseEvent): void => {
            event.stopPropagation();
          };

          return (
            <li
              key={message.id}
              data-message-id={message.id}
              className="rounded-2xl border border-app-border bg-app-card-muted px-4 py-3"
            >
              <div
                role="button"
                tabIndex={0}
                aria-expanded={expanded}
                aria-label={expanded ? t('forum.collapse') : t('forum.expand')}
                onClick={() => {
                  onToggleExpand(message.id);
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    onToggleExpand(message.id);
                  }
                }}
                className="cursor-pointer text-left"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-app-fg">{message.name}</span>
                    {roleKeys !== null ? (
                      <button
                        type="button"
                        aria-expanded={roleHintOpen}
                        onClick={(event) => {
                          stopCardToggle(event);
                          setOpenRoleMessageId(roleHintOpen ? null : message.id);
                        }}
                        className="rounded-full border border-app-border-strong px-2 py-0.5 text-xs font-medium text-app-muted"
                      >
                        {t(roleKeys.label)}
                      </button>
                    ) : null}
                  </div>
                  <time dateTime={message.createdAt} className="text-xs text-app-subtle">
                    {formatForumTime(message.createdAt, locale)}
                  </time>
                </div>
                {roleHintOpen && roleKeys !== null ? (
                  <p role="status" className="mt-1 text-xs text-app-muted">
                    {t(roleKeys.hint)}
                  </p>
                ) : null}
                {videoSrc !== undefined ? (
                  <video
                    src={videoSrc}
                    poster={photoUrl}
                    controls
                    playsInline
                    preload="metadata"
                    className="mt-2 max-h-80 w-full rounded-xl bg-black"
                  />
                ) : photoUrl !== undefined ? (
                  /* eslint-disable-next-line @next/next/no-img-element -- blob/object URLs from fetchMessagePhoto */
                  <img
                    src={photoUrl}
                    alt={t('forum.photoAlt', { name: message.name })}
                    className="mt-2 max-h-80 w-full rounded-xl object-contain"
                  />
                ) : null}
                {message.text !== '' ? (
                  <p className="mt-2 whitespace-pre-wrap text-sm text-app-fg">{message.text}</p>
                ) : null}
                <div className="mt-3 flex items-center gap-1.5">
                  <p className="text-xs font-medium text-app-muted">
                    {formatBitcoin(message.sats, locale)}
                  </p>
                  {message.payable ? (
                    <IconButton
                      type="button"
                      size="sm"
                      variant="ghost"
                      aria-label={t('forum.pay')}
                      disabled={payBusy}
                      onClick={(event) => {
                        stopCardToggle(event);
                        onPayOpen(message.id);
                      }}
                    >
                      <Bitcoin aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
                    </IconButton>
                  ) : null}
                  <IconButton
                    type="button"
                    size="sm"
                    variant="ghost"
                    aria-label={t('forum.copyLink')}
                    title={t('forum.copyLink')}
                    data-copied={copied ? 'true' : undefined}
                    onClick={(event) => {
                      stopCardToggle(event);
                      void copyMessageLink(message.id);
                    }}
                  >
                    {copied ? (
                      <Check aria-hidden="true" className="h-3.5 w-3.5" />
                    ) : (
                      <Link2 aria-hidden="true" className="h-3.5 w-3.5" />
                    )}
                  </IconButton>
                  {ownName === null || message.name !== ownName ? (
                    <IconButton
                      type="button"
                      size="sm"
                      variant="ghost"
                      aria-label={t('forum.pm')}
                      title={t('forum.pm')}
                      disabled={pmBusyId !== null}
                      onClick={(event) => {
                        stopCardToggle(event);
                        onPm(message.id);
                      }}
                    >
                      {pmBusyId === message.id ? (
                        <Loader2 aria-hidden="true" className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Mail aria-hidden="true" className="h-3.5 w-3.5" />
                      )}
                    </IconButton>
                  ) : null}
                  <span className="ml-auto text-xs text-app-subtle">
                    {t('forum.replyCount', { count: String(message.replyCount) })}
                  </span>
                </div>
              </div>

              {sheetOpen && invoiceForCard === null ? (
                <form
                  onSubmit={handlePaySubmit}
                  onClick={stopCardToggle}
                  className="relative mt-3 flex flex-col gap-3 rounded-xl border border-app-border bg-app-card p-3 pl-11 pt-10"
                >
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
                  <Field
                    label={t('forum.payAmountLabel')}
                    type="text"
                    inputMode="numeric"
                    autoComplete="off"
                    autoCorrect="off"
                    spellCheck={false}
                    placeholder={t('forum.payAmountPlaceholder')}
                    value={payDraft}
                    disabled={payBusy}
                    onChange={(event) => onPayDraftChange(event.target.value)}
                  />
                  {payError === 'amount' ? (
                    <p role="alert" className="text-sm text-red-600">
                      {t('forum.payErrorAmount')}
                    </p>
                  ) : null}
                  {payError === 'request' ? (
                    <p role="alert" className="text-sm text-red-600">
                      {t('forum.payErrorRequest')}
                    </p>
                  ) : null}
                  {payError === 'rateLimit' ? (
                    <p role="alert" className="text-sm text-red-600">
                      {t('forum.payErrorRateLimit')}
                    </p>
                  ) : null}
                  {payError === 'authorWallet' ? (
                    <p role="alert" className="text-sm text-red-600">
                      {t('forum.payErrorAuthorWallet')}
                    </p>
                  ) : null}
                  <Button
                    type="submit"
                    disabled={payBusy}
                    icon={
                      payBusy ? (
                        <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
                      ) : undefined
                    }
                  >
                    {t('forum.payContinue')}
                  </Button>
                </form>
              ) : null}

              {invoiceForCard !== null ? (
                <div
                  onClick={stopCardToggle}
                  className="relative mt-3 flex flex-col items-center gap-3 rounded-xl border border-app-border bg-app-card p-4"
                >
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
                      amount: formatBitcoin(invoiceForCard.amountSats, locale),
                    })}
                  </p>
                  {showPaymentQr ? (
                    <QrCode value={invoiceForCard.pr} label={t('forum.payInvoiceQr')} />
                  ) : null}
                  {/* v8 ignore start -- wosHref is set whenever an invoice is shown */}
                  {wosHref !== null ? (
                    <a
                      href={wosHref}
                      aria-label={t('forum.payOpenWalletAria')}
                      className="inline-flex items-center justify-center gap-2 rounded-full bg-app-btn px-5 py-2 text-sm font-medium text-app-btn-fg transition hover:bg-app-btn-hover"
                    >
                      <img
                        src="/wos-icon.png"
                        alt=""
                        width={20}
                        height={20}
                        aria-hidden="true"
                        className="h-5 w-5 rounded-md ring-1 ring-white/30"
                      />
                      {t('forum.payOpenWallet')}
                    </a>
                  ) : null}
                  {/* v8 ignore stop */}
                  {/* v8 ignore start */}
                  {payWaiting ? (
                    <p className="text-center text-xs text-app-muted">{t('forum.payWaiting')}</p>
                  ) : null}
                  {/* v8 ignore stop */}
                </div>
              ) : null}

              {expanded ? (
                <div
                  onClick={stopCardToggle}
                  className="mt-3 flex flex-col gap-3 border-t border-app-border pt-3"
                >
                  {repliesLoading ? (
                    <p className="text-center text-sm text-app-muted">
                      {t('forum.repliesLoading')}
                    </p>
                  ) : null}
                  {repliesError ? (
                    <div className="flex flex-col items-center gap-2">
                      <p className="text-center text-sm text-app-muted">
                        {t('forum.repliesError')}
                      </p>
                      <Button type="button" variant="secondary" onClick={onRetryReplies}>
                        {t('forum.retry')}
                      </Button>
                    </div>
                  ) : null}
                  {replies !== null && !repliesLoading && !repliesError ? (
                    <ul className="flex flex-col gap-3">
                      {replies.map((reply) => (
                        <li
                          key={reply.id}
                          data-reply-id={reply.id}
                          className="rounded-xl border border-app-border bg-app-card px-3 py-2"
                        >
                          <div className="flex flex-wrap items-baseline justify-between gap-2">
                            <span className="text-sm font-medium text-app-fg">{reply.name}</span>
                            <time dateTime={reply.createdAt} className="text-xs text-app-subtle">
                              {formatForumTime(reply.createdAt, locale)}
                            </time>
                          </div>
                          {reply.text !== '' ? (
                            <p className="mt-1 whitespace-pre-wrap text-sm text-app-fg">
                              {reply.text}
                            </p>
                          ) : null}
                          {ownName === null || reply.name !== ownName ? (
                            <div className="mt-2">
                              <IconButton
                                type="button"
                                size="sm"
                                variant="ghost"
                                aria-label={t('forum.pm')}
                                title={t('forum.pm')}
                                disabled={pmBusyId !== null}
                                onClick={() => {
                                  onPm(reply.id);
                                }}
                              >
                                {pmBusyId === reply.id ? (
                                  <Loader2
                                    aria-hidden="true"
                                    className="h-3.5 w-3.5 animate-spin"
                                  />
                                ) : (
                                  <Mail aria-hidden="true" className="h-3.5 w-3.5" />
                                )}
                              </IconButton>
                            </div>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  <form onSubmit={handleReplySubmit} className="flex flex-col gap-2">
                    <div className="flex items-end gap-2">
                      <textarea
                        aria-label={t('forum.replyComposerLabel')}
                        placeholder={t('forum.replyPlaceholder')}
                        value={replyDraft}
                        onChange={(event) => onReplyDraftChange(event.target.value)}
                        maxLength={FORUM_MESSAGE_MAX_LENGTH}
                        rows={2}
                        disabled={replyPosting}
                        className="min-h-11 min-w-0 flex-1 resize-none rounded-2xl border border-app-border-strong px-4 py-2.5 text-sm text-app-fg outline-none transition focus:border-app-border-strong disabled:opacity-50"
                      />
                      <IconButton
                        type="submit"
                        size="lg"
                        variant="primary"
                        disabled={replyPosting}
                        aria-label={t('forum.post')}
                      >
                        {replyPosting ? (
                          <Loader2
                            aria-hidden="true"
                            className="block h-5 w-5 shrink-0 animate-spin"
                          />
                        ) : (
                          <Send aria-hidden="true" className="block h-5 w-5 shrink-0" />
                        )}
                      </IconButton>
                    </div>
                    {replyFormError === 'empty' ? (
                      <p role="alert" className="text-center text-sm text-red-600">
                        {t('forum.errorEmpty')}
                      </p>
                    ) : null}
                    {replyFormError === 'tooLong' ? (
                      <p role="alert" className="text-center text-sm text-red-600">
                        {t('forum.errorTooLong')}
                      </p>
                    ) : null}
                    {replyFormError === 'request' ? (
                      <p role="alert" className="text-center text-sm text-red-600">
                        {t('forum.errorRequest')}
                      </p>
                    ) : null}
                    {replyFormError === 'rateLimit' ? (
                      <p role="alert" className="text-center text-sm text-red-600">
                        {t('forum.errorRateLimit')}
                      </p>
                    ) : null}
                  </form>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    );
  } else {
    middle = <p className="text-center text-sm text-app-muted">{t('forum.loading')}</p>;
  }

  return (
    <div className="flex w-full flex-col gap-4 border-t border-app-border pt-6">
      {lawsVisible ? (
        <div className="relative rounded-2xl border border-app-border bg-app-card-muted px-4 py-3 pr-10">
          <IconButton
            type="button"
            size="sm"
            variant="ghost"
            aria-label={t('forum.lawsDismiss')}
            onClick={onDismissLaws}
            className="absolute right-2 top-2"
          >
            <X aria-hidden="true" className="h-4 w-4" />
          </IconButton>
          <div className="flex flex-col items-center gap-2">
            <p className="text-center text-sm text-app-fg">{t('forum.laws1')}</p>
            <p className="text-center text-sm text-app-fg">{t('forum.laws2')}</p>
            <nav className="flex flex-wrap items-center justify-center gap-4 text-sm font-medium">
              <Link href="/rules" className="text-app-fg underline underline-offset-2">
                {t('forum.rulesLink')}
              </Link>
              <Link href="/contact" className="text-app-fg underline underline-offset-2">
                {t('forum.contactLink')}
              </Link>
            </nav>
          </div>
        </div>
      ) : null}

      <div
        role="group"
        aria-label={t('forum.modeLabel')}
        className="flex w-full rounded-full border border-app-border bg-app-card-muted p-1"
      >
        {FORUM_FEED_MODES.map((next) => (
          <button
            key={next}
            type="button"
            aria-pressed={mode === next}
            onClick={() => onModeChange(next)}
            className={`flex-1 rounded-full px-3 py-1.5 text-sm font-medium ${
              mode === next ? 'bg-app-btn text-app-btn-fg' : 'text-app-muted'
            }`}
          >
            {t(MODE_LABEL_KEY[next])}
          </button>
        ))}
      </div>

      {middle}
      {error && messages !== null ? errorBlock : null}

      <form ref={composerRef} onSubmit={handleSubmit} className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <IconButton
            type="button"
            size="lg"
            variant="secondary"
            aria-label={t('forum.attach')}
            disabled={posting}
            onClick={() => {
              fileInputRef.current?.click();
            }}
          >
            <ImagePlus aria-hidden="true" className="block h-5 w-5 shrink-0" />
          </IconButton>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov"
            className="hidden"
            disabled={posting}
            onChange={handleFileChange}
          />
          <textarea
            aria-label={t('forum.composerLabel')}
            placeholder={t('forum.placeholder')}
            value={draft}
            onChange={(event) => onDraftChange(event.target.value)}
            maxLength={FORUM_MESSAGE_MAX_LENGTH}
            rows={2}
            disabled={posting}
            className="min-h-11 min-w-0 flex-1 resize-none rounded-2xl border border-app-border-strong px-4 py-2.5 text-sm text-app-fg outline-none transition focus:border-app-border-strong disabled:opacity-50"
          />
          <IconButton
            type="submit"
            size="lg"
            variant="primary"
            disabled={posting}
            aria-label={t('forum.post')}
          >
            {posting ? (
              <Loader2 aria-hidden="true" className="block h-5 w-5 shrink-0 animate-spin" />
            ) : (
              <Send aria-hidden="true" className="block h-5 w-5 shrink-0" />
            )}
          </IconButton>
        </div>
        {videoDraft !== null ? (
          <div className="flex items-start gap-3 rounded-2xl border border-app-border bg-app-card-muted p-3">
            <video
              src={videoDraft.previewUrl}
              className="h-20 w-20 rounded-lg object-cover"
              muted
              playsInline
              preload="metadata"
            />
            <IconButton
              type="button"
              size="sm"
              variant="secondary"
              onClick={onClearPhoto}
              disabled={posting}
              aria-label={t('forum.removeVideo')}
            >
              <X aria-hidden="true" className="h-4 w-4" />
            </IconButton>
          </div>
        ) : null}
        {photoDraft !== null ? (
          <div className="flex items-start gap-3 rounded-2xl border border-app-border bg-app-card-muted p-3">
            {/* eslint-disable-next-line @next/next/no-img-element -- data URL preview from prepareForumPhoto */}
            <img
              src={photoDraft.previewUrl}
              alt={t('forum.previewAlt')}
              className="h-20 w-20 rounded-lg object-cover"
            />
            <IconButton
              type="button"
              size="sm"
              variant="secondary"
              onClick={onClearPhoto}
              disabled={posting}
              aria-label={t('forum.removePhoto')}
            >
              <X aria-hidden="true" className="h-4 w-4" />
            </IconButton>
          </div>
        ) : null}
      </form>

      {formError === 'empty' ? (
        <p role="alert" className="text-center text-sm text-red-600">
          {t('forum.errorEmpty')}
        </p>
      ) : null}
      {formError === 'tooLong' ? (
        <p role="alert" className="text-center text-sm text-red-600">
          {t('forum.errorTooLong')}
        </p>
      ) : null}
      {formError === 'request' ? (
        <p role="alert" className="text-center text-sm text-red-600">
          {t('forum.errorRequest')}
        </p>
      ) : null}
      {formError === 'rateLimit' ? (
        <p role="alert" className="text-center text-sm text-red-600">
          {t('forum.errorRateLimit')}
        </p>
      ) : null}
      {formError === 'unsupported' ? (
        <p role="alert" className="text-center text-sm text-red-600">
          {t('forum.errorUnsupported')}
        </p>
      ) : null}
      {formError === 'tooLarge' ? (
        <p role="alert" className="text-center text-sm text-red-600">
          {t('forum.errorTooLarge')}
        </p>
      ) : null}
    </div>
  );
}
