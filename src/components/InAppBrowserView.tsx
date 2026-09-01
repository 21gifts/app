'use client';

import { ExternalLink } from 'lucide-react';
import { useEffect, useRef, useState, type ReactElement } from 'react';
import { useTranslations } from '@/components/LocaleProvider';
import { Button } from '@/components/ui';
import { openInSystemBrowser } from '@/lib/in-app-browser';

const COPY_RESET_MS = 1200;

/**
 * Copy `text` via a hidden textarea and `document.execCommand('copy')`.
 *
 * @param text - Absolute URL to put on the clipboard.
 * @returns Whether the browser reported a successful copy.
 */
function fallbackCopy(text: string): boolean {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.setAttribute('aria-hidden', 'true');
  ta.className = 'fixed opacity-0';
  document.body.appendChild(ta);
  ta.select();
  let ok = false;
  try {
    ok = document.execCommand('copy');
  } catch {
    ok = false;
  }
  ta.remove();
  return ok;
}

/**
 * Escape hatch when the visitor is inside Telegram or another in-app browser.
 *
 * @returns The in-app browser view.
 */
export function InAppBrowserView(): ReactElement {
  const { t } = useTranslations();
  const [copied, setCopied] = useState(false);
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mounted = useRef(true);
  const showIosHint = /iPhone|iPad|iPod/i.test(navigator.userAgent);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (resetTimer.current !== null) {
        clearTimeout(resetTimer.current);
      }
    };
  }, []);

  function loginUrl(): string {
    return `${window.location.origin}${window.location.pathname}`;
  }

  function flashCopied(): void {
    setCopied(true);
    if (resetTimer.current !== null) {
      clearTimeout(resetTimer.current);
    }
    resetTimer.current = setTimeout(() => {
      setCopied(false);
      resetTimer.current = null;
    }, COPY_RESET_MS);
  }

  async function copyLink(): Promise<void> {
    const url = loginUrl();
    if (fallbackCopy(url)) {
      flashCopied();
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      if (!mounted.current) {
        return;
      }
      flashCopied();
    } catch {
      if (!mounted.current) {
        return;
      }
      console.error('Copy link failed');
    }
  }

  return (
    <>
      <ExternalLink aria-hidden="true" className="h-8 w-8 text-app-subtle" />
      <h2 className="text-center text-lg font-medium text-app-fg">{t('login.inAppHeading')}</h2>
      <p className="text-center text-sm text-app-muted">{t('login.inAppBody')}</p>
      {showIosHint ? (
        <p className="text-center text-sm text-app-muted">{t('login.inAppIosHint')}</p>
      ) : null}
      <div className="flex flex-col items-center gap-3">
        <Button
          type="button"
          onClick={() => {
            openInSystemBrowser(loginUrl());
          }}
        >
          {t('login.openInBrowser')}
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={() => {
            void copyLink();
          }}
          data-copied={copied ? 'true' : undefined}
        >
          {copied ? t('login.linkCopied') : t('login.copyLink')}
        </Button>
      </div>
    </>
  );
}
