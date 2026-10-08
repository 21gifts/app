'use client';

import { LogOut } from 'lucide-react';
import { useRouter } from 'next/navigation';
import type { ReactElement } from 'react';
import { useTranslations } from '@/components/LocaleProvider';
import { usePasskeyLogin } from '@/hooks/usePasskeyLogin';
import { logLogout } from '@/lib/interaction-log';
import { disablePush } from '@/lib/push';
import { useAuthStore } from '@/stores/auth-store';

/**
 * Quiet log-out control used inside the signed-in Menu dropdown, not as a
 * free top-right action, and under the in-place login card
 * (`WalletLoginCard`) while a session is held back. A held-back session ends
 * at once and push is switched off for it in the background; a signed-in
 * session first switches push off and sends the interaction log with its
 * `logout` event (together at most 5 s), then ends.
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
        const { session, lockedSession } = useAuthStore.getState();
        const token = session ?? lockedSession;
        const within5s = (work: Promise<void>): Promise<void> =>
          Promise.race([
            work,
            new Promise<void>((resolve) => {
              window.setTimeout(resolve, 5000);
            }),
          ]);
        const stopPush = (pushToken: string): Promise<void> =>
          within5s(disablePush(pushToken).catch(() => undefined));
        if (session === null && lockedSession !== null) {
          // A held-back session has nothing signed in to keep: end it at
          // once, so a new login on the card cannot be wiped by a late
          // clear; push is switched off for it in the background.
          clearAuth();
          router.replace('/login');
          void stopPush(lockedSession);
          return;
        }
        void (async () => {
          // The logout event goes out with the session it was recorded under,
          // before that session is cleared.
          await Promise.all([
            within5s(logLogout()),
            token === null ? Promise.resolve() : stopPush(token),
          ]);
          clearAuth();
          router.replace('/login');
        })();
      }}
      className="inline-flex w-full items-center gap-1.5 rounded-lg px-3 py-2 text-left text-sm text-app-muted transition hover:bg-app-hover hover:text-app-fg"
    >
      <LogOut aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
      {t('login.logOut')}
    </button>
  );
}
