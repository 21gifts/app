'use client';

import Link from 'next/link';
import { useState, type ReactElement, type ReactNode } from 'react';
import { useTranslations } from '@/components/LocaleProvider';
import { isShopNote } from '@/lib/forum-shop';
import type { MessageKey } from '@/lib/messages';

/** Kind of a top-level note, shown as a tag beside the author. */
export type NoteKind = 'loan' | 'donation' | 'shop';

const KIND_KEYS: Record<Exclude<NoteKind, 'shop'>, { label: MessageKey; hint: MessageKey }> = {
  loan: { label: 'forum.tag.loan', hint: 'forum.tag.loanHint' },
  donation: { label: 'forum.tag.donation', hint: 'forum.tag.donationHint' },
};

/**
 * Tags for a top-level note. A repayable ask is a loan. Any other ask is a
 * donation. A shop hashtag is a shop. Replies have none.
 *
 * @param message - Note fields the tags are derived from.
 * @returns Kinds in display order.
 */
export function noteKinds(message: {
  parentId?: string | null | undefined;
  text: string;
  goalSats?: number | undefined;
  goalRepayable?: true | undefined;
}): NoteKind[] {
  if (typeof message.parentId === 'string') {
    return [];
  }
  const kinds: NoteKind[] = [];
  if (message.goalRepayable === true) {
    kinds.push('loan');
  } else if (typeof message.goalSats === 'number' && message.goalSats > 0) {
    kinds.push('donation');
  }
  if (isShopNote(message.text)) {
    kinds.push('shop');
  }
  return kinds;
}

/**
 * Author row plus the note's kind tags. Loan and donation open a one-line
 * explanation. Shop keeps the link to the shop list.
 *
 * @param props.kinds - Tags to show.
 * @param props.children - Author name and any role tag, in the same row.
 * @returns The row, and the open explanation under it.
 */
export function MessageKindTags({
  kinds,
  children,
}: {
  kinds: readonly NoteKind[];
  children: ReactNode;
}): ReactElement {
  const { t } = useTranslations();
  const [open, setOpen] = useState<Exclude<NoteKind, 'shop'> | null>(null);
  const shown = open !== null && kinds.includes(open) ? open : null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      {children}
      {kinds.map((kind) =>
        kind === 'shop' ? (
          <Link
            key={kind}
            href="/shops"
            className="rounded-full border border-app-border-strong px-2 py-0.5 text-xs font-medium text-app-muted no-underline"
            onClick={(event) => {
              event.stopPropagation();
            }}
            onKeyDown={(event) => {
              event.stopPropagation();
            }}
          >
            {t('forum.shopTag')}
          </Link>
        ) : (
          <button
            key={kind}
            type="button"
            aria-expanded={shown === kind}
            onClick={(event) => {
              event.stopPropagation();
              setOpen(open === kind ? null : kind);
            }}
            className="rounded-full border border-app-border-strong px-2 py-0.5 text-xs font-medium text-app-muted"
          >
            {t(KIND_KEYS[kind].label)}
          </button>
        ),
      )}
      {shown !== null ? (
        <p role="status" className="basis-full text-xs text-app-muted">
          {t(KIND_KEYS[shown].hint)}
        </p>
      ) : null}
    </div>
  );
}
