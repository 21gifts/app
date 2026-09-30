'use client';

import { User, X } from 'lucide-react';
import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactElement } from 'react';
import { useTranslations } from '@/components/LocaleProvider';
import { Button, IconButton } from '@/components/ui';
import { setMessageShopAccount } from '@/lib/api';
import type { ForumMessage } from '@/lib/api-types';
import { isShopNote } from '@/lib/forum-shop';
import { searchMentionAccounts } from '@/lib/mention-search';
import { roleAtLeast } from '@/lib/roles';
import { useAuthStore } from '@/stores/auth-store';

const USERNAME_PREFIX = /^[a-z0-9][a-z0-9._-]{0,31}$/;

/** First rows only. A longer list would be a second scroller, which the page forbids. */
const SUGGESTION_LIMIT = 8;

/** One account the shop field can attach. */
interface ShopSuggestion {
  id: string;
  username: string;
  name: string;
}

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
 * @param place - Position chosen from the button.
 * @param rect - Measured panel box.
 * @param band - Visible band under the chrome.
 * @returns The same place when it already fits, otherwise a top-pinned box.
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
  if (top === rect.top) {
    return place;
  }
  return { side: 'below', top, left: place.left, width: place.width };
}

/** Props for the shops-feed staff account editor. */
export interface ShopAccountControlProps {
  /** Top-level shop note to attach an account to. */
  message: ForumMessage;
  /** Apply the saved account (or `null` when cleared) to the listed row. */
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
 * start with it, before the next page returns. Choosing one fills `@username`. Saving still
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
  const [errorKey, setErrorKey] = useState<'missing' | 'failed' | null>(null);
  const [seed, setSeed] = useState<readonly ShopSuggestion[]>([]);
  const [remote, setRemote] = useState<{
    query: string;
    rows: readonly ShopSuggestion[];
  } | null>(null);
  const [panel, setPanel] = useState<PanelPlace | null>(null);
  const [rowLimit, setRowLimit] = useState(SUGGESTION_LIMIT);
  const anchorRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const query = open && session !== null ? mentionQuery(draft) : null;

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

  useLayoutEffect(() => {
    setRowLimit(SUGGESTION_LIMIT);
  }, [query]);

  const placed = panel !== null;

  useLayoutEffect(() => {
    if (!open) {
      return;
    }
    const place = (): void => {
      const anchor = anchorRef.current;
      if (anchor === null) {
        return;
      }
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
  const ariaLabel = hasAccount ? t('forum.editShopAccount') : t('forum.addShopAccount');

  const saveUsername = async (): Promise<void> => {
    let trimmed = draft.trim();
    if (trimmed.startsWith('@')) {
      trimmed = trimmed.slice(1);
    }
    if (trimmed === '') {
      setErrorKey('missing');
      return;
    }
    setSaving(true);
    setErrorKey(null);
    try {
      const updated = await setMessageShopAccount(token, message.id, trimmed);
      onUpdated(message.id, updated.shopAccount ?? null);
      setOpen(false);
      setErrorKey(null);
    } catch (err) {
      if (err instanceof Error && err.message === 'No account with that username') {
        setErrorKey('missing');
      } else {
        setErrorKey('failed');
      }
    } finally {
      setSaving(false);
    }
  };

  const removeAccount = async (): Promise<void> => {
    setSaving(true);
    setErrorKey(null);
    try {
      await setMessageShopAccount(token, message.id, null);
      onUpdated(message.id, null);
      setOpen(false);
      setErrorKey(null);
    } catch {
      setErrorKey('failed');
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
            value={draft}
            disabled={saving}
            onChange={(event) => {
              setDraft(event.target.value);
              setRemote(null);
              setErrorKey(null);
            }}
            className="mt-0 w-full rounded-2xl border border-app-border-strong px-4 py-2.5 text-base text-app-fg"
          />
          {shown.length > 0 ? (
            <ul
              id={listId}
              role="listbox"
              aria-label={t('forum.mentionSuggest')}
              className="mt-2 rounded-xl border border-app-border bg-app-card p-2"
            >
              {shown.map((row) => (
                <li key={row.id} role="presentation">
                  <button
                    type="button"
                    role="option"
                    aria-selected={draft.trim().toLowerCase() === `@${row.username.toLowerCase()}`}
                    aria-label={`@${row.username}`}
                    disabled={saving}
                    className="flex min-h-11 w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-app-fg hover:bg-app-hover"
                    onMouseDown={(event) => {
                      event.preventDefault();
                      setDraft(`@${row.username}`);
                      setRemote(null);
                      setErrorKey(null);
                    }}
                    onClick={() => {
                      setDraft(`@${row.username}`);
                      setRemote(null);
                      setErrorKey(null);
                    }}
                  >
                    <span className="font-medium">@{row.username}</span>
                    {row.name !== row.username ? (
                      <span className="text-app-muted">{row.name}</span>
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          {errorKey !== null ? (
            <p role="alert" className="mt-3 text-sm text-app-danger">
              {errorKey === 'missing'
                ? t('forum.shopAccountMissing')
                : t('forum.shopAccountSaveFailed')}
            </p>
          ) : null}
          <Button
            type="button"
            variant="secondary"
            className="mt-3"
            disabled={saving}
            onClick={() => {
              void saveUsername();
            }}
          >
            {t('forum.shopAccountSave')}
          </Button>
          {hasAccount ? (
            <IconButton
              type="button"
              size="sm"
              variant="secondary"
              className="mt-3"
              aria-label={t('forum.shopAccountRemove')}
              disabled={saving}
              onClick={() => {
                void removeAccount();
              }}
            >
              <X aria-hidden="true" className="h-4 w-4" />
            </IconButton>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
