import type { ReactElement } from 'react';
import { StatsLoader } from '@/app/(marketing)/stats/stats-loader';

/**
 * `/stats` — public gift totals and diagrams.
 *
 * @returns The statistics screen.
 */
export default function StatsPage(): ReactElement {
  return (
    <main className="mx-auto max-w-[1100px] px-5 pt-16 pb-24">
      <h1 className="text-4xl font-semibold tracking-tight">Gifts</h1>
      <p className="mt-3 max-w-2xl text-lg text-white/60">How much has been given, over time.</p>
      <div className="mt-12">
        <StatsLoader />
      </div>
    </main>
  );
}
