'use client';

import { useRef, useState, type ReactElement } from 'react';
import { Trash2 } from 'lucide-react';
import { InlineConfirm } from '@/components/InlineConfirm';
import { SundayWritingGate } from '@/components/SundayWritingGate';
import { IconButton } from '@/components/ui/IconButton';
import { useTranslations } from '@/components/LocaleProvider';
import { deleteMessage, OPEN_CREDIT_DELETE_ERROR } from '@/lib/api';
import { roleAtLeast } from '@/lib/roles';
import { useAuthStore } from '@/stores/auth-store';

/** Props for the inline post or reply moderation control. */
export interface DeletePostControlProps {
  /** Post or reply to delete. */
  messageId: string;
  /** Remove the successfully deleted post or reply from the board. */
  onDeleted: (messageId: string) => void;
  /** Defaults to `'post'`. */
  kind?: 'post' | 'reply';
}

/**
 * Moderator-only delete action with confirmation, pending and retry states.
 * A credit that is not fully repaid shows its own reason instead of the retry error.
 *
 * @param props - Message id, successful removal callback, and optional kind.
 * @returns Inline moderation controls, or null for other roles.
 */
export function DeletePostControl({
  messageId,
  onDeleted,
  kind = 'post',
}: DeletePostControlProps): ReactElement | null {
  const account = useAuthStore((state) => state.account);
  const session = useAuthStore((state) => state.session);
  const { t } = useTranslations();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<'failed' | 'openCredit' | null>(null);
  const inFlight = useRef(false);
  const idleLabel = kind === 'reply' ? t('forum.deleteReply') : t('forum.delete');
  const confirmLabel = kind === 'reply' ? t('forum.deleteReplyConfirm') : t('forum.deleteConfirm');
  const failedLabel = kind === 'reply' ? t('forum.deleteReplyError') : t('forum.deleteError');
  const errorLabel =
    error === 'openCredit' ? t('forum.deleteOpenCreditError') : error === null ? null : failedLabel;

  if (session === null || !roleAtLeast(account?.role, 'moderator')) {
    return null;
  }

  async function remove(): Promise<void> {
    if (inFlight.current) {
      return;
    }
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      await deleteMessage(session!, messageId);
      onDeleted(messageId);
    } catch (err) {
      setError(
        err instanceof Error && err.message === OPEN_CREDIT_DELETE_ERROR ? 'openCredit' : 'failed',
      );
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  return (
    <SundayWritingGate>
      <div
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => event.stopPropagation()}
        className={confirming ? 'order-last mt-2 w-full basis-full' : undefined}
      >
        {confirming ? (
          <InlineConfirm
            label={confirmLabel}
            confirmLabel={t('forum.deleteConfirmAction')}
            cancelLabel={t('forum.deleteCancel')}
            busy={busy}
            error={errorLabel}
            onConfirm={() => {
              void remove();
            }}
            onCancel={() => {
              setConfirming(false);
              setError(null);
            }}
          />
        ) : (
          <IconButton
            size="sm"
            variant="ghost"
            aria-label={idleLabel}
            title={idleLabel}
            onClick={() => setConfirming(true)}
          >
            <Trash2 aria-hidden="true" className="h-4 w-4 text-app-danger" />
          </IconButton>
        )}
      </div>
    </SundayWritingGate>
  );
}
