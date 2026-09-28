'use client';

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactElement,
  type RefObject,
} from 'react';
import { useTranslations } from '@/components/LocaleProvider';
import { searchMentionAccounts } from '@/lib/mention-search';
import { activeMention } from '@/lib/mention-caret';
import { useAuthStore } from '@/stores/auth-store';

/** Open the list upward when fewer than this many pixels remain below the field. */
const MENTION_LIST_ROOM = 220;

/** One username the suggestion list can insert. */
export interface MentionAccount {
  id: string;
  username: string;
  name: string;
}

/** Props for {@link MentionTextarea}. */
export interface MentionTextareaProps {
  /** Composer value. */
  value: string;
  /** Called with the next composer value. */
  onChange: (value: string) => void;
  /** When true, the field is inert and does not suggest. */
  disabled?: boolean;
  /** Classes on the relative wrapper (layout stays with the caller). */
  wrapperClassName: string;
  /** Textarea classes. */
  className: string;
  /** Accessible name of the textarea. */
  ariaLabel: string;
  /** Placeholder. */
  placeholder?: string;
  /** Maximum characters. */
  maxLength?: number;
  /** Rows. */
  rows?: number;
  /** Existing composer ref, when the caller focuses the field. */
  textareaRef?: RefObject<HTMLTextAreaElement | null>;
}

const OPTION_ROW_CLASS =
  'flex min-h-11 w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-app-fg hover:bg-app-hover';

/**
 * Forum composer field that suggests people as soon as `@` is typed.
 *
 * An empty token shows the prefetched first page. A longer token shows
 * usernames that start with those letters. Choosing one inserts
 * `@username ` and closes the list. No session, or a disabled field,
 * is a plain textarea.
 *
 * @param props - Value, change handler, and textarea attributes.
 * @returns The field and, when a mention token is active, the list.
 */
export function MentionTextarea({
  value,
  onChange,
  disabled = false,
  wrapperClassName,
  className,
  ariaLabel,
  placeholder,
  maxLength,
  rows,
  textareaRef,
}: MentionTextareaProps): ReactElement {
  const session = useAuthStore((state) => state.session);
  const { t } = useTranslations();
  const rootRef = useRef<HTMLDivElement>(null);
  const localRef = useRef<HTMLTextAreaElement>(null);
  const pendingCaret = useRef<number | null>(null);
  const [caret, setCaret] = useState(0);
  const [collapsed, setCollapsed] = useState(true);
  const [seed, setSeed] = useState<MentionAccount[] | null>(null);
  const [remote, setRemote] = useState<MentionAccount[] | null>(null);
  const [highlight, setHighlight] = useState(0);
  const [closedKey, setClosedKey] = useState<string | null>(null);
  const [placeAbove, setPlaceAbove] = useState(false);

  const mention = collapsed ? activeMention(value, caret) : null;
  const query = mention === null ? null : mention.query;
  const tokenKey = mention === null ? '' : `${String(mention.start)}:${mention.query}`;
  const filtered =
    mention === null || seed === null
      ? []
      : mention.query === ''
        ? seed
        : seed.filter((row) => row.username.toLowerCase().startsWith(mention.query));
  const shown = mention !== null && mention.query !== '' && remote !== null ? remote : filtered;
  const open = mention !== null && closedKey !== tokenKey && shown.length > 0;

  useEffect(() => {
    if (disabled || session === null) {
      setSeed(null);
      return;
    }
    let cancelled = false;
    void searchMentionAccounts(session, '')
      .then((rows) => {
        if (!cancelled) {
          setSeed(rows);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSeed([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [disabled, session]);

  useEffect(() => {
    if (disabled || session === null || query === null || query === '') {
      setRemote(null);
      return;
    }
    const prefix = query;
    let cancelled = false;
    setRemote(null);
    const timer = setTimeout(() => {
      void searchMentionAccounts(session, prefix)
        .then((rows) => {
          if (!cancelled) {
            setRemote(rows);
          }
        })
        .catch(() => {
          if (!cancelled) {
            setRemote([]);
          }
        });
    }, 150);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [disabled, session, query]);

  useEffect(() => {
    setHighlight(0);
  }, [tokenKey]);

  useLayoutEffect(() => {
    if (!open) {
      return;
    }
    const node = localRef.current;
    /* v8 ignore next 3 -- the list is open only after the textarea is mounted */
    if (node === null) {
      return;
    }
    const spaceBelow = window.innerHeight - node.getBoundingClientRect().bottom;
    setPlaceAbove(spaceBelow < MENTION_LIST_ROOM);
  }, [open, shown.length, tokenKey]);

  useLayoutEffect(() => {
    const next = pendingCaret.current;
    if (next === null) {
      return;
    }
    const node = localRef.current;
    /* v8 ignore next 3 -- the caret effect runs after the textarea is mounted */
    if (node === null) {
      return;
    }
    pendingCaret.current = null;
    node.setSelectionRange(next, next);
    setCaret(next);
    setCollapsed(true);
  }, [value]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const onPointer = (event: MouseEvent): void => {
      const root = rootRef.current;
      /* v8 ignore next 3 -- the listener is attached only after the wrapper is mounted */
      if (root === null || root.contains(event.target as Node)) {
        return;
      }
      setClosedKey(tokenKey);
    };
    document.addEventListener('mousedown', onPointer);
    return () => {
      document.removeEventListener('mousedown', onPointer);
    };
  }, [open, tokenKey]);

  const sync = (node: HTMLTextAreaElement): void => {
    setCaret(node.selectionStart);
    setCollapsed(node.selectionStart === node.selectionEnd);
  };

  const insertAt = (token: NonNullable<typeof mention>, account: MentionAccount): void => {
    const next = value.slice(0, token.start) + `@${account.username} ` + value.slice(token.end);
    const caretAt = token.start + account.username.length + 2;
    pendingCaret.current = caretAt;
    setCaret(caretAt);
    setClosedKey(`${String(token.start)}:${token.query}`);
    onChange(next);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>): void => {
    if (!open) {
      return;
    }
    /* v8 ignore next 3 -- the list is open only while a mention token is active */
    if (mention === null) {
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setHighlight((index) => (index + 1) % shown.length);
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setHighlight((index) => (index - 1 + shown.length) % shown.length);
      return;
    }
    if (event.key === 'Home') {
      event.preventDefault();
      setHighlight(0);
      return;
    }
    if (event.key === 'End') {
      event.preventDefault();
      setHighlight(shown.length - 1);
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      const account = shown[highlight];
      if (account !== undefined) {
        insertAt(mention, account);
      }
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      setClosedKey(tokenKey);
      return;
    }
    if (event.key === 'Tab') {
      setClosedKey(tokenKey);
    }
  };

  return (
    <div
      ref={rootRef}
      className={wrapperClassName}
      onMouseDown={(event) => {
        event.stopPropagation();
      }}
    >
      <textarea
        ref={(node) => {
          localRef.current = node;
          if (textareaRef !== undefined) {
            textareaRef.current = node;
          }
        }}
        aria-label={ariaLabel}
        aria-controls={open ? 'forum-mention-suggest' : undefined}
        aria-activedescendant={open ? `forum-mention-option-${String(highlight)}` : undefined}
        {...(placeholder === undefined ? {} : { placeholder })}
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
          sync(event.target);
        }}
        onSelect={(event) => {
          sync(event.currentTarget);
        }}
        onKeyDown={onKeyDown}
        onKeyUp={(event) => {
          sync(event.currentTarget);
        }}
        onClick={(event) => {
          sync(event.currentTarget);
        }}
        {...(maxLength === undefined ? {} : { maxLength })}
        {...(rows === undefined ? {} : { rows })}
        disabled={disabled}
        className={`block min-w-0 ${className}`}
      />
      {open ? (
        <ul
          id="forum-mention-suggest"
          role="listbox"
          aria-label={t('forum.mentionSuggest')}
          className={`absolute left-0 right-0 z-50 rounded-xl border border-app-border bg-app-card p-2 shadow-lg ${
            placeAbove ? 'bottom-full mb-2' : 'top-full mt-2'
          }`}
        >
          {shown.map((account, index) => (
            <li key={account.id} role="presentation">
              <button
                type="button"
                id={`forum-mention-option-${String(index)}`}
                role="option"
                aria-selected={index === highlight}
                aria-label={`@${account.username}`}
                className={
                  index === highlight ? `${OPTION_ROW_CLASS} bg-app-hover` : OPTION_ROW_CLASS
                }
                onMouseDown={(event) => {
                  event.preventDefault();
                  if (mention !== null) {
                    insertAt(mention, account);
                  }
                }}
              >
                <span className="font-medium">@{account.username}</span>
                {account.name !== account.username ? (
                  <span className="text-app-muted">{account.name}</span>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
