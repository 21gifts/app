'use client';

import { useEffect, useRef, type ReactElement } from 'react';
import { loadGoogleMaps, onGoogleMapsAuthFailure } from '@/lib/google-maps-loader';

/** One latitude/longitude shown on {@link GoogleMapCanvas}. */
export interface GoogleMapPoint {
  /** Latitude in degrees. */
  lat: number;
  /** Longitude in degrees. */
  lng: number;
}

type GoogleLatLngBounds = {
  extend: (point: GoogleMapPoint) => void;
};

type GoogleMap = {
  setCenter: (center: GoogleMapPoint) => void;
  fitBounds: (bounds: GoogleLatLngBounds, padding?: number) => void;
  getZoom: () => number | undefined;
  setZoom: (zoom: number) => void;
};

type GoogleMapsNamespace = {
  Map: new (el: HTMLElement, opts: { center: GoogleMapPoint; zoom: number }) => GoogleMap;
  Marker: new (opts: { position: GoogleMapPoint; map: GoogleMap }) => unknown;
  LatLngBounds: new () => GoogleLatLngBounds;
  event?: {
    addListenerOnce: (instance: GoogleMap, eventName: string, handler: () => void) => void;
  };
};

type GoogleWindow = Window & {
  google?: { maps?: GoogleMapsNamespace };
};

/** Props for {@link GoogleMapCanvas}. */
export interface GoogleMapCanvasProps {
  /** Browser key, or null to leave the frame empty. */
  mapsKey: string | null;
  /** Marker coordinates. */
  points: ReadonlyArray<GoogleMapPoint>;
  /** Point used for the initial center. */
  anchor: GoogleMapPoint | undefined;
  /** Fit every marker instead of staying on the anchor. */
  fitAll: boolean;
  /** Stable test id for the map frame. */
  testId: string;
  /**
   * Called when the map cannot be drawn: the script fails, `google.maps` is
   * missing after load, or Google rejects the key. Not called for a null key.
   */
  onUnavailable?: () => void;
}

/**
 * Shared Google Maps canvas for the places list and one public shop marker.
 *
 * @param props - Key, marker points, anchor, fit mode, test id, and failure callback.
 * @returns A bounded map frame; without a key, or after a failure, it stays empty.
 */
export function GoogleMapCanvas({
  mapsKey,
  points,
  anchor,
  fitAll,
  testId,
  onUnavailable,
}: GoogleMapCanvasProps): ReactElement {
  const frameRef = useRef<HTMLDivElement | null>(null);
  const authFailedRef = useRef(false);
  // The latest callback, so an inline caller function does not redraw the map.
  const onUnavailableRef = useRef(onUnavailable);

  useEffect(() => {
    onUnavailableRef.current = onUnavailable;
  }, [onUnavailable]);

  useEffect(
    () =>
      // A rejected key would paint Google's dialog into the frame. Clear it.
      onGoogleMapsAuthFailure(() => {
        authFailedRef.current = true;
        frameRef.current?.replaceChildren();
        onUnavailableRef.current?.();
      }),
    [],
  );

  useEffect(() => {
    if (mapsKey === null || points.length === 0 || anchor === undefined) {
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
        // A newer draw (other points, such as another country) owns the frame now.
        if (cancelled) {
          return;
        }
        const maps = (window as GoogleWindow).google?.maps;
        if (maps === undefined) {
          onUnavailableRef.current?.();
          return;
        }
        const map = new maps.Map(frame, {
          center: { lat: anchor.lat, lng: anchor.lng },
          zoom: fitAll ? 2 : 14,
        });
        if (authFailedRef.current) {
          frame.replaceChildren();
          return;
        }
        for (const point of points) {
          new maps.Marker({ position: { lat: point.lat, lng: point.lng }, map });
        }
        if (!fitAll) {
          map.setCenter({ lat: anchor.lat, lng: anchor.lng });
          return;
        }
        const bounds = new maps.LatLngBounds();
        for (const point of points) {
          bounds.extend({ lat: point.lat, lng: point.lng });
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
        // The caller's text content stays usable when the script fails.
        if (!cancelled) {
          onUnavailableRef.current?.();
        }
      }
    };
    void draw();
    return () => {
      cancelled = true;
    };
  }, [anchor, fitAll, mapsKey, points]);

  return (
    <div
      ref={frameRef}
      data-testid={testId}
      className="h-64 w-full rounded-2xl border border-app-border bg-app-card-muted"
    />
  );
}
