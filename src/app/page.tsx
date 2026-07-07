import { Gift } from 'lucide-react';
import Link from 'next/link';
import type { ReactElement } from 'react';

/**
 * Landing page — a minimal placeholder until the first product surfaces land.
 */
export default function Home(): ReactElement {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <Gift aria-hidden="true" className="mb-8 h-10 w-10 text-neutral-400" />
      <h1 className="text-6xl font-semibold tracking-tight sm:text-8xl">21.gifts</h1>
      <p className="mt-6 max-w-2xl text-xl text-neutral-600 sm:text-2xl">
        Direct human-to-human giving over Bitcoin Lightning.
      </p>
      <p className="mt-16 text-sm uppercase tracking-widest text-neutral-400">Coming soon</p>
      <Link
        href="/login"
        className="mt-8 text-sm font-medium text-neutral-600 underline underline-offset-4 transition hover:text-neutral-900"
      >
        Log in
      </Link>
    </main>
  );
}
