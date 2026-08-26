'use client';

import { LogOut } from 'lucide-react';
import { useRouter } from 'next/navigation';
import type { ReactElement } from 'react';
import { useTranslations } from '@/components/LocaleProvider';
import { usePasskeyLogin } from '@/hooks/usePasskeyLogin';
import { useAuthStore } from '@/stores/auth-store';

/**
 * Logs the visitor out and returns them to `/login`.
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
      className="mt-2 inline-flex items-center gap-2 rounded-full border border-neutral-300 px-5 py-2 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50"
    >
      <LogOut aria-hidden="true" className="h-4 w-4" />
      {t('login.logOut')}
    </button>
  );
}
