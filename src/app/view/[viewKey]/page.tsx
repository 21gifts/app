import type { Metadata } from 'next';
import type { ReactElement } from 'react';
import { AppShell } from '@/components/AppShell';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { ThemeSwitcher } from '@/components/ThemeSwitcher';
import { ViewProfileLoader } from '@/components/ViewProfileLoader';
import { Wordmark } from '@/components/ui';

/**
 * Capability-URL referrer policy so the view key is not sent as Referer.
 */
export const metadata: Metadata = { referrer: 'no-referrer' };

/**
 * `/view/[viewKey]` — public read-only profile by view key.
 *
 * @param props - Dynamic route params (`viewKey`).
 * @returns The public view profile screen.
 */
export default async function ViewProfilePage({
  params,
}: {
  params: Promise<{ viewKey: string }>;
}): Promise<ReactElement> {
  const { viewKey } = await params;
  return (
    <AppShell
      mode="fill"
      align="center"
      topLeft={<Wordmark href="/" />}
      topRight={
        <>
          <ThemeSwitcher />
          <LanguageSwitcher tone="light" />
        </>
      }
    >
      <ViewProfileLoader viewKey={viewKey} />
    </AppShell>
  );
}
