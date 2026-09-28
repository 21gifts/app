'use client';

import { Pencil } from 'lucide-react';
import { useState, type ReactElement } from 'react';
import { useTranslations } from '@/components/LocaleProvider';
import { SundayWritingGate } from '@/components/SundayWritingGate';
import { IconButton } from '@/components/ui';
import { fetchShopNoteEdits, setMessageShopText, type ShopNoteEdit } from '@/lib/api';
import type { ForumMessage } from '@/lib/api-types';
import { isShopNote, stripShopHashtag } from '@/lib/forum-shop';
import { roleAtLeast } from '@/lib/roles';
import { useAuthStore } from '@/stores/auth-store';

/** Props for the shop-note text editor. */
export interface ShopNoteEditControlProps {
  /** Top-level shop note to edit. */
  message: ForumMessage;
  /** Apply the saved body to the listed row. */
  onUpdated: (messageId: string, text: string) => void;
}

/**
 * Short label for one history value.
 *
 * @param field - Which column changed.
 * @param value - Stored before or after value.
 * @param none - Copy used when the value is empty or not the expected shape.
 * @returns Visible text for that value.
 */
function editValueText(field: ShopNoteEdit['field'], value: unknown, none: string): string {
  if (value === null || value === undefined) {
    return none;
  }
  if (field === 'text') {
    return typeof value === 'string' ? stripShopHashtag(value) : none;
  }
  if (typeof value !== 'object' || Array.isArray(value)) {
    return none;
  }
  if (field === 'place') {
    const place = value as { lat?: unknown; lng?: unknown; label?: unknown };
    if (typeof place.label === 'string' && place.label.trim() !== '') {
      return place.label;
    }
    if (typeof place.lat === 'number' && typeof place.lng === 'number') {
      return `${place.lat}, ${place.lng}`;
    }
    return none;
  }
  const account = value as { username?: unknown };
  return typeof account.username === 'string' ? `@${account.username}` : none;
}

/**
 * Local medium date and short time, or the raw string when it is not a date.
 *
 * @param createdAt - ISO timestamp from the history row.
 * @returns A formatted instant.
 */
function formatEditWhen(createdAt: string): string {
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) {
    return createdAt;
  }
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(
    date,
  );
}

/**
 * Moderator-only text editor and edit history on a shop note. Absent on
 * replies, hidden notes, non-shop text, and ranks below moderator.
 *
 * @param props - Note and successful-save callback.
 * @returns The pencil, or null when it must not edit.
 */
export function ShopNoteEditControl({
  message,
  onUpdated,
}: ShopNoteEditControlProps): ReactElement | null {
  const account = useAuthStore((state) => state.account);
  const session = useAuthStore((state) => state.session);
  const { t } = useTranslations();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [history, setHistory] = useState<ShopNoteEdit[] | null>(null);
  const [historyError, setHistoryError] = useState(false);

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

  function openEditor(): void {
    setDraft(stripShopHashtag(message.text));
    setSaveError(false);
    setHistory(null);
    setHistoryError(false);
    setOpen(true);
    void fetchShopNoteEdits(token, message.id)
      .then((rows) => {
        setHistory(rows);
      })
      .catch(() => {
        setHistoryError(true);
      });
  }

  return (
    <div
      onClick={(event) => {
        event.stopPropagation();
      }}
      onKeyDown={(event) => {
        event.stopPropagation();
      }}
    >
      <IconButton
        type="button"
        size="sm"
        variant="ghost"
        aria-label={t('forum.editShopNote')}
        title={t('forum.editShopNote')}
        aria-expanded={open}
        onClick={() => {
          if (open) {
            setOpen(false);
            return;
          }
          openEditor();
        }}
      >
        <Pencil aria-hidden="true" className="h-3.5 w-3.5" />
      </IconButton>
      {open ? (
        <div className="mt-2 flex w-full flex-col gap-2">
          <SundayWritingGate>
            <label className="flex flex-col gap-1">
              <span className="sr-only">{t('forum.editShopNote')}</span>
              <textarea
                value={draft}
                rows={4}
                className="w-full rounded-xl border border-app-border bg-app-card px-3 py-2 text-sm text-app-fg"
                onChange={(event) => {
                  setDraft(event.target.value);
                }}
              />
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                className="text-xs font-medium text-app-fg underline"
                disabled={saving}
                onClick={() => {
                  setSaving(true);
                  setSaveError(false);
                  void setMessageShopText(token, message.id, draft)
                    .then((updated) => {
                      onUpdated(message.id, updated.text);
                      setOpen(false);
                    })
                    .catch(() => {
                      setSaveError(true);
                    })
                    .finally(() => {
                      setSaving(false);
                    });
                }}
              >
                {t('forum.editShopNoteSave')}
              </button>
              <button
                type="button"
                className="text-xs text-app-subtle"
                onClick={() => {
                  setSaveError(false);
                  setOpen(false);
                }}
              >
                {t('forum.editShopNoteCancel')}
              </button>
            </div>
          </SundayWritingGate>
          {saveError ? (
            <p role="alert" className="text-xs text-app-danger">
              {t('forum.editShopNoteFailed')}
            </p>
          ) : null}
          <h3 className="text-xs font-medium text-app-fg">{t('forum.editHistory')}</h3>
          {historyError ? (
            <p role="alert" className="text-xs text-app-danger">
              {t('forum.editHistoryFailed')}
            </p>
          ) : null}
          {history !== null && history.length === 0 ? (
            <p className="text-xs text-app-muted">{t('forum.editHistoryEmpty')}</p>
          ) : null}
          {history !== null && history.length > 0 ? (
            <ul className="flex flex-col gap-2">
              {history.map((edit) => {
                const who = edit.actor.name?.trim() ? edit.actor.name : edit.actor.id;
                const fieldLabel =
                  edit.field === 'text'
                    ? t('forum.editFieldText')
                    : edit.field === 'place'
                      ? t('forum.editFieldPlace')
                      : t('forum.editFieldAccount');
                return (
                  <li key={edit.id} className="text-xs text-app-muted">
                    <p>
                      {who} · {formatEditWhen(edit.createdAt)} · {fieldLabel}
                    </p>
                    <p className="whitespace-pre-wrap">
                      {editValueText(edit.field, edit.before, t('forum.editNone'))}
                      {' → '}
                      {editValueText(edit.field, edit.after, t('forum.editNone'))}
                    </p>
                  </li>
                );
              })}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
