'use client';

import { Pencil } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState, type ReactElement } from 'react';
import { GoogleMapCanvas } from '@/components/GoogleMapCanvas';
import { useTranslations } from '@/components/LocaleProvider';
import { ShopNoteEditControl } from '@/components/ShopNoteEditControl';
import { Button, Card, IconButton } from '@/components/ui';
import { fetchForumMessage, fetchPlaces } from '@/lib/api';
import { logInteraction } from '@/lib/interaction-log';
import type { ForumMessage, ForumPlaceRow } from '@/lib/api-types';
import { formatPlacePinText, isShopNote } from '@/lib/forum-shop';
import { fetchMapsKey } from '@/lib/maps-key';
import { roleAtLeast } from '@/lib/roles';
import { useAuthStore } from '@/stores/auth-store';

function ShopPinEdit({
  placeId,
  onUpdated,
  onSaved,
}: {
  placeId: string;
  onUpdated: (message: ForumMessage) => void;
  onSaved?: (() => void) | undefined;
}): ReactElement | null {
  const session = useAuthStore((state) => state.session);
  const account = useAuthStore((state) => state.account);
  const { t } = useTranslations();
  const [message, setMessage] = useState<ForumMessage | null>(null);
  const [failed, setFailed] = useState(false);
  if (session === null || !roleAtLeast(account?.role, 'moderator')) {
    return null;
  }
  if (message !== null) {
    return (
      <div className="w-full min-w-0 basis-full">
        <ShopNoteEditControl
          message={message}
          startOpen
          {...(onSaved !== undefined ? { onSaved } : {})}
          onUpdated={(updated) => {
            setMessage(updated);
            onUpdated(updated);
          }}
        />
      </div>
    );
  }
  return (
    <span className="inline-flex items-center gap-2">
      <IconButton
        type="button"
        size="sm"
        variant="ghost"
        aria-label={t('forum.editShopNote')}
        title={t('forum.editShopNote')}
        onClick={() => {
          void fetchForumMessage(session, placeId)
            .then((loaded) => {
              if (loaded === null || !isShopNote(loaded.text)) {
                setFailed(true);
                return;
              }
              setFailed(false);
              setMessage(loaded);
            })
            .catch(() => {
              setFailed(true);
            });
        }}
      >
        <Pencil aria-hidden="true" className="h-3.5 w-3.5" />
      </IconButton>
      {failed ? (
        <p role="alert" className="text-xs text-app-danger">
          {t('forum.editShopNoteLoadFailed')}
        </p>
      ) : null}
    </span>
  );
}

/**
 * Signed-in map of every forum note that has a pin.
 *
 * Without a Google key the places stay a list of links. A key draws the
 * same places as markers and does not replace the list. With a country, the
 * list and the markers keep only the shop pins in that country (`shop` and
 * `countryCode`, the same pins the country filter counts) and the map fits
 * those pins; none left is the empty copy.
 *
 * @param props - `embedded` omits the Map heading and card so `/shops` can reuse the body;
 * `country` (ISO 3166-1 alpha-2, or null for every pin) narrows the pins to that country's
 * shops; `onShopsChanged` runs once per moderator shop save (complete, or partly written
 * once its editor closes or unmounts).
 * @returns The map card, or only the body when `embedded` is true.
 */
export function PlacesMapScreen({
  embedded = false,
  country = null,
  onShopsChanged,
}: {
  embedded?: boolean;
  country?: string | null;
  onShopsChanged?: () => void;
} = {}): ReactElement {
  const { t, locale } = useTranslations();
  const session = useAuthStore((state) => state.session);
  const [loadedPlaces, setPlaces] = useState<ForumPlaceRow[] | null>(null);
  const places = useMemo(
    () =>
      loadedPlaces === null || country === null
        ? loadedPlaces
        : loadedPlaces.filter((row) => row.shop === true && row.countryCode === country),
    [loadedPlaces, country],
  );
  const [mapsKey, setMapsKey] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const pinId = useSearchParams().get('pin');
  const openedShop =
    pinId !== null && places?.some((row) => row.id === pinId && row.shop === true) === true
      ? pinId
      : null;
  useEffect(() => {
    if (openedShop !== null) {
      logInteraction('shop_opened', { placeId: openedShop });
    }
  }, [openedShop]);
  useEffect(() => {
    if (session === null) {
      return;
    }
    let cancelled = false;
    const run = async (): Promise<void> => {
      const keyPromise = fetchMapsKey();
      try {
        const [rows, key] = await Promise.all([fetchPlaces(session), keyPromise]);
        if (cancelled) {
          return;
        }
        setPlaces(rows);
        setMapsKey(key);
      } catch {
        if (!cancelled) {
          setFailed(true);
          setPlaces(null);
        }
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [session, attempt]);

  let body: ReactElement;
  if (failed) {
    body = (
      <div className="flex flex-col items-center gap-3">
        <p role="alert" className="text-center text-sm text-app-danger">
          {t('map.error')}
        </p>
        <Button
          type="button"
          variant="secondary"
          onClick={() => {
            setFailed(false);
            setPlaces(null);
            setAttempt((n) => n + 1);
          }}
        >
          {t('forum.retry')}
        </Button>
      </div>
    );
  } else if (places === null) {
    body = <p className="text-center text-sm text-app-muted">{t('map.loading')}</p>;
  } else if (places.length === 0) {
    body = <p className="text-center text-sm text-app-muted">{t('map.empty')}</p>;
  } else {
    const matched = pinId === null ? undefined : places.find((row) => row.id === pinId);
    const anchor = matched ?? places[0];
    const frameAll = matched === undefined && places.length > 1;
    body = (
      <div className="flex w-full flex-col gap-3">
        <GoogleMapCanvas
          mapsKey={mapsKey}
          points={places}
          anchor={anchor}
          fitAll={frameAll}
          testId="places-map"
        />
        <ul className="flex flex-col gap-2">
          {places.map((place) => {
            const label = formatPlacePinText(place, locale);
            const selected = place.id === pinId;
            const href = place.shopNpub === null ? `/messages/${place.id}` : `/${place.shopNpub}`;
            return (
              <li
                key={place.id}
                className="flex w-full min-w-0 flex-wrap items-start justify-between gap-2"
              >
                {typeof place.accountId === 'string' && place.accountId !== '' ? (
                  <span
                    data-selected={selected ? 'true' : 'false'}
                    className={`min-w-0 max-w-full break-words text-sm ${selected ? 'font-semibold text-app-fg' : 'text-app-fg'}`}
                  >
                    <Link
                      href={`/members/${place.accountId}`}
                      aria-label={t('forum.authorProfile')}
                      className="underline underline-offset-2"
                    >
                      {place.name}
                    </Link>
                    {' · '}
                    <Link href={href} className="underline">
                      {label}
                    </Link>
                  </span>
                ) : (
                  <Link
                    href={href}
                    data-selected={selected ? 'true' : 'false'}
                    className={`min-w-0 max-w-full break-words text-sm underline ${selected ? 'font-semibold text-app-fg' : 'text-app-fg'}`}
                  >
                    {place.name} · {label}
                  </Link>
                )}
                {place.shop === true ? (
                  <ShopPinEdit
                    placeId={place.id}
                    onSaved={onShopsChanged}
                    onUpdated={(updated) => {
                      const pin = updated.place;
                      setPlaces((current) => {
                        /* v8 ignore next 3 -- the list is on screen before a pin editor can save */
                        if (current === null) {
                          return current;
                        }
                        if (pin === undefined) {
                          return current.filter((row) => row.id !== updated.id);
                        }
                        return current.map((row) =>
                          row.id === updated.id
                            ? {
                                ...row,
                                lat: pin.lat,
                                lng: pin.lng,
                                label: pin.label ?? null,
                                address: pin.address ?? null,
                                shopNpub:
                                  updated.shopNpub === undefined ? row.shopNpub : updated.shopNpub,
                              }
                            : row,
                        );
                      });
                    }}
                  />
                ) : null}
              </li>
            );
          })}
        </ul>
      </div>
    );
  }

  if (embedded) {
    return body;
  }

  return (
    <Card maxWidth="xl" surface={false}>
      <h1 className="text-center text-2xl font-semibold tracking-tight text-app-fg sm:text-3xl">
        {t('map.heading')}
      </h1>
      {body}
    </Card>
  );
}
