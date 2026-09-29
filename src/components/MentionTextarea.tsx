'use client';

import {
  useEffect,
  useId,
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

/** Space between the field and the list (`mt-2` / `mb-2`). */
const MENTION_LIST_GAP = 8;

/** One username the suggestion list can insert. */
export interface MentionAccount {
  id: string;
  username: string;
  name: string;
}

/** Server page kept only while its prefix is still the active token. */
interface MentionPage {
  query: string;
  rows: MentionAccount[];
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
 * Field classes while the list is open.
 *
 * The closed field keeps the caller's classes and is not wrapped, so a
 * resting composer matches the plain textarea. The open field fills the
 * relative wrapper instead of being its own flex item.
 *
 * @param className - Classes for the closed textarea.
 * @returns Classes for the textarea inside the open wrapper.
 */
function openFieldClass(className: string): string {
  const rest = className
    .split(/\s+/)
    .filter(
      (token) =>
        token !== 'flex-1' && token !== 'min-w-0' && token !== 'w-full' && token !== 'block',
    )
    .join(' ');
  return `block min-w-0 w-full ${rest}`.trim();
}

/**
 * Forum composer field that suggests people as soon as `@` is typed.
 *
 * An empty token shows the prefetched first page. A longer token shows
 * usernames that start with those letters. A new letter drops the previous
 * server page in that same update. Choosing one inserts `@username ` and
 * closes the list. A space already after the token stays a single space.
 * A choice that would pass the length limit is not inserted. Keys during
 * text composition stay with the input method. Escape, Tab, or a click
 * outside keeps each such `@` closed until that character is gone.
 * Choosing does not remember that `@` as closed. The caret
 * sits after the inserted space even when the text was already that handle.
 * The list sits under the field, and
 * above it only when this list would not fit underneath and there is
 * more room above. No session, or a disabled field, is a plain textarea.
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
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const localRef = useRef<HTMLTextAreaElement>(null);
  const pendingCaret = useRef<number | null>(null);
  const [caret, setCaret] = useState(0);
  const [collapsed, setCollapsed] = useState(true);
  const [seed, setSeed] = useState<MentionAccount[] | null>(null);
  const [remote, setRemote] = useState<MentionPage | null>(null);
  const [highlight, setHighlight] = useState(0);
  const [closedStarts, setClosedStarts] = useState<ReadonlySet<number>>(() => new Set());
  const [placeAbove, setPlaceAbove] = useState(false);

  const mention = collapsed ? activeMention(value, caret) : null;
  const query = mention === null ? null : mention.query;
  const tokenKey = mention === null ? '' : `${String(mention.start)}:${mention.query}`;
  const mentionStart = mention === null ? null : mention.start;
  const filtered =
    mention === null || seed === null
      ? []
      : mention.query === ''
        ? seed
        : seed.filter((row) => row.username.toLowerCase().startsWith(mention.query));
  const shown =
    mention !== null && mention.query !== '' && remote !== null && remote.query === mention.query
      ? remote.rows
      : filtered;
  const shownKey = shown.map((row) => row.id).join('\n');
  const open = mention !== null && !closedStarts.has(mention.start) && shown.length > 0;
  const activeIndex = Math.min(highlight, Math.max(shown.length - 1, 0));

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
            setRemote({ query: prefix, rows });
            setHighlight(0);
          }
        })
        .catch(() => {
          if (!cancelled) {
            setRemote({ query: prefix, rows: [] });
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

  useEffect(() => {
    setClosedStarts((current) => {
      let next: Set<number> | null = null;
      for (const index of current) {
        if (value.charAt(index) === '@') {
          continue;
        }
        next ??= new Set(current);
        next.delete(index);
      }
      return next ?? current;
    });
  }, [value]);

  useLayoutEffect(() => {
    if (!open) {
      return;
    }
    const field = localRef.current;
    const list = listRef.current;
    /* v8 ignore next 3 -- the list is open only after the field and the list are mounted */
    if (field === null || list === null) {
      return;
    }
    const fieldBox = field.getBoundingClientRect();
    const roomBelow = window.innerHeight - fieldBox.bottom;
    const roomAbove = fieldBox.top;
    const needed = list.getBoundingClientRect().height + MENTION_LIST_GAP;
    setPlaceAbove(roomBelow < needed && roomAbove > roomBelow);
  }, [open, shownKey, tokenKey]);

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
    /* v8 ignore next 3 -- the list is open only while a mention token is active */
    if (mentionStart === null) {
      return;
    }
    const start = mentionStart;
    const onPointer = (event: MouseEvent): void => {
      const root = rootRef.current;
      /* v8 ignore next 3 -- the listener is attached only after the wrapper is mounted */
      if (root === null) {
        return;
      }
      if (root.contains(event.target as Node)) {
        return;
      }
      setClosedStarts((current) => {
        const next = new Set(current);
        next.add(start);
        return next;
      });
    };
    document.addEventListener('mousedown', onPointer, true);
    return () => {
      document.removeEventListener('mousedown', onPointer, true);
    };
  }, [open, mentionStart]);

  const sync = (node: HTMLTextAreaElement): void => {
    setCaret(node.selectionStart);
    setCollapsed(node.selectionStart === node.selectionEnd);
  };

  const insertAt = (token: NonNullable<typeof mention>, account: MentionAccount): void => {
    const end = value.charAt(token.end) === ' ' ? token.end + 1 : token.end;
    const next = value.slice(0, token.start) + `@${account.username} ` + value.slice(end);
    if (maxLength !== undefined && next.length > maxLength) {
      return;
    }
    const caretAt = token.start + account.username.length + 2;
    pendingCaret.current = caretAt;
    setCaret(caretAt);
    if (next === value) {
      const node = localRef.current;
      /* v8 ignore next 3 -- insert runs only after the textarea is mounted */
      if (node !== null) {
        node.setSelectionRange(caretAt, caretAt);
      }
      pendingCaret.current = null;
    }
    onChange(next);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>): void => {
    if (!open) {
      return;
    }
    if (event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229) {
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
      const account = shown[activeIndex];
      /* v8 ignore next 3 -- the list is open only while a row is shown */
      if (account === undefined) {
        return;
      }
      insertAt(mention, account);
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      const start = mention.start;
      setClosedStarts((current) => {
        const next = new Set(current);
        next.add(start);
        return next;
      });
      return;
    }
    if (event.key === 'Tab') {
      const start = mention.start;
      setClosedStarts((current) => {
        const next = new Set(current);
        next.add(start);
        return next;
      });
    }
  };

  const field = (
    <textarea
      ref={(node) => {
        localRef.current = node;
        if (textareaRef !== undefined) {
          textareaRef.current = node;
        }
      }}
      aria-label={ariaLabel}
      aria-controls={open ? listId : undefined}
      aria-activedescendant={open ? `${listId}-${String(activeIndex)}` : undefined}
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
      className={open ? openFieldClass(className) : className}
    />
  );
  if (!open) {
    return field;
  }
  return (
    <div
      ref={rootRef}
      className={wrapperClassName}
      onMouseDown={(event) => {
        event.stopPropagation();
      }}
    >
      {field}
      <ul
        ref={listRef}
        id={listId}
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
              id={`${listId}-${String(index)}`}
              tabIndex={-1}
              role="option"
              aria-selected={index === activeIndex}
              aria-label={`@${account.username}`}
              className={
                index === activeIndex ? `${OPTION_ROW_CLASS} bg-app-hover` : OPTION_ROW_CLASS
              }
              onMouseDown={(event) => {
                event.preventDefault();
                /* v8 ignore next 3 -- the option is rendered only while a mention token is active */
                if (mention === null) {
                  return;
                }
                insertAt(mention, account);
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
    </div>
  );
}
