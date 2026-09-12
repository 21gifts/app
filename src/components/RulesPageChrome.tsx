'use client';

import { type ReactElement, type ReactNode } from 'react';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { NumberFormatSwitcher } from '@/components/NumberFormatSwitcher';
import { ProfileChromeLeft } from '@/components/ProfileChromeLeft';
import { SignedInChrome } from '@/components/SignedInChrome';
import { ThemeSwitcher } from '@/components/ThemeSwitcher';
import { PageChrome, Wordmark } from '@/components/ui';
import { useHydrateSession } from '@/hooks/useHydrateSession';
import { useAuthStore } from '@/stores/auth-store';

/**
 * Public `/rules` chrome: signed-in shell when a session is hydrated, else
 * marketing-like unsigned chrome.
 *
 * @param children - Heading and rules document from {@link RulesPage}.
 * @returns The page chrome around `children`.
 */
export function RulesPageChrome({ children }: { children: ReactNode }): ReactElement {
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
      topLeft={<Wordmark href="/" />}
      topRight={
        <>
          <ThemeSwitcher />
          <NumberFormatSwitcher tone="light" />
          <LanguageSwitcher tone="light" />
        </>
      }
    >
      {children}
    </PageChrome>
  );
}
