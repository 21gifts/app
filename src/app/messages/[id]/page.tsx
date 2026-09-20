import type { Metadata } from 'next';
import type { ReactElement } from 'react';
import { PublicMessageChrome } from '@/components/PublicMessageChrome';
import { PublicMessageLoader } from '@/components/PublicMessageLoader';
import { loadPublicMessageForOg, publicMessageOgMetadata } from '@/lib/public-message-og';

/**
 * Per-note Open Graph / Twitter metadata for `/messages/[id]`.
 *
 * Loads the public note from the api and describes that note in `<head>`.
 * Missing or failed fetches inherit the root layout preview.
 *
 * @param props - Dynamic route params (`id`).
 * @returns Next.js `Metadata` for this note, or `{}` to inherit the layout.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const note = await loadPublicMessageForOg(id);
  return publicMessageOgMetadata(id, note);
}

/**
 * `/messages/[id]` — public permalink HTML note by forum message UUID.
 *
 * JSON for the same note is `/public-messages/[id]`. Unsigned visitors see a
 * read-only thread. Signed-in React on the root note, copy, reply, Gift on a
 * payable nested reply, and staff delete run through
 * {@link PublicMessageLoader} → `PublicMessageThread`.
 * No OnboardingGate, top-level composer, or envelope. Body chrome is
 * {@link PublicMessageChrome}.
 *
 * @param props - Dynamic route params (`id`).
 * @returns The public message screen.
 */
export default async function PublicMessagePage({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<ReactElement> {
  const { id } = await params;
  return (
    <PublicMessageChrome>
      <PublicMessageLoader key={id} id={id} />
    </PublicMessageChrome>
  );
}
