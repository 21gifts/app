'use client';

import { AlertTriangle, ExternalLink, Fingerprint, Loader2 } from 'lucide-react';
import { useEffect, useRef, useState, type ReactElement } from 'react';
import { useTranslations } from '@/components/LocaleProvider';
import { usePasskeyLogin } from '@/hooks/usePasskeyLogin';
import { isInAppBrowser, openInSystemBrowser } from '@/lib/in-app-browser';
import { useAuthStore } from '@/stores/auth-store';

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
  ta.readOnly = true;
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
 * The `/login` card: Log in, preparing, error, or in-app browser escape.
 *
 * After a successful login, {@link OnboardingGate} sends the visitor to
 * `/setup/name`, `/setup/address`, or `/welcome`.
 *
 * @returns The card element.
 */
export function LoginCard(): ReactElement {
  const account = useAuthStore((state) => state.account);
  const passkey = usePasskeyLogin();
  const [inApp, setInApp] = useState(false);

  useEffect(() => {
    setInApp(isInAppBrowser());
  }, []);

  useEffect(() => {
    if (account !== null) {
      passkey.cancel();
    }
  }, [account, passkey.cancel]);

  let body: ReactElement;
  if (account !== null) {
    body = <StartingView />;
  } else if (inApp || passkey.status === 'unsupported') {
    body = <InAppBrowserView />;
  } else if (passkey.status === 'starting') {
    body = <StartingView />;
  } else if (passkey.status === 'error') {
    body = <ErrorView onRetry={passkey.retry} />;
  } else {
    body = <StartView onLogin={passkey.login} />;
  }

  return (
    <section className="flex w-full max-w-sm flex-col items-center gap-6 rounded-3xl border border-neutral-200 bg-white p-8 shadow-sm">
      {body}
    </section>
  );
}

/** Props for {@link StartView}. */
interface StartViewProps {
  /** Called to sign in with an existing passkey, or create one. */
  onLogin: () => void;
}

/**
 * The initial logged-out state: a single Log in button.
 *
 * @param props - See {@link StartViewProps}.
 * @returns The start view.
 */
function StartView({ onLogin }: StartViewProps): ReactElement {
  const { t } = useTranslations();
  return (
    <>
      <Fingerprint aria-hidden="true" className="h-8 w-8 text-neutral-400" />
      <h2 className="text-center text-lg font-medium text-neutral-900">{t('login.heading')}</h2>
      <button
        type="button"
        onClick={onLogin}
        className="inline-flex items-center gap-2 rounded-full bg-neutral-900 px-6 py-3 text-sm font-medium text-white transition hover:bg-neutral-700"
      >
        <Fingerprint aria-hidden="true" className="h-4 w-4" />
        {t('login.submit')}
      </button>
    </>
  );
}

/**
 * Escape hatch when the visitor is inside Telegram or another in-app browser.
 *
 * @returns The in-app browser view.
 */
function InAppBrowserView(): ReactElement {
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
    try {
      await navigator.clipboard.writeText(url);
      if (!mounted.current) {
        return;
      }
      flashCopied();
      return;
    } catch {
      if (!mounted.current) {
        return;
      }
      if (fallbackCopy(url)) {
        flashCopied();
        return;
      }
      console.error('Copy link failed');
    }
  }

  return (
    <>
      <ExternalLink aria-hidden="true" className="h-8 w-8 text-neutral-400" />
      <h2 className="text-center text-lg font-medium text-neutral-900">
        {t('login.inAppHeading')}
      </h2>
      <p className="text-center text-sm text-neutral-500">{t('login.inAppBody')}</p>
      {showIosHint ? (
        <p className="text-center text-sm text-neutral-500">{t('login.inAppIosHint')}</p>
      ) : null}
      <div className="flex flex-col items-center gap-3">
        <button
          type="button"
          onClick={() => {
            openInSystemBrowser(loginUrl());
          }}
          className="inline-flex items-center gap-2 rounded-full bg-neutral-900 px-6 py-3 text-sm font-medium text-white transition hover:bg-neutral-700"
        >
          {t('login.openInBrowser')}
        </button>
        <button
          type="button"
          onClick={() => {
            void copyLink();
          }}
          data-copied={copied ? 'true' : undefined}
          className="rounded-full border border-neutral-300 bg-white px-6 py-3 text-sm font-medium text-neutral-900"
        >
          {copied ? t('login.linkCopied') : t('login.copyLink')}
        </button>
      </div>
    </>
  );
}

/**
 * The transient state while a passkey ceremony is in flight or a redirect is pending.
 *
 * @returns The loading view.
 */
function StartingView(): ReactElement {
  const { t } = useTranslations();
  return (
    <>
      <Loader2 aria-hidden="true" className="h-8 w-8 animate-spin text-neutral-400" />
      <p className="text-sm text-neutral-500">{t('login.preparing')}</p>
    </>
  );
}

/** Props for {@link ErrorView}. */
interface ErrorViewProps {
  /** Called to restart the login flow. */
  onRetry: () => void;
}

/**
 * The error state: a request failed or a response was malformed.
 *
 * @param props - See {@link ErrorViewProps}.
 * @returns The error view.
 */
function ErrorView({ onRetry }: ErrorViewProps): ReactElement {
  const { t } = useTranslations();
  return (
    <>
      <AlertTriangle aria-hidden="true" className="h-8 w-8 text-neutral-400" />
      <p className="text-center text-sm text-neutral-500">{t('login.error')}</p>
      <button
        type="button"
        onClick={onRetry}
        className="inline-flex items-center gap-2 rounded-full bg-neutral-900 px-6 py-3 text-sm font-medium text-white transition hover:bg-neutral-700"
      >
        {t('login.retry')}
      </button>
    </>
  );
}
