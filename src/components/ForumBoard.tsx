'use client';

import {
  ArrowLeft,
  ArrowUp,
  Check,
  Gift,
  ImagePlus,
  Link2,
  Loader2,
  Reply,
  Send,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
  type MouseEvent,
  type ReactElement,
} from 'react';
import { useAppShellScroller } from '@/components/AppShell';
import { ForumAskWizard, type ForumAskStep } from '@/components/ForumAskWizard';
import { ForumGoalBar } from '@/components/ForumGoalBar';
import { ForumNoteText } from '@/components/ForumNoteText';
import { ForumPhotoGallery } from '@/components/ForumPhotoGallery';
import { LinkedText } from '@/components/LinkedText';
import { useTranslations } from '@/components/LocaleProvider';
import { NoteTranslate } from '@/components/NoteTranslate';
import { preferredFiatSuffix } from '@/components/PreferredFiatSuffix';
import { ForumQuotedBody } from '@/components/QuotedForumNote';
import { useNumberFormat } from '@/components/NumberFormatProvider';
import { QrCode } from '@/components/QrCode';
import { Button, Field, IconButton, SegmentedControl } from '@/components/ui';
import { FORUM_MESSAGE_MAX_LENGTH, type ForumMessage } from '@/lib/api-types';
import { DeletePostControl } from '@/components/DeletePostControl';
import {
  FORUM_COMPOSE_EVENT,
  FORUM_FEED_MODES,
  consumePendingForumCompose,
  type ForumFeedMode,
  visibleForumMessages,
} from '@/lib/forum-feed';
import type { ForumPhotoPayload } from '@/lib/forum-photo';
import { isShopNote, stripShopHashtag } from '@/lib/forum-shop';
import { forumVideoSrc, type ForumVideoPayload } from '@/lib/forum-video';
import { formatForumTime } from '@/lib/forum-time';
import type { MessageKey } from '@/lib/messages';
import { useFiatPreference } from '@/components/FiatPreferenceProvider';
import {
  formatBitcoin,
  formatFiatDisplay,
  satsToFiatAmount,
  type FiatRateDay,
} from '@/lib/stats-money';
import {
  isAndroidUserAgent,
  isSmartphoneUserAgent,
  walletOfSatoshiHref,
  walletOfSatoshiIntentHref,
} from '@/lib/wos-deep-link';

/** Top-level compose mode: messenger post or Ask wizard. */
export type ForumComposeIntent = 'post' | 'ask';

export type { ForumAskStep } from '@/components/ForumAskWizard';

/** Client-side composer validation or request failure. */
export type ForumFormError =
  | 'empty'
  | 'tooLong'
  | 'request'
  | 'rateLimit'
  | 'unsupported'
  | 'tooLarge'
  | 'tooMany'
  | 'ask'
  | null;

/** Reply composer validation; `amount` is the paid-reply sats field. */
export type ForumReplyFormError = ForumFormError | 'amount';

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

/**
 * Role that shows a forum tag, or `null` for basis / missing.
 *
 * @param role - Live account role from the api, if present.
 * @returns Tagged role or `null`.
 */
function forumTaggedRole(role: string | undefined): ForumTaggedRole | null {
  if (role === 'founder' || role === 'moderator' || role === 'verified') {
    return role;
  }
  return null;
}

const COPY_RESET_MS = 1200;

/** Empty pay-sheet draft submits this many sats (same as the placeholder). */
const DEFAULT_PAY_PREVIEW_SATS = 21;

/**
 * Whole sats implied by the pay-sheet draft.
 *
 * @param draft - Raw field value.
 * @returns Preview sats, or `null` when the draft is not a valid amount.
 */
function previewPaySats(draft: string): number | null {
  const raw = draft.trim();
  if (raw === '') {
    return DEFAULT_PAY_PREVIEW_SATS;
  }
  if (!/^\d+$/.test(raw)) {
    return null;
  }
  const sats = Number.parseInt(raw, 10);
  if (sats <= 0 || !Number.isSafeInteger(sats)) {
    return null;
  }
  return sats;
}

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
  /** Catalog key when `messages` is a successful empty list. Default `forum.empty`. */
  emptyKey?: 'forum.empty' | 'shops.empty';
  /** True when the latest fetch failed. Copy comes from `forum.error`. */
  error: boolean;
  /** True while a fetch is in flight. */
  loading: boolean;
  /** True while a silent/pull refresh is in flight (list stays on screen). */
  refreshing?: boolean;
  /** Re-fetch the forum list. Omit to disable pull-to-refresh. */
  onRefresh?: () => void;
  /** True when unseen notes exist and the page is scrolled down. Default false. */
  newPostsAvailable?: boolean;
  /** Apply unseen notes and scroll to top. Omit with `newPostsAvailable` falsy. */
  onShowNewPosts?: () => void;
  /** True when an unread moderator-appointed notification exists. Default false. */
  moderatorAppointedAvailable?: boolean;
  /** Mark that notification read and hide the pill. Omit with `moderatorAppointedAvailable` falsy. */
  onShowModeratorAppointed?: () => void;
  /** True while a post is in flight. */
  posting: boolean;
  /** Composer draft text. */
  draft: string;
  /** Called when the composer value changes. */
  onDraftChange: (value: string) => void;
  /** Optional whole-sat ask draft for a top-level note. */
  askDraft: string;
  /** Called when the Ask field changes. */
  onAskDraftChange: (value: string) => void;
  /** Messenger vs Ask wizard. Default `post`. */
  composeIntent?: ForumComposeIntent;
  /** Called when the visitor picks Post or Ask. */
  onComposeIntentChange?: (intent: ForumComposeIntent) => void;
  /** Ask wizard step. Default 1. */
  askStep?: ForumAskStep;
  /** Called when the wizard step changes. */
  onAskStepChange?: (step: ForumAskStep) => void;
  /** Display name for the Ask preview card. */
  authorName?: string;
  /** Called when the composer form is submitted. */
  onPost: () => void;
  /** Retry handler for a failed fetch. */
  onRetry: () => void;
  /** Client-side composer validation or request failure. */
  formError: ForumFormError;
  /** New-post composer `maxLength`. Default {@link FORUM_MESSAGE_MAX_LENGTH}. */
  composerMaxLength?: number;
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
  onPaySubmit: () => void | Promise<ForumPayInvoice | null | undefined>;
  /** Closes the pay sheet and clears invoice state. */
  onPayCancel: () => void;
  /**
   * Latest gift-day totals used to scale sats into CHF/EUR/USD/PHP.
   * Omit or `null` when stats have not loaded — amounts stay ₿-only.
   */
  rateDay?: FiatRateDay | null;
  /** Selected feed mode. Default in the loader is Active. */
  mode: ForumFeedMode;
  /** Called when the visitor picks another mode. */
  onModeChange: (mode: ForumFeedMode) => void;
  /** When false, omit the Active / No gifts yet / All / Most popular control and show every loaded row (same as mode all). Default true. */
  modeSelector?: boolean;
  /** Optional ref attached near the end of the visible feed for loader pagination. */
  nearEndRef?: (node: HTMLLIElement | null) => void;
  /**
   * Unseen zero-sat notes since the last No gifts yet visit. Chip is shown
   * only when this is \> 0 and unpaid is not selected. Default 0.
   */
  unpaidNewCount?: number;
  /** When true, render the living-room laws hint box. */
  lawsVisible: boolean;
  /** Called when the user clicks the hint dismiss control. */
  onDismissLaws: () => void;
  /** Prepared photos waiting to post. */
  photoDrafts: ForumPhotoPayload[];
  /** Prepared video waiting to post, or `null`. */
  videoDraft?: ForumVideoPayload | null;
  /** Called when the visitor picks files from the attach control. */
  onPickFiles: (files: File[]) => void;
  /** Removes one pending photo draft. */
  onRemovePhoto: (index: number) => void;
  /** Clears the pending video and photos. */
  onClearPhoto: () => void;
  /** Message id plus index → blob/object URL for inline photos already loaded. */
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
  /** Optional sats draft for a paid reply. */
  replyAmountDraft?: string;
  /** Called when the reply amount draft changes. */
  onReplyAmountDraftChange?: (value: string) => void;
  /** Called when the reply form is submitted. */
  onReplyPost: () => void;
  /** True while a reply post is in flight. */
  replyPosting: boolean;
  /** Reply composer validation or request failure. */
  replyFormError: ForumReplyFormError;
  /** When true, hide the new-note composer (profile note card). */
  composerHidden?: boolean;
  /** Remove a moderated post or nested reply after a successful server deletion. */
  onDeleted?: (messageId: string) => void;
  /**
   * When set, that nested reply gets `data-permalink-target="true"` and
   * `ring-1 ring-app-fg`. Parent notes are not ringed (same as the unsigned
   * public thread). Omit or `null` for no ring.
   */
  permalinkTargetId?: string | null;
  /**
   * When false, note and reply bodies stay full (signed-in `/messages/[id]`).
   * Default true for the feed and profile.
   */
  truncate?: boolean;
}

/**
 * Amount form and invoice card for one payable reply.
 *
 * @param props - Open pay-sheet state for `messageId`.
 * @returns The in-card sheet.
 */
function ForumPaySheet({
  messageId,
  payDraft,
  payBusy,
  payError,
  payInvoice,
  payWaiting,
  onPayDraftChange,
  onPaySubmit,
  onPayCancel,
  rateDay,
  showPaymentQr,
  onInteract,
}: {
  messageId: string;
  payDraft: string;
  payBusy: boolean;
  payError: ForumPayError;
  payInvoice: ForumPayInvoice | null;
  payWaiting: boolean;
  onPayDraftChange: (value: string) => void;
  onPaySubmit: () => void | Promise<ForumPayInvoice | null | undefined>;
  onPayCancel: () => void;
  rateDay: FiatRateDay | null;
  showPaymentQr: boolean;
  onInteract: (event: MouseEvent) => void;
}): ReactElement {
  const { t } = useTranslations();
  const { numberFormat } = useNumberFormat();
  const { fiat } = useFiatPreference();
  const invoiceForCard =
    payInvoice !== null && payInvoice.messageId === messageId ? payInvoice : null;
  const payPreviewSats = invoiceForCard?.amountSats ?? previewPaySats(payDraft);
  const payPreviewFiat =
    payPreviewSats !== null && rateDay !== null
      ? satsToFiatAmount(payPreviewSats, rateDay, fiat)
      : null;
  /* v8 ignore next 8 -- SSR has no navigator */
  const isSmartphone =
    typeof navigator !== 'undefined' ? isSmartphoneUserAgent(navigator.userAgent) : false;
  const isIosPhone =
    typeof navigator !== 'undefined'
      ? isSmartphone && !isAndroidUserAgent(navigator.userAgent)
      : false;
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

  const handlePaySubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    void Promise.resolve(onPaySubmit());
  };

  const walletButton =
    wosHref === null ? null : (
      <Button
        type="button"
        aria-label={t('forum.payOpenWalletAria')}
        disabled={payBusy}
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
          window.location.href = wosHref;
        }}
      >
        {t('forum.payOpenWallet')}
      </Button>
    );

  return (
    <>
      {isSmartphone || invoiceForCard === null ? (
        <form
          onSubmit={handlePaySubmit}
          onClick={onInteract}
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
            value={invoiceForCard === null ? payDraft : String(invoiceForCard.amountSats)}
            disabled={payBusy || invoiceForCard !== null}
            onChange={(event) => onPayDraftChange(event.target.value)}
          />
          {payPreviewFiat !== null ? (
            <p className="text-sm tabular-nums lining-nums text-app-muted">
              {formatFiatDisplay(payPreviewFiat, fiat, numberFormat)}
            </p>
          ) : null}
          {payError === 'amount' ? (
            <p role="alert" className="text-sm text-app-danger">
              {t('forum.payErrorAmount')}
            </p>
          ) : null}
          {payError === 'request' ? (
            <p role="alert" className="text-sm text-app-danger">
              {t('forum.payErrorRequest')}
            </p>
          ) : null}
          {payError === 'rateLimit' ? (
            <p role="alert" className="text-sm text-app-danger">
              {t('forum.payErrorRateLimit')}
            </p>
          ) : null}
          {payError === 'authorWallet' ? (
            <p role="alert" className="text-sm text-app-danger">
              {t('forum.payErrorAuthorWallet')}
            </p>
          ) : null}
          {invoiceForCard === null ? (
            <Button
              type="submit"
              disabled={payBusy}
              icon={
                payBusy ? (
                  <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
                ) : undefined
              }
            >
              {isIosPhone ? t('forum.payNow') : t('forum.payContinue')}
            </Button>
          ) : (
            <>
              {walletButton}
              {payWaiting ? (
                <p className="text-center text-xs text-app-muted">{t('forum.payWaiting')}</p>
              ) : null}
            </>
          )}
        </form>
      ) : null}

      {invoiceForCard !== null && !isSmartphone ? (
        <div
          onClick={onInteract}
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
              amount: formatBitcoin(invoiceForCard.amountSats, numberFormat),
            })}
            {preferredFiatSuffix(invoiceForCard.amountSats, rateDay, fiat, numberFormat)}
          </p>
          {showPaymentQr ? (
            <QrCode value={invoiceForCard.pr} label={t('forum.payInvoiceQr')} />
          ) : null}
          {walletButton}
          {/* v8 ignore start -- payWaiting is true only after invoice mint while polling */}
          {payWaiting ? (
            <p className="text-center text-xs text-app-muted">{t('forum.payWaiting')}</p>
          ) : null}
          {/* v8 ignore stop */}
        </div>
      ) : null}
    </>
  );
}

const MODE_LABEL_KEY: Record<
  ForumFeedMode,
  'forum.modeActive' | 'forum.modeUnpaid' | 'forum.modeAll' | 'forum.modePopular'
> = {
  active: 'forum.modeActive',
  unpaid: 'forum.modeUnpaid',
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
 * Active/No gifts yet/All/Most popular selector (unpaid may show a count
 * chip of unseen zero-sat notes when `unpaidNewCount` is \> 0 and that mode
 * is not selected; omitted when `modeSelector` is false or `composerHidden`
 * is true), composer under the mode
 * filters above the newest-first list (new notes only; Post/Ask pill;
 * Post is attach + text + send, Ask is the four-step wizard), newest-first list (social
 * feed) or empty/loading/error, per-card expand for oldest-first replies +
 * reply composer (labeled Amount field; gift-only rows use `forum.giftReply`
 * + `formatBitcoin(sats, numberFormat)`, text-plus-gift shows the amount
 * under the body), copy-link control, `ForumGoalBar` on a top-level note
 * with `goalSats`, React control on posts (`forum.react`, lucide Reply;
 * expands the reply composer; omitted when `deletedAt` is set), payable-reply
 * pay sheet (Gift on nested replies and on top-level cards with `parentId`;
 * never on posts; omitted when `deletedAt` is set), staff Delete omitted
 * when `deletedAt` is set, optional inline photos, and optional inline videos.
 * When `onRefresh` is passed, supports pull-to-refresh; `refreshing` shows a
 * visually hidden (`sr-only`) refresh status without changing idle markup.
 * When unseen notes are held for a scrolled visitor, a labeled New posts pill
 * applies them without placing refresh chrome in the idle board. When an unread
 * moderator-appointed notification exists, a labeled pill in the same visual
 * language marks it read; pills are sticky in the AppShell scroller under the
 * frame header (`top-2`, or `top-14` for New posts when both show).
 * Optional `permalinkTargetId` rings the matching nested reply only; optional
 * `nearEndRef` attaches to the note about eight rows from the visible end.
 * Shop notes show `#Shop` linking to `/shops` and hide `#21GiftsShop`; optional `emptyKey`.
 *
 * @param props - Messages payload plus loading/error/composer (including
 * `askDraft` / compose intent / Ask wizard) /pay/mode/photo/video/laws/thread/permalink/truncate state.
 * @returns The forum board element.
 */
export function ForumBoard({
  messages,
  emptyKey = 'forum.empty',
  error,
  loading,
  refreshing = false,
  onRefresh,
  newPostsAvailable = false,
  onShowNewPosts,
  moderatorAppointedAvailable = false,
  onShowModeratorAppointed,
  posting,
  draft,
  onDraftChange,
  askDraft,
  onAskDraftChange,
  composeIntent = 'post',
  onComposeIntentChange,
  askStep = 1,
  onAskStepChange,
  authorName = '',
  onPost,
  onRetry,
  formError,
  composerMaxLength = FORUM_MESSAGE_MAX_LENGTH,
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
  rateDay = null,
  mode,
  onModeChange,
  modeSelector = true,
  nearEndRef,
  unpaidNewCount = 0,
  lawsVisible,
  onDismissLaws,
  photoDrafts,
  videoDraft = null,
  onPickFiles,
  onRemovePhoto,
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
  replyAmountDraft = '',
  onReplyAmountDraftChange,
  onReplyPost,
  replyPosting,
  replyFormError,
  composerHidden = false,
  onDeleted,
  permalinkTargetId = null,
  truncate = true,
}: ForumBoardProps): ReactElement {
  const { t, locale } = useTranslations();
  const { numberFormat } = useNumberFormat();
  const { fiat } = useFiatPreference();
  const router = useRouter();
  const scroller = useAppShellScroller();
  const rootRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const replyComposerRef = useRef<HTMLTextAreaElement>(null);
  const [showPaymentQr, setShowPaymentQr] = useState(false);
  const [openRoleMessageId, setOpenRoleMessageId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [deadVideoIds, setDeadVideoIds] = useState<ReadonlySet<string>>(() => new Set());
  const [pullArmed, setPullArmed] = useState(false);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const copyMounted = useRef(true);
  const refreshingRef = useRef(refreshing);
  refreshingRef.current = refreshing;
  const loadingRef = useRef(loading);
  loadingRef.current = loading;
  const onRefreshRef = useRef(onRefresh);
  onRefreshRef.current = onRefresh;

  useEffect(() => {
    if (onRefresh === undefined) {
      return;
    }

    let startY: number | null = null;
    let deltaY = 0;
    let armed = false;

    const pageScrollTop = (): number => {
      if (scroller !== null) return scroller.scrollTop;
      return window.scrollY || document.documentElement.scrollTop || 0;
    };

    const resetPull = (): void => {
      startY = null;
      deltaY = 0;
      if (armed) {
        armed = false;
        setPullArmed(false);
      }
    };

    const onTouchStart = (event: TouchEvent): void => {
      if (refreshingRef.current || loadingRef.current) {
        return;
      }
      if (pageScrollTop() >= 8) {
        return;
      }
      const touch = event.touches[0];
      if (touch === undefined) {
        return;
      }
      startY = touch.clientY;
      deltaY = 0;
    };

    const onTouchMove = (event: TouchEvent): void => {
      if (startY === null || refreshingRef.current || loadingRef.current) {
        return;
      }
      if (pageScrollTop() >= 8) {
        resetPull();
        return;
      }
      const touch = event.touches[0];
      /* v8 ignore next 3 -- TouchList can be empty mid-gesture */
      if (touch === undefined) {
        return;
      }
      deltaY = touch.clientY - startY;
      if (deltaY > 0) {
        if (deltaY > 24) {
          /* v8 ignore start -- preventDefault throws when the listener is passive */
          try {
            event.preventDefault();
          } catch {
            // Passive listeners still fire touchend.
          }
          /* v8 ignore stop */
        }
        if (deltaY >= 56 && !armed) {
          armed = true;
          setPullArmed(true);
        }
      }
    };

    const onTouchEnd = (): void => {
      const shouldRefresh = startY !== null && deltaY >= 56 && refreshingRef.current === false;
      resetPull();
      if (shouldRefresh) {
        onRefreshRef.current?.();
      }
    };

    const onTouchCancel = (): void => {
      resetPull();
    };

    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('touchend', onTouchEnd);
    window.addEventListener('touchcancel', onTouchCancel);
    return () => {
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
      window.removeEventListener('touchcancel', onTouchCancel);
    };
  }, [onRefresh, scroller]);

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

  useEffect(() => {
    const tryFocusComposer = (): boolean => {
      const el = composerRef.current;
      if (el === null) {
        return false;
      }
      el.focus();
      el.scrollIntoView({ block: 'nearest' });
      return true;
    };
    const onCompose = (): void => {
      if (tryFocusComposer()) {
        consumePendingForumCompose();
      }
    };
    window.addEventListener(FORUM_COMPOSE_EVENT, onCompose);
    if (composerRef.current !== null && consumePendingForumCompose()) {
      tryFocusComposer();
    }
    return () => {
      window.removeEventListener(FORUM_COMPOSE_EVENT, onCompose);
    };
  }, []);

  const handleSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    onPost();
  };

  const handleReplySubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    if (replyPosting || repliesLoading || repliesError || replies === null) {
      return;
    }
    onReplyPost();
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>): void => {
    const files = event.target.files;
    if (files !== null && files.length > 0) {
      onPickFiles(Array.from(files));
    }
    event.target.value = '';
  };

  const flashCopied = (messageId: string): void => {
    setCopiedId(messageId);
    /* v8 ignore next 6 -- timer reset between copies */
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
      /* v8 ignore next 3 -- copy resolved after unmount */
      if (!copyMounted.current) {
        return;
      }
      flashCopied(messageId);
      return;
    } catch {
      /* v8 ignore next 3 -- clipboard threw after unmount */
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
      <p role="alert" className="text-center text-sm text-app-danger">
        {t('forum.error')}
      </p>
      <Button type="button" variant="secondary" onClick={onRetry}>
        {t('forum.retry')}
      </Button>
    </div>
  );

  const listMode = modeSelector ? mode : 'all';
  const visible = messages === null ? null : visibleForumMessages(messages, listMode);

  let middle: ReactElement;
  if (loading && messages === null) {
    middle = <p className="text-center text-sm text-app-muted">{t('forum.loading')}</p>;
  } else if (error && messages === null) {
    middle = errorBlock;
  } else if (messages !== null && messages.length === 0) {
    middle = <p className="text-center text-sm text-app-muted">{t(emptyKey)}</p>;
  } else if (messages !== null && visible !== null && visible.length === 0) {
    middle = (
      <p className="text-center text-sm text-app-muted">
        {t(mode === 'unpaid' ? 'forum.emptyUnpaid' : 'forum.emptyPaid')}
      </p>
    );
  } else if (messages !== null && visible !== null) {
    const displayed = visible;
    middle = (
      <ul
        aria-label={t('forum.listLabel')}
        aria-busy={refreshing === true}
        className="flex flex-col gap-4"
      >
        {displayed.map((message, index) => {
          const photoCount = message.photoCount ?? (message.hasPhoto ? 1 : 0);
          const loadedPhotoUrls = Array.from({ length: photoCount }, (_, index) => ({
            index,
            url: photoUrls[`${message.id}:${index}`],
          })).filter((photo): photo is { index: number; url: string } => photo.url !== undefined);
          const photoUrl = photoUrls[`${message.id}:0`];
          const videoSrc =
            message.hasVideo && !deadVideoIds.has(message.id)
              ? (videoUrls[message.id] ?? forumVideoSrc(message.id, message.videoContentType))
              : undefined;
          const taggedRole = forumTaggedRole(message.role);
          const roleKeys = taggedRole === null ? null : ROLE_TAG_KEYS[taggedRole];
          const roleHintOpen = openRoleMessageId === message.id;
          const expanded = expandedId === message.id;
          const copied = copiedId === message.id;
          const shopNote = message.parentId === undefined && isShopNote(message.text);
          const displayText = shopNote ? stripShopHashtag(message.text) : message.text;

          const stopCardToggle = (event: { stopPropagation(): void }): void => {
            event.stopPropagation();
          };
          const copyLabelKey =
            message.parentId === undefined ? 'forum.copyLink' : 'forum.copyReplyLink';

          return (
            <li
              key={message.id}
              {...(nearEndRef !== undefined && index === Math.max(0, displayed.length - 8)
                ? { ref: nearEndRef }
                : {})}
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
                    {typeof message.accountId === 'string' && message.accountId !== '' ? (
                      <button
                        type="button"
                        aria-label={t('forum.authorProfile')}
                        className="text-sm font-medium text-app-fg underline underline-offset-2"
                        onClick={(event) => {
                          stopCardToggle(event);
                          router.push(`/members/${message.accountId}`);
                        }}
                      >
                        {message.name}
                      </button>
                    ) : (
                      <span className="text-sm font-medium text-app-fg">{message.name}</span>
                    )}
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
                    ) : message.via === 'nostr' ? (
                      <button
                        type="button"
                        aria-expanded={roleHintOpen}
                        onClick={(event) => {
                          stopCardToggle(event);
                          setOpenRoleMessageId(roleHintOpen ? null : message.id);
                        }}
                        className="rounded-full border border-app-border-strong px-2 py-0.5 text-xs font-medium text-app-muted"
                      >
                        {t('forum.via.nostr')}
                      </button>
                    ) : null}
                    {shopNote ? (
                      <Link
                        href="/shops"
                        className="rounded-full border border-app-border-strong px-2 py-0.5 text-xs font-medium text-app-muted no-underline"
                        onClick={stopCardToggle}
                        onKeyDown={stopCardToggle}
                      >
                        {t('forum.shopTag')}
                      </Link>
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
                ) : roleHintOpen && message.via === 'nostr' ? (
                  <p role="status" className="mt-1 text-xs text-app-muted">
                    {t('forum.via.nostrHint')}
                  </p>
                ) : null}
                {videoSrc !== undefined ? (
                  <video
                    src={videoSrc}
                    poster={photoUrl}
                    controls
                    playsInline
                    preload="metadata"
                    className="mt-2 mx-auto block h-auto w-auto max-h-80 max-w-full rounded-xl object-contain"
                    onClick={stopCardToggle}
                    onError={() => {
                      setDeadVideoIds((prev) => new Set(prev).add(message.id));
                    }}
                  />
                ) : photoCount <= 1 && photoUrl !== undefined ? (
                  /* eslint-disable-next-line @next/next/no-img-element -- blob/object URLs from fetchMessagePhoto */
                  <img
                    src={photoUrl}
                    alt={t('forum.photoAlt', { name: message.name })}
                    className="mt-2 max-h-80 w-full rounded-xl object-contain"
                    onClick={stopCardToggle}
                  />
                ) : photoCount > 1 && loadedPhotoUrls.length > 0 ? (
                  <ForumPhotoGallery
                    photos={loadedPhotoUrls}
                    alt={t('forum.photoAlt', { name: message.name })}
                    className="mt-2"
                    onPhotoClick={stopCardToggle}
                  />
                ) : null}
                {displayText !== '' ? (
                  <div className="mt-2">
                    {message.via === 'nostr' ? (
                      <>
                        {truncate ? (
                          <ForumNoteText
                            plain
                            text={displayText}
                            className="whitespace-pre-wrap text-sm text-app-fg"
                          />
                        ) : (
                          <LinkedText
                            plain
                            text={displayText}
                            className="whitespace-pre-wrap text-sm text-app-fg"
                          />
                        )}
                        <NoteTranslate plain text={displayText} />
                      </>
                    ) : (
                      <ForumQuotedBody
                        text={displayText}
                        knownNotes={[...messages, ...(Array.isArray(replies) ? replies : [])]}
                        excludeId={message.id}
                        rateDay={rateDay ?? null}
                        fiat={fiat}
                        truncate={truncate}
                        onActivate={(event) => {
                          event.stopPropagation();
                        }}
                      />
                    )}
                  </div>
                ) : null}
              </div>
              {message.parentId === undefined &&
              typeof message.goalSats === 'number' &&
              message.goalSats > 0 ? (
                <ForumGoalBar
                  sats={message.sats}
                  goalSats={message.goalSats}
                  rateDay={rateDay ?? null}
                />
              ) : null}
              <div className="mt-3 flex flex-wrap items-center gap-5">
                <button
                  type="button"
                  aria-expanded={expanded}
                  onClick={() => {
                    onToggleExpand(message.id);
                  }}
                  className="text-xs font-medium tabular-nums lining-nums text-app-muted"
                >
                  <span>{formatBitcoin(message.sats, numberFormat)}</span>
                  {preferredFiatSuffix(message.sats, rateDay, fiat, numberFormat)}
                </button>
                {message.parentId === undefined && message.deletedAt === undefined ? (
                  <IconButton
                    type="button"
                    size="sm"
                    variant="ghost"
                    aria-label={t('forum.react')}
                    title={t('forum.react')}
                    onClick={(event) => {
                      stopCardToggle(event);
                      if (expandedId !== message.id) {
                        onToggleExpand(message.id);
                      } else {
                        replyComposerRef.current?.focus();
                      }
                    }}
                  >
                    <Reply aria-hidden="true" className="h-4 w-4 shrink-0" />
                  </IconButton>
                ) : null}
                {message.parentId !== undefined &&
                message.payable &&
                message.deletedAt === undefined ? (
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
                    <Gift aria-hidden="true" className="h-4 w-4 shrink-0" />
                  </IconButton>
                ) : null}
                <IconButton
                  type="button"
                  size="sm"
                  variant="ghost"
                  aria-label={t(copyLabelKey)}
                  title={t(copyLabelKey)}
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
                {onDeleted !== undefined && message.deletedAt === undefined ? (
                  <DeletePostControl messageId={message.id} onDeleted={onDeleted} />
                ) : null}
                {message.parentId === undefined ? (
                  <button
                    type="button"
                    aria-expanded={expanded}
                    onClick={() => {
                      onToggleExpand(message.id);
                    }}
                    className="ml-auto text-xs text-app-subtle"
                  >
                    {t('forum.replyCount', { count: String(message.replyCount) })}
                  </button>
                ) : null}
              </div>

              {payMessageId === message.id ? (
                <ForumPaySheet
                  messageId={message.id}
                  payDraft={payDraft}
                  payBusy={payBusy}
                  payError={payError}
                  payInvoice={payInvoice}
                  payWaiting={payWaiting}
                  onPayDraftChange={onPayDraftChange}
                  onPaySubmit={onPaySubmit}
                  onPayCancel={onPayCancel}
                  rateDay={rateDay}
                  showPaymentQr={showPaymentQr}
                  onInteract={stopCardToggle}
                />
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
                      <p role="alert" className="text-center text-sm text-app-danger">
                        {t('forum.repliesError')}
                      </p>
                      <Button type="button" variant="secondary" onClick={onRetryReplies}>
                        {t('forum.retry')}
                      </Button>
                    </div>
                  ) : null}
                  {replies !== null && !repliesLoading && !repliesError ? (
                    <ul className="flex flex-col gap-3">
                      {(Array.isArray(replies) ? replies : []).map((reply) => {
                        const replyTaggedRole = forumTaggedRole(reply.role);
                        const replyRoleKeys =
                          replyTaggedRole === null ? null : ROLE_TAG_KEYS[replyTaggedRole];
                        const replyHintOpen = openRoleMessageId === reply.id;
                        return (
                          <li
                            key={reply.id}
                            data-reply-id={reply.id}
                            {...(permalinkTargetId === reply.id
                              ? { 'data-permalink-target': 'true' }
                              : {})}
                            className={
                              permalinkTargetId === reply.id
                                ? 'rounded-xl border border-app-border bg-app-card px-3 py-2 ring-1 ring-app-fg'
                                : 'rounded-xl border border-app-border bg-app-card px-3 py-2'
                            }
                          >
                            <div className="flex flex-wrap items-baseline justify-between gap-2">
                              <div className="flex flex-wrap items-center gap-2">
                                {typeof reply.accountId === 'string' && reply.accountId !== '' ? (
                                  <button
                                    type="button"
                                    aria-label={t('forum.authorProfile')}
                                    className="text-sm font-medium text-app-fg underline underline-offset-2"
                                    onClick={(event) => {
                                      stopCardToggle(event);
                                      router.push(`/members/${reply.accountId}`);
                                    }}
                                  >
                                    {reply.name}
                                  </button>
                                ) : (
                                  <span className="text-sm font-medium text-app-fg">
                                    {reply.name}
                                  </span>
                                )}
                                {replyRoleKeys !== null ? (
                                  <button
                                    type="button"
                                    aria-expanded={replyHintOpen}
                                    onClick={(event) => {
                                      stopCardToggle(event);
                                      setOpenRoleMessageId(replyHintOpen ? null : reply.id);
                                    }}
                                    className="rounded-full border border-app-border-strong px-2 py-0.5 text-xs font-medium text-app-muted"
                                  >
                                    {t(replyRoleKeys.label)}
                                  </button>
                                ) : reply.via === 'nostr' ? (
                                  <button
                                    type="button"
                                    aria-expanded={replyHintOpen}
                                    onClick={(event) => {
                                      stopCardToggle(event);
                                      setOpenRoleMessageId(replyHintOpen ? null : reply.id);
                                    }}
                                    className="rounded-full border border-app-border-strong px-2 py-0.5 text-xs font-medium text-app-muted"
                                  >
                                    {t('forum.via.nostr')}
                                  </button>
                                ) : null}
                              </div>
                              <time dateTime={reply.createdAt} className="text-xs text-app-subtle">
                                {formatForumTime(reply.createdAt, locale)}
                              </time>
                            </div>
                            {replyHintOpen && replyRoleKeys !== null ? (
                              <p role="status" className="mt-1 text-xs text-app-muted">
                                {t(replyRoleKeys.hint)}
                              </p>
                            ) : replyHintOpen && reply.via === 'nostr' ? (
                              <p role="status" className="mt-1 text-xs text-app-muted">
                                {t('forum.via.nostrHint')}
                              </p>
                            ) : null}
                            {reply.text === '' && reply.sats > 0 ? (
                              <p className="mt-1 text-sm tabular-nums lining-nums text-app-fg">
                                {t('forum.giftReply', {
                                  amount: formatBitcoin(reply.sats, numberFormat),
                                })}
                                {preferredFiatSuffix(reply.sats, rateDay, fiat, numberFormat)}
                              </p>
                            ) : null}
                            {reply.text !== '' ? (
                              <div className="mt-1">
                                {reply.via === 'nostr' ? (
                                  <>
                                    {truncate ? (
                                      <ForumNoteText
                                        plain
                                        text={reply.text}
                                        className="whitespace-pre-wrap text-sm text-app-fg"
                                      />
                                    ) : (
                                      <LinkedText
                                        plain
                                        text={reply.text}
                                        className="whitespace-pre-wrap text-sm text-app-fg"
                                      />
                                    )}
                                    <NoteTranslate plain text={reply.text} />
                                  </>
                                ) : (
                                  <ForumQuotedBody
                                    text={reply.text}
                                    knownNotes={[...messages, ...replies]}
                                    excludeId={reply.id}
                                    rateDay={rateDay ?? null}
                                    fiat={fiat}
                                    truncate={truncate}
                                    onActivate={(event) => {
                                      event.stopPropagation();
                                    }}
                                  />
                                )}
                              </div>
                            ) : null}
                            {reply.text !== '' && reply.sats > 0 ? (
                              <p className="mt-1 text-sm tabular-nums lining-nums text-app-muted">
                                {formatBitcoin(reply.sats, numberFormat)}
                                {preferredFiatSuffix(reply.sats, rateDay, fiat, numberFormat)}
                              </p>
                            ) : null}
                            <div
                              className={
                                reply.deletedAt === undefined &&
                                (reply.payable || onDeleted !== undefined)
                                  ? 'mt-2 flex flex-wrap items-start gap-5'
                                  : 'mt-2'
                              }
                            >
                              {reply.deletedAt === undefined && reply.payable ? (
                                <IconButton
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  aria-label={t('forum.pay')}
                                  disabled={payBusy}
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    onPayOpen(reply.id);
                                  }}
                                >
                                  <Gift aria-hidden="true" className="h-4 w-4 shrink-0" />
                                </IconButton>
                              ) : null}
                              <IconButton
                                type="button"
                                size="sm"
                                variant="ghost"
                                aria-label={t('forum.copyReplyLink')}
                                title={t('forum.copyReplyLink')}
                                data-copied={copiedId === reply.id ? 'true' : undefined}
                                onClick={(event) => {
                                  stopCardToggle(event);
                                  void copyMessageLink(reply.id);
                                }}
                              >
                                {copiedId === reply.id ? (
                                  <Check aria-hidden="true" className="h-3.5 w-3.5" />
                                ) : (
                                  <Link2 aria-hidden="true" className="h-3.5 w-3.5" />
                                )}
                              </IconButton>
                              {reply.deletedAt === undefined && onDeleted !== undefined ? (
                                <DeletePostControl
                                  kind="reply"
                                  messageId={reply.id}
                                  onDeleted={onDeleted}
                                />
                              ) : null}
                            </div>
                            {payMessageId === reply.id ? (
                              <ForumPaySheet
                                messageId={reply.id}
                                payDraft={payDraft}
                                payBusy={payBusy}
                                payError={payError}
                                payInvoice={payInvoice}
                                payWaiting={payWaiting}
                                onPayDraftChange={onPayDraftChange}
                                onPaySubmit={onPaySubmit}
                                onPayCancel={onPayCancel}
                                rateDay={rateDay}
                                showPaymentQr={showPaymentQr}
                                onInteract={stopCardToggle}
                              />
                            ) : null}
                          </li>
                        );
                      })}
                    </ul>
                  ) : null}
                  {message.deletedAt === undefined ? (
                    <form onSubmit={handleReplySubmit} className="flex flex-col gap-2">
                      <div className="flex items-end gap-2">
                        <textarea
                          ref={replyComposerRef}
                          aria-label={t('forum.replyComposerLabel')}
                          placeholder={t('forum.replyPlaceholder')}
                          value={replyDraft}
                          onChange={(event) => onReplyDraftChange(event.target.value)}
                          maxLength={FORUM_MESSAGE_MAX_LENGTH}
                          rows={2}
                          disabled={
                            replyPosting || repliesLoading || repliesError || replies === null
                          }
                          className="min-h-11 min-w-0 flex-1 resize-none rounded-2xl border border-app-border-strong px-4 py-2.5 text-base text-app-fg transition disabled:opacity-50"
                        />
                        <Field
                          id="forum-reply-amount"
                          label={t('forum.replyAmountLabel')}
                          type="text"
                          inputMode="numeric"
                          autoComplete="off"
                          autoCorrect="off"
                          spellCheck={false}
                          placeholder={t('forum.payAmountPlaceholder')}
                          value={replyAmountDraft}
                          disabled={
                            replyPosting || repliesLoading || repliesError || replies === null
                          }
                          onChange={(event) => onReplyAmountDraftChange?.(event.target.value)}
                          className="w-24"
                        />
                        <IconButton
                          type="submit"
                          size="lg"
                          variant="primary"
                          disabled={
                            replyPosting || repliesLoading || repliesError || replies === null
                          }
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
                        <p role="alert" className="text-center text-sm text-app-danger">
                          {t('forum.errorEmpty')}
                        </p>
                      ) : null}
                      {replyFormError === 'amount' ? (
                        <p role="alert" className="text-center text-sm text-app-danger">
                          {t('forum.errorReplyPayment')}
                        </p>
                      ) : null}
                      {replyFormError === 'tooLong' ? (
                        <p role="alert" className="text-center text-sm text-app-danger">
                          {t('forum.errorTooLong')}
                        </p>
                      ) : null}
                      {replyFormError === 'request' ? (
                        <p role="alert" className="text-center text-sm text-app-danger">
                          {t('forum.errorRequest')}
                        </p>
                      ) : null}
                      {replyFormError === 'rateLimit' ? (
                        <p role="alert" className="text-center text-sm text-app-danger">
                          {t('forum.errorRateLimit')}
                        </p>
                      ) : null}
                    </form>
                  ) : null}
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

  const showRefreshStatus = refreshing === true || pullArmed;

  return (
    <div
      ref={rootRef}
      className="flex w-full flex-col gap-4 overscroll-y-contain border-t border-app-border pt-6"
    >
      {moderatorAppointedAvailable ? (
        <div className="pointer-events-none sticky top-2 z-30 mx-auto w-fit">
          <Button
            type="button"
            variant="primary"
            size="sm"
            className="pointer-events-auto shadow-lg"
            icon={<ArrowUp aria-hidden="true" className="h-4 w-4" />}
            onClick={onShowModeratorAppointed}
          >
            {t('forum.moderatorAppointed')}
          </Button>
        </div>
      ) : null}
      {newPostsAvailable ? (
        <div
          className={
            moderatorAppointedAvailable
              ? 'pointer-events-none sticky top-14 z-30 mx-auto w-fit'
              : 'pointer-events-none sticky top-2 z-30 mx-auto w-fit'
          }
        >
          <Button
            type="button"
            variant="primary"
            size="sm"
            className="pointer-events-auto shadow-lg"
            icon={<ArrowUp aria-hidden="true" className="h-4 w-4" />}
            onClick={onShowNewPosts}
          >
            {t('forum.newPosts')}
          </Button>
        </div>
      ) : null}
      {showRefreshStatus ? (
        <div
          role="status"
          aria-live="polite"
          aria-label={t('forum.refreshing')}
          className="sr-only"
        />
      ) : null}
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

      {!composerHidden && modeSelector ? (
        <SegmentedControl
          value={mode}
          options={FORUM_FEED_MODES.map((next) => {
            const label = t(MODE_LABEL_KEY[next]);
            if (next !== 'unpaid' || mode === 'unpaid' || unpaidNewCount <= 0) {
              return { value: next, label };
            }
            return {
              value: next,
              label,
              badge: unpaidNewCount,
              badgeAriaLabel: t('forum.modeUnpaidNew', { count: unpaidNewCount }),
            };
          })}
          onChange={onModeChange}
          ariaLabel={t('forum.modeLabel')}
          tone="neutral"
          className="!grid grid-cols-2 !rounded-2xl"
        />
      ) : null}

      {!composerHidden ? (
        <SegmentedControl
          value={composeIntent}
          options={[
            { value: 'post', label: t('forum.composePost') },
            { value: 'ask', label: t('forum.composeAsk') },
          ]}
          onChange={(next) => {
            onComposeIntentChange?.(next);
          }}
          ariaLabel={t('forum.composeIntentLabel')}
          tone="neutral"
          className="!grid grid-cols-2 !rounded-2xl"
        />
      ) : null}

      {!composerHidden && composeIntent === 'ask' ? (
        <ForumAskWizard
          step={askStep}
          onStepChange={(next) => {
            onAskStepChange?.(next);
          }}
          askDraft={askDraft}
          onAskDraftChange={onAskDraftChange}
          draft={draft}
          onDraftChange={onDraftChange}
          posting={posting}
          photoDrafts={photoDrafts}
          videoDraft={videoDraft}
          onPickFiles={onPickFiles}
          onRemovePhoto={onRemovePhoto}
          onClearPhoto={onClearPhoto}
          authorName={authorName}
          onPost={onPost}
          rateDay={rateDay ?? null}
          composerMaxLength={composerMaxLength}
        />
      ) : null}

      {!composerHidden && composeIntent === 'post' ? (
        <form onSubmit={handleSubmit} className="flex flex-col gap-2">
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
              multiple
              accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime,video/x-m4v,.mp4,.webm,.mov,.m4v"
              className="hidden"
              disabled={posting}
              onChange={handleFileChange}
            />
            <textarea
              ref={composerRef}
              aria-label={t('forum.composerLabel')}
              placeholder={t('forum.placeholder')}
              value={draft}
              onChange={(event) => onDraftChange(event.target.value)}
              maxLength={composerMaxLength}
              rows={2}
              disabled={posting}
              className="min-h-11 min-w-0 flex-1 resize-none rounded-2xl border border-app-border-strong px-4 py-2.5 text-base text-app-fg transition disabled:opacity-50"
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
          {photoDrafts.length === 1 ? (
            <div className="flex items-start gap-3 rounded-2xl border border-app-border bg-app-card-muted p-3">
              {/* eslint-disable-next-line @next/next/no-img-element -- data URL preview from prepareForumPhoto */}
              <img
                src={photoDrafts[0]!.previewUrl}
                alt={t('forum.previewAlt')}
                className="h-20 w-20 rounded-lg object-cover"
              />
              <IconButton
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => {
                  onRemovePhoto(0);
                }}
                disabled={posting}
                aria-label={t('forum.removePhoto')}
              >
                <X aria-hidden="true" className="h-4 w-4" />
              </IconButton>
            </div>
          ) : photoDrafts.length > 1 ? (
            <ul className="flex flex-wrap items-start gap-3 rounded-2xl border border-app-border bg-app-card-muted p-3">
              {photoDrafts.map((photo, index) => (
                <li key={`${photo.previewUrl}:${index}`} className="flex items-start gap-1">
                  {/* eslint-disable-next-line @next/next/no-img-element -- data URL preview from prepareForumPhoto */}
                  <img
                    src={photo.previewUrl}
                    alt={t('forum.previewAlt')}
                    className="h-20 w-20 rounded-lg object-cover"
                  />
                  <IconButton
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      onRemovePhoto(index);
                    }}
                    disabled={posting}
                    aria-label={t('forum.removePhoto')}
                  >
                    <X aria-hidden="true" className="h-4 w-4" />
                  </IconButton>
                </li>
              ))}
            </ul>
          ) : null}
        </form>
      ) : null}

      {payMessageId !== null &&
      payInvoice !== null &&
      !(messages !== null && messages.some((row) => row.id === payMessageId)) &&
      !(replies !== null && replies.some((row) => row.id === payMessageId)) ? (
        <ForumPaySheet
          messageId={payInvoice.messageId}
          payDraft={payDraft}
          payBusy={payBusy}
          payError={payError}
          payInvoice={payInvoice}
          payWaiting={payWaiting}
          onPayDraftChange={onPayDraftChange}
          onPaySubmit={onPaySubmit}
          onPayCancel={onPayCancel}
          rateDay={rateDay}
          showPaymentQr={showPaymentQr}
          onInteract={(event) => {
            event.stopPropagation();
          }}
        />
      ) : null}

      {!composerHidden && formError === 'empty' ? (
        <p role="alert" className="text-center text-sm text-app-danger">
          {t('forum.errorEmpty')}
        </p>
      ) : null}
      {!composerHidden && formError === 'tooLong' ? (
        <p role="alert" className="text-center text-sm text-app-danger">
          {t('forum.errorTooLong')}
        </p>
      ) : null}
      {!composerHidden && formError === 'request' ? (
        <p role="alert" className="text-center text-sm text-app-danger">
          {t('forum.errorRequest')}
        </p>
      ) : null}
      {!composerHidden && formError === 'rateLimit' ? (
        <p role="alert" className="text-center text-sm text-app-danger">
          {t('forum.errorRateLimit')}
        </p>
      ) : null}
      {!composerHidden && formError === 'unsupported' ? (
        <p role="alert" className="text-center text-sm text-app-danger">
          {t('forum.errorUnsupported')}
        </p>
      ) : null}
      {!composerHidden && formError === 'tooLarge' ? (
        <p role="alert" className="text-center text-sm text-app-danger">
          {t('forum.errorTooLarge')}
        </p>
      ) : null}
      {!composerHidden && formError === 'tooMany' ? (
        <p role="alert" className="text-center text-sm text-app-danger">
          {t('forum.errorTooMany')}
        </p>
      ) : null}
      {!composerHidden && formError === 'ask' ? (
        <p role="alert" className="text-center text-sm text-app-danger">
          {t('forum.errorAskAmount')}
        </p>
      ) : null}

      {middle}
      {error && messages !== null ? errorBlock : null}
    </div>
  );
}
