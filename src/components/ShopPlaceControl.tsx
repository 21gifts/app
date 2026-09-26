'use client';

import { type ReactElement } from 'react';
import { PlaceField } from '@/components/PlaceField';
import { useTranslations } from '@/components/LocaleProvider';
import { setMessagePlace } from '@/lib/api';
import type { ForumMessage, ForumPlacePin } from '@/lib/api-types';
import { isShopNote } from '@/lib/forum-shop';
import { roleAtLeast } from '@/lib/roles';
import { useAuthStore } from '@/stores/auth-store';

/** Props for the shops-feed staff place editor. */
export interface ShopPlaceControlProps {
  /** Top-level shop note to pin. */
  message: ForumMessage;
  /** Apply the saved pin (or `null` when cleared) to the listed row. */
  onUpdated: (messageId: string, place: ForumPlacePin | null) => void;
}

/**
 * Moderator-only place editor on a shop note. Absent on replies, hidden
 * notes, non-shop text, and ranks below moderator.
 *
 * @param props - Note and successful-save callback.
 * @returns The compact place control, or null when it must not edit.
 */
export function ShopPlaceControl({
  message,
  onUpdated,
}: ShopPlaceControlProps): ReactElement | null {
  const account = useAuthStore((state) => state.account);
  const session = useAuthStore((state) => state.session);
  const { t } = useTranslations();

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
  const hasPlace = message.place !== undefined;

  return (
    <div
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
    >
      <PlaceField
        place={message.place ?? null}
        disabled={false}
        showPreview={false}
        buttonSize="sm"
        buttonVariant="ghost"
        ariaLabel={hasPlace ? t('forum.editPlace') : t('forum.addPlace')}
        onChange={
          /* v8 ignore next -- PlaceField calls onChange only when onCommit is omitted; this control always commits */
          () => undefined
        }
        onCommit={async (next) => {
          const updated = await setMessagePlace(token, message.id, next);
          onUpdated(message.id, updated.place ?? null);
        }}
      />
    </div>
  );
}
