'use client';

import { type ReactElement, type ReactNode } from 'react';
import { AppShell } from '@/components/AppShell';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { ProfileChromeLeft } from '@/components/ProfileChromeLeft';
import { SignedInChrome } from '@/components/SignedInChrome';
import { useHydrateSession } from '@/hooks/useHydrateSession';
import { useAuthStore } from '@/stores/auth-store';

/**
 * Public `/messages/[id]` chrome: signed-in shell when a session is hydrated, else
 * the same top-left arrow (wordmark href `/`) plus the language switcher.
 *
 * @param children - Thread body from {@link PublicMessagePage} (`PublicMessageLoader`).
 * @returns Fill `AppShell` (`align="center"`) with the matching top-left / top-right slots around `children`.
 */
export function PublicMessageChrome({ children }: { children: ReactNode }): ReactElement {
  const { ready } = useHydrateSession();
  const session = useAuthStore((state) => state.session);
  const signedIn = ready && session !== null;

  if (signedIn) {
    return (
      <AppShell
        mode="fill"
        align="center"
        topLeft={<ProfileChromeLeft />}
        topRight={<SignedInChrome />}
      >
        {children}
      </AppShell>
    );
  }

  return (
    <AppShell
      mode="fill"
      align="center"
      topLeft={<ProfileChromeLeft wordmarkHref="/" />}
      topRight={<LanguageSwitcher tone="light" />}
    >
      {children}
    </AppShell>
  );
}
