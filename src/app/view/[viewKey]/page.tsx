import type { Metadata } from 'next';
import type { ReactElement } from 'react';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { ViewProfileLoader } from '@/components/ViewProfileLoader';

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
    <main className="relative flex min-h-screen flex-col items-center justify-center gap-10 px-6">
      <div className="absolute top-4 right-5">
        <LanguageSwitcher tone="light" />
      </div>
      <ViewProfileLoader viewKey={viewKey} />
    </main>
  );
}
