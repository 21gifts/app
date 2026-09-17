'use client';

import { X } from 'lucide-react';
import type { ReactElement } from 'react';
import { useTranslations } from '@/components/LocaleProvider';
import { Button, Card, IconButton } from '@/components/ui';

/** Props for {@link ExternalLinkWarning}. */
export interface ExternalLinkWarningProps {
  /** Absolute http(s) URL the visitor is about to open. */
  url: string;
  /** Dismisses the overlay without opening the URL. */
  onCancel: () => void;
  /** Opens the URL after the visitor confirms. */
  onConfirm: () => void;
}

/**
 * Confirm overlay before leaving 21.gifts for an external http(s) URL.
 *
 * @param props - See {@link ExternalLinkWarningProps}.
 * @returns The overlay dialog.
 */
export function ExternalLinkWarning({
  url,
  onCancel,
  onConfirm,
}: ExternalLinkWarningProps): ReactElement {
  const { t } = useTranslations();

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t('link.externalTitle')}
      className="fixed inset-0 z-50 flex items-center justify-center bg-app-overlay p-4"
      onClick={(event) => {
        event.stopPropagation();
      }}
      onKeyDown={(event) => {
        event.stopPropagation();
      }}
    >
      <Card maxWidth="sm" chrome={false}>
        <div className="flex w-full items-start justify-between gap-3">
          <h2 className="text-lg font-semibold tracking-tight text-app-fg">
            {t('link.externalTitle')}
          </h2>
          <IconButton
            type="button"
            variant="ghost"
            size="md"
            aria-label={t('link.externalClose')}
            onClick={onCancel}
          >
            <X aria-hidden="true" className="h-4 w-4" />
          </IconButton>
        </div>
        <p className="text-sm text-app-muted">{t('link.externalBody')}</p>
        <p className="text-sm text-app-fg break-all">{url}</p>
        <Button type="button" size="lg" onClick={onConfirm}>
          {t('link.externalContinue')}
        </Button>
      </Card>
    </div>
  );
}
