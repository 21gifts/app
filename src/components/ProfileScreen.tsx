'use client';

import { ImagePlus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type ChangeEvent, type ReactElement } from 'react';
import { AboutMeSection } from '@/components/AboutMeSection';
import { AccountActivityChart } from '@/components/AccountActivityChart';
import { FiatPreferenceSwitcher } from '@/components/FiatPreferenceSwitcher';
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
import { prepareForumPhoto } from '@/lib/forum-photo';
import {
  fetchAboutMePhoto,
  fetchMember,
  fetchProfilePhoto,
  fetchWideBanner,
  putAboutMe,
  putProfilePhoto,
  putWideBanner,
} from '@/lib/api';
import type { MemberProfile } from '@/lib/api-types';
import { MissingRequirementsError } from '@/lib/missing-requirements';
import { useAuthStore } from '@/stores/auth-store';

/**
 * Resting header for the signed-in profile. The round photo and the wide
 * image are different pictures, and neither is the About me note photo.
 * A slot that has no stored picture offers a labeled button to add one.
 *
 * @param props - Loaders and saves for the two account slots. A rejected load means none.
 * @returns The header. Add buttons appear only after that slot's load has failed.
 */
function ProfileImages({
  loadPicture,
  loadBanner,
  onSavePicture,
  onSaveBanner,
}: {
  loadPicture: () => Promise<Blob>;
  loadBanner: () => Promise<Blob>;
  onSavePicture: (photo: { contentType: string; data: string }) => Promise<void>;
  onSaveBanner: (photo: { contentType: string; data: string }) => Promise<void>;
}): ReactElement {
  const { t } = useTranslations();
  const [pictureUrl, setPictureUrl] = useState<string | null>(null);
  const [bannerUrl, setBannerUrl] = useState<string | null>(null);
  const [pictureSettled, setPictureSettled] = useState(false);
  const [bannerSettled, setBannerSettled] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pictureInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);
  const loadPictureRef = useRef(loadPicture);
  const loadBannerRef = useRef(loadBanner);
  loadPictureRef.current = loadPicture;
  loadBannerRef.current = loadBanner;

  useEffect(() => {
    let cancelled = false;
    let pictureObject: string | null = null;
    let bannerObject: string | null = null;
    void (async () => {
      try {
        const blob = await loadPictureRef.current();
        if (cancelled || !blob.type.startsWith('image/') || blob.size === 0) {
          if (!cancelled) {
            setPictureSettled(true);
          }
          return;
        }
        pictureObject = URL.createObjectURL(blob);
        if (!cancelled) {
          setPictureUrl(pictureObject);
          setPictureSettled(true);
        }
      } catch {
        if (!cancelled) {
          setPictureSettled(true);
        }
      }
    })();
    void (async () => {
      try {
        const blob = await loadBannerRef.current();
        if (cancelled || !blob.type.startsWith('image/') || blob.size === 0) {
          if (!cancelled) {
            setBannerSettled(true);
          }
          return;
        }
        bannerObject = URL.createObjectURL(blob);
        if (!cancelled) {
          setBannerUrl(bannerObject);
          setBannerSettled(true);
        }
      } catch {
        if (!cancelled) {
          setBannerSettled(true);
        }
      }
    })();
    return () => {
      cancelled = true;
      if (pictureObject !== null) {
        URL.revokeObjectURL(pictureObject);
      }
      if (bannerObject !== null) {
        URL.revokeObjectURL(bannerObject);
      }
    };
  }, []);

  const saveFile = (file: File, wide: boolean): void => {
    setSaving(true);
    setError(null);
    void (async () => {
      try {
        const result =
          wide === true
            ? await prepareForumPhoto(file, { wide: true })
            : await prepareForumPhoto(file);
        if (!result.ok) {
          setError(
            result.error === 'tooLarge'
              ? t('profile.about.errorTooLarge')
              : result.error === 'notWide'
                ? t('profile.about.errorNotWide')
                : t('profile.about.errorUnsupported'),
          );
          return;
        }
        const payload = { contentType: result.photo.contentType, data: result.photo.data };
        if (wide) {
          await onSaveBanner(payload);
        } else {
          await onSavePicture(payload);
        }
      } catch {
        setError(t('profile.about.error'));
      } finally {
        setSaving(false);
      }
    })();
  };

  const onPictureFile = (event: ChangeEvent<HTMLInputElement>): void => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (file !== undefined) {
      saveFile(file, false);
    }
  };

  const onBannerFile = (event: ChangeEvent<HTMLInputElement>): void => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (file !== undefined) {
      saveFile(file, true);
    }
  };

  const overlapped = pictureUrl !== null && bannerUrl !== null;
  return (
    <div className="flex w-full flex-col items-center gap-4">
      {bannerUrl !== null ? (
        <div className={`relative w-full${overlapped ? ' mb-8' : ''}`}>
          {/* eslint-disable-next-line @next/next/no-img-element -- blob URL from the wide image */}
          <img
            src={bannerUrl}
            alt={t('profile.about.bannerAlt')}
            className="aspect-[5/2] w-full rounded-2xl object-cover"
          />
          {pictureUrl !== null ? (
            // eslint-disable-next-line @next/next/no-img-element -- blob URL from the profile photo
            <img
              src={pictureUrl}
              alt={t('profile.about.portraitAlt')}
              className="absolute bottom-0 left-1/2 h-16 w-16 -translate-x-1/2 translate-y-1/2 rounded-full object-cover ring-4 ring-app-card"
            />
          ) : null}
        </div>
      ) : bannerSettled ? (
        <Button
          type="button"
          variant="secondary"
          size="lg"
          disabled={saving}
          icon={<ImagePlus aria-hidden="true" className="h-4 w-4" />}
          onClick={() => {
            bannerInputRef.current?.click();
          }}
        >
          {t('profile.about.banner')}
        </Button>
      ) : null}
      {pictureUrl !== null && bannerUrl === null ? (
        // eslint-disable-next-line @next/next/no-img-element -- blob URL from the profile photo
        <img
          src={pictureUrl}
          alt={t('profile.about.portraitAlt')}
          className="mx-auto h-16 w-16 rounded-full object-cover"
        />
      ) : null}
      {pictureSettled && pictureUrl === null ? (
        <Button
          type="button"
          variant="secondary"
          size="md"
          disabled={saving}
          icon={<ImagePlus aria-hidden="true" className="h-4 w-4" />}
          onClick={() => {
            pictureInputRef.current?.click();
          }}
        >
          {t('profile.about.portrait')}
        </Button>
      ) : null}
      {error !== null ? (
        <p role="alert" className="text-center text-sm text-app-danger">
          {error}
        </p>
      ) : null}
      <input
        ref={bannerInputRef}
        name="profile-banner"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        disabled={saving}
        onChange={onBannerFile}
      />
      <input
        ref={pictureInputRef}
        name="profile-photo"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        disabled={saving}
        onChange={onPictureFile}
      />
    </div>
  );
}

/**
 * Signed-in profile card with compact activity chart, About me, name, location,
 * the same public gifts facts as the member card (`MemberProfileScreen`
 * `factsOnly`), and address forms,
 * PushToggle (All/Active/Mentions always; This device On/Off when Push APIs
 * are ready), LanguagePreferenceSwitcher, ThemeSwitcher,
 * FiatPreferenceSwitcher, and NumberFormatSwitcher.
 *
 * Never shows `forum.loading` for the chart. Empty chart is `profile.chartEmpty`
 * without a chart FiatPicker (including while activity is in flight); a failed
 * activity fetch shows `profile.chartError`. The only FiatPicker on the card is
 * {@link FiatPreferenceSwitcher}. The signed-in menu Profile row shows no amounts.
 *
 * @returns The identity card.
 */
export function ProfileScreen(): ReactElement {
  const { t } = useTranslations();
  const router = useRouter();
  const { receiveOverTime, donateOverTime, failed } = useAccountTotals();
  const account = useAuthStore((state) => state.account);
  const session = useAuthStore((state) => state.session);
  const setAccount = useAuthStore((state) => state.setAccount);
  const accountId = account?.id;
  /* v8 ignore next -- SSR: no window */
  const [origin, setOrigin] = useState(typeof window === 'undefined' ? '' : window.location.origin);
  const [member, setMember] = useState<MemberProfile | null>(null);
  const [memberStatus, setMemberStatus] = useState<'loading' | 'error' | 'ready'>('loading');
  const [memberAttempt, setMemberAttempt] = useState(0);
  const [imageEpoch, setImageEpoch] = useState(0);

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
      {session !== null ? (
        <ProfileImages
          key={`${session}:${imageEpoch}`}
          loadPicture={() => fetchProfilePhoto(session)}
          loadBanner={() => fetchWideBanner(session)}
          onSavePicture={async (photo) => {
            await putProfilePhoto(session, photo);
            setImageEpoch((epoch) => epoch + 1);
          }}
          onSaveBanner={async (photo) => {
            await putWideBanner(session, photo);
            setImageEpoch((epoch) => epoch + 1);
          }}
        />
      ) : null}
      <h1 className="text-center text-2xl font-semibold tracking-tight sm:text-3xl">
        {t('profile.title')}
      </h1>
      <AccountActivityChart received={receiveOverTime} donated={donateOverTime} failed={failed} />
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
          loadPicture={() => fetchProfilePhoto(session)}
          onSavePicture={async (photo) => {
            await putProfilePhoto(session, photo);
            setImageEpoch((epoch) => epoch + 1);
          }}
          loadBanner={() => fetchWideBanner(session)}
          onSaveBanner={async (photo) => {
            await putWideBanner(session, photo);
            setImageEpoch((epoch) => epoch + 1);
          }}
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
      <PushToggle />
      <LanguagePreferenceSwitcher />
      <ThemeSwitcher />
      <FiatPreferenceSwitcher />
      <NumberFormatSwitcher />
    </Card>
  );
}
