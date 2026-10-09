import type { Metadata } from 'next';
import type { ReactElement } from 'react';
import { StatsLoader } from '@/app/(marketing)/stats/stats-loader';
import { marketingMetadata } from '@/lib/marketing-metadata';

/** The public totals page has a distinct, self-referencing search preview. */
export const metadata: Metadata = marketingMetadata(
  '/stats',
  'Bitcoin donations over time | 21.gifts',
  'See how much Bitcoin people have donated through 21.gifts over time.',
);

/**
 * `/stats` — public donation totals and diagrams.
 *
 * @returns The statistics screen.
 */
export default function StatsPage(): ReactElement {
  return (
    <main className="mx-auto max-w-[1100px] px-5 pt-16 pb-24">
      <h1 className="text-4xl font-semibold leading-tight tracking-tight sm:text-6xl">Donations</h1>
      <p className="mt-3 max-w-2xl text-lg text-paper/60">How much has been donated, over time.</p>
      <div className="mt-12">
        <StatsLoader />
      </div>
    </main>
  );
}
