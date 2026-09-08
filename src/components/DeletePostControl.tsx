'use client';

import { useRef, useState, type ReactElement } from 'react';
import { Check, Loader2, Trash2, X } from 'lucide-react';
import { IconButton } from '@/components/ui/IconButton';
import { useTranslations } from '@/components/LocaleProvider';
import { deleteMessage } from '@/lib/api';
import { useAuthStore } from '@/stores/auth-store';

/** Props for the inline post moderation control. */
export interface DeletePostControlProps {
  /** Post to delete. */
  messageId: string;
  /** Remove the successfully deleted post from the board. */
  onDeleted: (messageId: string) => void;
}

/**
 * Founder/moderator-only delete action with confirmation, pending and retry states.
 *
 * @param props - Post id and successful removal callback.
 * @returns Inline moderation controls, or null for other roles.
 */
export function DeletePostControl({
  messageId,
  onDeleted,
}: DeletePostControlProps): ReactElement | null {
  const account = useAuthStore((state) => state.account);
  const session = useAuthStore((state) => state.session);
  const { t } = useTranslations();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const inFlight = useRef(false);

  if (session === null || (account?.role !== 'founder' && account?.role !== 'moderator')) {
    return null;
  }

  async function remove(): Promise<void> {
    /* v8 ignore next 3 -- synchronous guard against duplicate clicks before React commits disabled */
    if (inFlight.current) {
      return;
    }
    inFlight.current = true;
    setBusy(true);
    setError(false);
    try {
      await deleteMessage(session!, messageId);
      onDeleted(messageId);
    } catch {
      setError(true);
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  return (
    <div
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
      className="mt-2"
    >
      {confirming ? (
        <div
          role="group"
          aria-label={t('forum.deleteConfirm')}
          className="flex flex-col gap-2 rounded-xl border border-app-border p-3"
        >
          <p className="text-sm text-app-fg">{t('forum.deleteConfirm')}</p>
          {error ? (
            <p role="alert" className="text-sm text-app-danger">
              {t('forum.deleteError')}
            </p>
          ) : null}
          <div className="flex gap-3">
            <IconButton
              aria-label={t('forum.deleteConfirmAction')}
              disabled={busy}
              onClick={() => {
                void remove();
              }}
            >
              {busy ? (
                <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
              ) : (
                <Check aria-hidden="true" className="h-4 w-4" />
              )}
            </IconButton>
            <IconButton
              aria-label={t('forum.deleteCancel')}
              disabled={busy}
              onClick={() => {
                setConfirming(false);
                setError(false);
              }}
            >
              <X aria-hidden="true" className="h-4 w-4" />
            </IconButton>
          </div>
        </div>
      ) : (
        <IconButton
          size="sm"
          variant="ghost"
          aria-label={t('forum.delete')}
          title={t('forum.delete')}
          onClick={() => setConfirming(true)}
        >
          <Trash2 aria-hidden="true" className="h-4 w-4" />
        </IconButton>
      )}
    </div>
  );
}
