import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import type { ReactElement } from 'react';
import { PublicMessageChrome } from '@/components/PublicMessageChrome';
import { ShopScreen } from '@/components/ShopScreen';
import { SHOP_NPUB_RE, shopResponseSchema, type Shop } from '@/lib/api-types';
import { getApiUrl } from '@/lib/config';

const HEX_PUBKEY_RE = /^[0-9a-f]{64}$/;
const DEFAULT_OG_ALT = '21.gifts — peer-to-peer Bitcoin gifts';

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
 * @param segment - Validated npub or lowercase hex public key.
 * @param signal - Optional metadata timeout signal.
 * @returns Parsed shop, canonical npub, or a display state.
 */
async function loadShop(segment: string, signal?: AbortSignal): Promise<ShopLoadResult> {
  try {
    const response = await fetch(`${getApiUrl()}/shops/${encodeURIComponent(segment)}`, {
      cache: 'no-store',
      headers: { Accept: 'application/json' },
      redirect: 'manual',
      ...(signal === undefined ? {} : { signal }),
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
    if (!response.ok) {
      return { kind: 'unavailable' };
    }
    const parsed = shopResponseSchema.safeParse(await response.json());
    return parsed.success ? { kind: 'ready', shop: parsed.data.shop } : { kind: 'unavailable' };
  } catch {
    return { kind: 'unavailable' };
  }
}

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
  const result = await loadShop(npub, AbortSignal.timeout(2500));
  if (result.kind !== 'ready') {
    return {};
  }
  const firstPhoto = result.shop.photos[0];
  const fallbackImage = {
    url: '/og.png',
    width: 1200,
    height: 630,
    alt: DEFAULT_OG_ALT,
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
  return {
    title: result.shop.name,
    description: result.shop.description,
    alternates: { canonical },
    openGraph: {
      type: 'website',
      url: canonical,
      siteName: '21.gifts',
      title: result.shop.name,
      description: result.shop.description,
      images: [photoImage],
    },
    twitter: {
      card: 'summary_large_image',
      title: result.shop.name,
      description: result.shop.description,
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
