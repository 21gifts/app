'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState, type ReactElement } from 'react';
import { ForumNoteText } from '@/components/ForumNoteText';
import { LinkedText } from '@/components/LinkedText';
import { useTranslations } from '@/components/LocaleProvider';
import { TranslatableNoteBody } from '@/components/NoteTranslate';
import { useNumberFormat } from '@/components/NumberFormatProvider';
import { preferredFiatSuffix } from '@/components/PreferredFiatSuffix';
import { fetchPublicMessage, fetchPublicMessagePhoto, fetchShortLink } from '@/lib/api';
import type { ForumMessage } from '@/lib/api-types';
import { splitForumMessageQuotes, splitShortLinks } from '@/lib/forum-quote';
import { formatForumTime } from '@/lib/forum-time';
import type { MessageKey } from '@/lib/messages';
import { formatBitcoin, type FiatCode, type FiatRateDay } from '@/lib/stats-money';

type ShortHit = { code: string; messageId: string };

/** Stable empty list so a body with no short codes does not rerender. */
const NO_SHORT_HITS: ShortHit[] = [];

const ROLE_LABEL_KEYS: Record<'founder' | 'moderator' | 'verified', MessageKey> = {
  founder: 'forum.role.founder',
  moderator: 'forum.role.moderator',
  verified: 'forum.role.verified',
};

function findKnownNote(knownNotes: readonly ForumMessage[], id: string): ForumMessage | undefined {
  const needle = id.toLowerCase();
  return knownNotes.find((note) => note.id.toLowerCase() === needle);
}

function QuotedForumNote({
  note,
  rateDay,
  fiat,
  truncate,
  onActivate,
}: {
  note: ForumMessage;
  rateDay: FiatRateDay | null;
  fiat: FiatCode;
  truncate: boolean;
  onActivate?: (event: { stopPropagation: () => void }) => void;
}): ReactElement {
  const { t, locale } = useTranslations();
  const { numberFormat } = useNumberFormat();
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!note.hasPhoto) {
      setPhotoUrl(null);
      return;
    }

    let cancelled = false;
    let objectUrl: string | null = null;

    void (async () => {
      try {
        const blob = await fetchPublicMessagePhoto(note.id);
        if (cancelled) {
          return;
        }
        objectUrl = URL.createObjectURL(blob);
        setPhotoUrl(objectUrl);
      } catch {
        if (!cancelled) {
          setPhotoUrl(null);
        }
      }
    })();

    return () => {
      cancelled = true;
      if (objectUrl !== null) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [note.hasPhoto, note.id]);

  const fiatSuffix = preferredFiatSuffix(note.sats, rateDay, fiat, numberFormat, note);
  const roleLabel =
    note.role === 'founder' || note.role === 'moderator' || note.role === 'verified'
      ? t(ROLE_LABEL_KEYS[note.role])
      : null;
  const viaLabel = note.via === 'nostr' ? t('forum.via.nostr') : null;
  const badgeLabel = roleLabel ?? viaLabel;
  const handleActivate = (event: { stopPropagation: () => void }): void => {
    onActivate?.(event);
  };

  return (
    <div
      className="block rounded-xl border border-app-border bg-app-card px-3 py-2 mt-2"
      onClick={handleActivate}
    >
      <Link
        href={`/messages/${note.id}`}
        aria-label={
          note.via === 'nostr'
            ? t('forum.quotedNoteExternal', { name: note.name })
            : t('forum.quotedNote', { name: note.name })
        }
        className="block"
      >
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-app-fg">{note.name}</span>
            {badgeLabel !== null ? (
              <span className="rounded-full border border-app-border-strong px-2 py-0.5 text-xs font-medium text-app-muted">
                {badgeLabel}
              </span>
            ) : null}
          </span>
          <time dateTime={note.createdAt} className="text-xs text-app-subtle">
            {formatForumTime(note.createdAt, locale)}
          </time>
        </div>
        {photoUrl !== null ? (
          /* eslint-disable-next-line @next/next/no-img-element -- blob URL from fetchPublicMessagePhoto */
          <img
            src={photoUrl}
            alt={t('forum.photoAlt', { name: note.name })}
            className="mt-2 max-h-80 w-full rounded-xl object-contain"
          />
        ) : null}
      </Link>
      {note.text !== '' ? (
        note.via === 'nostr' ? (
          <TranslatableNoteBody
            messageId={note.id}
            plain
            text={note.text}
            truncate={truncate}
            className="whitespace-pre-wrap text-sm text-app-fg"
          />
        ) : truncate ? (
          <ForumNoteText text={note.text} className="whitespace-pre-wrap text-sm text-app-fg" />
        ) : (
          <LinkedText text={note.text} className="whitespace-pre-wrap text-sm text-app-fg" />
        )
      ) : null}
      <Link href={`/messages/${note.id}`} className="block">
        <p
          className={
            fiatSuffix === null
              ? 'text-sm font-medium text-app-fg'
              : 'text-sm font-medium tabular-nums lining-nums text-app-fg'
          }
        >
          {formatBitcoin(note.sats, numberFormat)}
          {fiatSuffix}
        </p>
      </Link>
    </div>
  );
}

/**
 * Remaining body text plus nested posts for resolved `/messages/<uuid>` URLs
 * and for `http(s)://<host>/l/<8 hex>` codes that resolve to a message.
 *
 * @param props - Body text, already-loaded notes, the containing message id,
 *   fiat conversion, optional feed truncation, optional remaining-text
 *   `className` (defaults to `whitespace-pre-wrap text-sm text-app-fg`;
 *   `text-app-btn-fg` selects NoteTranslate `tone="onButton"`), and
 *   an optional click handler for the nested card.
 * @returns The stripped paragraph (replaced by the translation while shown),
 *   nested post cards, and translation control; `null` when `text` is empty
 *   and no quotes resolved. Unknown quote ids
 *   are loaded with `fetchPublicMessage` (catch, never throw). Short codes
 *   load with `fetchShortLink` (null, never throw); only a shown message strips
 *   that short URL.
 * @throws Does not throw.
 */
export function ForumQuotedBody({
  text,
  knownNotes,
  excludeId,
  rateDay,
  fiat,
  truncate = true,
  className = 'whitespace-pre-wrap text-sm text-app-fg',
  onActivate,
}: {
  text: string;
  knownNotes: readonly ForumMessage[];
  excludeId: string;
  rateDay: FiatRateDay | null;
  fiat: FiatCode;
  truncate?: boolean;
  className?: string;
  onActivate?: (event: { stopPropagation: () => void }) => void;
}): ReactElement | null {
  const quoteIds = useMemo(() => {
    const exclude = excludeId.toLowerCase();
    return splitForumMessageQuotes(text).ids.filter((id) => id !== exclude);
  }, [text, excludeId]);
  const shortKey = useMemo(() => splitShortLinks(text).codes.join(','), [text]);
  const [shortHits, setShortHits] = useState<ShortHit[]>(NO_SHORT_HITS);

  useEffect(() => {
    if (shortKey === '') {
      setShortHits(NO_SHORT_HITS);
      return;
    }
    const codes = shortKey.split(',');
    const exclude = excludeId.toLowerCase();
    let cancelled = false;
    void (async () => {
      const next: ShortHit[] = [];
      for (const code of codes) {
        const link = await fetchShortLink(code);
        if (link !== null && link.kind === 'message' && link.id.toLowerCase() !== exclude) {
          next.push({ code, messageId: link.id.toLowerCase() });
        }
      }
      if (!cancelled) {
        setShortHits(next);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [shortKey, excludeId]);

  const candidateIds = useMemo(() => {
    const ids = [...quoteIds];
    const seen = new Set(ids);
    for (const hit of shortHits) {
      if (!seen.has(hit.messageId)) {
        seen.add(hit.messageId);
        ids.push(hit.messageId);
      }
    }
    return ids;
  }, [quoteIds, shortHits]);

  const [fetchedNotes, setFetchedNotes] = useState<ForumMessage[]>([]);
  const missingKey = candidateIds
    .filter((id) => findKnownNote(knownNotes, id) === undefined)
    .join(',');

  useEffect(() => {
    if (missingKey === '') {
      setFetchedNotes([]);
      return;
    }

    const missing = missingKey.split(',');
    let cancelled = false;
    void (async () => {
      const next: ForumMessage[] = [];
      for (const id of missing) {
        try {
          const note = await fetchPublicMessage(id);
          if (note !== null) {
            next.push(note);
          }
        } catch {
          // Leave the URL in the visible text when the public note cannot load.
        }
      }
      if (!cancelled) {
        setFetchedNotes(next);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [missingKey]);

  const resolvedNotes = useMemo(() => {
    const notes: ForumMessage[] = [];
    for (const id of candidateIds) {
      const note = findKnownNote(knownNotes, id) ?? findKnownNote(fetchedNotes, id);
      if (note !== undefined) {
        notes.push(note);
      }
    }
    return notes;
  }, [candidateIds, knownNotes, fetchedNotes]);

  const resolvedIdSet = useMemo(
    () => new Set(resolvedNotes.map((note) => note.id.toLowerCase())),
    [resolvedNotes],
  );
  const resolvedCodeSet = useMemo(() => {
    const codes = new Set<string>();
    for (const hit of shortHits) {
      if (resolvedIdSet.has(hit.messageId)) {
        codes.add(hit.code);
      }
    }
    return codes;
  }, [shortHits, resolvedIdSet]);
  const displayText = splitShortLinks(
    splitForumMessageQuotes(text, resolvedIdSet).displayText,
    resolvedCodeSet,
  ).displayText;

  if (text === '' && resolvedNotes.length === 0) {
    return null;
  }

  return (
    <>
      {displayText !== '' ? (
        <TranslatableNoteBody
          messageId={excludeId}
          text={displayText}
          truncate={truncate}
          className={className}
        />
      ) : null}
      {resolvedNotes.map((note) => (
        <QuotedForumNote
          key={note.id}
          note={note}
          rateDay={rateDay}
          fiat={fiat}
          truncate={truncate}
          {...(onActivate === undefined ? {} : { onActivate })}
        />
      ))}
    </>
  );
}
