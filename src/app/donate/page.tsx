import type { ReactElement } from 'react';
import { DonateForm } from '@/components/DonateForm';

/**
 * `/donate` — guest LNURL-pay gift flow.
 */
export default function DonatePage(): ReactElement {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-10 px-6">
      <h1 className="text-center text-3xl font-semibold tracking-tight sm:text-4xl">Send a gift</h1>
      <DonateForm />
    </main>
  );
}
