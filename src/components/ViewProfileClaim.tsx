'use client';

import { Fingerprint, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, type ReactElement } from 'react';
import { useTranslations } from '@/components/LocaleProvider';
import { useHydrateSession } from '@/hooks/useHydrateSession';
import { usePasskeyLogin } from '@/hooks/usePasskeyLogin';
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
 * Visible only while logged out; binds a passkey to the existing profile, then
 * then `nextOnboardingPath` (rules, if name and address are already set).
 *
 * @param props - Dynamic route `viewKey` (64 lowercase hex).
 * @returns Icon-only claim control, spinner, error copy, or `null` when signed in.
 */
export function ViewProfileClaim({ viewKey }: { viewKey: string }): ReactElement | null {
  const { t } = useTranslations();
  const router = useRouter();
  const { ready } = useHydrateSession();
  const account = useAuthStore((state) => state.account);
  const passkey = usePasskeyLogin();
  const claimAttemptedRef = useRef(false);

  useEffect(() => {
    if (claimAttemptedRef.current && account !== null) {
      router.replace(nextOnboardingPath(account));
    }
  }, [account, router]);

  if (!ready) {
    return <Loader2 aria-hidden="true" className="h-8 w-8 animate-spin text-neutral-400" />;
  }

  if (account !== null) {
    return null;
  }

  if (passkey.status === 'unsupported') {
    return (
      <p className="max-w-sm text-center text-sm text-neutral-500">{t('login.inAppHeading')}</p>
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
    <button
      type="button"
      onClick={() => {
        claimAttemptedRef.current = true;
        passkey.register(viewKey);
      }}
      aria-label={claimLabel}
      title={claimLabel}
      className="inline-flex items-center justify-center rounded-full bg-neutral-900 p-3 text-white transition hover:bg-neutral-700"
    >
      <Fingerprint aria-hidden="true" className="h-5 w-5" />
    </button>
  );
}
