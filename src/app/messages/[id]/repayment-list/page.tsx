import type { ReactElement } from 'react';
import { CreditLedger } from '@/components/CreditLedger';
import { PublicMessageChrome } from '@/components/PublicMessageChrome';

/**
 * `/messages/[id]/repayment-list` — day-by-day repayment list for one credit.
 *
 * Body is {@link CreditLedger} with `list="page"`. Chrome is
 * {@link PublicMessageChrome}. No OnboardingGate. The note id is not validated
 * as a UUID here.
 *
 * @param props - Dynamic route params (`id`).
 * @returns The repayment list screen.
 */
export default async function RepaymentListPage({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<ReactElement> {
  const { id } = await params;
  return (
    <PublicMessageChrome>
      <CreditLedger messageId={id} list="page" />
    </PublicMessageChrome>
  );
}
