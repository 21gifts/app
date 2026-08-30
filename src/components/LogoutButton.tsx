'use client';

import { LogOut } from 'lucide-react';
import { useRouter } from 'next/navigation';
import type { ReactElement } from 'react';
import { useTranslations } from '@/components/LocaleProvider';
import { usePasskeyLogin } from '@/hooks/usePasskeyLogin';
import { useAuthStore } from '@/stores/auth-store';

/**
 * Quiet log-out control used inside the signed-in Menu dropdown, not as a free top-right action.
 *
 * @returns Full-width Menu-row icon+text log-out control.
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
      className="inline-flex w-full items-center gap-1.5 rounded-lg px-3 py-2 text-left text-sm text-app-muted transition hover:bg-app-hover hover:text-app-fg"
    >
      <LogOut aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
      {t('login.logOut')}
    </button>
  );
}
