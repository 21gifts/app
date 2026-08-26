'use client';

import { LogOut } from 'lucide-react';
import { useRouter } from 'next/navigation';
import type { ReactElement } from 'react';
import { useTranslations } from '@/components/LocaleProvider';
import { usePasskeyLogin } from '@/hooks/usePasskeyLogin';
import { useAuthStore } from '@/stores/auth-store';

/**
 * Quiet log-out control in `SignedInChrome` (top-right page chrome, not on the card).
 *
 * @returns The log-out control.
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
      className="inline-flex items-center gap-1.5 text-sm text-neutral-500 transition hover:text-neutral-900"
    >
      <LogOut aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
      {t('login.logOut')}
    </button>
  );
}
