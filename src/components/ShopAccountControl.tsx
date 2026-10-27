'use client';

import { User } from 'lucide-react';
import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactElement,
} from 'react';
import { useTranslations } from '@/components/LocaleProvider';
import {
  ShopAccountSuggestions,
  type ShopAccountSuggestion,
} from '@/components/ShopAccountSuggestions';
import { Button, IconButton } from '@/components/ui';
import { setMessageShopAccount } from '@/lib/api';
import type { ForumMessage } from '@/lib/api-types';
import { isShopNote, shopAccountRequiredProblem, shopUsernameProblem } from '@/lib/forum-shop';
import { lookupAccountByUsername, searchMentionAccounts } from '@/lib/mention-search';
import { roleAtLeast } from '@/lib/roles';
import { useAuthStore } from '@/stores/auth-store';

const USERNAME_PREFIX = /^[a-z0-9][a-z0-9._-]{0,31}$/;

/** First rows only. A longer list would be a second scroller, which the page forbids. */
const SUGGESTION_LIMIT = 8;

/**
 * Username prefix after a leading `@`, or `null` when the field is not a mention.
 *
 * Empty string means the field is exactly `@` and the first suggestion page applies.
 * Any space, including a trailing one, is not a username and closes the list.
 *
 * @param draft - Current field value.
 * @returns The lowercase prefix, `""`, or `null`.
 */
function mentionQuery(draft: string): string | null {
  if (draft === '@') {
    return '';
  }
  if (!draft.startsWith('@') || draft.includes(' ')) {
    return null;
  }
  const query = draft.slice(1).toLowerCase();
  if (!USERNAME_PREFIX.test(query)) {
    return null;
  }
  return query;
}

/**
 * Field value when the panel opens.
 *
 * An attached account keeps its `@username`. A new account starts at `@`
 * so the suggestion list can open immediately.
 *
 * @param username - Saved username, when the note already has an account.
 * @returns The draft, always starting with `@`.
 */
function draftFor(username: string | undefined): string {
  return username === undefined || username === '' ? '@' : `@${username}`;
}

/**
 * Field value after each keystroke.
 *
 * A value that already starts with `@` is kept, including a space after it,
 * so `@ ` still closes the list. Blank and a lone `@` with only surrounding
 * spaces stay `@`, so the list can open. Leading space before `@handle` is
 * trimmed to that one `@`, so save still strips a single prefix. Any other
 * value gets one leading `@`.
 *
 * @param raw - The input's current value.
 * @returns The draft shown in the field.
 */
function accountDraft(raw: string): string {
  if (raw.startsWith('@')) {
    return raw;
  }
  const trimmed = raw.trim();
  if (trimmed === '' || trimmed === '@') {
    return '@';
  }
  if (trimmed.startsWith('@')) {
    return trimmed;
  }
  return `@${raw}`;
}

/** Where the suggestion panel sits: below the button, or above it. */
type PanelPlace =
  | { side: 'below'; top: number; left: number; width: number }
  | { side: 'above'; bottom: number; left: number; width: number };

/**
 * Keep the suggestion panel inside the viewport.
 *
 * The control sits in a note footer. A wide absolute panel there scrolls the
 * page sideways on a phone. A fixed box does not. The page has one scroller,
 * so this panel does not scroll on its own. When the button is low on the
 * screen, the panel opens upward.
 *
 * @param anchor - The account button.
 * @returns The fixed box, either below or above the button.
 */
function placePanel(anchor: HTMLElement): PanelPlace {
  const rect = anchor.getBoundingClientRect();
  const viewport = window.visualViewport;
  const viewTop = viewport?.offsetTop ?? 0;
  const viewHeight = viewport?.height ?? window.innerHeight;
  const viewBottom = viewTop + viewHeight;
  const width = Math.min(288, window.innerWidth - 16);
  const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8));
  const below = viewBottom - rect.bottom;
  const above = rect.top - viewTop;
  if (below < 480 && above > below) {
    return { side: 'above', bottom: window.innerHeight - rect.top + 8, left, width };
  }
  return { side: 'below', top: rect.bottom + 8, left, width };
}

/** Visible band under the app chrome, inside the visual viewport. */
function visibleBand(anchor: HTMLElement): { top: number; bottom: number } {
  const viewport = window.visualViewport;
  const viewTop = viewport?.offsetTop ?? 0;
  const viewBottom = viewTop + (viewport?.height ?? window.innerHeight);
  const frame = anchor.closest('[data-app-frame]');
  const chrome = frame?.querySelector('[data-app-chrome]');
  const chromeBottom =
    chrome instanceof HTMLElement ? chrome.getBoundingClientRect().bottom : viewTop;
  return { top: Math.max(viewTop, chromeBottom), bottom: viewBottom };
}

/**
 * Move a panel that still crosses the chrome fully under it.
 *
 * Dropping rows cannot help once none remain. The box is pinned by its top
 * edge so it cannot sit on the chrome, even when it is taller than the band.
 *
 * @param place - Position chosen from the button. Its left and width are kept.
 * @param rect - Measured panel box.
 * @param band - Visible band under the chrome.
 * @returns A top-pinned box under the chrome.
 */
function clampIntoBand(
  place: PanelPlace,
  rect: DOMRect,
  band: { top: number; bottom: number },
): PanelPlace {
  let top = rect.top;
  if (top < band.top) {
    top = band.top;
  }
  if (top + rect.height > band.bottom) {
    top = Math.max(band.top, band.bottom - rect.height);
  }
  return { side: 'below', top, left: place.left, width: place.width };
}

/** Props for the shops-feed staff account editor. */
export interface ShopAccountControlProps {
  /** Top-level shop note to attach an account to. */
  message: ForumMessage;
  /** Apply the saved account to the listed row. */
  onUpdated: (
    messageId: string,
    shopAccount: { id: string; username: string; name: string } | null,
  ) => void;
}

/**
 * Moderator-only shop-account editor on a shop note. Absent on replies, hidden
 * notes, non-shop text, and ranks below moderator.
 *
 * The open field starts with `@`. Suggestions from the same account list as a
 * forum post appear immediately. A typed prefix keeps only usernames that
 * start with it, before the next page returns. Choosing one fills `@username`.
 * Deleting the prefix puts `@` back, so the next letter still lists accounts.
 * After an edit, that bare `@` is the required-account message.
 * A debounced exact-account check blocks Save while pending or proven
 * missing; a failed lookup leaves the API to decide. Saving still
 * sends the username without `@`. The panel is fixed to the viewport so a
 * phone does not scroll sideways. Rows drop until the box fits under the
 * app chrome, and the list hides rather than covering that chrome.
 *
 * @param props - Note and successful-save callback.
 * @returns The compact account control, or null when it must not edit.
 */
export function ShopAccountControl({
  message,
  onUpdated,
}: ShopAccountControlProps): ReactElement | null {
  const account = useAuthStore((state) => state.account);
  const session = useAuthStore((state) => state.session);
  const { t } = useTranslations();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState(draftFor(message.shopAccount?.username));
  const [edited, setEdited] = useState(false);
  const [errorKey, setErrorKey] = useState<'format' | 'missing' | 'failed' | null>(null);
  const [usernameLookup, setUsernameLookup] = useState<{
    username: string;
    verdict: 'checking' | 'found' | 'missing' | 'failed';
  } | null>(null);
  const [seed, setSeed] = useState<readonly ShopAccountSuggestion[]>([]);
  const [remote, setRemote] = useState<{
    query: string;
    rows: readonly ShopAccountSuggestion[];
  } | null>(null);
  const [panel, setPanel] = useState<PanelPlace | null>(null);
  const [rowLimit, setRowLimit] = useState(SUGGESTION_LIMIT);
  const [suggestionActive, setSuggestionActive] = useState(0);
  const anchorRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const query = open && session !== null ? mentionQuery(draft) : null;
  const normalizedUsername = draft.trim().replace(/^@/, '').trim().toLowerCase();
  // A newly opened picker starts with `@` and explains the disabled Save as a
  // hint. After an edit, or when the field is left, a bare `@` is the required
  // account, not a format error.
  const formatProblem = shopUsernameProblem(draft);
  const accountRequired = shopAccountRequiredProblem(draft) === 'required';
  const usernameRequired = edited && accountRequired;

  useEffect(() => {
    if (session === null || !open || query === null) {
      setSeed([]);
      setRemote(null);
      return;
    }
    const current = session;
    const requested = query;
    let cancelled = false;
    if (requested !== '') {
      setRemote(null);
    }
    void searchMentionAccounts(current, requested)
      .then((rows) => {
        if (cancelled) {
          return;
        }
        if (requested === '') {
          setSeed(rows);
          return;
        }
        setRemote({ query: requested, rows });
      })
      .catch(() => {
        if (cancelled) {
          return;
        }
        if (requested === '') {
          setSeed([]);
          return;
        }
        setRemote({ query: requested, rows: [] });
      });
    return () => {
      cancelled = true;
    };
  }, [open, query, session]);

  useEffect(() => {
    setSuggestionActive(0);
  }, [query]);

  useEffect(() => {
    if (session === null || !open || accountRequired || shopUsernameProblem(draft) !== null) {
      setUsernameLookup(null);
      return;
    }
    const current = session;
    const requested = normalizedUsername;
    let cancelled = false;
    setUsernameLookup({ username: requested, verdict: 'checking' });
    const timer = window.setTimeout(() => {
      void lookupAccountByUsername(current, requested)
        .then((verdict) => {
          if (!cancelled) {
            setUsernameLookup({
              username: requested,
              verdict,
            });
          }
        })
        .catch(() => {
          if (!cancelled) {
            setUsernameLookup({ username: requested, verdict: 'failed' });
          }
        });
    }, 150);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [accountRequired, draft, normalizedUsername, open, session]);

  useLayoutEffect(() => {
    setRowLimit(SUGGESTION_LIMIT);
  }, [query]);

  const placed = panel !== null;

  useLayoutEffect(() => {
    if (!open) {
      return;
    }
    const place = (): void => {
      const anchor = anchorRef.current as HTMLDivElement;
      let next = placePanel(anchor);
      const box = panelRef.current;
      if (placed && box !== null) {
        const band = visibleBand(anchor);
        const rect = box.getBoundingClientRect();
        if (rect.top < band.top || rect.bottom > band.bottom) {
          if (rowLimit > 0) {
            setRowLimit(rowLimit - 1);
          } else {
            next = clampIntoBand(next, rect, band);
          }
        }
      }
      setPanel(next);
    };
    place();
    const viewport = window.visualViewport;
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    viewport?.addEventListener('resize', place);
    viewport?.addEventListener('scroll', place);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
      viewport?.removeEventListener('resize', place);
      viewport?.removeEventListener('scroll', place);
    };
  }, [open, rowLimit, seed, remote, query, placed]);

  if (
    message.parentId !== undefined ||
    message.deletedAt !== undefined ||
    !isShopNote(message.text) ||
    session === null ||
    !roleAtLeast(account?.role, 'moderator')
  ) {
    return null;
  }

  const token = session;
  const hasAccount = message.shopAccount !== undefined;
  const shown = (
    query === null
      ? []
      : query === ''
        ? seed
        : remote !== null && remote.query === query
          ? remote.rows
          : seed.filter((row) => row.username.toLowerCase().startsWith(query))
  ).slice(0, rowLimit);
  const suggestionActiveIndex = shown.length === 0 ? 0 : suggestionActive % shown.length;
  const ariaLabel = hasAccount ? t('forum.editShopAccount') : t('forum.addShopAccount');
  const usernameLookupCurrent = usernameLookup?.username === normalizedUsername;
  const usernameMissing =
    usernameLookupCurrent && usernameLookup?.verdict === 'missing' && formatProblem === null;
  const usernamePending =
    normalizedUsername !== '' &&
    formatProblem === null &&
    (!usernameLookupCurrent || usernameLookup?.verdict === 'checking');
  const liveError =
    formatProblem !== null
      ? t('login.nameInvalid')
      : usernameMissing
        ? t('shops.problemUsernameMissing')
        : usernameRequired
          ? t('forum.shopAccountHint')
          : undefined;
  const savedError =
    errorKey === 'format'
      ? t('login.nameInvalid')
      : errorKey === 'missing'
        ? t('shops.problemUsernameMissing')
        : errorKey === 'failed'
          ? t('forum.shopAccountSaveFailed')
          : undefined;
  const shownError = savedError ?? liveError;
  // The untouched `@` keeps Save disabled, so the reason is shown as a hint.
  const untouched = !edited && draft === '@';
  const usernameFeedbackId =
    shownError !== undefined
      ? `${listId}-error`
      : usernamePending
        ? `${listId}-checking`
        : untouched
          ? `${listId}-hint`
          : undefined;

  const pickSuggestion = (username: string): void => {
    setDraft(`@${username}`);
    setEdited(true);
    setRemote(null);
    setErrorKey(null);
    setSuggestionActive(0);
  };

  const onSuggestionKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229) {
      return;
    }
    if (shown.length === 0) {
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setSuggestionActive((index) => (index + 1) % shown.length);
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setSuggestionActive((index) => (index - 1 + shown.length) % shown.length);
      return;
    }
    if (event.key === 'Home') {
      event.preventDefault();
      setSuggestionActive(0);
      return;
    }
    if (event.key === 'End') {
      event.preventDefault();
      setSuggestionActive(shown.length - 1);
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      const row = shown[suggestionActiveIndex];
      /* v8 ignore next 3 -- the list is open only while a row is shown */
      if (row === undefined) {
        return;
      }
      pickSuggestion(row.username);
    }
  };

  const saveUsername = async (): Promise<void> => {
    const trimmed = normalizedUsername;
    setSaving(true);
    setErrorKey(null);
    try {
      const updated = await setMessageShopAccount(token, message.id, trimmed);
      onUpdated(message.id, updated.shopAccount ?? null);
      setOpen(false);
      setErrorKey(null);
    } catch (err) {
      if (err instanceof Error && err.message === 'No account with that username') {
        setUsernameLookup({ username: trimmed, verdict: 'missing' });
        setErrorKey('missing');
      } else if (err instanceof Error && err.message === 'Username is not valid') {
        setErrorKey('format');
      } else {
        setErrorKey('failed');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      ref={anchorRef}
      className="relative shrink-0"
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
    >
      <IconButton
        type="button"
        size="sm"
        variant="ghost"
        aria-label={ariaLabel}
        title={ariaLabel}
        aria-expanded={open}
        disabled={saving}
        onClick={() => {
          setOpen((current) => {
            if (!current) {
              setDraft(draftFor(message.shopAccount?.username));
              setEdited(false);
              setUsernameLookup(null);
              setSeed([]);
              setRemote(null);
              setErrorKey(null);
            }
            return !current;
          });
        }}
      >
        <User aria-hidden="true" className="h-4 w-4 shrink-0" />
      </IconButton>
      {open && panel !== null ? (
        <div
          ref={panelRef}
          className="fixed z-50 rounded-2xl border border-app-border bg-app-card-muted p-3"
          style={
            panel.side === 'above'
              ? { bottom: panel.bottom, left: panel.left, width: panel.width }
              : { top: panel.top, left: panel.left, width: panel.width }
          }
        >
          <input
            type="text"
            aria-label={t('forum.shopAccountLabel')}
            aria-controls={shown.length > 0 ? listId : undefined}
            aria-activedescendant={
              shown.length > 0 ? `${listId}-${String(suggestionActiveIndex)}` : undefined
            }
            aria-invalid={shownError === undefined ? undefined : true}
            aria-describedby={usernameFeedbackId}
            value={draft}
            disabled={saving}
            onKeyDown={onSuggestionKeyDown}
            onChange={(event) => {
              setDraft(accountDraft(event.target.value));
              setEdited(true);
              setRemote(null);
              setErrorKey(null);
            }}
            onBlur={() => {
              setEdited(true);
            }}
            className="mt-0 w-full rounded-2xl border border-app-border-strong px-4 py-2.5 text-base text-app-fg"
          />
          {shownError === undefined ? null : (
            <p
              id={`${listId}-error`}
              className="mt-3 text-sm text-app-danger"
              role={savedError === undefined ? undefined : 'alert'}
            >
              {shownError}
            </p>
          )}
          {shownError === undefined && !usernamePending && untouched ? (
            <p id={`${listId}-hint`} className="mt-3 text-sm text-app-muted">
              {t('forum.shopAccountHint')}
            </p>
          ) : null}
          {shownError === undefined && usernamePending ? (
            <p id={`${listId}-checking`} className="mt-3 text-sm text-app-muted">
              {t('shops.usernameChecking')}
            </p>
          ) : null}
          {shown.length > 0 ? (
            <ShopAccountSuggestions
              listId={listId}
              rows={shown}
              activeIndex={suggestionActiveIndex}
              disabled={saving}
              className="mt-2 rounded-xl border border-app-border bg-app-card p-2"
              optionId={(index) => `${listId}-${String(index)}`}
              onPick={pickSuggestion}
            />
          ) : null}
          <Button
            type="button"
            variant="secondary"
            className="mt-3"
            disabled={
              saving ||
              accountRequired ||
              formatProblem !== null ||
              usernameMissing ||
              usernamePending
            }
            onClick={() => {
              void saveUsername();
            }}
          >
            {t('forum.shopAccountSave')}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
