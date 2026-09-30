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
 *
 * @param draft - Current field value.
 * @returns The lowercase prefix, `""`, or `null`.
 */
function mentionQuery(draft: string): string | null {
  const trimmed = draft.trim();
  if (!trimmed.startsWith('@')) {
    return null;
  }
  const query = trimmed.slice(1).toLowerCase();
  if (query === '') {
    return '';
  }
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

/** Where the suggestion panel sits. One edge is set; the other stays unset. */
interface PanelPlace {
  top: number | null;
  bottom: number | null;
  left: number;
  width: number;
}

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
  const width = Math.min(288, window.innerWidth - 16);
  const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8));
  const below = window.innerHeight - rect.bottom;
  const above = rect.top;
  if (below < 480 && above > below) {
    return { top: null, bottom: window.innerHeight - rect.top + 8, left, width };
  }
  return { top: rect.bottom + 8, bottom: null, left, width };
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
 * forum post appear immediately. Choosing one fills `@username`. Saving still
 * sends the username without `@`. The panel is fixed to the viewport so a
 * phone does not scroll sideways.
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
  const [suggestions, setSuggestions] = useState<readonly ShopSuggestion[]>([]);
  const [panel, setPanel] = useState<PanelPlace | null>(null);
  const anchorRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const query = open && session !== null ? mentionQuery(draft) : null;

  useEffect(() => {
    if (session === null || !open || query === null) {
      setSuggestions([]);
      return;
    }
    const current = session;
    let cancelled = false;
    void searchMentionAccounts(current, query)
      .then((rows) => {
        if (!cancelled) {
          setSuggestions(rows);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSuggestions([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [open, query, session]);

  useLayoutEffect(() => {
    if (!open) {
      return;
    }
    const place = (): void => {
      const anchor = anchorRef.current;
      if (anchor !== null) {
        setPanel(placePanel(anchor));
      }
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open]);

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
              setSuggestions([]);
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
          className="fixed z-30 rounded-2xl border border-app-border bg-app-card-muted p-3"
          style={{
            ...(panel.top === null ? { bottom: panel.bottom ?? 0 } : { top: panel.top }),
            left: panel.left,
            width: panel.width,
          }}
        >
          <input
            type="text"
            aria-label={t('forum.shopAccountLabel')}
            aria-controls={suggestions.length > 0 ? listId : undefined}
            value={draft}
            disabled={saving}
            onChange={(event) => {
              setDraft(event.target.value);
              setErrorKey(null);
            }}
            className="mt-0 w-full rounded-2xl border border-app-border-strong px-4 py-2.5 text-base text-app-fg"
          />
          {suggestions.length > 0 ? (
            <ul
              id={listId}
              role="listbox"
              aria-label={t('forum.mentionSuggest')}
              className="mt-2 rounded-xl border border-app-border bg-app-card p-2"
            >
              {suggestions.slice(0, SUGGESTION_LIMIT).map((row) => (
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
