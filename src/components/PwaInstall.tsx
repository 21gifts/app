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

let sharedDeferred: BeforeInstallPromptEvent | null = null;
let promptListenersAttached = false;
const promptSubscribers = new Set<(event: BeforeInstallPromptEvent | null) => void>();

function notifyPromptSubscribers(): void {
  for (const subscriber of promptSubscribers) {
    subscriber(sharedDeferred);
  }
}

function attachSharedPromptListeners(): void {
  if (promptListenersAttached) {
    return;
  }
  promptListenersAttached = true;
  window.addEventListener('beforeinstallprompt', (event: Event) => {
    event.preventDefault();
    sharedDeferred = event as BeforeInstallPromptEvent;
    notifyPromptSubscribers();
  });
  window.addEventListener('appinstalled', () => {
    sharedDeferred = null;
    notifyPromptSubscribers();
  });
}

function consumeSharedPrompt(): BeforeInstallPromptEvent | null {
  const event = sharedDeferred;
  sharedDeferred = null;
  notifyPromptSubscribers();
  return event;
}

/**
 * Labeled control to install the PWA (Chromium prompt) or show iPhone Home
 * Screen steps (Safari, Chrome, Firefox, Edge). Renders nothing until after
 * mount, and stays hidden when already standalone, in an in-app browser, or
 * when neither offer applies.
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
  const closeId = `${titleId}-close`;

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
    attachSharedPromptListeners();
    setDeferred(sharedDeferred);
    const onPrompt = (event: BeforeInstallPromptEvent | null): void => {
      setDeferred(event);
      if (event === null) {
        setIosOffer(false);
      }
    };
    promptSubscribers.add(onPrompt);
    return () => {
      promptSubscribers.delete(onPrompt);
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
    document.getElementById(closeId)?.focus();
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
    };
  }, [sheetOpen, closeId]);

  if (!ready || !offer) {
    return null;
  }
  if (!iosOffer && deferred === null) {
    return null;
  }

  const closeSheet = (): void => {
    setSheetOpen(false);
  };

  const handleClick = (): void => {
    if (iosOffer) {
      setSheetOpen(true);
      onMenuAction?.();
      return;
    }
    const event = consumeSharedPrompt();
    if (event !== null) {
      void event.prompt();
    }
    onMenuAction?.();
  };

  const darkButton = tone === 'dark';

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
    control = darkButton ? (
      <Button type="button" size="sm" variant="secondary" tone="dark" onClick={handleClick}>
        {t('pwa.install')}
      </Button>
    ) : (
      <Button type="button" size="sm" variant="secondary" onClick={handleClick}>
        {t('pwa.install')}
      </Button>
    );
  } else {
    control = darkButton ? (
      <Button type="button" variant="secondary" tone="dark" onClick={handleClick}>
        {t('pwa.install')}
      </Button>
    ) : (
      <Button type="button" variant="secondary" onClick={handleClick}>
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
            <div
              className="absolute inset-0 bg-app-overlay"
              aria-hidden="true"
              onClick={closeSheet}
            />
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
                {darkButton ? (
                  <Button
                    id={closeId}
                    type="button"
                    variant="secondary"
                    tone="dark"
                    onClick={closeSheet}
                  >
                    {t('pwa.close')}
                  </Button>
                ) : (
                  <Button id={closeId} type="button" variant="secondary" onClick={closeSheet}>
                    {t('pwa.close')}
                  </Button>
                )}
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
