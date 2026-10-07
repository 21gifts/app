'use client';

import { Check, Loader2, X } from 'lucide-react';
import type { ReactElement } from 'react';
import { IconButton } from '@/components/ui/IconButton';

/** Props for the bordered confirm or cancel group. */
export interface InlineConfirmProps {
  /** Question shown above the two actions, and the group's accessible name. */
  label: string;
  /** Accessible name of the confirm action. */
  confirmLabel: string;
  /** Accessible name of the cancel action. */
  cancelLabel: string;
  /** Confirm was chosen. */
  onConfirm: () => void;
  /** Cancel was chosen. */
  onCancel: () => void;
  /** Confirm shows a spinner and both actions are disabled. */
  busy?: boolean;
  /** Failure text under the question. Omit when there is no failure. */
  error?: string | null;
}

/**
 * Bordered confirm or cancel group used by delete and archive.
 *
 * Callers keep their own idle button. This is only the open question.
 *
 * @param props - Labels, callbacks, and optional pending or failure state.
 * @returns The group.
 */
export function InlineConfirm({
  label,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
  busy = false,
  error = null,
}: InlineConfirmProps): ReactElement {
  return (
    <div
      role="group"
      aria-label={label}
      className="flex flex-col gap-2 rounded-xl border border-app-border p-3"
    >
      <p className="text-sm text-app-fg">{label}</p>
      {error !== null ? (
        <p role="alert" className="text-sm text-app-danger">
          {error}
        </p>
      ) : null}
      <div className="flex gap-3">
        <IconButton type="button" aria-label={confirmLabel} disabled={busy} onClick={onConfirm}>
          {busy ? (
            <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
          ) : (
            <Check aria-hidden="true" className="h-4 w-4" />
          )}
        </IconButton>
        <IconButton type="button" aria-label={cancelLabel} disabled={busy} onClick={onCancel}>
          <X aria-hidden="true" className="h-4 w-4" />
        </IconButton>
      </div>
    </div>
  );
}
