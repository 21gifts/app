'use client';

import { useRouter } from 'next/navigation';
import { Suspense, useLayoutEffect, useState, type ReactElement } from 'react';
import { ForumLoader } from '@/components/ForumLoader';
import { PlacesMapScreen } from '@/components/PlacesMapScreen';
import { ShopTable } from '@/components/ShopTable';
import { ShopsCountryFilter } from '@/components/ShopsCountryFilter';
import { ShopsViewSwitch, type ShopsView } from '@/components/ShopsViewSwitch';
import { useTranslations } from '@/components/LocaleProvider';
import { Card } from '@/components/ui';
import { shopCountryFromQuery } from '@/lib/shop-country';

/**
 * View named by `/shops#map`, `/shops#table`, or `/shops#post`.
 *
 * @param hash - `location.hash`, with or without `#`.
 * @returns The view, or null when the hash is empty or unknown.
 */
function shopsViewFromHash(hash: string): ShopsView | null {
  const name = hash.replace(/^#/, '').trim().toLowerCase();
  if (name === 'post' || name === 'map' || name === 'table') {
    return name;
  }
  return null;
}

/** Write the shops view into the URL without adding a history entry. Post clears the hash. */
function writeShopsHash(view: ShopsView): void {
  const hash = view === 'post' ? '' : `#${view}`;
  const next = `${window.location.pathname}${window.location.search}${hash}`;
  window.history.replaceState(window.history.state, '', next);
}

/**
 * `/shops` address with `country` set or removed. Other query values and the hash stay.
 *
 * @param country - ISO 3166-1 alpha-2 code, or null for All countries.
 * @returns Path, query, and hash of the current page with that country.
 */
function shopsCountryHref(country: string | null): string {
  const query = new URLSearchParams(window.location.search);
  if (country === null) {
    query.delete('country');
  } else {
    query.set('country', country);
  }
  const search = query.toString();
  return `${window.location.pathname}${search === '' ? '' : `?${search}`}${window.location.hash}`;
}

/**
 * Shops page body: heading, lead, a country filter, and a Post / Map / Table pill.
 *
 * `/shops?country=PH` shows only the shops pinned in that country on every view: the
 * post list and the table load only those shops, and the map keeps only those pins and
 * fits them. A missing or unknown code is All countries. Choosing a country pushes a new
 * history entry with the client-side router, so browser Back and Forward (`popstate`)
 * return to the previous choice. The post list and the table are remounted per country.
 *
 * `/shops#map` and `/shops#table` open that view. A missing or unknown hash opens Post.
 * A plain click on a link to a view of this same page (a place opens `/shops?pin=…#map`)
 * shows that view (no or an unknown hash is Post, as on load), since the client-side push
 * fires no `hashchange`. The push keeps the entry the link was clicked from for browser
 * Back (`popstate`). Links with `target` or `download` are ignored.
 * The view stays unset until the hash is read, so the post list, map, and table mount only after that.
 *
 * @returns The shops column (`Card` `surface={false}`).
 */
export function ShopsScreen(): ReactElement {
  const { t } = useTranslations();
  const router = useRouter();
  const [view, setView] = useState<ShopsView | null>(null);
  const [country, setCountry] = useState<string | null>(null);
  // Bumped when a shop or its pin changes: the filter recounts, and a filtered view reloads.
  const [revision, setRevision] = useState(0);
  const onShopsChanged = (): void => {
    setRevision((n) => n + 1);
  };
  // A filtered view cannot place a new or moved pin itself; it reloads from the api.
  const viewKey = country === null ? 'all' : `${country}:${revision}`;

  useLayoutEffect(() => {
    const apply = (): void => {
      setView(shopsViewFromHash(window.location.hash) ?? 'post');
      setCountry(shopCountryFromQuery(new URLSearchParams(window.location.search).get('country')));
    };
    apply();
    window.addEventListener('hashchange', apply);
    // Browser back and forward between entries of this page that differ in
    // more than the hash fire popstate, not hashchange.
    window.addEventListener('popstate', apply);
    // A link to a view of this page (a place in the post list or the table
    // opens `/shops?pin=…#map`) is a client-side push, which fires no
    // hashchange. Capture runs before next/link prevents the default.
    const onLinkClick = (event: MouseEvent): void => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey ||
        !(event.target instanceof Element)
      ) {
        return;
      }
      const anchor = event.target.closest('a[href]');
      if (
        !(anchor instanceof HTMLAnchorElement) ||
        (anchor.target !== '' && anchor.target !== '_self') ||
        anchor.hasAttribute('download')
      ) {
        return;
      }
      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin || url.pathname !== window.location.pathname) {
        return;
      }
      // Same rule as the hash on load: none or an unknown one is Post. The
      // top-left arrow back to `/shops` carries no hash.
      const next = shopsViewFromHash(url.hash) ?? 'post';
      const nextCountry = shopCountryFromQuery(url.searchParams.get('country'));
      // The router push carries the hash and keeps the entry being left for Back.
      // Switch after this click is dispatched: unmounting the link first would
      // stop next/link from preventing the default document load.
      window.setTimeout(() => {
        setView(next);
        setCountry(nextCountry);
      }, 0);
    };
    document.addEventListener('click', onLinkClick, true);
    return () => {
      window.removeEventListener('hashchange', apply);
      window.removeEventListener('popstate', apply);
      document.removeEventListener('click', onLinkClick, true);
    };
  }, []);

  function selectView(next: ShopsView): void {
    setView(next);
    writeShopsHash(next);
  }

  function selectCountry(next: string | null): void {
    setCountry(next);
    router.push(shopsCountryHref(next), { scroll: false });
  }

  return (
    <Card maxWidth="xl" surface={false}>
      <h1 className="text-center text-2xl font-semibold tracking-tight text-app-fg sm:text-3xl">
        {t('shops.heading')}
      </h1>
      <p className="text-center text-sm text-app-fg">{t('shops.lead')}</p>
      {view !== null ? (
        <ShopsCountryFilter key={revision} value={country} onChange={selectCountry} />
      ) : null}
      {view !== null ? <ShopsViewSwitch value={view} onChange={selectView} /> : null}
      {view === 'post' ? (
        <ForumLoader key={viewKey} feed="shops" country={country} onShopsChanged={onShopsChanged} />
      ) : null}
      {view === 'map' ? (
        <Suspense>
          <PlacesMapScreen
            key={viewKey}
            embedded
            country={country}
            onShopsChanged={onShopsChanged}
          />
        </Suspense>
      ) : null}
      {view === 'table' ? (
        <ShopTable key={viewKey} country={country} onShopsChanged={onShopsChanged} />
      ) : null}
    </Card>
  );
}
