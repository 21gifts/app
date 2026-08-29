'use client';

import { Bitcoin, Loader2 } from 'lucide-react';
import { type FormEvent, type ReactElement } from 'react';
import { useTranslations } from '@/components/LocaleProvider';
import { QrCode } from '@/components/QrCode';
import { FORUM_MESSAGE_MAX_LENGTH, type ForumMessage } from '@/lib/api-types';
import { formatForumTime } from '@/lib/forum-time';
import {
  isAndroidUserAgent,
  walletOfSatoshiHref,
  walletOfSatoshiIntentHref,
} from '@/lib/wos-deep-link';

/** Client-side composer validation or request failure. */
export type ForumFormError = 'empty' | 'tooLong' | 'request' | 'rateLimit' | null;

/** Pay-sheet validation or request failure. */
export type ForumPayError = 'amount' | 'request' | 'rateLimit' | null;

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
}

/**
 * Presentational public forum: heading, list or empty/loading/error, composer,
 * per-card sats total with a Bitcoin pay icon beside it, and pay-on-note sheet
 * (amount → QR / Wallet of Satoshi).
 *
 * Always shows the heading and composer so validation errors can surface even
 * when the list is empty. Light neutral palette to match {@link WelcomeScreen}.
 *
 * @param props - Messages payload plus loading/error/composer/pay state.
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
}: ForumBoardProps): ReactElement {
  const { t, locale } = useTranslations();

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

  let middle: ReactElement;
  if (loading && messages === null) {
    middle = <p className="text-center text-sm text-neutral-500">{t('forum.loading')}</p>;
  } else if (error && messages === null) {
    middle = errorBlock;
  } else if (messages !== null && messages.length === 0) {
    middle = <p className="text-center text-sm text-neutral-500">{t('forum.empty')}</p>;
  } else if (messages !== null) {
    middle = (
      <ul aria-label={t('forum.listLabel')} className="flex flex-col gap-4">
        {messages.map((message) => {
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

          return (
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
              <div className="mt-3 flex items-center gap-1.5">
                <p className="text-xs font-medium text-neutral-500">
                  {formatSatsLabel(message.sats)}
                </p>
                <button
                  type="button"
                  aria-label={t('forum.pay')}
                  disabled={!message.payable || payBusy}
                  onClick={() => onPayOpen(message.id)}
                  className="inline-flex h-6 w-6 items-center justify-center rounded-full text-neutral-500 transition hover:bg-white hover:text-neutral-900 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Bitcoin aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
                </button>
              </div>

              {sheetOpen && invoiceForCard === null ? (
                <form
                  onSubmit={handlePaySubmit}
                  className="mt-3 flex flex-col gap-3 rounded-xl border border-neutral-200 bg-white p-3"
                >
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
                    <button
                      type="button"
                      onClick={onPayCancel}
                      className="inline-flex items-center rounded-full border border-neutral-300 px-5 py-2 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50"
                    >
                      {t('forum.payCancel')}
                    </button>
                  </div>
                </form>
              ) : null}

              {invoiceForCard !== null ? (
                <div className="mt-3 flex flex-col items-center gap-3 rounded-xl border border-neutral-200 bg-white p-4">
                  <p className="text-center text-sm text-neutral-600">
                    {t('forum.payConfirm', { amount: formatSatsLabel(invoiceForCard.amountSats) })}
                  </p>
                  <QrCode value={invoiceForCard.pr} label={t('forum.payInvoiceQr')} />
                  {/* v8 ignore start -- wosHref is set whenever an invoice is shown */}
                  {wosHref !== null ? (
                    <a
                      href={wosHref}
                      className="text-sm font-medium text-neutral-600 underline underline-offset-4 transition hover:text-neutral-900"
                    >
                      {t('forum.payOpenWallet')}
                    </a>
                  ) : null}
                  {/* v8 ignore stop */}
                  {/* v8 ignore start */}
                  {payWaiting ? (
                    <p className="text-center text-xs text-neutral-500">{t('forum.payWaiting')}</p>
                  ) : null}
                  {/* v8 ignore stop */}
                  <button
                    type="button"
                    onClick={onPayCancel}
                    className="inline-flex items-center rounded-full border border-neutral-300 px-5 py-2 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50"
                  >
                    {t('forum.payCancel')}
                  </button>
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

      {middle}
      {error && messages !== null ? errorBlock : null}

      <form onSubmit={handleSubmit} className="flex items-end gap-2">
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
          className="inline-flex h-11 shrink-0 items-center gap-2 rounded-full bg-neutral-900 px-5 text-sm font-medium text-white transition hover:bg-neutral-700 disabled:opacity-50"
        >
          {posting ? <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> : null}
          {t('forum.post')}
        </button>
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
    </div>
  );
}
