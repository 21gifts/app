'use client';

import { Suspense, useLayoutEffect, useState, type ReactElement } from 'react';
import { ForumLoader } from '@/components/ForumLoader';
import { PlacesMapScreen } from '@/components/PlacesMapScreen';
import { ShopTable } from '@/components/ShopTable';
import { ShopsViewSwitch, type ShopsView } from '@/components/ShopsViewSwitch';
import { useTranslations } from '@/components/LocaleProvider';
import { Card } from '@/components/ui';

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
 * Shops page body: heading, lead, and a Post / Map / Table pill.
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
  const [view, setView] = useState<ShopsView | null>(null);

  useLayoutEffect(() => {
    const apply = (): void => {
      setView(shopsViewFromHash(window.location.hash) ?? 'post');
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
      // The router push carries the hash and keeps the entry being left for Back.
      // Switch after this click is dispatched: unmounting the link first would
      // stop next/link from preventing the default document load.
      window.setTimeout(() => {
        setView(next);
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

  return (
    <Card maxWidth="xl" surface={false}>
      <h1 className="text-center text-2xl font-semibold tracking-tight text-app-fg sm:text-3xl">
        {t('shops.heading')}
      </h1>
      <p className="text-center text-sm text-app-fg">{t('shops.lead')}</p>
      {view !== null ? <ShopsViewSwitch value={view} onChange={selectView} /> : null}
      {view === 'post' ? <ForumLoader feed="shops" /> : null}
      {view === 'map' ? (
        <Suspense>
          <PlacesMapScreen embedded />
        </Suspense>
      ) : null}
      {view === 'table' ? <ShopTable /> : null}
    </Card>
  );
}
