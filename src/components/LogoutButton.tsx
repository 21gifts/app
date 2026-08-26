'use client';

import { useRouter } from 'next/navigation';
import type { ReactElement } from 'react';
import { useTranslations } from '@/components/LocaleProvider';
import { usePasskeyLogin } from '@/hooks/usePasskeyLogin';
import { useAuthStore } from '@/stores/auth-store';

/**
 * Logs the visitor out from the page chrome (top-right), not from the card.
 *
 * @returns The log-out button.
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
      className="text-sm text-neutral-500 transition hover:text-neutral-900"
    >
      {t('login.logOut')}
    </button>
  );
}
