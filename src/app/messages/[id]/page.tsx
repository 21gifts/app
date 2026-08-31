import type { ReactElement } from 'react';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { PublicMessageLoader } from '@/components/PublicMessageLoader';
import { PageChrome } from '@/components/ui';

/**
 * `/messages/[id]` — public read-only HTML note by forum message UUID.
 *
 * JSON for the same note is `/public-messages/[id]`. No OnboardingGate, pay,
 * or composer.
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
    <PageChrome topRight={<LanguageSwitcher tone="light" />}>
      <PublicMessageLoader key={id} id={id} />
    </PageChrome>
  );
}
