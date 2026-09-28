'use client';

import type { ReactElement } from 'react';
import Link from 'next/link';
import { ForumHomeWordmark } from '@/components/ForumHomeWordmark';
import { useChromeBack } from '@/components/ViewHistoryRoot';
import { OnboardingGate } from '@/components/OnboardingGate';
import { SignedInChrome } from '@/components/SignedInChrome';
import { useTranslations } from '@/components/LocaleProvider';
import { WelcomeScreen } from '@/components/WelcomeScreen';
import { PageChrome } from '@/components/ui';
import { useAuthStore } from '@/stores/auth-store';

const BACK_CLASS =
  'inline-flex h-11 w-11 items-center justify-center rounded-full text-app-muted transition hover:bg-app-hover hover:text-app-fg';

function WelcomeTopLeft(): ReactElement {
  const { t } = useTranslations();
  const { override } = useChromeBack();
  return (
    <>
      {override === null ? null : (
        <button
          type="button"
          className={BACK_CLASS}
          aria-label={t('forum.askBack')}
          onClick={override.onClick}
        >
          <svg
            aria-hidden="true"
            className="h-5 w-5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="m12 19-7-7 7-7" />
            <path d="M19 12H5" />
          </svg>
        </button>
      )}
      <ForumHomeWordmark />
    </>
  );
}

function WelcomeTopRight(): ReactElement {
  const { t } = useTranslations();
  const session = useAuthStore((state) => state.session);
  if (session !== null) {
    return <SignedInChrome />;
  }
  return (
    <Link href="/login" className="text-sm font-medium text-app-fg underline underline-offset-2">
      {t('nav.login')}
    </Link>
  );
}

/**
 * `/welcome` — shown when name, address, and living-room rules agreement are saved.
 *
 * @returns The welcome screen.
 */
export default function WelcomePage(): ReactElement {
  return (
    <PageChrome topLeft={<WelcomeTopLeft />} topRight={<WelcomeTopRight />}>
      <OnboardingGate screen="welcome" allowGuest>
        <WelcomeScreen />
      </OnboardingGate>
    </PageChrome>
  );
}
