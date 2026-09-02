import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactElement } from 'react';

/**
 * Title and description for `/legal` (overrides the root layout metadata).
 */
export const metadata: Metadata = {
  title: 'Legal Notice & Privacy — 21.gifts',
  description: 'Legal notice and privacy policy of 21.gifts.',
};

/**
 * Legal notice and privacy policy at `/legal`.
 *
 * Contact is in-app only — no published email.
 *
 * @returns The legal screen.
 */
export default function LegalPage(): ReactElement {
  return (
    <main className="mx-auto max-w-3xl px-5 py-24">
      <section className="space-y-4">
        <h1 className="text-3xl font-semibold">Legal Notice</h1>
        <h2 className="text-xl text-paper/70">Imprint</h2>
        <p>
          <strong>21.gifts</strong>
          <br />
          Switzerland
        </p>
        <p>
          Contact us in the 21.gifts app after you log in.{' '}
          <Link className="text-accent underline underline-offset-2" href="/contact">
            Open the app
          </Link>
          .
        </p>
        <p>Legal form: non-profit project (entity in formation).</p>
      </section>

      <section className="mt-16 space-y-4">
        <h1 className="text-3xl font-semibold">Privacy Policy</h1>
        <h2 className="text-xl text-paper/70">Overview</h2>
        <p>
          21.gifts (&quot;we&quot;, &quot;us&quot;) operates the website at 21.gifts. We do not run
          advertising, sell data, or track visitors. This page explains what data is involved.
        </p>
        <h3 className="text-lg font-semibold">Data on this website</h3>
        <p className="text-paper/70">
          This origin does not load analytics scripts. It sets no cookies unless you choose a
          language or a light/dark appearance; then a <code>locale</code> cookie and/or a{' '}
          <code>theme</code> cookie store those choices so the next visit can honour them. Choosing
          System appearance removes the <code>theme</code> cookie. The application stores a session
          token in <code>localStorage</code> after you log in so a returning visitor stays logged
          in.
        </p>
        <h3 className="text-lg font-semibold">Hosting</h3>
        <p className="text-paper/70">
          Traffic is terminated at Cloudflare. Cloudflare may record technical data such as IP
          addresses in standard server logs as part of its infrastructure. For details, see{' '}
          <a
            className="text-accent underline underline-offset-2"
            href="https://www.cloudflare.com/privacypolicy/"
            target="_blank"
            rel="noopener noreferrer"
          >
            Cloudflare&apos;s Privacy Policy
          </a>
          .
        </p>
        <h3 className="text-lg font-semibold">Data in the app</h3>
        <p className="text-paper/70">
          The application on this same origin lets you log in and uses Wallet of Satoshi to receive
          Bitcoin. It does not hold funds. Bitcoin payments go directly from the donor&apos;s Wallet
          of Satoshi to the receiver&apos;s Wallet of Satoshi address.
        </p>
        <h3 className="text-lg font-semibold">Contact</h3>
        <p className="text-paper/70">
          Contact us in the 21.gifts app after you log in.{' '}
          <Link className="text-accent underline underline-offset-2" href="/contact">
            Open the app
          </Link>
          . Messages you send there are processed solely to respond to your inquiry and are not
          passed on to third parties.
        </p>
        <h3 className="text-lg font-semibold">Your rights</h3>
        <p className="text-paper/70">
          Under the Swiss Federal Act on Data Protection (FADP) you have the right to access,
          rectify, or delete any personal data we hold about you. Contact us in the 21.gifts app
          after you log in.{' '}
          <Link className="text-accent underline underline-offset-2" href="/contact">
            Open the app
          </Link>
          .
        </p>
      </section>
    </main>
  );
}
