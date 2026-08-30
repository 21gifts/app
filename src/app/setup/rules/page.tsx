import type { ReactElement } from 'react';
import { OnboardingGate } from '@/components/OnboardingGate';
import { RulesDocument } from '@/components/RulesDocument';
import { RulesSetup } from '@/components/RulesSetup';
import { SignedInChrome } from '@/components/SignedInChrome';
import { getCatalog } from '@/lib/messages';
import { getRequestLocale } from '@/lib/request-locale';
import { RULES_CHAPTER_IDS } from '@/lib/rules-chapters';

/**
 * `/setup/rules` — agree to the living-room rules after name and address.
 *
 * @returns The rules agreement screen.
 */
export default async function RulesSetupPage(): Promise<ReactElement> {
  const locale = await getRequestLocale();
  const messages = getCatalog(locale);
  return (
    <main className="relative flex min-h-svh flex-col items-center px-6">
      <SignedInChrome />
      <OnboardingGate screen="rules">
        <RulesSetup
          chapters={RULES_CHAPTER_IDS.map((id) => (
            <RulesDocument key={id} messages={messages} showNav={false} chapter={id} />
          ))}
        />
      </OnboardingGate>
    </main>
  );
}
