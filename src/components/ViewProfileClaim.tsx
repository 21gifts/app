'use client';

import { Fingerprint, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type ReactElement } from 'react';
import { InAppBrowserView } from '@/components/InAppBrowserView';
import { useTranslations } from '@/components/LocaleProvider';
import { Button, Card, IconButton } from '@/components/ui';
import { WalletLoginCard } from '@/components/WalletLoginCard';
import { useHydrateSession } from '@/hooks/useHydrateSession';
import { usePasskeyLogin } from '@/hooks/usePasskeyLogin';
import { useWalletOpen } from '@/hooks/useWalletOpen';
import { isInAppBrowser } from '@/lib/in-app-browser';
import { nextOnboardingPath } from '@/lib/onboarding';
import { useAuthStore } from '@/stores/auth-store';

/** `usePasskeyLogin` error when the new passkey returned no PRF output. */
const PRF_UNSUPPORTED_ERROR = 'wallet.prfUnsupported';

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
 * in-app browser, shows the shared escape card on mount instead. When the new
 * passkey returns no PRF output, the alert says that this phone or browser
 * cannot hold a 21.gifts wallet instead of the generic claim error.
 *
 * @param props - Dynamic route `viewKey` and whether the profile already has a passkey.
 * @returns Yellow activate banner, in-app escape card, spinner, error copy,
 *   `WalletLoginCard` after **Log in instead** (once that login is no longer
 *   running) until the wallet is open (and while that session is held back),
 *   or `null` when claimed.
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
  const lockedSession = useAuthStore((state) => state.lockedSession);
  const walletOpen = useWalletOpen();
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

  function claimFailedView(onRetry: () => void): ReactElement {
    return (
      <div className="flex max-w-sm flex-col items-center gap-3">
        <p role="alert" className="text-center text-sm text-app-danger">
          {passkey.error === PRF_UNSUPPORTED_ERROR
            ? t('wallet.prfUnsupported')
            : t('view.claimError')}
        </p>
        <Button type="button" onClick={onRetry}>
          {t('view.retry')}
        </Button>
      </div>
    );
  }

  if (claimedLoginRef.current) {
    // While this login is still running, only its spinner shows: a held-back
    // session's card (with its own login and Log out) would race it.
    if (account === null && passkey.status === 'starting') {
      return (
        <div className="flex flex-col items-center gap-2">
          <Loader2 aria-hidden="true" className="h-8 w-8 animate-spin text-app-subtle" />
        </div>
      );
    }
    // A failed attempt of this login keeps its own alert and retry, also
    // over a held-back session.
    if (account === null && passkey.status === 'unknown') {
      return claimFailedView(() => passkey.authenticate());
    }
    if (account === null && passkey.status === 'error' && !isAlreadyClaimedError(passkey.error)) {
      return claimFailedView(() => passkey.retry());
    }
    // Logging in here opens the wallet like everywhere else: until it is
    // open, and while the session is held back after it could not be, the
    // same login card stands in place, so its alert stays.
    if ((account !== null && !walletOpen) || lockedSession !== null) {
      return <WalletLoginCard />;
    }
    if (account !== null) {
      return null;
    }
    return alreadyClaimedView();
  }

  if (inApp || passkey.status === 'unsupported') {
    return (
      <Card>
        <InAppBrowserView />
      </Card>
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
    return claimFailedView(() => passkey.retry());
  }

  if (passkey.status === 'unknown') {
    return claimFailedView(() => passkey.authenticate());
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
