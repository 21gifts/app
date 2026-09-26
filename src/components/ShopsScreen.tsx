'use client';

import { Suspense, useState, type ReactElement } from 'react';
import { ForumLoader } from '@/components/ForumLoader';
import { PlacesMapScreen } from '@/components/PlacesMapScreen';
import { ShopTable } from '@/components/ShopTable';
import { ShopsViewSwitch, type ShopsView } from '@/components/ShopsViewSwitch';
import { useTranslations } from '@/components/LocaleProvider';
import { Card } from '@/components/ui';

/**
 * Shops page body: heading, lead, and a Post / Map / Table pill.
 *
 * @returns The shops column (`Card` `surface={false}`).
 */
export function ShopsScreen(): ReactElement {
  const { t } = useTranslations();
  const [view, setView] = useState<ShopsView>('post');

  return (
    <Card maxWidth="xl" surface={false}>
      <h1 className="text-center text-2xl font-semibold tracking-tight text-app-fg sm:text-3xl">
        {t('shops.heading')}
      </h1>
      <p className="text-center text-sm text-app-fg">{t('shops.lead')}</p>
      <ShopsViewSwitch value={view} onChange={setView} />
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
