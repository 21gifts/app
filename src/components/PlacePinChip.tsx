'use client';

import { MapPin, X } from 'lucide-react';
import type { ReactElement } from 'react';
import { useTranslations } from '@/components/LocaleProvider';
import { SundayWritingGate, useLocalSunday } from '@/components/SundayWritingGate';
import { IconButton } from '@/components/ui';
import type { ForumPlacePin } from '@/lib/api-types';
import { formatPlacePinText } from '@/lib/forum-shop';

/**
 * Confirmed composer place shown in normal document flow.
 *
 * @param props - Confirmed place, optional disabled state, and remove callback.
 * @returns The localized place chip, or no chip content on the device's local Sunday.
 */
export function PlacePinChip({
  place,
  disabled = false,
  onRemove,
}: {
  place: ForumPlacePin;
  disabled?: boolean;
  onRemove: () => void;
}): ReactElement {
  const { t, locale } = useTranslations();
  const sunday = useLocalSunday();

  return (
    <SundayWritingGate>
      {!sunday ? (
        <div className="flex w-full max-w-sm items-start gap-3 rounded-2xl border border-app-border bg-app-card-muted p-3">
          <MapPin aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
          <span className="min-w-0 flex-1 text-sm text-app-fg">
            {formatPlacePinText(place, locale)}
          </span>
          <IconButton
            type="button"
            size="sm"
            variant="secondary"
            aria-label={t('forum.placeRemove')}
            disabled={disabled}
            onClick={onRemove}
          >
            <X aria-hidden="true" className="h-4 w-4" />
          </IconButton>
        </div>
      ) : null}
    </SundayWritingGate>
  );
}
