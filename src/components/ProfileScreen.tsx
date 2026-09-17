'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState, type ReactElement } from 'react';
import { AboutMeSection } from '@/components/AboutMeSection';
import { AccountActivityChart } from '@/components/AccountActivityChart';
import { FiatPreferenceSwitcher } from '@/components/FiatPreferenceSwitcher';
import { LanguagePreferenceSwitcher } from '@/components/LanguagePreferenceSwitcher';
import { LightningAddressForm } from '@/components/LightningAddressForm';
import { LocationForm } from '@/components/LocationForm';
import { useTranslations } from '@/components/LocaleProvider';
import { NameForm } from '@/components/NameForm';
import { NumberFormatSwitcher } from '@/components/NumberFormatSwitcher';
import { PushToggle } from '@/components/PushToggle';
import { ThemeSwitcher } from '@/components/ThemeSwitcher';
import { Card } from '@/components/ui';
import { useAccountTotals } from '@/hooks/useAccountTotals';
import { fetchAboutMePhoto, putAboutMe } from '@/lib/api';
import { MissingRequirementsError } from '@/lib/missing-requirements';
import { useAuthStore } from '@/stores/auth-store';

/**
 * Signed-in profile card with compact activity chart, About me, name, location,
 * and address forms, PushToggle, LanguagePreferenceSwitcher, ThemeSwitcher,
 * FiatPreferenceSwitcher, and NumberFormatSwitcher.
 *
 * Never shows `forum.loading` for the chart. Menu totals stay in `SignedInChrome`.
 *
 * @returns The identity card.
 */
export function ProfileScreen(): ReactElement {
  const { t } = useTranslations();
  const router = useRouter();
  const { receiveOverTime, donateOverTime } = useAccountTotals();
  const account = useAuthStore((state) => state.account);
  const session = useAuthStore((state) => state.session);
  const setAccount = useAuthStore((state) => state.setAccount);
  /* v8 ignore next -- SSR: no window */
  const [origin, setOrigin] = useState(typeof window === 'undefined' ? '' : window.location.origin);

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  return (
    <Card>
      <h1 className="text-center text-2xl font-semibold tracking-tight sm:text-3xl">
        {t('profile.title')}
      </h1>
      <AccountActivityChart received={receiveOverTime} donated={donateOverTime} />
      {account !== null && session !== null ? (
        <AboutMeSection
          mode="owner"
          aboutMe={account.aboutMe}
          name={account.name}
          hasPhoto={account.aboutMeHasPhoto === true}
          loadPhoto={() => fetchAboutMePhoto(session)}
          /* v8 ignore next -- SSR first paint: origin empty so no copy URL */
          {...(origin !== '' ? { profileUrl: `${origin}/view/${account.viewKey}` } : {})}
          onSave={async (text, photo) => {
            try {
              const updated =
                photo === undefined
                  ? await putAboutMe(session, text)
                  : await putAboutMe(session, text, photo);
              if (useAuthStore.getState().session !== session) {
                return false;
              }
              const current = useAuthStore.getState().account;
              if (current === null) {
                return false;
              }
              setAccount({
                ...current,
                aboutMe: updated.aboutMe,
                aboutMeHasPhoto: updated.aboutMeHasPhoto,
              });
            } catch (err) {
              if (useAuthStore.getState().session !== session) {
                return false;
              }
              if (err instanceof MissingRequirementsError) {
                if (err.missing.includes('rules')) {
                  router.replace('/setup/rules');
                  return;
                }
                throw err;
              }
              throw err;
            }
          }}
        />
      ) : null}
      <NameForm variant="profile" />
      <LocationForm />
      <LightningAddressForm variant="profile" />
      <PushToggle />
      <LanguagePreferenceSwitcher />
      <ThemeSwitcher />
      <FiatPreferenceSwitcher />
      <NumberFormatSwitcher />
    </Card>
  );
}
