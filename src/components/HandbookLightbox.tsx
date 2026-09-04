'use client';

import { X } from 'lucide-react';
import { useEffect, type ReactElement } from 'react';
import { useTranslations } from '@/components/LocaleProvider';
import { IconButton } from '@/components/ui';

/** Props for {@link HandbookLightbox}. */
export interface HandbookLightboxProps {
  /** Whether the overlay is shown. */
  open: boolean;
  /** Full-size image URL. */
  src: string;
  /** Accessible name for the image and dialog. */
  alt: string;
  /** Closes the overlay (X, backdrop, or Escape). */
  onClose: () => void;
}

/**
 * Full-size handbook image overlay. Matches {@link RequirementsOverlay} chrome
 * (`bg-app-card`, ghost close, backdrop). Not a native `<dialog>`.
 *
 * @param props - See {@link HandbookLightboxProps}.
 * @returns The dialog when `open`, otherwise `null`.
 */
export function HandbookLightbox({
  open,
  src,
  alt,
  onClose,
}: HandbookLightboxProps): ReactElement | null {
  const { t } = useTranslations();

  useEffect(() => {
    if (!open) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={alt}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="relative max-h-[90vh] max-w-[min(1100px,100%)] overflow-auto rounded-3xl border border-app-border bg-app-card p-4 shadow-lg"
        onClick={(event) => {
          event.stopPropagation();
        }}
      >
        <div className="mb-2 flex justify-end">
          <IconButton
            type="button"
            variant="ghost"
            size="md"
            aria-label={t('handbook.closeImage')}
            autoFocus
            onClick={onClose}
          >
            <X aria-hidden="true" className="h-4 w-4" />
          </IconButton>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element -- static handbook baseline PNG */}
        <img src={src} alt={alt} className="mx-auto max-h-[80vh] w-auto max-w-full" />
      </div>
    </div>
  );
}
