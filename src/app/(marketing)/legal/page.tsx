import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactElement } from 'react';

/**
 * Title and description for `/legal` (overrides the root layout metadata).
 */
export const metadata: Metadata = {
  title: 'Legal Notice & Privacy — 21.gifts',
  description: 'Legal notice, privacy policy, and Scripture credits of 21.gifts.',
};

/**
 * Legal notice, privacy policy, and Scripture credits at `/legal`.
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
        <h2 className="text-xl font-semibold">Imprint</h2>
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
        <h2 className="text-3xl font-semibold">Privacy Policy</h2>
        <h3 className="text-xl font-semibold">Overview</h3>
        <p>
          21.gifts (&quot;we&quot;, &quot;us&quot;) operates the website at 21.gifts. We do not run
          advertising, sell data, or track visitors. This page explains what data is involved.
        </p>
        <h3 className="text-lg font-semibold">Data on this website</h3>
        <p className="text-paper/70">
          This origin does not load analytics scripts. It sets no cookies unless you choose a
          language, a number format, or a light/dark appearance; then a <code>locale</code> cookie,
          a <code>numberFormat</code> cookie, and/or a <code>theme</code> cookie store those choices
          so the next visit can honour them. Choosing a number format writes{' '}
          <code>numberFormat</code>; absent means Swiss grouping 10&apos;000.23. Choosing System
          appearance removes the <code>theme</code> cookie. The application stores a session token
          in <code>localStorage</code> after you log in so a returning visitor stays logged in.
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

      <section className="mt-16 space-y-4">
        <h2 className="text-3xl font-semibold">Scripture quotations</h2>
        <p className="text-paper/70">
          The Bible verses on this website are quoted from the following editions, used by
          permission of their publishers.
        </p>
        <p className="text-paper/70">
          <strong>English:</strong> THE HOLY BIBLE, NEW INTERNATIONAL VERSION®, NIV® Copyright ©
          1973, 1978, 1984, 2011 by Biblica, Inc.® Used by permission. All rights reserved
          worldwide.
        </p>
        <p className="text-paper/70">
          <strong>German:</strong> Die Bibel nach Martin Luthers Übersetzung, revidiert 2017, © 2016
          Deutsche Bibelgesellschaft, Stuttgart.
        </p>
        <p className="text-paper/70">
          <strong>Spanish:</strong> Texto bíblico: Reina-Valera 1960® © Sociedades Bíblicas en
          América Latina, 1960. Renovado © Sociedades Bíblicas Unidas, 1988. Utilizado con permiso.
          Reina-Valera 1960® es una marca registrada de Sociedades Bíblicas Unidas, y se puede usar
          solamente bajo licencia.
        </p>
        <p className="text-paper/70">
          <strong>Filipino:</strong> Magandang Balita Biblia (Revised) © Philippine Bible Society
          2005.
        </p>
      </section>
    </main>
  );
}
