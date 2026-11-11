import type { ReactElement } from 'react';
import { AppShell } from '@/components/AppShell';
import { FondSummaryLoader } from '@/components/FondSummaryLoader';
import { HomeWordmark } from '@/components/HomeWordmark';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { ProfileChromeLeft } from '@/components/ProfileChromeLeft';

/**
 * `/fonds/[username]` — public Fond page with received, paid-out, and
 * balance totals.
 *
 * Unsigned public chrome like `/view/[viewKey]`: the one top-left back arrow
 * beside the wordmark and the light language switcher. The page body is
 * {@link FondSummaryLoader}; the same-origin proxy `/fonds/:username/summary`
 * answers 404 for another handle, and the loader then shows not-found.
 *
 * @param props - Dynamic route params (`username`).
 * @returns The public Fond screen.
 */
export default async function FondPage({
  params,
}: {
  params: Promise<{ username: string }>;
}): Promise<ReactElement> {
  const { username } = await params;
  return (
    <AppShell
      mode="fill"
      align="center"
      topLeft={<ProfileChromeLeft wordmark={<HomeWordmark />} />}
      topRight={<LanguageSwitcher tone="light" />}
    >
      <FondSummaryLoader username={username} />
    </AppShell>
  );
}
