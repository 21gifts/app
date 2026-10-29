'use client';

import { type ReactElement, type ReactNode } from 'react';
import { HomeWordmark } from '@/components/HomeWordmark';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { ProfileChromeLeft } from '@/components/ProfileChromeLeft';
import { SignedInChrome } from '@/components/SignedInChrome';
import { PageChrome } from '@/components/ui';
import { useHydrateSession } from '@/hooks/useHydrateSession';
import { useAuthStore } from '@/stores/auth-store';

/**
 * Public `/rules` chrome: signed-in shell when a session is hydrated, else
 * marketing-like unsigned chrome. The unsigned wordmark opens `homeHref`.
 *
 * @param children - Heading and rules document from {@link RulesPage}.
 * @param homeHref - Language home for the unsigned wordmark (`/{locale}`).
 * @returns The page chrome around `children`.
 */
export function RulesPageChrome({
  children,
  homeHref,
}: {
  children: ReactNode;
  homeHref: string;
}): ReactElement {
  const { ready } = useHydrateSession();
  const session = useAuthStore((state) => state.session);
  const signedIn = ready && session !== null;

  if (signedIn) {
    return (
      <PageChrome topLeft={<ProfileChromeLeft />} topRight={<SignedInChrome />}>
        {children}
      </PageChrome>
    );
  }

  return (
    <PageChrome
      topLeft={<ProfileChromeLeft wordmark={<HomeWordmark publicHref={homeHref} />} />}
      topRight={<LanguageSwitcher tone="light" />}
    >
      {children}
    </PageChrome>
  );
}
