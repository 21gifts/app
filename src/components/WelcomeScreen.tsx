'use client';

import { Gift } from 'lucide-react';
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
      <Gift aria-hidden="true" className="h-12 w-12 text-app-fg" />
      <h1 className="text-center text-2xl font-semibold tracking-tight">
        {t('login.welcomeHeading', { name })}
      </h1>
      <ForumLoader />
    </Card>
  );
}
