'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState, type ReactElement } from 'react';
import { useTranslations } from '@/components/LocaleProvider';
import { NoteTranslate } from '@/components/NoteTranslate';
import { useNumberFormat } from '@/components/NumberFormatProvider';
import { fetchPublicMessage, fetchPublicMessagePhoto } from '@/lib/api';
import type { ForumMessage } from '@/lib/api-types';
import { splitForumMessageQuotes } from '@/lib/forum-quote';
import { formatForumTime } from '@/lib/forum-time';
import type { MessageKey } from '@/lib/messages';
import {
  formatBitcoin,
  formatFiatDisplay,
  satsToFiatAmount,
  type FiatCode,
  type FiatRateDay,
} from '@/lib/stats-money';

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
  onActivate,
}: {
  note: ForumMessage;
  rateDay: FiatRateDay | null;
  fiat: FiatCode;
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

  const fiatAmount = rateDay === null ? null : satsToFiatAmount(note.sats, rateDay, fiat);
  const roleLabel =
    note.role === 'founder' || note.role === 'moderator' || note.role === 'verified'
      ? t(ROLE_LABEL_KEYS[note.role])
      : null;

  return (
    <Link
      href={`/messages/${note.id}`}
      aria-label={t('forum.quotedNote', { name: note.name })}
      onClick={(event) => {
        onActivate?.(event);
      }}
      className="block rounded-xl border border-app-border bg-app-card px-3 py-2 mt-2"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-app-fg">{note.name}</span>
          {roleLabel !== null ? (
            <span className="rounded-full border border-app-border-strong px-2 py-0.5 text-xs font-medium text-app-muted">
              {roleLabel}
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
      {note.text !== '' ? (
        <p className="whitespace-pre-wrap text-sm text-app-fg">{note.text}</p>
      ) : null}
      <p
        className={
          fiatAmount === null
            ? 'text-sm font-medium text-app-fg'
            : 'text-sm font-medium tabular-nums lining-nums text-app-fg'
        }
      >
        {formatBitcoin(note.sats, numberFormat)}
        {fiatAmount !== null ? (
          <>
            <span aria-hidden="true"> · </span>
            <span>{formatFiatDisplay(fiatAmount, fiat, numberFormat)}</span>
          </>
        ) : null}
      </p>
    </Link>
  );
}

/**
 * Remaining body text plus nested posts for resolved `/messages/<uuid>` URLs.
 */
export function ForumQuotedBody({
  text,
  knownNotes,
  excludeId,
  rateDay,
  fiat,
  onActivate,
}: {
  text: string;
  knownNotes: readonly ForumMessage[];
  excludeId: string;
  rateDay: FiatRateDay | null;
  fiat: FiatCode;
  onActivate?: (event: { stopPropagation: () => void }) => void;
}): ReactElement | null {
  const candidateIds = useMemo(() => {
    const exclude = excludeId.toLowerCase();
    return splitForumMessageQuotes(text).ids.filter((id) => id !== exclude);
  }, [text, excludeId]);

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
  const displayText = splitForumMessageQuotes(text, resolvedIdSet).displayText;

  if (text === '' && resolvedNotes.length === 0) {
    return null;
  }

  return (
    <>
      {displayText !== '' ? (
        <p className="whitespace-pre-wrap text-sm text-app-fg">{displayText}</p>
      ) : null}
      {displayText !== '' ? <NoteTranslate text={displayText} /> : null}
      {resolvedNotes.map((note) => (
        <QuotedForumNote
          key={note.id}
          note={note}
          rateDay={rateDay}
          fiat={fiat}
          {...(onActivate === undefined ? {} : { onActivate })}
        />
      ))}
    </>
  );
}
