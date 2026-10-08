'use client';

import { Pencil } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import { useTranslations } from '@/components/LocaleProvider';
import { ShopNoteEditControl } from '@/components/ShopNoteEditControl';
import { Button, Card, IconButton } from '@/components/ui';
import { fetchForumMessage, fetchPlaces } from '@/lib/api';
import { logInteraction } from '@/lib/interaction-log';
import type { ForumMessage, ForumPlaceRow } from '@/lib/api-types';
import { isShopNote } from '@/lib/forum-shop';
import { roleAtLeast } from '@/lib/roles';
import { useAuthStore } from '@/stores/auth-store';

type GoogleLatLngBounds = {
  extend: (point: { lat: number; lng: number }) => void;
};

type GoogleMap = {
  setCenter: (center: { lat: number; lng: number }) => void;
  fitBounds: (bounds: GoogleLatLngBounds, padding?: number) => void;
  getZoom: () => number | undefined;
  setZoom: (zoom: number) => void;
};

type GoogleMapsNamespace = {
  Map: new (
    el: HTMLElement,
    opts: { center: { lat: number; lng: number }; zoom: number },
  ) => GoogleMap;
  Marker: new (opts: { position: { lat: number; lng: number }; map: GoogleMap }) => unknown;
  LatLngBounds: new () => GoogleLatLngBounds;
  event?: {
    addListenerOnce: (instance: GoogleMap, eventName: string, handler: () => void) => void;
  };
};

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

type GoogleWindow = Window & {
  google?: { maps?: GoogleMapsNamespace };
  gm_authFailure?: () => void;
};

/** The Maps script while it loads, so a redraw before `onload` waits for the same script. */
let pendingMapsLoad: Promise<void> | null = null;

/**
 * Load the Maps JavaScript API once. Resolves when `google.maps` exists. A call
 * while the script is still loading (a redraw for another country) gets the
 * same promise instead of a second script tag.
 *
 * @param key - Browser key from GET /maps/key. Not logged.
 * @returns Resolves when the script has loaded.
 */
function loadGoogleMaps(key: string): Promise<void> {
  const host = window as GoogleWindow;
  if (host.google?.maps !== undefined) {
    return Promise.resolve();
  }
  if (pendingMapsLoad !== null) {
    return pendingMapsLoad;
  }
  const load = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&v=weekly`;
    script.async = true;
    script.dataset['googleMaps'] = '1';
    script.onload = () => {
      resolve();
    };
    script.onerror = () => {
      reject(new Error('map'));
    };
    document.head.appendChild(script);
  });
  pendingMapsLoad = load;
  const settle = (): void => {
    pendingMapsLoad = null;
  };
  load.then(settle, settle);
  return load;
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
 * shops; `onShopsChanged` runs once after a moderator saves a shop in full.
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
  const { t } = useTranslations();
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
  const frameRef = useRef<HTMLDivElement | null>(null);
  const authFailedRef = useRef(false);

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
    const host = window as GoogleWindow;
    // A rejected key would paint Google's dialog into the frame. Clear it.
    host.gm_authFailure = () => {
      authFailedRef.current = true;
      frameRef.current?.replaceChildren();
    };
    return () => {
      delete host.gm_authFailure;
    };
  }, []);

  useEffect(() => {
    if (session === null) {
      return;
    }
    let cancelled = false;
    const run = async (): Promise<void> => {
      const keyPromise = fetch('/maps/key')
        .then(async (response) => {
          const keyBody: unknown = await response.json();
          if (
            typeof keyBody === 'object' &&
            keyBody !== null &&
            'key' in keyBody &&
            typeof keyBody.key === 'string'
          ) {
            const trimmed = keyBody.key.trim();
            return trimmed === '' ? null : trimmed;
          }
          return null;
        })
        .catch(() => null);
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

  useEffect(() => {
    if (mapsKey === null || places === null || places.length === 0) {
      return;
    }
    const frame = frameRef.current;
    /* v8 ignore next 3 -- the map node is committed before this effect */
    if (frame === null) {
      return;
    }
    let cancelled = false;
    const draw = async (): Promise<void> => {
      if (authFailedRef.current) {
        return;
      }
      try {
        await loadGoogleMaps(mapsKey);
        if (authFailedRef.current) {
          frame.replaceChildren();
          return;
        }
        // A newer draw (another country or pin) owns the frame now.
        if (cancelled) {
          return;
        }
        const maps = (window as GoogleWindow).google?.maps;
        if (maps === undefined) {
          return;
        }
        const matched = pinId === null ? undefined : places.find((row) => row.id === pinId);
        const anchor = matched ?? places[0];
        /* v8 ignore next 3 -- noUncheckedIndexedAccess; a non-empty list has a row */
        if (anchor === undefined) {
          return;
        }
        const frameAll = matched === undefined && places.length > 1;
        const map = new maps.Map(frame, {
          center: { lat: anchor.lat, lng: anchor.lng },
          zoom: frameAll ? 2 : 14,
        });
        if (authFailedRef.current) {
          frame.replaceChildren();
          return;
        }
        for (const row of places) {
          new maps.Marker({ position: { lat: row.lat, lng: row.lng }, map });
        }
        if (!frameAll) {
          map.setCenter({ lat: anchor.lat, lng: anchor.lng });
          return;
        }
        const bounds = new maps.LatLngBounds();
        for (const row of places) {
          bounds.extend({ lat: row.lat, lng: row.lng });
        }
        map.fitBounds(bounds, 32);
        maps.event?.addListenerOnce(map, 'idle', () => {
          if (cancelled) {
            return;
          }
          const zoom = map.getZoom();
          if (typeof zoom === 'number' && zoom > 14) {
            map.setZoom(14);
          }
        });
      } catch {
        /* List stays usable when the script fails. */
      }
    };
    void draw();
    return () => {
      cancelled = true;
    };
  }, [mapsKey, places, pinId]);

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
    body = (
      <div className="flex w-full flex-col gap-3">
        <div
          ref={frameRef}
          data-testid="places-map"
          className="h-64 w-full rounded-2xl border border-app-border bg-app-card-muted"
        />
        <ul className="flex flex-col gap-2">
          {places.map((place) => {
            const label = place.label ?? `${place.lat.toFixed(5)}, ${place.lng.toFixed(5)}`;
            const selected = place.id === pinId;
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
                    <Link href={`/messages/${place.id}`} className="underline">
                      {label}
                    </Link>
                  </span>
                ) : (
                  <Link
                    href={`/messages/${place.id}`}
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
