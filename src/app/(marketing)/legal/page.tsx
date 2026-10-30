import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactElement } from 'react';
import { marketingMetadata } from '@/lib/marketing-metadata';

/**
 * Title and description for `/legal` (overrides the root layout metadata).
 */
export const metadata: Metadata = marketingMetadata(
  '/legal',
  'Legal Notice & Privacy — 21.gifts',
  'Legal notice and privacy policy of 21.gifts.',
);

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
        <p>
          Using 21.gifts is governed by the{' '}
          <Link className="text-accent underline underline-offset-2" href="/terms">
            Terms of Use
          </Link>
          .
        </p>
      </section>

      <section className="mt-16 space-y-4">
        <h2 className="text-3xl font-semibold">Privacy Policy</h2>
        <h3 className="text-xl font-semibold">Overview</h3>
        <p>
          21.gifts (&quot;we&quot;, &quot;us&quot;) operates the website at 21.gifts. The website
          does not run advertising and does not load analytics scripts. This page explains what data
          is involved.
        </p>
        <h3 className="text-lg font-semibold">Data on this website</h3>
        <p className="text-paper/70">
          This origin does not load analytics scripts. It sets a <code>locale</code> cookie only
          after you choose a language, when you open a language address such as <code>/de</code>, or
          to mirror the language stored on your account. It sets a <code>fiat</code> cookie (CHF,
          EUR, USD, or PHP) only after you choose a currency, or to mirror the currency stored on
          your account. Choosing a number format writes a <code>numberFormat</code> cookie; absent
          means Swiss grouping 10&apos;000.23. Choosing a light or dark appearance writes a{' '}
          <code>theme</code> cookie; choosing System removes it. The application stores a session
          token in <code>localStorage</code> after you log in so a returning visitor stays logged
          in. If another member chose you to keep a Social Recovery
          share for them, the application stores that share in <code>localStorage</code> under your
          account until you delete it. While recovering an account or moving a balance, the 12
          recovery words and the shares stay only in the open tab&apos;s memory.
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
          The application on this same origin lets you log in and gives you your own Bitcoin wallet
          in the app, which only you can open. It does not hold funds. Bitcoin payments go directly
          from the giver&apos;s wallet to the receiver&apos;s wallet. The application stores, with
          your account, the wallet details that let payments to your 21.gifts address reach that
          wallet. If you set up Social Recovery, your 12 recovery words are split into three parts:
          the two people you choose each keep one, and 21.gifts stores the third, encrypted, with
          your account, for your current wallet and for each previous wallet until you remove that
          wallet. One part alone opens nothing; any two parts together open the wallet. 21.gifts
          keeps its part as a backup only: the application never shows it or sends it anywhere.
          After a recovery, the key and the address of the previous wallet stay with your account
          until you remove it, and 21.gifts reads that wallet&apos;s balance by its address from a
          public blockchain explorer, without your account details. Your 12 recovery words open your
          Bitcoin in any compatible wallet, also if 21.gifts stops running; your 21.gifts address
          works only while 21.gifts runs.
        </p>
        <h3 className="text-lg font-semibold">Wallet and payment data</h3>
        <p className="text-paper/70">
          21.gifts sees the balance and the complete transaction history of the wallet in the app.
          How 21.gifts uses this data, who in the team may see it, and which statements derived from
          it 21.gifts may publish is set out in the section{' '}
          <Link className="text-accent underline underline-offset-2" href="/terms#wallet-and-data">
            Wallet and data
          </Link>{' '}
          of the Terms of Use.
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
