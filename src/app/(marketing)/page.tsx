import Link from 'next/link';
import type { ReactElement } from 'react';

/**
 * Marketing landing at `/`: pitch, how it works, why, FAQ, CTAs into the app.
 *
 * @returns The home screen.
 */
export default function Home(): ReactElement {
  return (
    <main>
      <section className="relative overflow-hidden px-5 pt-28 pb-20 sm:pt-36">
        <div className="mx-auto max-w-[1100px]">
          <h1 className="text-4xl leading-tight font-semibold tracking-tight sm:text-6xl">
            Direct human-to-human gifts
            <br />
            over Bitcoin Lightning
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-white/60">
            Ask for help, or send help, without an organization in the middle. Funds flow donor to
            receiver directly — the platform never custodies a satoshi.
          </p>
          <div className="mt-10 flex flex-wrap gap-4">
            <Link
              href="/login"
              className="rounded-full bg-[#f7931a] px-6 py-3 font-medium text-[#0a090c] no-underline"
            >
              Ask for help
            </Link>
            <Link
              href="/donate"
              className="rounded-full border border-white/20 px-6 py-3 font-medium text-white no-underline"
            >
              Send help
            </Link>
          </div>
        </div>
      </section>

      <section id="how" className="mx-auto max-w-[1100px] px-5 py-20">
        <h2 className="text-sm tracking-widest text-[#f7931a] uppercase">How it works</h2>
        <p className="mt-3 text-2xl font-semibold">
          Three steps, no accounts in the traditional sense
        </p>
        <p className="mt-4 max-w-3xl text-white/60">
          21.gifts uses LNURL-auth: you sign in with the Lightning wallet you already have. There
          are no usernames, no passwords, and no email sign-ups.
        </p>
        <div className="mt-12 grid gap-10 sm:grid-cols-3">
          <div>
            <span className="text-sm text-white/60">01</span>
            <h3 className="mt-2 text-xl font-semibold">Sign in with your wallet</h3>
            <p className="mt-2 text-white/60">
              Scan a QR or open Wallet of Satoshi. Your wallet signs a one-time challenge. That
              signature is your account — nothing else to remember.
            </p>
          </div>
          <div>
            <span className="text-sm text-white/60">02</span>
            <h3 className="mt-2 text-xl font-semibold">Add a Lightning Address</h3>
            <p className="mt-2 text-white/60">
              Link where gifts should land, in the usual <code>name@domain</code> form. Anyone can
              then send to you from their own wallet.
            </p>
          </div>
          <div>
            <span className="text-sm text-white/60">03</span>
            <h3 className="mt-2 text-xl font-semibold">Gifts arrive directly</h3>
            <p className="mt-2 text-white/60">
              Donors pay your Lightning Address. Satoshis land in your wallet, not ours. The
              platform never sees the money.
            </p>
          </div>
        </div>
      </section>

      <section id="why" className="mx-auto max-w-[1100px] px-5 py-20">
        <h2 className="text-sm tracking-widest text-[#f7931a] uppercase">Why this exists</h2>
        <p className="mt-3 text-2xl font-semibold">
          The shortest possible path from one person to another
        </p>
        <div className="mt-12 grid gap-10 sm:grid-cols-2">
          <div>
            <h3 className="text-xl font-semibold">Truly peer-to-peer</h3>
            <p className="mt-2 text-white/60">
              Funds move from the donor&apos;s Lightning wallet to the receiver&apos;s Lightning
              Address. 21.gifts never holds, routes, or escrows the money. There is nothing for us
              to freeze.
            </p>
          </div>
          <div>
            <h3 className="text-xl font-semibold">Your wallet is the login</h3>
            <p className="mt-2 text-white/60">
              Identity is the key your Lightning wallet already holds for this site. 21.gifts never
              sees that key — only a signed challenge. No password database to leak.
            </p>
          </div>
          <div>
            <h3 className="text-xl font-semibold">Open Lightning rails</h3>
            <p className="mt-2 text-white/60">
              Gifts use Lightning Addresses and invoices that any compatible wallet can pay. If
              21.gifts disappeared tomorrow, those addresses would still work.
            </p>
          </div>
          <div>
            <h3 className="text-xl font-semibold">Non-profit by design</h3>
            <p className="mt-2 text-white/60">
              There is no take-rate, no platform fee, and no fundraising round to recoup. The
              project covers its own infrastructure cost and nothing more.
            </p>
          </div>
        </div>
      </section>

      <section id="faq" className="mx-auto max-w-[1100px] px-5 py-20">
        <h2 className="text-sm tracking-widest text-[#f7931a] uppercase">FAQ</h2>
        <p className="mt-3 text-2xl font-semibold">Common questions, answered briefly</p>
        <div className="mt-10 space-y-3">
          <details className="border-b border-white/10 py-4">
            <summary className="cursor-pointer font-medium">Who can use this?</summary>
            <p className="mt-3 text-white/60">
              Anyone with a Lightning wallet that supports LNURL-auth (Wallet of Satoshi, Phoenix,
              Alby, Zeus, and others) and a Lightning Address to receive. No application, no review
              process.
            </p>
          </details>
          <details className="border-b border-white/10 py-4">
            <summary className="cursor-pointer font-medium">
              Do you take a cut of the gifts?
            </summary>
            <p className="mt-3 text-white/60">
              No. Payments go directly from the donor&apos;s wallet to the receiver&apos;s Lightning
              Address. 21.gifts is never in the payment path and earns nothing per transaction.
            </p>
          </details>
          <details className="border-b border-white/10 py-4">
            <summary className="cursor-pointer font-medium">What happens to my keys?</summary>
            <p className="mt-3 text-white/60">
              They stay in your Lightning wallet. 21.gifts only sees a signed login challenge and,
              if you choose, the Lightning Address you publish. There is no password and no seed
              stored on our servers.
            </p>
          </details>
          <details className="border-b border-white/10 py-4">
            <summary className="cursor-pointer font-medium">
              Can I lose access to my account?
            </summary>
            <p className="mt-3 text-white/60">
              Yes. If you lose the wallet (or it issues a new LNURL-auth key), the account cannot be
              recovered in v1. Keep a backup of the wallet you sign in with.
            </p>
          </details>
          <details className="border-b border-white/10 py-4">
            <summary className="cursor-pointer font-medium">How do I send a gift?</summary>
            <p className="mt-3 text-white/60">
              Open Send help, enter the recipient&apos;s Lightning Address and an amount in sats,
              then pay the invoice from any Lightning wallet. You do not need to log in to give.
            </p>
          </details>
          <details className="border-b border-white/10 py-4">
            <summary className="cursor-pointer font-medium">Why only Bitcoin Lightning?</summary>
            <p className="mt-3 text-white/60">
              Lightning is the only payment rail that is fast, low-fee, censorship-resistant, and
              works with simple addresses like email. It removes the need for any custodial layer
              and lets anyone in the world give or receive without permission.
            </p>
          </details>
          <details className="border-b border-white/10 py-4">
            <summary className="cursor-pointer font-medium">
              Is this regulated, and how do taxes work?
            </summary>
            <p className="mt-3 text-white/60">
              21.gifts is a non-profit communication and discovery layer. It is not a payment
              service provider and does not move funds. Donors and receivers are responsible for
              their own tax treatment in their jurisdiction.
            </p>
          </details>
        </div>
      </section>
    </main>
  );
}
