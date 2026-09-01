'use client';

import { Download } from 'lucide-react';
import { useEffect, useId, useState, type ReactElement } from 'react';
import { createPortal } from 'react-dom';
import { useTranslations } from '@/components/LocaleProvider';
import { Button } from '@/components/ui';
import { isInAppBrowser } from '@/lib/in-app-browser';
import { shouldOfferIosInstall } from '@/lib/pwa-install';
import { isStandaloneDisplay } from '@/lib/push';

/** Chromium install prompt event (not in every TS DOM lib). */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
}

/** Props for {@link PwaInstall}. */
export interface PwaInstallProps {
  /** Marketing dark shell vs app chrome. Default `app`. */
  tone?: 'app' | 'dark';
  /** `header` = compact labeled button; `hero` = Button md; `menu` = SignedInChrome row. */
  placement: 'header' | 'hero' | 'menu';
  /** Menu row: called after click so the menu can close. */
  onMenuAction?: () => void;
}

const DARK_SECONDARY = 'border-paper/20 text-paper hover:bg-paper/10';

/**
 * Labeled control to install the PWA (Chromium prompt) or show iPhone Safari
 * Home Screen steps. Renders nothing until after mount, and stays hidden when
 * already standalone, in an in-app browser, or when neither offer applies.
 *
 * @param props - Placement, optional tone, and optional menu close callback.
 * @returns The install control, iOS sheet, or `null`.
 */
export function PwaInstall({
  tone = 'app',
  placement,
  onMenuAction,
}: PwaInstallProps): ReactElement | null {
  const { t } = useTranslations();
  const titleId = useId();
  const [ready, setReady] = useState(false);
  const [offer, setOffer] = useState(false);
  const [iosOffer, setIosOffer] = useState(false);
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  useEffect(() => {
    setReady(true);
    if (isStandaloneDisplay() || isInAppBrowser()) {
      setOffer(false);
      return;
    }
    setOffer(true);
    if (shouldOfferIosInstall()) {
      setIosOffer(true);
    }
    const onBeforeInstall = (event: Event): void => {
      event.preventDefault();
      setDeferred(event as BeforeInstallPromptEvent);
    };
    const onInstalled = (): void => {
      setDeferred(null);
      setIosOffer(false);
    };
    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  useEffect(() => {
    if (!sheetOpen) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') {
        return;
      }
      event.stopPropagation();
      setSheetOpen(false);
    };
    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
    };
  }, [sheetOpen]);

  if (!ready || !offer) {
    return null;
  }
  if (!iosOffer && deferred === null) {
    return null;
  }

  const darkClass = tone === 'dark' ? DARK_SECONDARY : undefined;

  const closeSheet = (): void => {
    setSheetOpen(false);
  };

  const handleClick = (): void => {
    if (iosOffer) {
      setSheetOpen(true);
      onMenuAction?.();
      return;
    }
    const event = deferred;
    setDeferred(null);
    if (event !== null) {
      void event.prompt();
    }
    onMenuAction?.();
  };

  let control: ReactElement;
  if (placement === 'menu') {
    control = (
      <button
        type="button"
        onClick={handleClick}
        className="flex min-h-11 w-full items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-app-fg transition hover:bg-app-hover"
      >
        <Download aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
        {t('pwa.install')}
      </button>
    );
  } else if (placement === 'header') {
    control = (
      <Button
        type="button"
        size="sm"
        variant="secondary"
        className={darkClass ?? ''}
        onClick={handleClick}
      >
        {t('pwa.install')}
      </Button>
    );
  } else {
    control = (
      <Button type="button" variant="secondary" className={darkClass ?? ''} onClick={handleClick}>
        {t('pwa.install')}
      </Button>
    );
  }

  const sheetToneClass =
    tone === 'dark'
      ? 'border border-paper/10 bg-ink text-paper'
      : 'border border-app-border bg-app-card text-app-fg';

  const sheet =
    sheetOpen && typeof document !== 'undefined'
      ? createPortal(
          <div
            className="fixed inset-0 z-[100] flex items-end justify-center p-4 sm:items-center"
            onMouseDown={(event) => {
              event.stopPropagation();
            }}
          >
            <div className="absolute inset-0 bg-black/50" aria-hidden="true" onClick={closeSheet} />
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby={titleId}
              className={`relative z-10 w-full max-w-md rounded-2xl p-6 shadow-lg ${sheetToneClass}`}
            >
              <h2 id={titleId} className="text-lg font-semibold">
                {t('pwa.iosTitle')}
              </h2>
              <p className="mt-2 text-sm opacity-80">{t('pwa.iosLead')}</p>
              <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm">
                <li>{t('pwa.iosShare')}</li>
                <li>{t('pwa.iosAdd')}</li>
                <li>{t('pwa.iosOpen')}</li>
              </ol>
              <div className="mt-6">
                <Button
                  type="button"
                  variant="secondary"
                  className={darkClass ?? ''}
                  onClick={closeSheet}
                >
                  {t('pwa.close')}
                </Button>
              </div>
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      {control}
      {sheet}
    </>
  );
}
