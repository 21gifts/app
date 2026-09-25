'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState, type ReactElement } from 'react';
import { useTranslations } from '@/components/LocaleProvider';
import { Button, Card } from '@/components/ui';
import { fetchPlaces } from '@/lib/api';
import type { ForumPlaceRow } from '@/lib/api-types';
import { useAuthStore } from '@/stores/auth-store';

type GoogleMap = {
  setCenter: (center: { lat: number; lng: number }) => void;
};

type GoogleMapsNamespace = {
  Map: new (
    el: HTMLElement,
    opts: { center: { lat: number; lng: number }; zoom: number },
  ) => GoogleMap;
  Marker: new (opts: { position: { lat: number; lng: number }; map: GoogleMap }) => unknown;
};

type GoogleWindow = Window & {
  google?: { maps?: GoogleMapsNamespace };
  gm_authFailure?: () => void;
};

/**
 * Load the Maps JavaScript API once. Resolves when `google.maps` exists.
 *
 * @param key - Browser key from GET /maps/key. Not logged.
 * @returns Resolves when the script has loaded.
 */
function loadGoogleMaps(key: string): Promise<void> {
  const host = window as GoogleWindow;
  if (host.google?.maps !== undefined) {
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
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
}

/**
 * Signed-in map of every forum note that has a pin.
 *
 * Without a Google key the places stay a list of links. A key draws the
 * same places as markers and does not replace the list.
 *
 * @returns The map card (loading, error, empty, or places).
 */
export function PlacesMapScreen(): ReactElement {
  const { t } = useTranslations();
  const session = useAuthStore((state) => state.session);
  const [places, setPlaces] = useState<ForumPlaceRow[] | null>(null);
  const [mapsKey, setMapsKey] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const pinId = useSearchParams().get('pin');
  const frameRef = useRef<HTMLDivElement | null>(null);
  const authFailedRef = useRef(false);

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
        if (cancelled || authFailedRef.current) {
          frame.replaceChildren();
          return;
        }
        const maps = (window as GoogleWindow).google?.maps;
        if (maps === undefined) {
          return;
        }
        const focus = places.find((row) => row.id === pinId) ?? places[0];
        /* v8 ignore next 3 -- noUncheckedIndexedAccess; a non-empty list has a row */
        if (focus === undefined) {
          return;
        }
        const map = new maps.Map(frame, {
          center: { lat: focus.lat, lng: focus.lng },
          zoom: 14,
        });
        if (authFailedRef.current) {
          frame.replaceChildren();
          return;
        }
        for (const row of places) {
          new maps.Marker({ position: { lat: row.lat, lng: row.lng }, map });
        }
        map.setCenter({ lat: focus.lat, lng: focus.lng });
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
              <li key={place.id}>
                <a
                  href={`/messages/${place.id}`}
                  data-selected={selected ? 'true' : 'false'}
                  className={`text-sm underline ${selected ? 'font-semibold text-app-fg' : 'text-app-fg'}`}
                >
                  {place.name} · {label}
                </a>
              </li>
            );
          })}
        </ul>
      </div>
    );
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
