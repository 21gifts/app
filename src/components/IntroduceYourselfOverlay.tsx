'use client';

import { X } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import type { ReactElement } from 'react';
import { useTranslations } from '@/components/LocaleProvider';
import { Button, Card, IconButton } from '@/components/ui';
import { requestForumCompose } from '@/lib/forum-feed';

/** Props for {@link IntroduceYourselfOverlay}. */
export interface IntroduceYourselfOverlayProps {
  /** Closes the overlay for this mount only. */
  onDismiss: () => void;
}

/**
 * Modal that asks a signed-in member who has not posted yet to introduce
 * themselves in the forum. Close dismisses this mount. The CTA dismisses,
 * focuses the welcome composer, and navigates to `/welcome` only when the
 * path is not already `/welcome`.
 *
 * @param props - See {@link IntroduceYourselfOverlayProps}.
 * @returns The overlay dialog.
 */
export function IntroduceYourselfOverlay({
  onDismiss,
}: IntroduceYourselfOverlayProps): ReactElement {
  const { t } = useTranslations();
  const pathname = usePathname();
  const router = useRouter();

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t('introduce.title')}
      className="fixed inset-0 z-50 flex items-center justify-center bg-app-overlay p-4"
    >
      <Card maxWidth="sm" chrome={false}>
        <div className="flex w-full items-start justify-between gap-3">
          <h2 className="text-lg font-semibold tracking-tight text-app-fg">
            {t('introduce.title')}
          </h2>
          <IconButton
            type="button"
            variant="ghost"
            size="md"
            aria-label={t('introduce.close')}
            onClick={onDismiss}
          >
            <X aria-hidden="true" className="h-4 w-4" />
          </IconButton>
        </div>
        <p className="text-sm text-app-muted">{t('introduce.body')}</p>
        <Button
          type="button"
          size="lg"
          onClick={() => {
            requestForumCompose();
            onDismiss();
            if (pathname !== '/welcome') {
              router.push('/welcome');
            }
          }}
        >
          {t('introduce.cta')}
        </Button>
      </Card>
    </div>
  );
}
