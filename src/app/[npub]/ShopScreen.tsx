'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState, type ReactElement } from 'react';
import { ForumPhotoGallery } from '@/components/ForumPhotoGallery';
import { GoogleMapCanvas } from '@/components/GoogleMapCanvas';
import { useTranslations } from '@/components/LocaleProvider';
import { NpubCopyButton } from '@/components/NpubCopyButton';
import { QrCode } from '@/components/QrCode';
import { Button, Card } from '@/components/ui';
import type { Shop } from '@/lib/api-types';
import { giftsLightningAddress, openCryptoPayQrValue } from '@/lib/gifts-address';
import { fetchMapsKey } from '@/lib/maps-key';
import { profileQrLogo } from '@/lib/profile-qr-logo';
import { resolveShopPhotoUrl } from '@/lib/shop-photo-url';

/** Visible state of the public shop screen. */
export type ShopScreenProps = { state: 'ready'; shop: Shop } | { state: 'gone' | 'unavailable' };

/**
 * Public shop identity card, including photos, address, map, payment QR, and npub.
 *
 * @param props - Ready shop data, the unlisted state, or the retryable error state.
 * @returns The matching public shop page body.
 */
export function ShopScreen(props: ShopScreenProps): ReactElement {
  const { t } = useTranslations();
  const router = useRouter();
  const shop = props.state === 'ready' ? props.shop : null;
  const [mapsKey, setMapsKey] = useState<string | null>(null);
  const [showQr, setShowQr] = useState(false);
  /* v8 ignore next -- SSR: no window */
  const host = typeof window === 'undefined' ? '21.gifts' : window.location.hostname;
  const payAddress = giftsLightningAddress(shop?.payUsername, host);
  const qr = openCryptoPayQrValue(shop?.payUsername, host);
  // ShopPage already resolved relative paths against the api; the browser has
  // no api base, so it keeps only absolute http(s) photos.
  const photos = useMemo(
    () =>
      (shop?.photos ?? [])
        .flatMap((photo) => {
          const url = resolveShopPhotoUrl(photo.url);
          return url === null ? [] : [url];
        })
        .map((url, index) => ({ index, url })),
    [shop],
  );
  const points = useMemo(
    () => (shop === null ? [] : [{ lat: shop.place.lat, lng: shop.place.lng }]),
    [shop],
  );

  useEffect(() => {
    setShowQr(true);
  }, []);

  useEffect(() => {
    if (shop === null) {
      return;
    }
    let cancelled = false;
    void fetchMapsKey().then((key) => {
      if (!cancelled) {
        setMapsKey(key);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [shop]);

  if (props.state !== 'ready') {
    return props.state === 'gone' ? (
      <Card maxWidth="md" surface={false}>
        <h1 className="text-center text-2xl font-semibold tracking-tight sm:text-3xl">
          {t('shop.noLongerListed')}
        </h1>
      </Card>
    ) : (
      <div className="flex flex-col items-center gap-4">
        <p role="alert" className="text-center text-sm text-app-danger">
          {t('forum.error')}
        </p>
        <Button type="button" onClick={() => router.refresh()}>
          {t('view.retry')}
        </Button>
      </div>
    );
  }

  const address = props.shop.place.address;
  const street = [address.street, address.houseNumber]
    .filter((part) => part.trim() !== '')
    .join(' ');
  const city = [address.postalCode, address.city].filter((part) => part.trim() !== '').join(' ');
  const addressLines = [street, city, address.country].filter((part) => part.trim() !== '');

  return (
    <Card maxWidth="xl" surface={false}>
      <h1 className="text-center text-2xl font-semibold tracking-tight sm:text-3xl">
        {props.shop.name}
      </h1>
      <p className="w-full whitespace-pre-wrap text-center text-sm text-app-fg">
        {props.shop.description}
      </p>
      <ForumPhotoGallery photos={photos} alt={t('forum.photoAlt', { name: props.shop.name })} />
      <section className="flex w-full flex-col items-stretch gap-3 border-t border-app-border pt-6">
        <h2 className="text-center text-xs tracking-widest text-app-subtle uppercase">
          {t('shop.address')}
        </h2>
        <address className="text-center text-sm text-app-fg not-italic">
          {props.shop.place.label.trim() === '' ? null : <span>{props.shop.place.label}</span>}
          {addressLines.map((line, index) => (
            <span key={`${index}:${line}`} className="block">
              {line}
            </span>
          ))}
        </address>
        {mapsKey !== null ? (
          <GoogleMapCanvas
            mapsKey={mapsKey}
            points={points}
            anchor={points[0]}
            fitAll={false}
            testId="shop-map"
          />
        ) : null}
      </section>
      <section className="flex w-full flex-col items-center gap-3 border-t border-app-border pt-6">
        <Link
          href={`/messages/${props.shop.messageId}`}
          className="text-sm font-medium text-app-fg underline underline-offset-2"
        >
          {t('shop.forumNote')}
        </Link>
      </section>
      {props.shop.nip05 === null ? null : (
        <section className="flex w-full flex-col items-stretch gap-3 border-t border-app-border pt-6">
          <h2 className="text-center text-xs tracking-widest text-app-subtle uppercase">
            {t('forum.externalProfileNip05')}
          </h2>
          <p className="min-w-0 break-all text-center text-sm text-app-fg">{props.shop.nip05}</p>
        </section>
      )}
      <section className="flex w-full flex-col items-stretch gap-3 border-t border-app-border pt-6">
        <h2 className="text-center text-xs tracking-widest text-app-subtle uppercase">
          {t('forum.externalProfileNpub')}
        </h2>
        <p className="min-w-0 break-all text-center text-sm text-app-fg">{props.shop.npub}</p>
        <div className="flex justify-center">
          <NpubCopyButton key={props.shop.npub} npub={props.shop.npub} />
        </div>
      </section>
      {payAddress !== null ? (
        <section className="flex w-full flex-col items-stretch gap-3 border-t border-app-border pt-6">
          <h2 className="text-center text-xs tracking-widest text-app-subtle uppercase">
            {t('profile.giftsHeading')}
          </h2>
          {/* The address and QR use the browser host, so they render after mount. */}
          {showQr && qr !== null ? (
            <>
              <p className="min-w-0 truncate text-center font-mono text-sm text-app-fg">
                {payAddress}
              </p>
              <div className="flex justify-center">
                <QrCode value={qr} label={t('profile.giftsQr')} logo={profileQrLogo} />
              </div>
            </>
          ) : null}
        </section>
      ) : null}
    </Card>
  );
}
