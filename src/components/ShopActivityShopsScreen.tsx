'use client';

import Link from 'next/link';
import { useEffect, useState, type ReactElement } from 'react';
import { useTranslations } from '@/components/LocaleProvider';
import { Button, Card } from '@/components/ui';
import { fetchShopActivityShops } from '@/lib/api';
import type { ShopActivityShops } from '@/lib/api-types';
import { roleAtLeast } from '@/lib/roles';
import { useAuthStore } from '@/stores/auth-store';

/**
 * Formats a UTC calendar day with day, month, and year.
 *
 * @param day - UTC `YYYY-MM-DD`.
 * @param locale - Active UI locale.
 * @returns Locale date in the UTC zone.
 */
function formatChargeDay(day: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeZone: 'UTC' }).format(
    new Date(`${day}T00:00:00.000Z`),
  );
}

/**
 * Signed-in staff table of POS activity per shop.
 *
 * Moderators fetch {@link fetchShopActivityShops} and see one row per shop in
 * the api order: shop name (linked to `/{npub}` when set), till account
 * (`@username`, otherwise the account id), active days out of the window, and the last charge day. A shop with no
 * active day is marked inactive. Other signed-in visitors, and staff the api
 * answers with 403, see a short forbidden message and no table. Renders
 * nothing without a session. The page chrome owns the back; this screen
 * renders none.
 *
 * @returns The shop table card, forbidden copy, or `null` without a session.
 */
export function ShopActivityShopsScreen(): ReactElement | null {
  const { t, locale } = useTranslations();
  const session = useAuthStore((state) => state.session);
  const account = useAuthStore((state) => state.account);
  const staff = roleAtLeast(account?.role, 'moderator');
  const [table, setTable] = useState<ShopActivityShops | null>(null);
  const [tableError, setTableError] = useState<'forbidden' | 'error' | null>(null);
  const [tableAttempt, setTableAttempt] = useState(0);

  useEffect(() => {
    if (session === null || !staff) {
      return;
    }
    let cancelled = false;
    setTableError(null);
    void (async () => {
      try {
        const next = await fetchShopActivityShops(session);
        if (cancelled) {
          return;
        }
        setTable(next);
      } catch (err) {
        if (cancelled) {
          return;
        }
        setTable(null);
        setTableError(
          err instanceof Error && err.message === 'moderate.forbidden' ? 'forbidden' : 'error',
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [session, staff, tableAttempt]);

  if (session === null) {
    return null;
  }

  const heading = (
    <h1 className="text-center text-2xl font-semibold tracking-tight text-app-fg sm:text-3xl">
      {t('moderate.shops.heading')}
    </h1>
  );

  if (!staff || tableError === 'forbidden') {
    return (
      <Card maxWidth="xl" surface={false}>
        {heading}
        <p className="text-center text-sm text-app-muted">{t('moderate.forbidden')}</p>
      </Card>
    );
  }

  let body: ReactElement;
  if (tableError === 'error') {
    body = (
      <>
        <p role="alert" className="text-center text-sm text-app-danger">
          {t('moderate.shops.error')}
        </p>
        <Button
          type="button"
          variant="secondary"
          onClick={() => {
            setTableAttempt((n) => n + 1);
          }}
        >
          {t('moderate.retry')}
        </Button>
      </>
    );
  } else if (table === null) {
    body = <p className="text-center text-sm text-app-muted">{t('moderate.loading')}</p>;
  } else if (table.shops.length === 0) {
    body = <p className="text-center text-sm text-app-muted">{t('moderate.shops.empty')}</p>;
  } else {
    const days = String(table.windowDays);
    const unnamed = t('moderate.unnamed');
    body = (
      <>
        <p className="text-sm text-app-muted">{t('moderate.shops.lead', { days })}</p>
        <div className="w-full">
          <table
            aria-label={t('moderate.shops.heading')}
            className="w-full table-fixed border-collapse text-sm"
          >
            <thead>
              <tr>
                <th
                  scope="col"
                  className="w-[30%] bg-app-card px-2 py-2 text-left font-medium text-app-fg"
                >
                  {t('moderate.shops.column.shop')}
                </th>
                <th scope="col" className="w-[26%] px-2 py-2 text-left font-medium text-app-fg">
                  {t('moderate.shops.column.account')}
                </th>
                <th scope="col" className="w-[20%] px-2 py-2 text-left font-medium text-app-fg">
                  {t('moderate.shops.column.activeDays')}
                </th>
                <th scope="col" className="px-2 py-2 text-left font-medium text-app-fg">
                  {t('moderate.shops.column.lastCharge')}
                </th>
              </tr>
            </thead>
            <tbody>
              {table.shops.map((shop) => {
                const label = shop.name.trim() !== '' ? shop.name.trim() : unnamed;
                const inactive = shop.activeDays === 0;
                return (
                  <tr key={shop.noteId} className="border-t border-app-border">
                    <th
                      scope="row"
                      className="overflow-hidden bg-app-card px-2 py-2 text-left font-medium text-app-fg"
                    >
                      {shop.npub !== null ? (
                        <Link
                          href={`/${shop.npub}`}
                          className="block truncate text-sm font-medium text-app-fg underline underline-offset-2"
                        >
                          {label}
                        </Link>
                      ) : (
                        <span className="block truncate">{label}</span>
                      )}
                    </th>
                    <td className="overflow-hidden px-2 py-2 text-app-fg">
                      {shop.username !== null ? (
                        <span className="block truncate">@{shop.username}</span>
                      ) : (
                        <span className="block truncate text-app-muted">{shop.accountId}</span>
                      )}
                    </td>
                    <td
                      className={`px-2 py-2 tabular-nums lining-nums ${
                        inactive ? 'font-semibold text-app-danger' : 'text-app-fg'
                      }`}
                    >
                      <span className="block">
                        {t('moderate.shops.activeDays', {
                          count: String(shop.activeDays),
                          days,
                        })}
                      </span>
                      {inactive ? (
                        <span className="block text-xs">{t('moderate.shops.inactive')}</span>
                      ) : null}
                    </td>
                    <td className="px-2 py-2 text-app-fg">
                      {shop.lastChargeDay !== null ? (
                        formatChargeDay(shop.lastChargeDay, locale)
                      ) : (
                        <span className="text-app-muted">{t('moderate.shops.never')}</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </>
    );
  }

  return (
    <Card maxWidth="xl" surface={false}>
      {heading}
      {body}
    </Card>
  );
}
