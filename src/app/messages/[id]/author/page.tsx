import type { ReactElement } from 'react';
import { ExternalAuthorProfile } from '@/components/ExternalAuthorProfile';
import { PublicMessageChrome } from '@/components/PublicMessageChrome';

function firstQuery(value: string | string[] | undefined): string {
  const raw = Array.isArray(value) ? value[0] : value;
  if (typeof raw !== 'string') {
    return '';
  }
  return raw.trim();
}

/**
 * `/messages/[id]/author` — external author profile card for a forum note.
 *
 * The person has no 21.gifts account. Body is {@link ExternalAuthorProfile}
 * (the member profile card sections, not a dialog). Chrome is
 * {@link PublicMessageChrome}. Not a member page: no `/members` route and no
 * OnboardingGate. The note id is not validated as a UUID here.
 *
 * @param props - Dynamic route params (`id`) and optional `name` query.
 * @returns The external author profile screen.
 */
export default async function ExternalAuthorPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ name?: string | string[] }>;
}): Promise<ReactElement> {
  const { id } = await params;
  const { name } = await searchParams;
  return (
    <PublicMessageChrome>
      <ExternalAuthorProfile messageId={id} fallbackName={firstQuery(name)} />
    </PublicMessageChrome>
  );
}
