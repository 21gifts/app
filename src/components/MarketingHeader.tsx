'use client';

import Link from 'next/link';
import { useState, type ReactElement } from 'react';

/**
 * Sticky dark header for marketing pages: wordmark, section nav, login CTA,
 * and a mobile menu toggle.
 *
 * @returns The header element.
 */
export function MarketingHeader(): ReactElement {
  const [open, setOpen] = useState(false);

  const closeMenu = (): void => {
    setOpen(false);
  };

  return (
    <header className="sticky top-0 z-50 flex items-center justify-between border-b border-white/10 bg-[#0a090c]/85 px-5 py-3.5 backdrop-blur-xl">
      <Link href="/" className="text-[17px] font-bold text-white no-underline">
        21.gifts
      </Link>
      <nav
        aria-label="Primary"
        className={`items-center gap-6 text-sm text-white/80 ${open ? 'absolute top-full right-0 left-0 flex flex-col border-b border-white/10 bg-[#0a090c] px-5 py-4' : 'hidden md:flex'}`}
      >
        <Link href="/#how" onClick={closeMenu}>
          How it works
        </Link>
        <Link href="/#why" onClick={closeMenu}>
          Why
        </Link>
        <Link href="/#faq" onClick={closeMenu}>
          FAQ
        </Link>
        <Link href="/handbook" onClick={closeMenu}>
          Handbook
        </Link>
        <Link
          href="/login"
          className="rounded-full bg-[#f7931a] px-4 py-2 font-medium text-[#0a090c] no-underline"
          onClick={closeMenu}
        >
          Log in
        </Link>
      </nav>
      <button
        type="button"
        className="flex flex-col gap-1.5 md:hidden"
        aria-label="Menu"
        aria-expanded={open}
        onClick={() => {
          setOpen((current) => !current);
        }}
      >
        <span className="block h-0.5 w-5 bg-white" />
        <span className="block h-0.5 w-5 bg-white" />
        <span className="block h-0.5 w-5 bg-white" />
      </button>
    </header>
  );
}
