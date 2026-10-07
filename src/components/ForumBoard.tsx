'use client';

import { revealInScrollport } from '@/lib/reveal-in-scrollport';

import {
  ArrowUp,
  Check,
  Gift,
  ImagePlus,
  Link2,
  Loader2,
  MapPin,
  Reply,
  Send,
  User,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
  type ReactElement,
} from 'react';
import { AmountEntry } from '@/components/AmountEntry';
import {
  ForumPaySheet,
  type ForumPayError,
  type ForumPayInvoice,
} from '@/components/ForumPaySheet';
import { SundayWritingGate } from '@/components/SundayWritingGate';
import { useAppShellScroller } from '@/components/AppShell';
import {
  ForumAskWizard,
  type ForumAskCadence,
  type ForumAskObligation,
  type ForumAskStep,
} from '@/components/ForumAskWizard';
import { ForumGoalBar } from '@/components/ForumGoalBar';
import { ForumPhotoGallery } from '@/components/ForumPhotoGallery';
import { ForumReplyPayPage } from '@/components/ForumReplyPayPage';
import { ReplyDirectionAmounts } from '@/components/ReplyDirectionAmounts';
import { ForumVideo } from '@/components/ForumVideo';
import { useTranslations } from '@/components/LocaleProvider';
import { PlaceField } from '@/components/PlaceField';
import { TranslatableNoteBody } from '@/components/TranslatableNoteBody';
import { preferredFiatSuffix } from '@/components/PreferredFiatSuffix';
import { ForumQuotedBody } from '@/components/QuotedForumNote';
import { useNumberFormat } from '@/components/NumberFormatProvider';
import { ForumModeSelect } from '@/components/ForumModeSelect';
import { MentionTextarea } from '@/components/MentionTextarea';
import { Button, IconButton, SegmentedControl } from '@/components/ui';
import {
  FORUM_MESSAGE_MAX_LENGTH,
  type AmountUnit,
  type ForumMessage,
  type ForumPlacePin,
} from '@/lib/api-types';
import { DeletePostControl } from '@/components/DeletePostControl';
import { ShopAccountControl } from '@/components/ShopAccountControl';
import { ShopAddWizard } from '@/components/ShopAddWizard';
import { ShopNoteEditControl } from '@/components/ShopNoteEditControl';
import { ShopPlaceControl } from '@/components/ShopPlaceControl';
import {
  FORUM_COMPOSE_EVENT,
  FORUM_FEED_MODES,
  consumePendingForumCompose,
  type ForumFeedMode,
  visibleForumMessages,
} from '@/lib/forum-feed';
import type { ForumPhotoPayload } from '@/lib/forum-photo';
import { MessageKindTags, noteKinds } from '@/components/MessageKindTags';
import { isShopNote, stripShopHashtag } from '@/lib/forum-shop';
import { forumVideoSrc, type ForumVideoPayload } from '@/lib/forum-video';
import { shortResourceUrl } from '@/lib/short-link';
import { formatForumTime } from '@/lib/forum-time';
import type { MessageKey } from '@/lib/messages';
import { useFiatPreference } from '@/components/FiatPreferenceProvider';
import { formatBitcoin, type FiatRateDay } from '@/lib/stats-money';

export type { ForumPayError, ForumPayInvoice } from '@/components/ForumPaySheet';

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

/**
 * Reply composer validation; `amount` is the paid-reply sats field and
 * `authorWallet` means the note author's wallet cannot take the paid reply.
 */
export type ForumReplyFormError = ForumFormError | 'amount' | 'deleted' | 'authorWallet';

/** Loaded still URLs for one note, in gallery order. Missing slots are skipped. */
function editStillUrls(
  messageId: string,
  photoCount: number,
  photoUrls: Readonly<Record<string, string>>,
): string[] {
  const found: string[] = [];
  for (let index = 0; index < photoCount; index += 1) {
    const url = photoUrls[`${messageId}:${index}`];
    if (typeof url === 'string') {
      found.push(url);
    }
  }
  return found;
}

/** Roles that show a clickable tag beside the author name. */
type ForumTaggedRole = 'founder' | 'moderator' | 'initiator' | 'verified';

/** Catalog keys for a tagged role's label and explanation. */
const ROLE_TAG_KEYS: Record<ForumTaggedRole, { label: MessageKey; hint: MessageKey }> = {
  founder: { label: 'forum.role.founder', hint: 'forum.role.founderHint' },
  moderator: { label: 'forum.role.moderator', hint: 'forum.role.moderatorHint' },
  initiator: { label: 'forum.role.initiator', hint: 'forum.role.initiatorHint' },
  verified: { label: 'forum.role.verified', hint: 'forum.role.verifiedHint' },
};

function isForumTaggedRole(role: string): role is ForumTaggedRole {
  return role in ROLE_TAG_KEYS;
}

/**
 * Role that shows a forum tag, or `null` for basis / missing.
 *
 * @param role - Live account role from the api, if present.
 * @returns Tagged role or `null`.
 */
function forumTaggedRole(role: string): ForumTaggedRole | null {
  return isForumTaggedRole(role) ? role : null;
}

const COPY_RESET_MS = 1200;

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
  /** Unit the ask draft is written in. Default is the account unit. */
  askDraftUnit?: AmountUnit;
  /** Called when the ask field is actually showing a unit. */
  onAskDraftUnit?: (unit: AmountUnit) => void;
  /** Called when the Ask field changes. */
  onAskDraftChange: (value: string) => void;
  /** Messenger vs Ask wizard. Default `post`. */
  composeIntent?: ForumComposeIntent;
  /** Called when the visitor picks Post or Ask. */
  onComposeIntentChange?: (intent: ForumComposeIntent) => void;
  /**
   * When false, the composer is a shop post only: no Post/Ask pill and no
   * Ask wizard. Default true.
   */
  allowAsk?: boolean;
  /** Ask wizard step. Default 1. */
  askStep?: ForumAskStep;
  /** Called when the wizard step changes. */
  onAskStepChange?: (step: ForumAskStep) => void;
  /** One-time or daily Ask. Default `once`. */
  askCadence?: ForumAskCadence;
  /** Called when the visitor picks One-time or Daily. */
  onAskCadenceChange?: (value: ForumAskCadence) => void;
  /** Donation or credit Ask. Default `donation`. */
  askObligation?: ForumAskObligation;
  /** Called when the visitor picks Donation or Credit. */
  onAskObligationChange?: (value: ForumAskObligation) => void;
  /** Days a credit will be repaid over, or null while unset. */
  onCreditTermDays?: (days: number | null) => void;
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
  /**
   * When true, the message composer says under Post that this member's first
   * post is free. Default false.
   */
  firstPostFree?: boolean;
  /**
   * When true, the shops feed shows Add a shop instead of the message composer.
   * Default false.
   */
  shopComposer?: boolean;
  /** Optional username for the shop being composed. */
  shopUsername?: string;
  /** Replace the optional shop username. */
  onShopUsernameChange?: (username: string) => void;
  /** Bumps after a shop is sent so the wizard closes. */
  shopResetToken?: number;
  /** Message id whose pay sheet is open, or `null`. */
  payMessageId: string | null;
  /**
   * Where the open invoice is bound. `'composer'` keeps the sheet on the
   * top-level composer even when the fee note is in the visible list.
   * `'card'` binds to the matching parent or reply. Omit/`null` infers
   * from whether `payMessageId` is listed.
   */
  payHost?: 'composer' | 'card' | null;
  /** Amount draft for the open pay sheet. */
  payDraft: string;
  /** True while an invoice request is in flight. */
  payBusy: boolean;
  /** Pay-sheet validation or request failure. */
  payError: ForumPayError;
  /** Issued invoice for QR / wallet link, or `null`. */
  payInvoice: ForumPayInvoice | null;
  /**
   * Submitted reaction text shown on {@link ForumReplyPayPage}, or `null`
   * when the reply composer stays mounted. Default `null`.
   */
  replyPayPreview?: string | null;
  /** True while polling for an updated sats total after pay. */
  payWaiting: boolean;
  /** Opens the pay sheet for a payable message. */
  onPayOpen: (messageId: string) => void;
  /** Signed-in account id, used to show repayment only on the author's credit. */
  viewerAccountId?: string | null;
  /** Requests today's repayment invoice for the author's own funded credit. */
  onRepay?: (messageId: string) => void;
  /** Failure of today's repayment, shown without the gift amount form. */
  repayNotice?: { messageId: string; error: Exclude<ForumPayError, null> | null } | null;
  /** Updates the pay amount draft. */
  onPayDraftChange: (value: string) => void;
  /** Unit the pay field is actually showing. */
  onPayUnitChange?: (unit: AmountUnit) => void;
  /** Submits the pay amount for an invoice. */
  onPaySubmit: () => void | Promise<ForumPayInvoice | null | undefined>;
  /** Closes the pay sheet and clears invoice state. */
  onPayCancel: () => void;
  /**
   * Current spot rate for unsent previews (pay sheet, unpaid invoice).
   * Settled ₿ amounts use the fiat stored on the row. Omit or `null` when
   * the spot rate has not loaded — previews stay ₿-only.
   */
  rateDay?: FiatRateDay | null;
  /** Selected feed mode. Default in the loader is Active. */
  mode: ForumFeedMode;
  /** Called when the visitor picks another mode. */
  onModeChange: (mode: ForumFeedMode) => void;
  /** When false, omit the Active / No gifts yet / All / Most popular control and show every loaded row (same as mode all). Default true. */
  modeSelector?: boolean;
  /**
   * Optional ref attached near the end of the visible feed for loader pagination,
   * or to the empty-feed line when the loaded page kept no row.
   */
  nearEndRef?: (node: HTMLElement | null) => void;
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
  /** Unit the reply amount field is actually showing. */
  onReplyUnitChange?: (unit: AmountUnit) => void;
  /** Called when the reply form is submitted. */
  onReplyPost: () => void;
  /** True while a reply post is in flight. */
  replyPosting: boolean;
  /** Reply composer validation or request failure. */
  replyFormError: ForumReplyFormError;
  /** When true, hide the new-note composer (profile note card). */
  composerHidden?: boolean;
  /** Signed-out living room: no composer, reaction form, pay, or delete. Mode stays. */
  readOnly?: boolean;
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
  /** Optional place pin draft for the top-level composer. Default null. */
  placeDraft?: ForumPlacePin | null;
  /** Called when the top-level composer pin changes. Default no-op. */
  onPlaceDraftChange?: (place: ForumPlacePin | null) => void;
  /**
   * When true, show the shops staff place editor on top-level notes.
   * Default false.
   */
  shopPlaceEdit?: boolean;
  /** Apply a saved or cleared pin on a listed shop note. */
  onShopPlaceUpdated?: (messageId: string, place: ForumPlacePin | null) => void;
  /**
   * When true, show the shops staff account editor on top-level notes.
   * Default false.
   */
  shopAccountEdit?: boolean;
  /** Apply a saved or cleared shop account on a listed shop note. */
  onShopAccountUpdated?: (
    messageId: string,
    shopAccount: { id: string; username: string; name: string } | null,
  ) => void;
  /**
   * When true, show the shop-note pencil on top-level notes.
   * Default false. The control itself hides non-shop text.
   */
  shopNoteEdit?: boolean;
  /** Apply a saved shop-note body to the listed row. */
  onShopNoteUpdated?: (message: ForumMessage) => void;
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
 * Reveals the reply form inside the one scrollport.
 *
 * A null scroller or form leaves the scroll position unchanged. Otherwise this
 * delegates to {@link revealInScrollport}, which also corrects a top overflow
 * and a target taller than the scroller.
 *
 * @param scroller - App shell scroller, or null when the board is not inside one.
 * @param form - Reply form, or null when no reply composer is open.
 * @returns void
 */
export function revealReplyForm(scroller: HTMLElement | null, form: HTMLFormElement | null): void {
  if (scroller === null || form === null) {
    return;
  }
  revealInScrollport(scroller, form);
}

/**
 * Pulls a pay sheet back into the shell only when its top sits above the shell.
 *
 * A sheet that starts below the fold is left alone so the note above it stays
 * on screen. A missing scroller or sheet leaves the scroll position unchanged.
 *
 * @param scroller - App shell scroller, or null when the board is not inside one.
 * @param sheet - Pay sheet element, or null when no sheet is open.
 * @returns void
 */
export function revealPaySheet(scroller: HTMLElement | null, sheet: HTMLElement | null): void {
  if (scroller === null || sheet === null) {
    return;
  }
  const shell = scroller.getBoundingClientRect();
  const box = sheet.getBoundingClientRect();
  // A sheet that starts below the fold stays put. Pulling it to the top
  // would scroll the note off screen.
  if (box.top < shell.top) {
    scroller.scrollTop -= shell.top - box.top;
  }
}

/**
 * The open pay sheet inside the board, if one is mounted.
 *
 * @param root - Board root, or null before mount.
 * @returns The sheet element, or null.
 */
function paySheetElement(root: HTMLElement | null): HTMLElement | null {
  return root?.querySelector<HTMLElement>('[data-pay-sheet]') ?? null;
}

/**
 * Presentational public forum: optional dismissible living-room laws hint,
 * ForumModeSelect (a closed full-width combobox showing the selected label
 * and a chevron; unpaid count chip on the closed trigger when `unpaidNewCount`
 * is \> 0 and unpaid is not selected; omitted when `modeSelector` is false or
 * `composerHidden` is true), composer under the mode
 * filters above the newest-first list (new notes only; Post/Ask pill;
 * Post is attach + text + send, Ask is the four-step wizard), newest-first list (social
 * feed) or empty/loading/error, per-card expand for oldest-first replies +
 * reply composer (amount and the bitcoin/fiat switch on one line, text and
 * send on the next; reply money is `ReplyDirectionAmounts`: gift-only rows
 * use `forum.giftReply`, text-plus-gift shows the bare amount under the
 * body, and a later receipt is `forum.receivedOnReply` on its own line.
 * A text reply that also sent sats labels that line `forum.sentOnReply`
 * and the two lines share a left rule. The amounts are not added),
 * copy-link control, `ForumGoalBar` on a top-level note
 * with `goalSats`, React control on posts (`forum.react`, lucide Reply;
 * expands the reply composer; omitted when `deletedAt` is set), payable-reply
 * pay sheet (Gift on nested replies and on top-level cards with `parentId`;
 * never on posts; omitted when `deletedAt` is set), optional shop-note
 * pencil when `shopNoteEdit` and `onShopNoteUpdated` are set (top-level
 * notes; the control hides non-shop text), optional shops staff
 * place editor after copy and before staff Delete when `shopPlaceEdit` and
 * `onShopPlaceUpdated` are set, then the shops account editor when
 * `shopAccountEdit` and `onShopAccountUpdated` are set (top-level notes only),
 * staff Delete omitted
 * when `deletedAt` is set, optional inline photos, and optional inline videos.
 * When `onRefresh` is passed, supports pull-to-refresh; `refreshing` shows a
 * visually hidden (`sr-only`) refresh status without changing idle markup.
 * When unseen notes are held for a scrolled visitor, a labeled New posts pill
 * applies them without placing refresh chrome in the idle board. When an unread
 * moderator-appointed notification exists, a labeled pill in the same visual
 * language marks it read; pills are sticky in the AppShell scroller under the
 * frame header (`top-2`, or `top-14` for New posts when both show).
 * Optional `permalinkTargetId` rings the matching nested reply only; optional
 * `nearEndRef` attaches to the note about eight rows from the visible end, or
 * to the empty-feed line when no row is loaded, so a page whose notes were all
 * dropped still leads on to the next page.
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
  askDraftUnit,
  onAskDraftUnit,
  onAskDraftChange,
  composeIntent = 'post',
  onComposeIntentChange,
  allowAsk = true,
  askStep = 1,
  onAskStepChange,
  askCadence = 'once',
  onAskCadenceChange = () => undefined,
  askObligation = 'donation',
  onAskObligationChange = () => undefined,
  onCreditTermDays,
  authorName = '',
  onPost,
  onRetry,
  formError,
  composerMaxLength = FORUM_MESSAGE_MAX_LENGTH,
  firstPostFree = false,
  shopComposer = false,
  shopUsername = '',
  onShopUsernameChange,
  shopResetToken = 0,
  payMessageId,
  payHost = null,
  payDraft,
  payBusy,
  payError,
  payInvoice,
  replyPayPreview = null,
  payWaiting,
  onPayOpen,
  viewerAccountId = null,
  onRepay,
  repayNotice = null,
  onPayDraftChange,
  onPayUnitChange,
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
  onReplyUnitChange,
  onReplyPost,
  replyPosting,
  replyFormError,
  composerHidden = false,
  readOnly = false,
  onDeleted,
  permalinkTargetId = null,
  truncate = true,
  placeDraft = null,
  onPlaceDraftChange,
  shopPlaceEdit = false,
  onShopPlaceUpdated,
  shopAccountEdit = false,
  onShopAccountUpdated,
  shopNoteEdit = false,
  onShopNoteUpdated,
}: ForumBoardProps): ReactElement {
  const hideCompose = composerHidden || readOnly;
  const { t, locale } = useTranslations();
  const { numberFormat } = useNumberFormat();
  const { fiat } = useFiatPreference();
  const router = useRouter();
  const scroller = useAppShellScroller();
  const rootRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const replyComposerRef = useRef<HTMLTextAreaElement>(null);
  const scrollerRef = useRef<HTMLElement | null>(scroller);
  scrollerRef.current = scroller;
  const shownReplies = replies === null ? -1 : replies.length;
  const scrollBeforeSheet = useRef<number | null>(null);
  const sheetWasOpen = useRef(false);
  useEffect(() => {
    if (scroller === null) {
      return;
    }
    const remember = (): void => {
      if (!sheetWasOpen.current) {
        scrollBeforeSheet.current = scroller.scrollTop;
      }
    };
    remember();
    scroller.addEventListener('scroll', remember);
    return () => {
      scroller.removeEventListener('scroll', remember);
    };
  }, [scroller]);
  useLayoutEffect(() => {
    const field = replyComposerRef.current;
    const form = field === null ? null : field.form;
    const sheet = paySheetElement(rootRef.current);
    if (sheet !== null) {
      if (!sheetWasOpen.current && scroller !== null && scrollBeforeSheet.current !== null) {
        scroller.scrollTop = scrollBeforeSheet.current;
      }
      sheetWasOpen.current = true;
      revealPaySheet(scroller, sheet);
    } else {
      sheetWasOpen.current = false;
      revealReplyForm(scroller, form);
    }
    if (scroller === null || typeof ResizeObserver === 'undefined') {
      return;
    }
    const observer = new ResizeObserver(() => {
      const liveSheet = paySheetElement(rootRef.current);
      if (liveSheet !== null) {
        revealPaySheet(scroller, liveSheet);
        return;
      }
      revealReplyForm(scroller, form);
    });
    if (sheet !== null) {
      observer.observe(sheet);
    }
    if (form !== null) {
      observer.observe(form);
    }
    return () => {
      observer.disconnect();
    };
  }, [expandedId, repliesLoading, scroller, shownReplies, payMessageId, payInvoice]);
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
      el.focus({ preventScroll: true });
      const port = scrollerRef.current;
      if (port !== null) {
        revealInScrollport(port, el);
      }
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
    const url = shortResourceUrl(window.location.origin, messageId, `/messages/${messageId}`);
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
    middle = (
      <p
        {...(nearEndRef !== undefined ? { ref: nearEndRef } : {})}
        className="text-center text-sm text-app-muted"
      >
        {t(emptyKey)}
      </p>
    );
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
          const replyPayLocked =
            payInvoice !== null && payMessageId === message.id && payHost !== 'composer';
          const reactionPay =
            replyPayPreview !== null &&
            payInvoice !== null &&
            payMessageId === message.id &&
            payHost === 'card' &&
            payInvoice.messageId === message.id
              ? {
                  preview: replyPayPreview,
                  amountSats: payInvoice.amountSats,
                  pr: payInvoice.pr,
                  sparkInvoice: payInvoice.sparkInvoice,
                }
              : null;
          const reactionPayPage = reactionPay !== null;
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
                  if (event.target !== event.currentTarget) {
                    return;
                  }
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    onToggleExpand(message.id);
                  }
                }}
                className="cursor-pointer text-left"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <MessageKindTags
                    kinds={noteKinds({
                      parentId: message.parentId,
                      text: message.text,
                      goalSats: message.goalSats,
                      goalRepayable: message.goalRepayable,
                    })}
                  >
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
                    ) : message.via === 'nostr' ? (
                      <button
                        type="button"
                        aria-label={t('forum.authorProfile')}
                        className="text-sm font-medium text-app-fg underline underline-offset-2"
                        onClick={(event) => {
                          stopCardToggle(event);
                          router.push(
                            `/messages/${message.id}/author?name=${encodeURIComponent(message.name)}`,
                          );
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
                    {message.staffTag === 'software_developer' ? (
                      <span className="rounded-full border border-app-border-strong px-2 py-0.5 text-xs font-medium text-app-muted">
                        {t('forum.staff.softwareDeveloper')}
                      </span>
                    ) : null}
                  </MessageKindTags>
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
                  <ForumVideo
                    src={videoSrc}
                    poster={photoUrl}
                    preload="metadata"
                    className="mt-2 mx-auto block h-auto w-auto max-h-80 max-w-full shrink-0 rounded-xl object-contain"
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
                    className="mt-2 block h-auto max-h-80 w-full shrink-0 rounded-xl object-contain"
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
                      <TranslatableNoteBody
                        messageId={message.id}
                        plain
                        text={displayText}
                        truncate={truncate}
                        className="whitespace-pre-wrap text-sm text-app-fg"
                        controlSlotId={`note-translate-${message.id}`}
                        {...(shopNote ? { formatTranslated: stripShopHashtag } : {})}
                        {...(!readOnly &&
                        typeof message.accountId === 'string' &&
                        message.accountId !== '' &&
                        message.mentions !== undefined
                          ? { mentions: message.mentions }
                          : {})}
                      />
                    ) : (
                      <ForumQuotedBody
                        text={displayText}
                        knownNotes={[...messages, ...(Array.isArray(replies) ? replies : [])]}
                        excludeId={message.id}
                        rateDay={rateDay ?? null}
                        fiat={fiat}
                        truncate={truncate}
                        controlSlotId={`note-translate-${message.id}`}
                        {...(shopNote ? { formatTranslated: stripShopHashtag } : {})}
                        {...(!readOnly &&
                        typeof message.accountId === 'string' &&
                        message.accountId !== '' &&
                        message.mentions !== undefined
                          ? { mentions: message.mentions }
                          : {})}
                        onActivate={(event) => {
                          event.stopPropagation();
                        }}
                      />
                    )}
                  </div>
                ) : null}
                {message.parentId === undefined && message.place !== undefined ? (
                  <Link
                    href={`/shops?pin=${encodeURIComponent(message.id)}#map`}
                    className="mt-2 inline-flex items-center gap-1 text-sm text-app-fg underline"
                    onClick={stopCardToggle}
                  >
                    <MapPin aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
                    {message.place.label ??
                      `${message.place.lat.toFixed(5)}, ${message.place.lng.toFixed(5)}`}
                  </Link>
                ) : null}
                {message.parentId === undefined && message.shopAccount !== undefined ? (
                  <Link
                    href={`/members/${message.shopAccount.id}`}
                    className="mt-2 inline-flex items-center gap-1 text-sm text-app-fg underline"
                    onClick={stopCardToggle}
                  >
                    <User aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />@
                    {message.shopAccount.username}
                  </Link>
                ) : null}
              </div>
              {message.parentId === undefined &&
              typeof message.goalSats === 'number' &&
              message.goalSats > 0 ? (
                <ForumGoalBar
                  sats={message.sats}
                  goalSats={message.goalSats}
                  rateDay={rateDay ?? null}
                  goalCurrency={message.goalCurrency}
                  goalAmount={message.goalAmount}
                  goalAmountUsd={message.goalAmountUsd}
                  goalAmountChf={message.goalAmountChf}
                  goalAmountEur={message.goalAmountEur}
                  goalAmountPhp={message.goalAmountPhp}
                  amountUsd={message.amountUsd}
                  amountChf={message.amountChf}
                  amountEur={message.amountEur}
                  amountPhp={message.amountPhp}
                  goalRepayable={message.goalRepayable}
                  goalTermDays={message.goalTermDays}
                  messageId={message.id}
                  ledgerCollapsed={truncate}
                />
              ) : null}
              <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2">
                <div className="flex items-center gap-5">
                  <button
                    type="button"
                    aria-expanded={expanded}
                    onClick={() => {
                      onToggleExpand(message.id);
                    }}
                    className="text-xs font-medium tabular-nums lining-nums text-app-muted"
                  >
                    <span>{formatBitcoin(message.sats, numberFormat)}</span>
                    {preferredFiatSuffix(message.sats, rateDay, fiat, numberFormat, message)}
                  </button>
                  {message.parentId === undefined ? (
                    <button
                      type="button"
                      aria-expanded={expanded}
                      onClick={() => {
                        onToggleExpand(message.id);
                      }}
                      className="text-xs text-app-subtle"
                    >
                      {t('forum.replyCount', { count: String(message.replyCount) })}
                    </button>
                  ) : null}
                </div>
                <div className="ml-auto flex flex-wrap items-center gap-5">
                  <div id={`note-translate-${message.id}`} className="contents" />
                  {/* Signed-out forum is readOnly and still shows React. The author feed sets both flags. */}
                  {message.parentId === undefined &&
                  message.deletedAt === undefined &&
                  !(readOnly && composerHidden) ? (
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
                          const field = replyComposerRef.current;
                          field?.focus({ preventScroll: true });
                          const port = scrollerRef.current;
                          if (port !== null && field !== null) {
                            revealInScrollport(port, field);
                          }
                        }
                      }}
                    >
                      <Reply aria-hidden="true" className="h-4 w-4 shrink-0" />
                    </IconButton>
                  ) : null}
                  {onRepay !== undefined &&
                  viewerAccountId !== null &&
                  message.accountId === viewerAccountId &&
                  message.parentId === undefined &&
                  message.goalRepayable === true &&
                  typeof message.goalSats === 'number' &&
                  message.sats >= message.goalSats &&
                  message.deletedAt === undefined ? (
                    <SundayWritingGate notice="zap">
                      <button
                        type="button"
                        className="text-xs font-medium text-app-fg underline"
                        disabled={payBusy || payInvoice?.messageId === message.id}
                        onClick={(event) => {
                          stopCardToggle(event);
                          onRepay(message.id);
                        }}
                      >
                        {t('forum.repayToday')}
                      </button>
                    </SundayWritingGate>
                  ) : null}
                  {repayNotice?.messageId === message.id && repayNotice.error !== null ? (
                    <p role="alert" className="text-xs text-app-danger">
                      {t(
                        repayNotice.error === 'rateLimit'
                          ? 'forum.payErrorRateLimit'
                          : repayNotice.error === 'authorWallet'
                            ? 'forum.payErrorAuthorWallet'
                            : 'forum.payErrorRequest',
                      )}
                    </p>
                  ) : null}
                  {message.parentId !== undefined &&
                  message.payable &&
                  message.deletedAt === undefined &&
                  !readOnly ? (
                    <SundayWritingGate notice="zap">
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
                    </SundayWritingGate>
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
                  {shopNoteEdit &&
                  onShopNoteUpdated !== undefined &&
                  message.parentId === undefined ? (
                    <ShopNoteEditControl
                      message={message}
                      onUpdated={onShopNoteUpdated}
                      existingPhotos={editStillUrls(message.id, photoCount, photoUrls)}
                      {...(videoSrc !== undefined ? { existingVideoUrl: videoSrc } : {})}
                    />
                  ) : null}
                  {shopPlaceEdit &&
                  onShopPlaceUpdated !== undefined &&
                  message.parentId === undefined ? (
                    <ShopPlaceControl message={message} onUpdated={onShopPlaceUpdated} />
                  ) : null}
                  {shopAccountEdit &&
                  onShopAccountUpdated !== undefined &&
                  message.parentId === undefined ? (
                    <SundayWritingGate>
                      <ShopAccountControl message={message} onUpdated={onShopAccountUpdated} />
                    </SundayWritingGate>
                  ) : null}
                  {onDeleted !== undefined && message.deletedAt === undefined ? (
                    <DeletePostControl messageId={message.id} onDeleted={onDeleted} />
                  ) : null}
                </div>
              </div>

              {!reactionPayPage && payMessageId === message.id && payHost !== 'composer' ? (
                <SundayWritingGate notice="zap">
                  <ForumPaySheet
                    messageId={message.id}
                    payDraft={payDraft}
                    payBusy={payBusy}
                    payError={payError}
                    payInvoice={payInvoice}
                    payWaiting={payWaiting}
                    onPayDraftChange={onPayDraftChange}
                    {...(onPayUnitChange === undefined ? {} : { onPayUnitChange })}
                    onPaySubmit={onPaySubmit}
                    onPayCancel={onPayCancel}
                    rateDay={rateDay}
                    onInteract={stopCardToggle}
                  />
                </SundayWritingGate>
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
                                ) : reply.via === 'nostr' ? (
                                  <button
                                    type="button"
                                    aria-label={t('forum.authorProfile')}
                                    className="text-sm font-medium text-app-fg underline underline-offset-2"
                                    onClick={(event) => {
                                      stopCardToggle(event);
                                      router.push(
                                        `/messages/${reply.id}/author?name=${encodeURIComponent(reply.name)}`,
                                      );
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
                                {reply.staffTag === 'software_developer' ? (
                                  <span className="rounded-full border border-app-border-strong px-2 py-0.5 text-xs font-medium text-app-muted">
                                    {t('forum.staff.softwareDeveloper')}
                                  </span>
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
                            {reply.text !== '' ? (
                              <div className="mt-1">
                                {reply.via === 'nostr' ? (
                                  <TranslatableNoteBody
                                    messageId={reply.id}
                                    plain
                                    text={reply.text}
                                    truncate={truncate}
                                    className="whitespace-pre-wrap text-sm text-app-fg"
                                    controlSlotId={`note-translate-${reply.id}`}
                                    {...(!readOnly &&
                                    typeof reply.accountId === 'string' &&
                                    reply.accountId !== '' &&
                                    reply.mentions !== undefined
                                      ? { mentions: reply.mentions }
                                      : {})}
                                  />
                                ) : (
                                  <ForumQuotedBody
                                    text={reply.text}
                                    knownNotes={[...messages, ...replies]}
                                    excludeId={reply.id}
                                    rateDay={rateDay ?? null}
                                    fiat={fiat}
                                    truncate={truncate}
                                    controlSlotId={`note-translate-${reply.id}`}
                                    {...(!readOnly &&
                                    typeof reply.accountId === 'string' &&
                                    reply.accountId !== '' &&
                                    reply.mentions !== undefined
                                      ? { mentions: reply.mentions }
                                      : {})}
                                    onActivate={(event) => {
                                      event.stopPropagation();
                                    }}
                                  />
                                )}
                              </div>
                            ) : null}
                            <ReplyDirectionAmounts
                              text={reply.text}
                              sats={reply.sats}
                              receivedSats={reply.receivedSats}
                              rateDay={rateDay ?? null}
                              fiat={fiat}
                              numberFormat={numberFormat}
                              sent={reply}
                              received={{
                                amountUsd: reply.receivedAmountUsd,
                                amountChf: reply.receivedAmountChf,
                                amountEur: reply.receivedAmountEur,
                                amountPhp: reply.receivedAmountPhp,
                              }}
                            />
                            <div className="mt-2 flex flex-wrap items-center gap-5">
                              <div id={`note-translate-${reply.id}`} className="contents" />
                              {reply.deletedAt === undefined && reply.payable && !readOnly ? (
                                <SundayWritingGate notice="zap">
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
                                </SundayWritingGate>
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
                            {payMessageId === reply.id && payHost !== 'composer' ? (
                              <SundayWritingGate notice="zap">
                                <ForumPaySheet
                                  messageId={reply.id}
                                  payDraft={payDraft}
                                  payBusy={payBusy}
                                  payError={payError}
                                  payInvoice={payInvoice}
                                  payWaiting={payWaiting}
                                  onPayDraftChange={onPayDraftChange}
                                  {...(onPayUnitChange === undefined ? {} : { onPayUnitChange })}
                                  onPaySubmit={onPaySubmit}
                                  onPayCancel={onPayCancel}
                                  rateDay={rateDay}
                                  onInteract={stopCardToggle}
                                />
                              </SundayWritingGate>
                            ) : null}
                          </li>
                        );
                      })}
                    </ul>
                  ) : null}
                  {!readOnly && message.deletedAt === undefined ? (
                    reactionPay !== null ? (
                      <SundayWritingGate notice="zap">
                        <ForumReplyPayPage
                          preview={reactionPay.preview}
                          amountSats={reactionPay.amountSats}
                          pr={reactionPay.pr}
                          sparkInvoice={reactionPay.sparkInvoice}
                          payWaiting={payWaiting}
                          rateDay={rateDay}
                          onCancel={onPayCancel}
                        />
                      </SundayWritingGate>
                    ) : (
                      <SundayWritingGate>
                        <form onSubmit={handleReplySubmit} className="flex flex-col gap-2">
                          <AmountEntry
                            id="forum-reply-amount"
                            layout="inline"
                            label={t('forum.replyAmountLabel')}
                            placeholder={t('forum.payAmountPlaceholder')}
                            value={replyAmountDraft}
                            disabled={
                              replyPayLocked ||
                              replyPosting ||
                              repliesLoading ||
                              repliesError ||
                              replies === null
                            }
                            rateDay={rateDay}
                            onValueChange={(next) => onReplyAmountDraftChange?.(next)}
                            {...(onReplyUnitChange === undefined
                              ? {}
                              : { onUnitChange: onReplyUnitChange })}
                          />
                          <div className="flex items-center gap-2">
                            <MentionTextarea
                              textareaRef={replyComposerRef}
                              ariaLabel={t('forum.replyComposerLabel')}
                              placeholder={t('forum.replyPlaceholder')}
                              value={replyDraft}
                              onChange={onReplyDraftChange}
                              maxLength={FORUM_MESSAGE_MAX_LENGTH}
                              rows={1}
                              disabled={
                                replyPayLocked ||
                                replyPosting ||
                                repliesLoading ||
                                repliesError ||
                                replies === null
                              }
                              wrapperClassName="relative min-w-0 flex-1"
                              className="h-12 min-w-0 flex-1 resize-none rounded-2xl border border-app-border-strong px-4 text-base leading-6 text-app-fg transition disabled:opacity-50"
                            />
                            <IconButton
                              type="submit"
                              size="lg"
                              variant="primary"
                              disabled={
                                replyPayLocked ||
                                replyPosting ||
                                repliesLoading ||
                                repliesError ||
                                replies === null
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
                          {replyFormError === 'deleted' ? (
                            <p role="alert" className="text-center text-sm text-app-danger">
                              {t('forum.errorNoteDeleted')}
                            </p>
                          ) : null}
                          {replyFormError === 'authorWallet' ? (
                            <p role="alert" className="text-center text-sm text-app-danger">
                              {t('forum.payErrorAuthorWallet')}
                            </p>
                          ) : null}
                        </form>
                      </SundayWritingGate>
                    )
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
      className="flex w-full min-w-0 flex-col gap-4 overscroll-y-contain border-t border-app-border pt-6"
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

      {modeSelector && !composerHidden ? (
        <ForumModeSelect
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
        />
      ) : null}

      {!hideCompose && allowAsk ? (
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

      {!hideCompose && allowAsk && composeIntent === 'ask' ? (
        <SundayWritingGate>
          <ForumAskWizard
            step={askStep}
            onStepChange={(next) => {
              onAskStepChange?.(next);
            }}
            askCadence={askCadence}
            onAskCadenceChange={onAskCadenceChange}
            askObligation={askObligation}
            onAskObligationChange={onAskObligationChange}
            {...(onCreditTermDays === undefined ? {} : { onCreditTermDays })}
            askDraft={askDraft}
            {...(askDraftUnit === undefined ? {} : { askDraftUnit })}
            {...(onAskDraftUnit === undefined ? {} : { onAskDraftUnit })}
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
        </SundayWritingGate>
      ) : null}

      {!hideCompose && (!allowAsk || composeIntent === 'post') && shopComposer ? (
        <SundayWritingGate>
          <ShopAddWizard
            posting={posting}
            draft={draft}
            onDraftChange={onDraftChange}
            photoDrafts={photoDrafts}
            videoDraft={videoDraft}
            onPickFiles={onPickFiles}
            onRemovePhoto={onRemovePhoto}
            onClearPhoto={onClearPhoto}
            place={placeDraft}
            onPlaceChange={onPlaceDraftChange!}
            username={shopUsername}
            onUsernameChange={onShopUsernameChange!}
            onSubmit={onPost}
            resetToken={shopResetToken}
            maxLength={composerMaxLength}
          />
        </SundayWritingGate>
      ) : null}
      {!hideCompose && (!allowAsk || composeIntent === 'post') && !shopComposer ? (
        <SundayWritingGate>
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
              {onPlaceDraftChange !== undefined ? (
                <PlaceField place={placeDraft} disabled={posting} onChange={onPlaceDraftChange} />
              ) : null}
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime,video/x-m4v,.mp4,.webm,.mov,.m4v"
                className="hidden"
                disabled={posting}
                onChange={handleFileChange}
              />
              <MentionTextarea
                textareaRef={composerRef}
                ariaLabel={t('forum.composerLabel')}
                placeholder={t('forum.placeholder')}
                value={draft}
                onChange={onDraftChange}
                maxLength={composerMaxLength}
                rows={2}
                disabled={posting}
                wrapperClassName="relative min-w-0 flex-1"
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
            {firstPostFree ? (
              <p className="text-center text-sm text-app-muted">{t('forum.firstPostFree')}</p>
            ) : null}
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
        </SundayWritingGate>
      ) : null}

      {payInvoice !== null &&
      (payHost === 'composer' ||
        (payHost !== 'card' &&
          payMessageId !== null &&
          !(visible !== null && visible.some((row) => row.id === payMessageId)) &&
          !(replies !== null && replies.some((row) => row.id === payMessageId)))) ? (
        <SundayWritingGate notice="zap">
          <ForumPaySheet
            messageId={payInvoice.messageId}
            payDraft={payDraft}
            payBusy={payBusy}
            payError={payError}
            payInvoice={payInvoice}
            payWaiting={payWaiting}
            onPayDraftChange={onPayDraftChange}
            {...(onPayUnitChange === undefined ? {} : { onPayUnitChange })}
            onPaySubmit={onPaySubmit}
            onPayCancel={onPayCancel}
            rateDay={rateDay}
            onInteract={(event) => {
              event.stopPropagation();
            }}
          />
        </SundayWritingGate>
      ) : null}

      <div className="sunday-write-field">
        {!hideCompose && formError === 'empty' ? (
          <p role="alert" className="text-center text-sm text-app-danger">
            {t('forum.errorEmpty')}
          </p>
        ) : null}
        {!hideCompose && formError === 'tooLong' ? (
          <p role="alert" className="text-center text-sm text-app-danger">
            {t('forum.errorTooLong')}
          </p>
        ) : null}
        {!hideCompose && formError === 'request' ? (
          <p role="alert" className="text-center text-sm text-app-danger">
            {t('forum.errorRequest')}
          </p>
        ) : null}
        {!hideCompose && formError === 'rateLimit' ? (
          <p role="alert" className="text-center text-sm text-app-danger">
            {t('forum.errorRateLimit')}
          </p>
        ) : null}
        {!hideCompose && formError === 'unsupported' ? (
          <p role="alert" className="text-center text-sm text-app-danger">
            {t('forum.errorUnsupported')}
          </p>
        ) : null}
        {!hideCompose && formError === 'tooLarge' ? (
          <p role="alert" className="text-center text-sm text-app-danger">
            {t('forum.errorTooLarge')}
          </p>
        ) : null}
        {!hideCompose && formError === 'tooMany' ? (
          <p role="alert" className="text-center text-sm text-app-danger">
            {t('forum.errorTooMany')}
          </p>
        ) : null}
        {!hideCompose && formError === 'ask' ? (
          <p role="alert" className="text-center text-sm text-app-danger">
            {t('forum.errorAskAmount')}
          </p>
        ) : null}
      </div>

      {middle}
      {error && messages !== null ? errorBlock : null}
    </div>
  );
}
