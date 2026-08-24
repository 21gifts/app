import type { Metadata } from 'next';
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
 * @returns The legal screen.
 */
export default function LegalPage(): ReactElement {
  return (
    <main className="mx-auto max-w-3xl px-5 py-24">
      <section className="space-y-4">
        <h1 className="text-3xl font-semibold">Legal Notice</h1>
        <h2 className="text-xl text-white/70">Imprint</h2>
        <p>
          <strong>21.gifts</strong>
          <br />
          Switzerland
        </p>
        <p>
          Email:{' '}
          <a className="text-[#f7931a] underline underline-offset-2" href="mailto:info@21.gifts">
            info@21.gifts
          </a>
        </p>
        <p>Legal form: non-profit project (entity in formation).</p>
      </section>

      <section className="mt-16 space-y-4">
        <h1 className="text-3xl font-semibold">Privacy Policy</h1>
        <h2 className="text-xl text-white/70">Overview</h2>
        <p>
          21.gifts (&quot;we&quot;, &quot;us&quot;) operates the website at 21.gifts. We do not run
          advertising, sell data, or track visitors. This page explains what data is involved.
        </p>
        <h3 className="text-lg font-semibold">Data on this website</h3>
        <p className="text-white/70">
          This origin does not load analytics scripts. It sets no cookies unless you choose a
          language; then a <code>locale</code> cookie stores that choice so the next visit can
          honour it. The application stores a session token in <code>localStorage</code> after you
          sign in with a passkey so a returning visitor stays signed in.
        </p>
        <h3 className="text-lg font-semibold">Hosting</h3>
        <p className="text-white/70">
          Traffic is terminated at Cloudflare. Cloudflare may record technical data such as IP
          addresses in standard server logs as part of its infrastructure. For details, see{' '}
          <a
            className="text-[#f7931a] underline underline-offset-2"
            href="https://www.cloudflare.com/privacypolicy/"
            target="_blank"
            rel="noopener noreferrer"
          >
            Cloudflare&apos;s Privacy Policy
          </a>
          .
        </p>
        <h3 className="text-lg font-semibold">Data in the app</h3>
        <p className="text-white/70">
          The application on this same origin uses a passkey to sign in and Wallet of Satoshi to
          receive Bitcoin. It does not hold funds. Bitcoin payments go directly from the
          donor&apos;s Wallet of Satoshi to the receiver&apos;s Wallet of Satoshi address.
        </p>
        <h3 className="text-lg font-semibold">Contact</h3>
        <p className="text-white/70">
          If you contact us by email, we will process the information you provide solely to respond
          to your inquiry, and we will not pass it on to third parties.
        </p>
        <h3 className="text-lg font-semibold">Your rights</h3>
        <p className="text-white/70">
          Under the Swiss Federal Act on Data Protection (FADP) you have the right to access,
          rectify, or delete any personal data we hold about you. Write to{' '}
          <a className="text-[#f7931a] underline underline-offset-2" href="mailto:info@21.gifts">
            info@21.gifts
          </a>
          .
        </p>
      </section>
    </main>
  );
}
