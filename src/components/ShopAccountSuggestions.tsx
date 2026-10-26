'use client';

import type { ReactElement } from 'react';
import { useTranslations } from '@/components/LocaleProvider';

/** One account the shop field can attach. */
export interface ShopAccountSuggestion {
  id: string;
  username: string;
  name: string;
}

/** Props for the shared shop-account people list. */
interface ShopAccountSuggestionsProps {
  /** DOM id of the listbox. */
  listId: string;
  /** Accounts whose username starts with the field prefix. */
  rows: readonly ShopAccountSuggestion[];
  /** Index of the highlighted row. */
  activeIndex: number;
  /** When true, every row button is disabled. */
  disabled: boolean;
  /** Classes on the list element. */
  className: string;
  /** DOM id of one option. */
  optionId: (index: number) => string;
  /** Report the chosen username. Does not save. */
  onPick: (username: string) => void;
}

/**
 * People list under a shop-account field.
 *
 * Each row is `@username` and the display name when it differs. The
 * highlighted row uses the hover fill. Choosing a row reports that username
 * and does not save.
 *
 * @param props - List identity, rows, highlight, and the pick callback.
 * @returns The listbox.
 */
export function ShopAccountSuggestions({
  listId,
  rows,
  activeIndex,
  disabled,
  className,
  optionId,
  onPick,
}: ShopAccountSuggestionsProps): ReactElement {
  const { t } = useTranslations();
  return (
    <ul id={listId} role="listbox" aria-label={t('forum.mentionSuggest')} className={className}>
      {rows.map((row, index) => (
        <li key={row.id} role="presentation">
          <button
            type="button"
            id={optionId(index)}
            tabIndex={-1}
            role="option"
            aria-selected={index === activeIndex}
            aria-label={`@${row.username}`}
            disabled={disabled}
            className={`flex min-h-11 w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-app-fg hover:bg-app-hover${
              index === activeIndex ? ' bg-app-hover' : ''
            }`}
            onMouseDown={(event) => {
              event.preventDefault();
              onPick(row.username);
            }}
            onClick={() => {
              onPick(row.username);
            }}
          >
            <span className="font-medium">@{row.username}</span>
            {row.name !== row.username ? <span className="text-app-muted">{row.name}</span> : null}
          </button>
        </li>
      ))}
    </ul>
  );
}
