'use client';

import { ImagePlus, Loader2 } from 'lucide-react';
import { useEffect, useRef, useState, type ChangeEvent, type ReactElement } from 'react';
import { CameraPhotoButton } from '@/components/CameraPhotoButton';
import { useTranslations } from '@/components/LocaleProvider';
import { WideImageCropper } from '@/components/WideImageCropper';
import { Button } from '@/components/ui';
import { isForumPhotoFile, prepareForumPhoto } from '@/lib/forum-photo';

/**
 * Resting header for the signed-in profile. The round photo and the wide
 * image are different pictures, and neither is the About me note photo.
 * A slot that has no stored picture offers an icon-only camera then a labeled button to add one.
 * An open wide-image crop stays while a profile photo saves. `imageEpoch`
 * only reloads the stored pictures; it does not remount this header.
 * A failed or empty reload clears that slot. Add buttons stay hidden until
 * the reload settles.
 *
 * @param props - Loaders and saves for the two account slots. A rejected load means none.
 * @returns The header. Add buttons appear only after that slot's load has failed.
 */
export function ProfileImages({
  loadPicture,
  loadBanner,
  onSavePicture,
  onSaveBanner,
  imageEpoch,
}: {
  loadPicture: () => Promise<Blob>;
  loadBanner: () => Promise<Blob>;
  onSavePicture: (photo: { contentType: string; data: string }) => Promise<void>;
  onSaveBanner: (photo: { contentType: string; data: string }) => Promise<void>;
  imageEpoch: number;
}): ReactElement {
  const { t } = useTranslations();
  const [pictureUrl, setPictureUrl] = useState<string | null>(null);
  const [bannerUrl, setBannerUrl] = useState<string | null>(null);
  const [pictureSettled, setPictureSettled] = useState(false);
  const [bannerSettled, setBannerSettled] = useState(false);
  const [saving, setSaving] = useState<'picture' | 'banner' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [bannerCropFile, setBannerCropFile] = useState<File | null>(null);
  const pictureInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);
  const pictureUrlRef = useRef<string | null>(null);
  const bannerUrlRef = useRef<string | null>(null);
  const loadPictureRef = useRef(loadPicture);
  const loadBannerRef = useRef(loadBanner);
  loadPictureRef.current = loadPicture;
  loadBannerRef.current = loadBanner;

  useEffect(() => {
    setPictureSettled(false);
    setBannerSettled(false);
    let cancelled = false;
    const dropPicture = (): void => {
      const previous = pictureUrlRef.current;
      pictureUrlRef.current = null;
      setPictureUrl(null);
      setPictureSettled(true);
      if (previous !== null) {
        URL.revokeObjectURL(previous);
      }
    };
    const dropBanner = (): void => {
      const previous = bannerUrlRef.current;
      bannerUrlRef.current = null;
      setBannerUrl(null);
      setBannerSettled(true);
      if (previous !== null) {
        URL.revokeObjectURL(previous);
      }
    };
    void (async () => {
      try {
        const blob = await loadPictureRef.current();
        if (cancelled) {
          return;
        }
        if (!blob.type.startsWith('image/') || blob.size === 0) {
          dropPicture();
          return;
        }
        const url = URL.createObjectURL(blob);
        const previous = pictureUrlRef.current;
        pictureUrlRef.current = url;
        setPictureUrl(url);
        setPictureSettled(true);
        if (previous !== null) {
          URL.revokeObjectURL(previous);
        }
      } catch {
        if (!cancelled) {
          dropPicture();
        }
      }
    })();
    void (async () => {
      try {
        const blob = await loadBannerRef.current();
        if (cancelled) {
          return;
        }
        if (!blob.type.startsWith('image/') || blob.size === 0) {
          dropBanner();
          return;
        }
        const url = URL.createObjectURL(blob);
        const previous = bannerUrlRef.current;
        bannerUrlRef.current = url;
        setBannerUrl(url);
        setBannerSettled(true);
        if (previous !== null) {
          URL.revokeObjectURL(previous);
        }
      } catch {
        if (!cancelled) {
          dropBanner();
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [imageEpoch]);

  useEffect(() => {
    return () => {
      if (pictureUrlRef.current !== null) {
        URL.revokeObjectURL(pictureUrlRef.current);
      }
      if (bannerUrlRef.current !== null) {
        URL.revokeObjectURL(bannerUrlRef.current);
      }
    };
  }, []);

  const savePicture = (file: File): void => {
    setSaving('picture');
    setError(null);
    void (async () => {
      try {
        let result: Awaited<ReturnType<typeof prepareForumPhoto>>;
        try {
          result = await prepareForumPhoto(file);
        } catch {
          setError(t('profile.about.errorUnsupported'));
          return;
        }
        if (!result.ok) {
          setError(
            result.error === 'tooLarge'
              ? t('profile.about.errorTooLarge')
              : t('profile.about.errorUnsupported'),
          );
          return;
        }
        const payload = { contentType: result.photo.contentType, data: result.photo.data };
        await onSavePicture(payload);
      } catch {
        setError(t('profile.about.error'));
      } finally {
        setSaving(null);
      }
    })();
  };

  const onPictureFile = (event: ChangeEvent<HTMLInputElement>): void => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (saving !== null || file === undefined) {
      return;
    }
    savePicture(file);
  };

  const onBannerFile = (event: ChangeEvent<HTMLInputElement>): void => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (saving !== null || file === undefined) {
      return;
    }
    if (!isForumPhotoFile(file)) {
      setError(t('profile.about.errorUnsupported'));
      return;
    }
    setBannerCropFile(file);
    setError(null);
  };

  const saveBannerCrop = async (photo: {
    contentType: 'image/jpeg';
    data: string;
  }): Promise<void> => {
    setSaving('banner');
    setError(null);
    try {
      await onSaveBanner(photo);
      setBannerCropFile(null);
    } catch {
      setError(t('profile.about.error'));
    } finally {
      setSaving(null);
    }
  };

  const overlapped = pictureUrl !== null && bannerUrl !== null;
  return (
    <div className="flex w-full flex-col items-center gap-4">
      {bannerCropFile !== null ? (
        <WideImageCropper
          file={bannerCropFile}
          busy={saving !== null}
          onConfirm={(photo) => {
            void saveBannerCrop(photo);
          }}
          onCancel={() => setBannerCropFile(null)}
          onError={(cropError) => {
            if (cropError === 'unsupported') {
              setBannerCropFile(null);
              setError(t('profile.about.errorUnsupported'));
              return;
            }
            setError(t('profile.about.errorTooLarge'));
          }}
        />
      ) : bannerUrl !== null ? (
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
        <div className="flex w-full items-center gap-2">
          <CameraPhotoButton
            label={t('profile.about.bannerCamera')}
            name="profile-banner-camera"
            disabled={saving !== null}
            onChange={onBannerFile}
          />
          <Button
            type="button"
            variant="secondary"
            size="lg"
            disabled={saving !== null}
            icon={<ImagePlus aria-hidden="true" className="h-4 w-4" />}
            onClick={() => {
              bannerInputRef.current?.click();
            }}
          >
            {t('profile.about.banner')}
          </Button>
        </div>
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
        <div className="flex flex-wrap items-center justify-center gap-2">
          <CameraPhotoButton
            label={t('profile.about.portraitCamera')}
            facing="user"
            name="profile-photo-camera"
            disabled={saving !== null}
            onChange={onPictureFile}
          />
          <Button
            type="button"
            variant="secondary"
            size="md"
            disabled={saving !== null}
            icon={
              saving === 'picture' ? (
                <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
              ) : (
                <ImagePlus aria-hidden="true" className="h-4 w-4" />
              )
            }
            onClick={() => {
              pictureInputRef.current?.click();
            }}
          >
            {t('profile.about.portrait')}
          </Button>
        </div>
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
        disabled={saving !== null}
        onChange={onBannerFile}
      />
      <input
        ref={pictureInputRef}
        name="profile-photo"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        disabled={saving !== null}
        onChange={onPictureFile}
      />
    </div>
  );
}
