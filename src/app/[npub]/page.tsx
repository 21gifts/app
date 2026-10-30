import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import { cache, type ReactElement } from 'react';
import { PublicMessageChrome } from '@/components/PublicMessageChrome';
import { ShopScreen } from '@/app/[npub]/ShopScreen';
import { API_FETCH_TIMEOUT_MS } from '@/lib/api-timeout';
import { SHOP_NPUB_RE, shopResponseSchema, type Shop } from '@/lib/api-types';
import { getApiUrl } from '@/lib/config';
import { OG_IMAGE_ALT } from '@/lib/marketing-metadata';
import { ogDescriptionText } from '@/lib/public-message-og';
import { resolveShopPhotoUrl, sameOriginShopPhotoPath } from '@/lib/shop-photo-url';

const HEX_PUBKEY_RE = /^[0-9a-f]{64}$/;

type ShopLoadResult =
  | { kind: 'ready'; shop: Shop }
  | { kind: 'redirect'; npub: string }
  | { kind: 'missing' | 'gone' | 'unavailable' };

/**
 * Read and validate the canonical npub from an api 301 Location header.
 *
 * @param response - Manual-redirect response from `GET /shops/:hex`.
 * @returns The final path segment when it is an npub, otherwise null.
 */
function redirectNpub(response: Response): string | null {
  const location = response.headers.get('location');
  if (location === null) {
    return null;
  }
  try {
    const path = new URL(location, 'https://api.21.gifts').pathname;
    const value = decodeURIComponent(path.slice(path.lastIndexOf('/') + 1));
    return SHOP_NPUB_RE.test(value) ? value : null;
  } catch {
    return null;
  }
}

/**
 * Load one public shop and reduce api statuses to page-safe states.
 *
 * Only an exact answer counts. A hex segment is usable only as a 301 to a
 * valid npub. An npub segment is usable only as a 200 whose `shop.npub` is
 * that same npub. Every other status, a 200 for a hex segment, and a timeout
 * or abort after {@link API_FETCH_TIMEOUT_MS} become `unavailable`; 404 and 410
 * stay `missing` and `gone`. An api forum photo URL becomes the app's own
 * proxy path ({@link sameOriginShopPhotoPath}); any other photo URL goes through
 * {@link resolveShopPhotoUrl} against the api base, and a photo that is not
 * http(s) is dropped, so the page and `og:image` share the same list.
 *
 * Wrapped in React `cache`, so `generateMetadata` and `ShopPage` share one api
 * call and one answer per request.
 *
 * @param segment - Validated npub or lowercase hex public key.
 * @returns Parsed shop, canonical npub, or a display state.
 */
const loadShop = cache(async (segment: string): Promise<ShopLoadResult> => {
  try {
    const apiBase = getApiUrl();
    const response = await fetch(`${apiBase}/shops/${encodeURIComponent(segment)}`, {
      cache: 'no-store',
      headers: { Accept: 'application/json' },
      redirect: 'manual',
      signal: AbortSignal.timeout(API_FETCH_TIMEOUT_MS),
    });
    if (response.status === 301) {
      const npub = redirectNpub(response);
      return npub === null ? { kind: 'unavailable' } : { kind: 'redirect', npub };
    }
    if (response.status === 404) {
      return { kind: 'missing' };
    }
    if (response.status === 410) {
      return { kind: 'gone' };
    }
    if (response.status !== 200 || !SHOP_NPUB_RE.test(segment)) {
      return { kind: 'unavailable' };
    }
    const parsed = shopResponseSchema.safeParse(await response.json());
    if (!parsed.success || parsed.data.shop.npub !== segment) {
      return { kind: 'unavailable' };
    }
    // A relative photo path belongs to the api; only http(s) photos render.
    const photos = parsed.data.shop.photos.flatMap((photo) => {
      const url = sameOriginShopPhotoPath(photo.url, apiBase) ?? resolveShopPhotoUrl(photo.url, apiBase);
      return url === null ? [] : [{ ...photo, url }];
    });
    return { kind: 'ready', shop: { ...parsed.data.shop, photos } };
  } catch {
    return { kind: 'unavailable' };
  }
});

/**
 * Per-shop Open Graph, Twitter, and canonical metadata for `/{npub}`.
 *
 * @param props - Dynamic route params (`npub`).
 * @returns Shop metadata, or an empty object when the shop cannot be loaded.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ npub: string }>;
}): Promise<Metadata> {
  const { npub } = await params;
  if (!SHOP_NPUB_RE.test(npub) && !HEX_PUBKEY_RE.test(npub)) {
    return {};
  }
  const result = await loadShop(npub);
  if (result.kind !== 'ready') {
    return {};
  }
  const firstPhoto = result.shop.photos[0];
  const fallbackImage = {
    url: '/og.png',
    width: 1200,
    height: 630,
    alt: OG_IMAGE_ALT,
  };
  const photoImage =
    firstPhoto === undefined
      ? fallbackImage
      : {
          url: firstPhoto.url,
          alt: result.shop.name,
          ...(firstPhoto.width === null ? {} : { width: firstPhoto.width }),
          ...(firstPhoto.height === null ? {} : { height: firstPhoto.height }),
        };
  const canonical = `/${result.shop.npub}`;
  const description = ogDescriptionText(result.shop.description, result.shop.name);
  return {
    title: result.shop.name,
    description,
    alternates: { canonical },
    openGraph: {
      type: 'website',
      url: canonical,
      siteName: '21.gifts',
      title: result.shop.name,
      description,
      images: [photoImage],
    },
    twitter: {
      card: 'summary_large_image',
      title: result.shop.name,
      description,
      images: [{ url: photoImage.url, alt: photoImage.alt }],
    },
  };
}

/**
 * `/{npub}` public shop identity page, with legacy hex-key canonicalization.
 *
 * @param props - Dynamic route params (`npub`).
 * @returns The shop, unlisted notice, or retryable error inside public chrome.
 */
export default async function ShopPage({
  params,
}: {
  params: Promise<{ npub: string }>;
}): Promise<ReactElement> {
  const { npub } = await params;
  if (!SHOP_NPUB_RE.test(npub) && !HEX_PUBKEY_RE.test(npub)) {
    notFound();
  }
  const result = await loadShop(npub);
  if (result.kind === 'missing') {
    notFound();
  }
  if (result.kind === 'redirect') {
    if (HEX_PUBKEY_RE.test(npub)) {
      permanentRedirect(`/${result.npub}`);
    }
    return (
      <PublicMessageChrome>
        <ShopScreen state="unavailable" />
      </PublicMessageChrome>
    );
  }
  return (
    <PublicMessageChrome>
      {result.kind === 'ready' ? (
        <ShopScreen state="ready" shop={result.shop} />
      ) : (
        <ShopScreen state={result.kind} />
      )}
    </PublicMessageChrome>
  );
}
