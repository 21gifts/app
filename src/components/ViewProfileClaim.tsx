'use client';

import { Fingerprint, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type ReactElement } from 'react';
import { InAppBrowserView } from '@/components/InAppBrowserView';
import { useTranslations } from '@/components/LocaleProvider';
import { useHydrateSession } from '@/hooks/useHydrateSession';
import { usePasskeyLogin } from '@/hooks/usePasskeyLogin';
import { isInAppBrowser } from '@/lib/in-app-browser';
import { nextOnboardingPath } from '@/lib/onboarding';
import { useAuthStore } from '@/stores/auth-store';

/**
 * Whether a passkey error means the profile is already claimed (HTTP 409).
 *
 * @param message - Stored `Error.message` from the passkey hook.
 * @returns True when the api reported an existing passkey.
 */
function isAlreadyClaimedError(message: string | null): boolean {
  return message === 'This profile already has a passkey';
}

/**
 * Public passkey claim control under the `/view/[viewKey]` profile card.
 * Unclaimed profiles (`hasPasskey` false) show the yellow Activate banner in a
 * real browser even when another session is signed in. In Telegram or another
 * in-app browser, shows the shared escape card on mount instead.
 *
 * @param props - Dynamic route `viewKey` and whether the profile already has a passkey.
 * @returns Yellow activate banner, in-app escape card, spinner, error copy, or `null` when claimed.
 */
export function ViewProfileClaim({
  viewKey,
  hasPasskey,
}: {
  viewKey: string;
  hasPasskey: boolean;
}): ReactElement | null {
  const { t } = useTranslations();
  const router = useRouter();
  const { ready } = useHydrateSession();
  const account = useAuthStore((state) => state.account);
  const clearAuth = useAuthStore((state) => state.clearAuth);
  const passkey = usePasskeyLogin();
  const claimAttemptedRef = useRef(false);
  const [inApp, setInApp] = useState(false);

  useEffect(() => {
    setInApp(isInAppBrowser());
  }, []);

  useEffect(() => {
    if (claimAttemptedRef.current && account !== null) {
      router.replace(nextOnboardingPath(account));
    }
  }, [account, router]);

  if (!ready) {
    return <Loader2 aria-hidden="true" className="h-8 w-8 animate-spin text-neutral-400" />;
  }

  if (hasPasskey) {
    return null;
  }

  if (inApp || passkey.status === 'unsupported') {
    return (
      <section className="flex w-full max-w-sm flex-col items-center gap-6 rounded-3xl border border-app-border bg-app-card p-8 shadow-sm">
        <InAppBrowserView />
      </section>
    );
  }

  const claimLabel = t('view.claim');

  if (passkey.status === 'starting') {
    return (
      <div className="flex flex-col items-center gap-2">
        <Loader2 aria-hidden="true" className="h-8 w-8 animate-spin text-neutral-400" />
      </div>
    );
  }

  if (passkey.status === 'error' && isAlreadyClaimedError(passkey.error)) {
    return (
      <div className="flex max-w-sm flex-col items-center gap-3">
        <p className="text-center text-sm text-neutral-500">{t('view.alreadyClaimed')}</p>
        <button
          type="button"
          onClick={() => {
            claimAttemptedRef.current = false;
            passkey.authenticate();
          }}
          aria-label={claimLabel}
          title={claimLabel}
          className="inline-flex items-center justify-center rounded-full bg-neutral-900 p-3 text-white transition hover:bg-neutral-700"
        >
          <Fingerprint aria-hidden="true" className="h-5 w-5" />
        </button>
      </div>
    );
  }

  if (passkey.status === 'error') {
    return (
      <div className="flex max-w-sm flex-col items-center gap-3">
        <p className="text-center text-sm text-neutral-500">{t('view.claimError')}</p>
        <button
          type="button"
          onClick={() => {
            passkey.retry();
          }}
          className="rounded-full bg-neutral-900 px-5 py-2 text-sm font-medium text-white transition hover:bg-neutral-800"
        >
          {t('view.retry')}
        </button>
      </div>
    );
  }

  return (
    <div className="flex w-full max-w-sm flex-col items-center gap-3 rounded-2xl bg-yellow-200 px-4 py-4 text-neutral-900">
      <p className="text-center text-sm font-medium">{t('view.activationRequired')}</p>
      <button
        type="button"
        onClick={() => {
          claimAttemptedRef.current = true;
          if (useAuthStore.getState().account !== null) {
            passkey.cancel();
            clearAuth();
          }
          passkey.register(viewKey);
        }}
        className="rounded-full bg-neutral-900 px-5 py-2 text-sm font-medium text-white transition hover:bg-neutral-800"
      >
        {t('view.activate')}
      </button>
    </div>
  );
}
