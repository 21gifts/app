'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState, type ReactElement } from 'react';
import { AboutMeSection } from '@/components/AboutMeSection';
import { AccountActivityChart } from '@/components/AccountActivityChart';
import { FiatPreferenceSwitcher } from '@/components/FiatPreferenceSwitcher';
import { FundingStatusCard } from '@/components/FundingStatusCard';
import { LanguagePreferenceSwitcher } from '@/components/LanguagePreferenceSwitcher';
import { LightningAddressForm } from '@/components/LightningAddressForm';
import { LocationForm } from '@/components/LocationForm';
import { MemberProfileScreen } from '@/components/MemberProfileScreen';
import { useTranslations } from '@/components/LocaleProvider';
import { NameForm } from '@/components/NameForm';
import { NumberFormatSwitcher } from '@/components/NumberFormatSwitcher';
import { PushToggle } from '@/components/PushToggle';
import { ThemeSwitcher } from '@/components/ThemeSwitcher';
import { Button, Card } from '@/components/ui';
import { useAccountTotals } from '@/hooks/useAccountTotals';
import { fetchAboutMePhoto, fetchMember, putAboutMe } from '@/lib/api';
import type { MemberProfile } from '@/lib/api-types';
import { MissingRequirementsError } from '@/lib/missing-requirements';
import { useAuthStore } from '@/stores/auth-store';

/**
 * Signed-in profile card with compact activity chart, About me, name, location,
 * the same public gifts facts as the member card (`MemberProfileScreen`
 * `factsOnly`), and address forms, FundingStatusCard (verification / 21 gifts grant),
 * PushToggle (All/Active/Mentions always; This device On/Off when Push APIs
 * are ready), LanguagePreferenceSwitcher, ThemeSwitcher,
 * FiatPreferenceSwitcher, and NumberFormatSwitcher.
 *
 * Never shows `forum.loading` for the chart. Empty chart is `profile.chartEmpty`
 * without a chart FiatPicker; the only FiatPicker on the card is
 * {@link FiatPreferenceSwitcher}. Menu totals stay in `SignedInChrome`.
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
  const accountId = account?.id;
  /* v8 ignore next -- SSR: no window */
  const [origin, setOrigin] = useState(typeof window === 'undefined' ? '' : window.location.origin);
  const [member, setMember] = useState<MemberProfile | null>(null);
  const [memberStatus, setMemberStatus] = useState<'loading' | 'error' | 'ready'>('loading');
  const [memberAttempt, setMemberAttempt] = useState(0);

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  useEffect(() => {
    if (session === null || accountId === undefined) {
      return;
    }
    let cancelled = false;
    setMember(null);
    setMemberStatus('loading');
    void (async () => {
      try {
        const next = await fetchMember(session, accountId);
        if (cancelled) {
          return;
        }
        if (next === null) {
          setMemberStatus('error');
          return;
        }
        setMember(next);
        setMemberStatus('ready');
      } catch (err) {
        if (cancelled) {
          return;
        }
        if (err instanceof MissingRequirementsError) {
          router.replace('/setup/rules');
          return;
        }
        setMemberStatus('error');
      }
    })();
    return () => {
      cancelled = true;
    };
    /* router.replace is used on 409; next/navigation's identity is not stable */
  }, [session, accountId, memberAttempt]);

  return (
    <Card surface={false}>
      <h1 className="text-center text-2xl font-semibold tracking-tight sm:text-3xl">
        {t('profile.title')}
      </h1>
      <AccountActivityChart received={receiveOverTime} donated={donateOverTime} />
      {account !== null && session !== null ? (
        <AboutMeSection
          mode="owner"
          aboutMe={account.aboutMe}
          name={account.name}
          {...(typeof account.aboutMessageId === 'string' && account.aboutMessageId !== ''
            ? { messageId: account.aboutMessageId }
            : {})}
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
              const nextAboutId = updated.aboutMessageId;
              setAccount({
                ...current,
                aboutMe: updated.aboutMe,
                aboutMeHasPhoto: updated.aboutMeHasPhoto,
                ...(nextAboutId === undefined || nextAboutId === ''
                  ? {}
                  : { aboutMessageId: nextAboutId }),
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
      {memberStatus === 'ready' && member !== null ? (
        <MemberProfileScreen factsOnly profile={member} received={[]} donated={[]} />
      ) : memberStatus === 'error' ? (
        <div className="flex flex-col items-center gap-4">
          <p role="alert" className="text-center text-sm text-app-danger">
            {t('forum.error')}
          </p>
          <Button
            type="button"
            onClick={() => {
              setMemberAttempt((n) => n + 1);
            }}
          >
            {t('view.retry')}
          </Button>
        </div>
      ) : null}
      <LightningAddressForm variant="profile" />
      <FundingStatusCard />
      <PushToggle />
      <LanguagePreferenceSwitcher />
      <ThemeSwitcher />
      <FiatPreferenceSwitcher />
      <NumberFormatSwitcher />
    </Card>
  );
}
