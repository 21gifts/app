import Link from 'next/link';
import type { ReactElement } from 'react';

/**
 * Marketing footer: wordmark, section links, legal, and GitHub.
 *
 * @returns The footer element.
 */
export function MarketingFooter(): ReactElement {
  return (
    <footer className="border-t border-white/10 px-5 py-10">
      <div className="mx-auto flex max-w-[1100px] flex-col items-start gap-6 sm:flex-row sm:items-center sm:justify-between">
        <span className="font-bold">21.gifts</span>
        <nav aria-label="Footer" className="flex flex-wrap gap-4 text-sm text-white/70">
          <Link href="/#how">How it works</Link>
          <Link href="/#why">Why</Link>
          <Link href="/#faq">FAQ</Link>
          <Link href="/handbook">Handbook</Link>
          <Link href="/legal">Legal & Privacy</Link>
        </nav>
        <a href="https://github.com/21gifts" className="text-sm text-white/70" aria-label="GitHub">
          GitHub
        </a>
      </div>
    </footer>
  );
}
