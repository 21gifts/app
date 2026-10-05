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
    return () => {
      window.removeEventListener('hashchange', apply);
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
      {view === 'table' ? (
        <ShopTable
          onShowMap={() => {
            selectView('map');
          }}
        />
      ) : null}
    </Card>
  );
}
