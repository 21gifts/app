import type { Metadata } from 'next';
import type { ReactElement } from 'react';
import { WalletUsageLoader } from '@/app/(marketing)/stats/wallet/wallet-usage-loader';
import { marketingMetadata } from '@/lib/marketing-metadata';

/** The public wallet-usage page has a distinct, self-referencing search preview. */
export const metadata: Metadata = marketingMetadata(
  '/stats/wallet',
  'Wallet usage | 21.gifts',
  'How people use the 21.gifts wallet since its release.',
);

/**
 * `/stats/wallet` — public aggregates of how the in-app wallet is used.
 *
 * @returns The wallet-usage screen.
 */
export default function WalletUsagePage(): ReactElement {
  return (
    <main className="mx-auto max-w-[1100px] px-5 pt-16 pb-24">
      <h1 className="text-4xl font-semibold leading-tight tracking-tight sm:text-6xl">
        Wallet usage
      </h1>
      <div className="mt-3">
        <WalletUsageLoader />
      </div>
    </main>
  );
}
