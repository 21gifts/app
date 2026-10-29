'use client';

import { useEffect, useState, type ReactElement } from 'react';
import Link from 'next/link';
import { useTranslations } from '@/components/LocaleProvider';
import { Button } from '@/components/ui';
import { fetchListedShops } from '@/lib/api';
import type { ShopListItem } from '@/lib/api-types';
import { formatPlacePinText } from '@/lib/forum-shop';

/**
 * List of shop pages. A row is the shop name linking to that shop's page.
 *
 * @returns The list, empty copy, or an error with retry.
 */
export function ShopList(): ReactElement {
  const { t, locale } = useTranslations();
  const [rows, setRows] = useState<ShopListItem[] | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadId, setLoadId] = useState(0);
  const [cursor, setCursor] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setFailed(false);
    const pending = cursor === null ? fetchListedShops() : fetchListedShops(cursor);
    void pending
      .then((page) => {
        if (cancelled) {
          return;
        }
        setRows((prev) => (prev === null ? page.shops : [...prev, ...page.shops]));
        setNextCursor(page.nextCursor);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) {
          return;
        }
        setFailed(true);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [loadId, cursor]);

  if (failed && rows === null) {
    return (
      <div className="mt-4 flex flex-col items-center gap-3">
        <p role="alert" className="text-center text-sm text-app-danger">
          {t('shops.loadError')}
        </p>
        <Button
          type="button"
          variant="secondary"
          onClick={() => {
            setCursor(null);
            setRows(null);
            setFailed(false);
            setLoadId((n) => n + 1);
          }}
        >
          {t('forum.retry')}
        </Button>
      </div>
    );
  }

  if (rows === null) {
    return <p className="mt-4 text-center text-sm text-app-muted">{t('map.loading')}</p>;
  }

  if (rows.length === 0 && nextCursor === null) {
    return <p className="mt-4 text-center text-sm text-app-fg">{t('shops.empty')}</p>;
  }

  return (
    <div className="mt-4 w-full min-w-0 max-w-full self-stretch">
      {rows.length === 0 ? null : (
        <ul className="flex w-full min-w-0 list-none flex-col gap-3 p-0 text-sm text-app-fg">
          {rows.map((row) => (
            <li key={row.npub} className="flex min-w-0 flex-col gap-1 break-words">
              <Link href={`/${row.npub}`} className="underline">
                {row.name.trim()}
              </Link>
              {row.place === null ? null : (
                <p className="text-sm text-app-muted">{formatPlacePinText(row.place, locale)}</p>
              )}
            </li>
          ))}
        </ul>
      )}
      {failed ? (
        <div className="mt-3 flex flex-col items-center gap-3">
          <p role="alert" className="text-center text-sm text-app-danger">
            {t('shops.loadError')}
          </p>
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              setFailed(false);
              setLoadId((n) => n + 1);
            }}
          >
            {t('forum.retry')}
          </Button>
        </div>
      ) : null}
      {nextCursor !== null ? (
        <Button
          type="button"
          variant="secondary"
          className="mt-3"
          disabled={loading}
          onClick={() => {
            setCursor(nextCursor);
            setLoadId((n) => n + 1);
          }}
        >
          {t('shops.showMore')}
        </Button>
      ) : null}
    </div>
  );
}
