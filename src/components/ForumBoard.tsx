'use client';

import { ArrowLeft, Bitcoin, ImagePlus, Loader2, Send, X } from 'lucide-react';
import Link from 'next/link';
import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
  type ReactElement,
} from 'react';
import { useTranslations } from '@/components/LocaleProvider';
import { QrCode } from '@/components/QrCode';
import { FORUM_MESSAGE_MAX_LENGTH, type ForumMessage } from '@/lib/api-types';
import { FORUM_FEED_MODES, type ForumFeedMode, visibleForumMessages } from '@/lib/forum-feed';
import type { ForumPhotoPayload } from '@/lib/forum-photo';
import { formatForumTime } from '@/lib/forum-time';
import type { MessageKey } from '@/lib/messages';
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
export type ForumPayError = 'amount' | 'request' | 'rateLimit' | null;

/** Roles that show a clickable tag beside the author name. */
type ForumTaggedRole = 'founder' | 'moderator' | 'verified';

/** Catalog keys for a tagged role's label and explanation. */
const ROLE_TAG_KEYS: Record<ForumTaggedRole, { label: MessageKey; hint: MessageKey }> = {
  founder: { label: 'forum.role.founder', hint: 'forum.role.founderHint' },
  moderator: { label: 'forum.role.moderator', hint: 'forum.role.moderatorHint' },
  verified: { label: 'forum.role.verified', hint: 'forum.role.verifiedHint' },
};

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
  /** Called when the visitor picks a file from the attach control. */
  onPickPhoto: (file: File) => void;
  /** Clears the pending photo draft. */
  onClearPhoto: () => void;
  /** Message id → blob/object URL for inline photos already loaded. */
  photoUrls: Readonly<Record<string, string>>;
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
 * Presentational public forum: heading, optional dismissible living-room laws
 * hint box with links to `/rules` and `/contact`, Active/All/Most popular
 * selector, list or empty/loading/error, composer (attach + textarea + Send
 * icon), per-card sats total with a Bitcoin pay icon when the note is payable,
 * optional Founder / Moderator / Verified role pills with click-to-explain,
 * pay-on-note sheet (amount → desktop QR + Pay button with Wallet of Satoshi
 * icon; smartphone deep link only, no QR; top-left back control cancels), and
 * optional inline photos (caption below the photo).
 *
 * This is a messenger-group thread (oldest top, newest bottom above the
 * composer), not a social feed. Props stay newest-first; Active and All reverse
 * the filtered list for the DOM. Most popular keeps sats-desc order.
 *
 * Always shows the heading, mode selector, and composer so validation errors
 * can surface even when the list is empty. Light neutral palette to match
 * {@link WelcomeScreen}. Photos render from {@link ForumBoardProps.photoUrls}
 * blob URLs — never from an unauthenticated `<img src="/messages/.../photo">`.
 *
 * @param props - Messages payload plus loading/error/composer/pay/mode/photo/laws state.
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
  onPickPhoto,
  onClearPhoto,
  photoUrls,
}: ForumBoardProps): ReactElement {
  const { t, locale } = useTranslations();
  const composerRef = useRef<HTMLFormElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const newestId = messages?.[0]?.id ?? null;
  const [showPaymentQr, setShowPaymentQr] = useState(false);
  const [openRoleMessageId, setOpenRoleMessageId] = useState<string | null>(null);

  useEffect(() => {
    if (newestId === null) {
      return;
    }
    composerRef.current?.scrollIntoView({ block: 'end', behavior: 'auto' });
  }, [newestId]);

  useEffect(() => {
    setShowPaymentQr(!isSmartphoneUserAgent(navigator.userAgent));
  }, []);

  const formatSatsLabel = (sats: number): string => {
    if (sats === 1) {
      return t('forum.satsOne');
    }
    return t('forum.sats', { n: sats });
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    onPost();
  };

  const handlePaySubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    onPaySubmit();
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>): void => {
    const file = event.target.files?.[0];
    if (file !== undefined) {
      onPickPhoto(file);
    }
    event.target.value = '';
  };

  const errorBlock = (
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

  const visible = messages === null ? null : visibleForumMessages(messages, mode);

  let middle: ReactElement;
  if (loading && messages === null) {
    middle = <p className="text-center text-sm text-neutral-500">{t('forum.loading')}</p>;
  } else if (error && messages === null) {
    middle = errorBlock;
  } else if (messages !== null && messages.length === 0) {
    middle = <p className="text-center text-sm text-neutral-500">{t('forum.empty')}</p>;
  } else if (messages !== null && visible !== null && visible.length === 0) {
    middle = <p className="text-center text-sm text-neutral-500">{t('forum.emptyPaid')}</p>;
  } else if (messages !== null && visible !== null) {
    const displayed = mode === 'popular' ? visible : visible.slice().reverse();
    middle = (
      <ul aria-label={t('forum.listLabel')} className="flex flex-col gap-4">
        {displayed.map((message) => {
          const photoUrl = message.hasPhoto ? photoUrls[message.id] : undefined;
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

          return (
            <li
              key={message.id}
              data-message-id={message.id}
              className="rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium text-neutral-900">{message.name}</span>
                  {roleKeys !== null ? (
                    <button
                      type="button"
                      aria-expanded={roleHintOpen}
                      onClick={() => setOpenRoleMessageId(roleHintOpen ? null : message.id)}
                      className="rounded-full border border-neutral-300 px-2 py-0.5 text-xs font-medium text-neutral-600"
                    >
                      {t(roleKeys.label)}
                    </button>
                  ) : null}
                </div>
                <time dateTime={message.createdAt} className="text-xs text-neutral-400">
                  {formatForumTime(message.createdAt, locale)}
                </time>
              </div>
              {roleHintOpen && roleKeys !== null ? (
                <p role="status" className="mt-1 text-xs text-neutral-500">
                  {t(roleKeys.hint)}
                </p>
              ) : null}
              {photoUrl !== undefined ? (
                /* eslint-disable-next-line @next/next/no-img-element -- blob/object URLs from fetchMessagePhoto */
                <img
                  src={photoUrl}
                  alt={t('forum.photoAlt', { name: message.name })}
                  className="mt-2 max-h-80 w-full rounded-xl object-contain"
                />
              ) : null}
              {message.text !== '' ? (
                <p className="mt-2 whitespace-pre-wrap text-sm text-neutral-700">{message.text}</p>
              ) : null}
              <div className="mt-3 flex items-center gap-1.5">
                <p className="text-xs font-medium text-neutral-500">
                  {formatSatsLabel(message.sats)}
                </p>
                {message.payable ? (
                  <button
                    type="button"
                    aria-label={t('forum.pay')}
                    disabled={payBusy}
                    onClick={() => onPayOpen(message.id)}
                    className="inline-flex h-6 w-6 items-center justify-center rounded-full text-neutral-500 transition hover:bg-white hover:text-neutral-900 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <Bitcoin aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
                  </button>
                ) : null}
              </div>

              {sheetOpen && invoiceForCard === null ? (
                <form
                  onSubmit={handlePaySubmit}
                  className="relative mt-3 flex flex-col gap-3 rounded-xl border border-neutral-200 bg-white p-3 pl-11 pt-10"
                >
                  <button
                    type="button"
                    aria-label={t('forum.payBack')}
                    onClick={onPayCancel}
                    className="absolute left-2 top-2 inline-flex h-8 w-8 items-center justify-center rounded-full text-neutral-500 transition hover:bg-neutral-50 hover:text-neutral-900"
                  >
                    <ArrowLeft aria-hidden="true" className="h-4 w-4" />
                  </button>
                  <label className="flex flex-col gap-1 text-left text-sm text-neutral-700">
                    {t('forum.payAmountLabel')}
                    <input
                      type="text"
                      inputMode="numeric"
                      autoComplete="off"
                      autoCorrect="off"
                      spellCheck={false}
                      placeholder={t('forum.payAmountPlaceholder')}
                      value={payDraft}
                      disabled={payBusy}
                      onChange={(event) => onPayDraftChange(event.target.value)}
                      className="rounded-xl border border-neutral-300 px-3 py-2 text-neutral-900 outline-none focus:border-neutral-500 disabled:opacity-50"
                    />
                  </label>
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
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="submit"
                      disabled={payBusy}
                      className="inline-flex items-center justify-center gap-2 rounded-full bg-neutral-900 px-5 py-2 text-sm font-medium text-white transition hover:bg-neutral-700 disabled:opacity-50"
                    >
                      {payBusy ? (
                        <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
                      ) : null}
                      {t('forum.payContinue')}
                    </button>
                  </div>
                </form>
              ) : null}

              {invoiceForCard !== null ? (
                <div className="relative mt-3 flex flex-col items-center gap-3 rounded-xl border border-neutral-200 bg-white p-4">
                  <button
                    type="button"
                    aria-label={t('forum.payBack')}
                    onClick={onPayCancel}
                    className="absolute left-2 top-2 inline-flex h-8 w-8 items-center justify-center rounded-full text-neutral-500 transition hover:bg-neutral-50 hover:text-neutral-900"
                  >
                    <ArrowLeft aria-hidden="true" className="h-4 w-4" />
                  </button>
                  <p className="px-10 text-center text-sm text-neutral-600">
                    {t('forum.payConfirm', { amount: formatSatsLabel(invoiceForCard.amountSats) })}
                  </p>
                  {showPaymentQr ? (
                    <QrCode value={invoiceForCard.pr} label={t('forum.payInvoiceQr')} />
                  ) : null}
                  {/* v8 ignore start -- wosHref is set whenever an invoice is shown */}
                  {wosHref !== null ? (
                    <a
                      href={wosHref}
                      aria-label={t('forum.payOpenWalletAria')}
                      className="inline-flex items-center justify-center gap-2 rounded-full bg-neutral-900 px-5 py-2 text-sm font-medium text-white transition hover:bg-neutral-700"
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
                    <p className="text-center text-xs text-neutral-500">{t('forum.payWaiting')}</p>
                  ) : null}
                  {/* v8 ignore stop */}
                </div>
              ) : null}
            </li>
          );
        })}
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

      {lawsVisible ? (
        <div className="relative rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 pr-10">
          <button
            type="button"
            aria-label={t('forum.lawsDismiss')}
            onClick={onDismissLaws}
            className="absolute right-2 top-2 inline-flex h-7 w-7 items-center justify-center rounded-full text-neutral-500 transition hover:bg-white hover:text-neutral-900"
          >
            <X aria-hidden="true" className="h-4 w-4" />
          </button>
          <div className="flex flex-col items-center gap-2">
            <p className="text-center text-sm text-neutral-700">{t('forum.laws1')}</p>
            <p className="text-center text-sm text-neutral-700">{t('forum.laws2')}</p>
            <nav className="flex flex-wrap items-center justify-center gap-4 text-sm font-medium">
              <Link href="/rules" className="text-neutral-900 underline underline-offset-2">
                {t('forum.rulesLink')}
              </Link>
              <Link href="/contact" className="text-neutral-900 underline underline-offset-2">
                {t('forum.contactLink')}
              </Link>
            </nav>
          </div>
        </div>
      ) : null}

      <div
        role="group"
        aria-label={t('forum.modeLabel')}
        className="flex w-full rounded-full border border-neutral-200 bg-neutral-50 p-1"
      >
        {FORUM_FEED_MODES.map((next) => (
          <button
            key={next}
            type="button"
            aria-pressed={mode === next}
            onClick={() => onModeChange(next)}
            className={`flex-1 rounded-full px-3 py-1.5 text-sm font-medium ${
              mode === next ? 'bg-neutral-900 text-white' : 'text-neutral-600'
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
          <button
            type="button"
            aria-label={t('forum.attach')}
            disabled={posting}
            onClick={() => {
              fileInputRef.current?.click();
            }}
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-neutral-300 leading-none text-neutral-700 transition hover:bg-neutral-50 disabled:opacity-50"
          >
            <ImagePlus aria-hidden="true" className="block h-5 w-5 shrink-0" />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
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
            className="min-h-11 min-w-0 flex-1 resize-none rounded-2xl border border-neutral-300 px-4 py-2.5 text-sm text-neutral-900 outline-none transition focus:border-neutral-500 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={posting}
            aria-label={t('forum.post')}
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-neutral-900 leading-none text-white transition hover:bg-neutral-700 disabled:opacity-50"
          >
            {posting ? (
              <Loader2 aria-hidden="true" className="block h-5 w-5 shrink-0 animate-spin" />
            ) : (
              <Send aria-hidden="true" className="block h-5 w-5 shrink-0" />
            )}
          </button>
        </div>
        {photoDraft !== null ? (
          <div className="flex items-start gap-3 rounded-2xl border border-neutral-200 bg-neutral-50 p-3">
            {/* eslint-disable-next-line @next/next/no-img-element -- data URL preview from prepareForumPhoto */}
            <img
              src={photoDraft.previewUrl}
              alt={t('forum.previewAlt')}
              className="h-20 w-20 rounded-lg object-cover"
            />
            <button
              type="button"
              onClick={onClearPhoto}
              disabled={posting}
              aria-label={t('forum.removePhoto')}
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-neutral-300 text-neutral-700 transition hover:bg-white disabled:opacity-50"
            >
              <X aria-hidden="true" className="h-4 w-4" />
            </button>
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
