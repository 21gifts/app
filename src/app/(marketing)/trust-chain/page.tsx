import type { ReactElement } from 'react';
import { TrustChainLoader } from '@/app/(marketing)/trust-chain/trust-chain-loader';

/**
 * `/trust-chain` — public diagram of who verified or appointed whom.
 *
 * @returns The Trust Chain screen.
 */
export default function TrustChainPage(): ReactElement {
  return (
    <main className="mx-auto max-w-[1100px] px-5 pt-16 pb-24">
      <TrustChainLoader />
    </main>
  );
}
