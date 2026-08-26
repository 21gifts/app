'use client';

import { useRouter } from 'next/navigation';
import type { ReactElement } from 'react';
import { useTranslations } from '@/components/LocaleProvider';
import { usePasskeyLogin } from '@/hooks/usePasskeyLogin';
import { useAuthStore } from '@/stores/auth-store';

/**
 * Log-out segment of `SignedInChrome` (top-right page chrome, not on the card).
 *
 * @returns The log-out button segment.
 */
export function LogoutButton(): ReactElement {
  const { t } = useTranslations();
  const router = useRouter();
  const clearAuth = useAuthStore((state) => state.clearAuth);
  const passkey = usePasskeyLogin();

  return (
    <button
      type="button"
      onClick={() => {
        passkey.cancel();
        clearAuth();
        router.replace('/login');
      }}
      className="px-3 py-1 text-sm text-neutral-900 transition hover:bg-neutral-50"
    >
      {t('login.logOut')}
    </button>
  );
}
