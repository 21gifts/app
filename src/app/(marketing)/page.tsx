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
          21.gifts uses a Passkey on your device as your identity. There are no usernames, no
          passwords, and no email sign-ups. Behind the scenes the Passkey derives a NOSTR key — but
          you never have to think about it.
        </p>
        <div className="mt-12 grid gap-10 sm:grid-cols-3">
          <div>
            <span className="text-sm text-white/40">01</span>
            <h3 className="mt-2 text-xl font-semibold">Post a request</h3>
            <p className="mt-2 text-white/60">
              Sign in with a Passkey. Describe what you need in a short message and add your
              Lightning Address. That&apos;s the entire setup.
            </p>
          </div>
          <div>
            <span className="text-sm text-white/40">02</span>
            <h3 className="mt-2 text-xl font-semibold">Your story spreads</h3>
            <p className="mt-2 text-white/60">
              Your message is published as a NOSTR event. It appears on 21.gifts, and on every NOSTR
              client that follows the same relay — Damus, Amethyst, and others.
            </p>
          </div>
          <div>
            <span className="text-sm text-white/40">03</span>
            <h3 className="mt-2 text-xl font-semibold">Gifts arrive directly</h3>
            <p className="mt-2 text-white/60">
              Donors pay your Lightning Address from their own wallet. Satoshis land in your wallet,
              not ours. The platform never sees the money.
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
            <h3 className="text-xl font-semibold">Self-sovereign keys</h3>
            <p className="mt-2 text-white/60">
              Your NOSTR key is derived from a Passkey on your own device, using the WebAuthn PRF
              extension. The server never sees the private key, and cannot impersonate you or read
              your future messages.
            </p>
          </div>
          <div>
            <h3 className="text-xl font-semibold">Open protocol</h3>
            <p className="mt-2 text-white/60">
              Every message is a standard NOSTR event. If 21.gifts disappears tomorrow, your
              identity and your posts continue to exist on the relay and in every NOSTR client that
              has them.
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
            <summary className="cursor-pointer font-medium">Who can post a request?</summary>
            <p className="mt-3 text-white/60">
              Anyone with a device that supports Passkeys and a Lightning Address from any custodial
              or self-custodial wallet. No application, no review process.
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
              Your Passkey lives in your device&apos;s secure enclave (or in iCloud Keychain /
              Google Password Manager / Bitwarden / a hardware authenticator, depending on your
              setup). 21.gifts derives a NOSTR key from it inside your browser. The server only ever
              sees signed events, never the private key itself.
            </p>
          </details>
          <details className="border-b border-white/10 py-4">
            <summary className="cursor-pointer font-medium">
              Can I lose access to my account?
            </summary>
            <p className="mt-3 text-white/60">
              If your Passkey syncs through iCloud, Google, 1Password, or Bitwarden, restoring a
              device also restores access. On sign-up you can also choose to write down a 12-word
              backup phrase (NIP-06) — it recovers the same identity in 21.gifts and in any NOSTR
              client.
            </p>
          </details>
          <details className="border-b border-white/10 py-4">
            <summary className="cursor-pointer font-medium">
              What is NOSTR doing in the background?
            </summary>
            <p className="mt-3 text-white/60">
              NOSTR is the message transport. Every request you post, and every comment under it, is
              a signed NOSTR event published to a public relay. You never have to know this — but it
              means the content lives on an open protocol, not inside a private database.
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
