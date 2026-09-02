'use client';

import { Fingerprint, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type ReactElement } from 'react';
import { InAppBrowserView } from '@/components/InAppBrowserView';
import { useTranslations } from '@/components/LocaleProvider';
import { Button, IconButton } from '@/components/ui';
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
  const passkey = usePasskeyLogin();
  const claimAttemptedRef = useRef(false);
  const claimedLoginRef = useRef(false);
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
    return <Loader2 aria-hidden="true" className="h-8 w-8 animate-spin text-app-subtle" />;
  }

  if (hasPasskey) {
    return null;
  }

  const claimLabel = t('view.claim');

  function alreadyClaimedView(): ReactElement {
    return (
      <div className="flex max-w-sm flex-col items-center gap-3">
        <p className="text-center text-sm text-app-muted">{t('view.alreadyClaimed')}</p>
        <IconButton
          type="button"
          variant="primary"
          size="md"
          onClick={() => {
            claimedLoginRef.current = true;
            claimAttemptedRef.current = false;
            passkey.authenticate();
          }}
          aria-label={claimLabel}
          title={claimLabel}
        >
          <Fingerprint aria-hidden="true" className="h-5 w-5" />
        </IconButton>
      </div>
    );
  }

  if (claimedLoginRef.current) {
    if (account !== null) {
      return null;
    }
    if (passkey.status === 'starting') {
      return (
        <div className="flex flex-col items-center gap-2">
          <Loader2 aria-hidden="true" className="h-8 w-8 animate-spin text-app-subtle" />
        </div>
      );
    }
    if (passkey.status === 'error' && !isAlreadyClaimedError(passkey.error)) {
      return (
        <div className="flex max-w-sm flex-col items-center gap-3">
          <p role="alert" className="text-center text-sm text-app-danger">
            {t('view.claimError')}
          </p>
          <Button type="button" onClick={() => passkey.retry()}>
            {t('view.retry')}
          </Button>
        </div>
      );
    }
    return alreadyClaimedView();
  }

  if (inApp || passkey.status === 'unsupported') {
    return (
      <section className="flex w-full max-w-sm flex-col items-center gap-6 rounded-3xl border border-app-border bg-app-card p-8 shadow-sm">
        <InAppBrowserView />
      </section>
    );
  }

  if (passkey.status === 'starting') {
    return (
      <div className="flex flex-col items-center gap-2">
        <Loader2 aria-hidden="true" className="h-8 w-8 animate-spin text-app-subtle" />
      </div>
    );
  }

  if (passkey.status === 'error' && isAlreadyClaimedError(passkey.error)) {
    return alreadyClaimedView();
  }

  if (passkey.status === 'error') {
    return (
      <div className="flex max-w-sm flex-col items-center gap-3">
        <p role="alert" className="text-center text-sm text-app-danger">
          {t('view.claimError')}
        </p>
        <Button type="button" onClick={() => passkey.retry()}>
          {t('view.retry')}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex w-full max-w-sm flex-col items-center gap-3 rounded-2xl bg-app-notice px-4 py-4 text-app-notice-fg">
      <p className="text-center text-sm font-medium">{t('view.activationRequired')}</p>
      <Button
        type="button"
        onClick={() => {
          claimAttemptedRef.current = true;
          if (useAuthStore.getState().account !== null) {
            passkey.cancel();
            useAuthStore.getState().clearAuth();
          }
          passkey.register(viewKey);
        }}
      >
        {t('view.activate')}
      </Button>
    </div>
  );
}
