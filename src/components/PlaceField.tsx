'use client';

import { MapPin, X } from 'lucide-react';
import { useEffect, useRef, useState, type ReactElement } from 'react';
import { useTranslations } from '@/components/LocaleProvider';
import { Button, IconButton } from '@/components/ui';
import type { ForumPlacePin } from '@/lib/api-types';

type GoogleLatLng = {
  lat: () => number;
  lng: () => number;
};

type GoogleMapMouseEvent = {
  latLng: GoogleLatLng | null;
};

type GoogleMap = {
  setCenter: (center: { lat: number; lng: number }) => void;
  addListener: (event: string, handler: (event: GoogleMapMouseEvent) => void) => void;
};

type GoogleMarker = {
  setPosition: (pos: { lat: number; lng: number }) => void;
  getPosition: () => GoogleLatLng | null;
  addListener: (event: string, handler: () => void) => void;
};

type GoogleMapsNamespace = {
  Map: new (
    el: HTMLElement,
    opts: { center: { lat: number; lng: number }; zoom: number },
  ) => GoogleMap;
  Marker: new (opts: {
    position: { lat: number; lng: number };
    map: GoogleMap;
    draggable: boolean;
  }) => GoogleMarker;
};

type GoogleWindow = Window & {
  google?: { maps?: GoogleMapsNamespace };
  gm_authFailure?: () => void;
};

const START_CENTER = { lat: 20, lng: 0 };

/**
 * Optional place pin control for a top-level forum composer or staff editor.
 *
 * @param props - Current pin, disabled flag, change handler, and optional
 * staff-commit overrides (size, variant, preview, label, `onCommit`).
 * @returns Attach button, optional preview, and map panel.
 */
export function PlaceField(props: {
  place: ForumPlacePin | null;
  disabled: boolean;
  onChange: (place: ForumPlacePin | null) => void;
  buttonSize?: 'lg' | 'sm';
  buttonVariant?: 'secondary' | 'ghost';
  showPreview?: boolean;
  ariaLabel?: string;
  onCommit?: (place: ForumPlacePin | null) => Promise<void>;
}): ReactElement {
  const { t } = useTranslations();
  const buttonSize = props.buttonSize ?? 'lg';
  const buttonVariant = props.buttonVariant ?? 'secondary';
  const showPreview = props.showPreview ?? true;
  const ariaLabel = props.ariaLabel ?? t('forum.addPlace');
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const [scriptReady, setScriptReady] = useState(false);
  const [mapsKey, setMapsKey] = useState<string | null>(null);
  const [labelDraft, setLabelDraft] = useState('');
  const [markerPos, setMarkerPos] = useState<{ lat: number; lng: number } | null>(null);
  const mapElRef = useRef<HTMLDivElement | null>(null);
  const markerRef = useRef<GoogleMarker | null>(null);
  const authFailedRef = useRef(false);

  useEffect(() => {
    if (props.disabled) {
      setOpen(false);
    }
  }, [props.disabled]);

  useEffect(() => {
    if (!open) {
      return;
    }
    let cancelled = false;
    const load = async (): Promise<void> => {
      try {
        const response = await fetch('/maps/key');
        const body: unknown = await response.json();
        if (cancelled) {
          return;
        }
        let nextKey: string | null = null;
        if (typeof body === 'object' && body !== null && 'key' in body) {
          const raw = body.key;
          if (typeof raw === 'string') {
            const trimmed = raw.trim();
            if (trimmed !== '') {
              nextKey = trimmed;
            }
          }
        }
        if (nextKey === null) {
          setMapsKey(null);
          setUnavailable(true);
          setScriptReady(false);
          return;
        }
        setMapsKey(nextKey);
        const googleWindow = window as GoogleWindow;
        // A rejected key stays rejected. Google still defines `google.maps`.
        const rejectKey = (): void => {
          authFailedRef.current = true;
          if (cancelled) {
            return;
          }
          setUnavailable(true);
          setScriptReady(false);
        };
        const acceptKey = (): void => {
          if (cancelled || authFailedRef.current) {
            if (!cancelled && authFailedRef.current) {
              setUnavailable(true);
              setScriptReady(false);
            }
            return;
          }
          setUnavailable(false);
          setScriptReady(true);
        };
        googleWindow.gm_authFailure = rejectKey;
        if (googleWindow.google?.maps !== undefined) {
          acceptKey();
          return;
        }
        const existing = document.querySelector('script[data-gmaps="weekly"]');
        const onLoad = (): void => {
          if (cancelled) {
            return;
          }
          if (googleWindow.google?.maps === undefined || authFailedRef.current) {
            if (existing instanceof HTMLScriptElement) {
              existing.dataset['gmapsState'] = 'error';
            }
            setUnavailable(true);
            setScriptReady(false);
            return;
          }
          acceptKey();
        };
        const onError = (): void => {
          if (cancelled) {
            return;
          }
          if (existing instanceof HTMLScriptElement) {
            existing.dataset['gmapsState'] = 'error';
          }
          setUnavailable(true);
          setScriptReady(false);
        };
        if (existing instanceof HTMLScriptElement) {
          if (existing.dataset['gmapsState'] === 'error' || authFailedRef.current) {
            setUnavailable(true);
            setScriptReady(false);
            return;
          }
          setUnavailable(false);
          existing.addEventListener('load', onLoad);
          existing.addEventListener('error', onError);
          return;
        }
        if (authFailedRef.current) {
          setUnavailable(true);
          setScriptReady(false);
          return;
        }
        setUnavailable(false);
        const script = document.createElement('script');
        script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(nextKey)}&v=weekly`;
        script.dataset['gmaps'] = 'weekly';
        script.addEventListener('load', () => {
          if (googleWindow.google?.maps === undefined) {
            script.dataset['gmapsState'] = 'error';
          }
          onLoad();
        });
        script.addEventListener('error', () => {
          script.dataset['gmapsState'] = 'error';
          onError();
        });
        document.head.appendChild(script);
      } catch {
        if (!cancelled) {
          setMapsKey(null);
          setUnavailable(true);
          setScriptReady(false);
        }
      }
    };
    void load();
    return () => {
      cancelled = true;
      // Keep the rejection if Google calls back after the panel closes.
      (window as GoogleWindow).gm_authFailure = () => {
        authFailedRef.current = true;
      };
    };
  }, [open]);

  useEffect(() => {
    if (authFailedRef.current) {
      return;
    }
    if (!open || unavailable || mapsKey === null || !scriptReady) {
      return;
    }
    const el = mapElRef.current;
    /* v8 ignore next 3 -- the map node is committed before this effect */
    if (el === null) {
      return;
    }
    const maps = (window as GoogleWindow).google?.maps;
    if (maps === undefined) {
      return;
    }
    const saved = props.place;
    const map = new maps.Map(el, { center: saved ?? START_CENTER, zoom: 2 });
    if (authFailedRef.current) {
      el.replaceChildren();
      return;
    }
    markerRef.current = null;
    setMarkerPos(saved === null ? null : { lat: saved.lat, lng: saved.lng });
    setLabelDraft(saved?.label ?? '');
    if (saved !== null) {
      const savedMarker = new maps.Marker({
        position: { lat: saved.lat, lng: saved.lng },
        map,
        draggable: true,
      });
      savedMarker.addListener('dragend', () => {
        const next = savedMarker.getPosition();
        if (next === null) {
          return;
        }
        setMarkerPos({ lat: next.lat(), lng: next.lng() });
      });
      markerRef.current = savedMarker;
    }
    map.addListener('click', (event: GoogleMapMouseEvent) => {
      if (event.latLng === null) {
        return;
      }
      const pos = { lat: event.latLng.lat(), lng: event.latLng.lng() };
      if (markerRef.current !== null) {
        markerRef.current.setPosition(pos);
      } else {
        const marker = new maps.Marker({ position: pos, map, draggable: true });
        marker.addListener('dragend', () => {
          const next = marker.getPosition();
          if (next === null) {
            return;
          }
          setMarkerPos({ lat: next.lat(), lng: next.lng() });
        });
        markerRef.current = marker;
      }
      setMarkerPos(pos);
    });
    if (saved === null && navigator.geolocation !== undefined) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          map.setCenter({ lat: position.coords.latitude, lng: position.coords.longitude });
        },
        () => {
          map.setCenter(START_CENTER);
        },
      );
    }
  }, [open, unavailable, mapsKey, scriptReady, props.place]);

  const previewText =
    props.place === null
      ? ''
      : (props.place.label ?? `${props.place.lat.toFixed(5)}, ${props.place.lng.toFixed(5)}`);

  async function commit(next: ForumPlacePin | null): Promise<void> {
    if (props.onCommit === undefined) {
      props.onChange(next);
      setOpen(false);
      return;
    }
    setSaving(true);
    setSaveError(false);
    try {
      await props.onCommit(next);
      setOpen(false);
    } catch {
      setSaveError(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="relative shrink-0">
      <IconButton
        type="button"
        size={buttonSize}
        variant={buttonVariant}
        aria-label={ariaLabel}
        title={ariaLabel}
        aria-expanded={open}
        disabled={props.disabled}
        onClick={() => {
          setOpen((current) => !current);
        }}
      >
        <MapPin
          aria-hidden="true"
          className={buttonSize === 'sm' ? 'h-4 w-4 shrink-0' : 'block h-5 w-5 shrink-0'}
        />
      </IconButton>
      {showPreview && props.place !== null && !open ? (
        <div className="absolute left-0 top-full z-20 mt-2 flex w-64 items-start gap-3 rounded-2xl border border-app-border bg-app-card-muted p-3">
          <MapPin aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
          <span className="min-w-0 flex-1 text-sm text-app-fg">{previewText}</span>
          <IconButton
            type="button"
            size="sm"
            variant="secondary"
            aria-label={t('forum.placeRemove')}
            disabled={props.disabled || saving}
            onClick={() => {
              void commit(null);
            }}
          >
            <X aria-hidden="true" className="h-4 w-4" />
          </IconButton>
        </div>
      ) : null}
      {open && !props.disabled && (unavailable || mapsKey !== null) ? (
        <div className="absolute left-0 top-full z-30 mt-2 w-[min(90vw,24rem)] rounded-2xl border border-app-border bg-app-card-muted p-3">
          {unavailable ? (
            <p className="text-sm text-app-muted">{t('forum.placeUnavailable')}</p>
          ) : (
            <>
              <div ref={mapElRef} className="h-64 w-full rounded-xl" />
              <input
                type="text"
                maxLength={80}
                aria-label={t('forum.placeLabel')}
                value={labelDraft}
                disabled={props.disabled}
                onChange={(event) => {
                  setLabelDraft(event.target.value);
                }}
                className="mt-3 w-full rounded-2xl border border-app-border-strong px-4 py-2.5 text-base text-app-fg"
              />
              {saveError ? (
                <p role="alert" className="mt-3 text-sm text-app-danger">
                  {t('forum.placeSaveFailed')}
                </p>
              ) : null}
              {markerPos !== null ? (
                <Button
                  type="button"
                  variant="secondary"
                  className="mt-3"
                  disabled={props.disabled || saving}
                  onClick={() => {
                    const trimmed = labelDraft.trim();
                    void commit({
                      lat: markerPos.lat,
                      lng: markerPos.lng,
                      label: trimmed === '' ? null : trimmed,
                    });
                  }}
                >
                  {t('forum.placeDone')}
                </Button>
              ) : null}
              {props.onCommit !== undefined && !showPreview && props.place !== null ? (
                <IconButton
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="mt-3"
                  aria-label={t('forum.placeRemove')}
                  disabled={props.disabled || saving}
                  onClick={() => {
                    void commit(null);
                  }}
                >
                  <X aria-hidden="true" className="h-4 w-4" />
                </IconButton>
              ) : null}
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
