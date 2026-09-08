'use client';

import type { ReactElement } from 'react';
import { ForumLoader } from '@/components/ForumLoader';
import { useTranslations } from '@/components/LocaleProvider';
import { Card } from '@/components/ui';
import { useAuthStore } from '@/stores/auth-store';

/**
 * The fourth post-login screen: welcome after name, address, and rules agreement.
 *
 * Embeds {@link ForumLoader} (forum list + composer) below the heading.
 * Card is `max-w-xl` to fit the board. Forum heading is omitted on the board
 * so this welcome title is the only stack header.
 *
 * @returns The welcome card.
 */
export function WelcomeScreen(): ReactElement {
  const { t } = useTranslations();
  const storedName = useAuthStore((state) => state.account?.name);
  const name = storedName === null || storedName === undefined ? '' : storedName.trim();

  return (
    <Card maxWidth="xl">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 64 64"
        aria-hidden="true"
        className="h-12 w-12 text-app-fg"
      >
        <g
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 32v24a2 2 0 0 0 2 2h36a2 2 0 0 0 2-2V32" />
          <rect x="8" y="23" width="48" height="9" rx="2" />
          <path d="M32 23C29 12 25 7 20 9c-8 3-4 14 12 14ZM32 23c3-11 7-16 12-14 8 3 4 14-12 14ZM32 23v9" />
          <g transform="translate(20 33)">
            <path d="M11.767 19.089c4.924.868 6.14-6.025 1.216-6.894m-1.216 6.894L5.86 18.047m5.908 1.042-.347 1.97m1.563-8.864c4.924.869 6.14-6.025 1.215-6.893m-1.215 6.893-3.94-.694m5.155-6.2L8.29 4.26m5.908 1.042.348-1.97M7.48 20.364l3.126-17.727" />
          </g>
        </g>
      </svg>
      <h1 className="text-center text-2xl font-semibold tracking-tight sm:text-3xl">
        {t('login.welcomeHeading', { name })}
      </h1>
      <ForumLoader />
    </Card>
  );
}
