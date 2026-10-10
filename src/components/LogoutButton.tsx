'use client';

import { LogOut } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useRef, type ReactElement } from 'react';
import { useTranslations } from '@/components/LocaleProvider';
import { usePasskeyLogin } from '@/hooks/usePasskeyLogin';
import { logLogout } from '@/lib/interaction-log';
import { disablePush } from '@/lib/push';
import { returnToView } from '@/lib/view-history';
import { useAuthStore } from '@/stores/auth-store';

/**
 * Quiet log-out control used inside the signed-in Menu dropdown, not as a
 * free top-right action. The login card of a held-back session has none:
 * logging in there with any passkey decides the account. The session first
 * switches push off and sends the interaction log with its `logout` event
 * (together at most 5 s), then ends.
 *
 * @returns Full-width Menu-row icon+text log-out control.
 */
export function LogoutButton(): ReactElement {
  const { t } = useTranslations();
  const router = useRouter();
  const clearAuth = useAuthStore((state) => state.clearAuth);
  const passkey = usePasskeyLogin();
  const ending = useRef(false);

  return (
    <button
      type="button"
      onClick={() => {
        if (ending.current) {
          // A second click while a log-out is still ending its session.
          return;
        }
        passkey.cancel();
        const { session } = useAuthStore.getState();
        const within5s = (work: Promise<void>): Promise<void> =>
          Promise.race([
            work,
            new Promise<void>((resolve) => {
              window.setTimeout(resolve, 5000);
            }),
          ]);
        const stopPush = (pushToken: string): Promise<void> =>
          within5s(disablePush(pushToken).catch(() => undefined));
        ending.current = true;
        void (async () => {
          // The logout event goes out with the session it was recorded under,
          // before that session is cleared.
          await Promise.all([
            within5s(logLogout()),
            session === null ? Promise.resolve() : stopPush(session),
          ]);
          clearAuth();
          ending.current = false;
          returnToView('/login', router);
        })();
      }}
      className="inline-flex w-full items-center gap-1.5 rounded-lg px-3 py-2 text-left text-sm text-app-muted transition hover:bg-app-hover hover:text-app-fg"
    >
      <LogOut aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
      {t('login.logOut')}
    </button>
  );
}
