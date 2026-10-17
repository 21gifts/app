'use client';

import { MapPin, X } from 'lucide-react';
import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactElement,
} from 'react';
import { createPortal } from 'react-dom';
import { SundayWritingGate, useLocalSunday } from '@/components/SundayWritingGate';
import { useTranslations } from '@/components/LocaleProvider';
import { ShopAddressFields, type ForumPlaceAddressDraft } from '@/components/ShopAddressFields';
import { Button, IconButton } from '@/components/ui';
import { Scrollport } from '@/components/ui/Scrollport';
import type { ForumPlaceAddress, ForumPlacePin } from '@/lib/api-types';
import {
  SHOP_API_MESSAGE,
  formatPlacePinText,
  shopAddressProblem,
  shopApiProblem,
  shopNameProblem,
} from '@/lib/forum-shop';
import type { MessageKey } from '@/lib/messages';
import { fitBoxInFrame, type PlacedFrameBox } from '@/lib/page-frame';

const EMPTY_ADDRESS: ForumPlaceAddressDraft = {
  street: '',
  houseNumber: '',
  postalCode: '',
  city: '',
  country: '',
};

const SHOP_NAME_CONTROL_CLASS = [
  'w-full min-h-11 rounded-2xl border border-app-border-strong bg-app-card',
  'px-4 py-2 text-base text-app-fg placeholder:text-app-subtle transition focus-visible:border-app-fg disabled:opacity-50',
].join(' ');

const SHOP_NAME_WRAP_CLASS = 'flex flex-col gap-1 text-left text-sm text-app-fg';

const ADDRESS_FIELD_KEY: Record<
  'street' | 'houseNumber' | 'postalCode' | 'city' | 'country',
  MessageKey
> = {
  street: 'shops.addressStreet',
  houseNumber: 'shops.addressHouseNumber',
  postalCode: 'shops.addressPostalCode',
  city: 'shops.addressCity',
  country: 'shops.addressCountry',
};

function addressFromDraft(draft: ForumPlaceAddressDraft): ForumPlaceAddress | null {
  if (
    draft.street === '' &&
    draft.houseNumber === '' &&
    draft.postalCode === '' &&
    draft.city === '' &&
    draft.country === ''
  ) {
    return null;
  }
  return {
    street: draft.street,
    houseNumber: draft.houseNumber,
    postalCode: draft.postalCode,
    city: draft.city,
    country: draft.country,
  };
}

function draftFromAddress(address: ForumPlaceAddress | null | undefined): ForumPlaceAddressDraft {
  if (address === null || address === undefined) {
    return { ...EMPTY_ADDRESS };
  }
  return {
    street: address.street,
    houseNumber: address.houseNumber,
    postalCode: address.postalCode,
    city: address.city,
    country: address.country,
  };
}

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
  event?: { trigger: (map: GoogleMap, name: string) => void };
};

type GoogleWindow = Window & {
  google?: { maps?: GoogleMapsNamespace };
  gm_authFailure?: () => void;
};

const START_CENTER = { lat: 20, lng: 0 };

const PLACED_BOX_FIELDS = ['left', 'width', 'maxHeight', 'top', 'bottom'] as const;

function samePlacedBox(a: PlacedFrameBox | null, b: PlacedFrameBox | null): boolean {
  if (a === null || b === null) {
    return a === b;
  }
  for (const field of PLACED_BOX_FIELDS) {
    if (a[field] !== b[field]) {
      return false;
    }
  }
  return true;
}

function placedBoxStyle(box: PlacedFrameBox, fill: boolean): CSSProperties {
  const style: CSSProperties = {
    left: box.left,
    width: box.width,
  };
  if (box.top !== null) {
    style.top = box.top;
  } else {
    style.bottom = box.bottom!;
  }
  if (fill) {
    const viewportHeight = window.innerHeight;
    if (box.top !== null) {
      style.bottom = viewportHeight - box.top - box.maxHeight;
    } else {
      style.top = viewportHeight - box.bottom! - box.maxHeight;
    }
  }
  return style;
}

/**
 * Optional place pin control for a top-level forum composer or staff editor.
 *
 * @param props - Current pin, disabled flag, change handler, and optional
 * staff-commit overrides (size, variant, preview, label, `onCommit`).
 * `shopDetails` collects a required shop name and structured address.
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
  shopDetails?: boolean;
}): ReactElement {
  const { t, locale } = useTranslations();
  const sunday = useLocalSunday();
  const shopNameId = `${useId()}-shop-name`;
  const shopDetails = props.shopDetails === true;
  const buttonSize = props.buttonSize ?? 'lg';
  const buttonVariant = props.buttonVariant ?? 'secondary';
  const showPreview = props.showPreview ?? true;
  const ariaLabel = props.ariaLabel ?? t('forum.addPlace');
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [saveErrorKey, setSaveErrorKey] = useState<MessageKey | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const [scriptReady, setScriptReady] = useState(false);
  const [mapsKey, setMapsKey] = useState<string | null>(null);
  const [labelDraft, setLabelDraft] = useState('');
  const [addressDraft, setAddressDraft] = useState<ForumPlaceAddressDraft>({ ...EMPTY_ADDRESS });
  const [markerPos, setMarkerPos] = useState<{ lat: number; lng: number } | null>(null);
  const mapElRef = useRef<HTMLDivElement | null>(null);
  const markerRef = useRef<GoogleMarker | null>(null);
  const authFailedRef = useRef(false);
  // Map click and drag listeners are registered once; they read this ref.
  const savingRef = useRef(false);
  const anchorRef = useRef<HTMLDivElement | null>(null);
  const [placedBox, setPlacedBox] = useState<PlacedFrameBox | null>(null);
  const placedBoxRef = useRef<PlacedFrameBox | null>(null);
  const mapPlaced = placedBox !== null;
  savingRef.current = saving;
  const fieldsDisabled = props.disabled || saving;

  function clearSaveError(): void {
    setSaveError(false);
    setSaveErrorKey(null);
  }

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
    setAddressDraft(draftFromAddress(saved?.address ?? null));
    if (saved !== null) {
      const savedMarker = new maps.Marker({
        position: { lat: saved.lat, lng: saved.lng },
        map,
        draggable: true,
      });
      savedMarker.addListener('dragend', () => {
        if (savingRef.current) {
          return;
        }
        const next = savedMarker.getPosition();
        if (next === null) {
          return;
        }
        setMarkerPos({ lat: next.lat(), lng: next.lng() });
      });
      markerRef.current = savedMarker;
    }
    map.addListener('click', (event: GoogleMapMouseEvent) => {
      if (savingRef.current) {
        return;
      }
      if (event.latLng === null) {
        return;
      }
      const pos = { lat: event.latLng.lat(), lng: event.latLng.lng() };
      if (markerRef.current !== null) {
        markerRef.current.setPosition(pos);
      } else {
        const marker = new maps.Marker({ position: pos, map, draggable: true });
        marker.addListener('dragend', () => {
          if (savingRef.current) {
            return;
          }
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
    let observer: ResizeObserver | undefined;
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(() => {
        maps.event?.trigger(map, 'resize');
      });
      observer.observe(el);
    }
    return () => {
      observer?.disconnect();
      el.replaceChildren();
    };
  }, [
    open,
    unavailable,
    mapsKey,
    scriptReady,
    props.place?.lat,
    props.place?.lng,
    props.place?.label,
    props.place?.address?.street,
    props.place?.address?.houseNumber,
    props.place?.address?.postalCode,
    props.place?.address?.city,
    props.place?.address?.country,
    mapPlaced,
    sunday,
  ]);

  useLayoutEffect(() => {
    const showPreviewBox = !sunday && showPreview && props.place !== null && !open;
    const showPanelBox = !sunday && open && !props.disabled && (unavailable || mapsKey !== null);
    const commitPlacedBox = (next: PlacedFrameBox | null): void => {
      if (samePlacedBox(placedBoxRef.current, next)) {
        return;
      }
      placedBoxRef.current = next;
      setPlacedBox(next);
    };
    if (!showPreviewBox && !showPanelBox) {
      commitPlacedBox(null);
      return;
    }
    const preferredWidth = showPanelBox ? 384 : 256;
    const measure = (): void => {
      const anchor = anchorRef.current;
      /* v8 ignore next 4 -- the anchor div stays mounted for the whole effect */
      if (anchor === null) {
        setPlacedBox(null);
        return;
      }
      const anchorRect = anchor.getBoundingClientRect();
      const frameEl = anchor.closest('[data-app-frame]');
      const raw =
        frameEl !== null
          ? frameEl.getBoundingClientRect()
          : { left: 0, right: window.innerWidth, top: 0, bottom: window.innerHeight };
      const band = window.visualViewport;
      const viewTop = band?.offsetTop ?? 0;
      const viewBottom = viewTop + (band?.height ?? window.innerHeight);
      commitPlacedBox(
        fitBoxInFrame({
          frameLeft: Math.max(raw.left, 0),
          frameRight: Math.min(raw.right, window.innerWidth),
          frameTop: Math.max(raw.top, viewTop),
          frameBottom: Math.min(raw.bottom, viewBottom),
          anchorLeft: anchorRect.left,
          anchorTop: anchorRect.top,
          anchorBottom: anchorRect.bottom,
          gap: 8,
          preferredWidth,
          inset: 16,
          viewportHeight: window.innerHeight,
        }),
      );
    };
    measure();
    const viewport = window.visualViewport;
    window.addEventListener('resize', measure);
    document.addEventListener('scroll', measure, true);
    viewport?.addEventListener('resize', measure);
    viewport?.addEventListener('scroll', measure);
    return () => {
      window.removeEventListener('resize', measure);
      document.removeEventListener('scroll', measure, true);
      viewport?.removeEventListener('resize', measure);
      viewport?.removeEventListener('scroll', measure);
    };
  }, [open, showPreview, props.place, props.disabled, unavailable, mapsKey, sunday]);

  const previewText = props.place === null ? '' : formatPlacePinText(props.place, locale);

  const addressValue = addressFromDraft(addressDraft);
  const nameProblem = shopDetails ? shopNameProblem(labelDraft, addressValue) : null;
  const addressProblem = shopDetails ? shopAddressProblem(addressValue) : null;
  const shopCommitBlocked = shopDetails && (nameProblem !== null || addressProblem !== null);
  const shopHint =
    nameProblem === 'name'
      ? t('shops.problemName')
      : nameProblem === 'nameAddress'
        ? t('shops.problemNameAddress')
        : addressProblem === 'missing'
          ? t('shops.problemAddress')
          : addressProblem !== null
            ? t('shops.problemAddressField', { field: t(ADDRESS_FIELD_KEY[addressProblem]) })
            : null;

  async function commit(next: ForumPlacePin | null): Promise<void> {
    if (props.onCommit === undefined) {
      props.onChange(next);
      setOpen(false);
      return;
    }
    setSaving(true);
    setSaveError(false);
    setSaveErrorKey(null);
    try {
      await props.onCommit(next);
      setOpen(false);
    } catch (error) {
      setSaveError(true);
      const problem = error instanceof Error ? shopApiProblem(error.message) : null;
      setSaveErrorKey(problem === null ? null : SHOP_API_MESSAGE[problem]);
    } finally {
      setSaving(false);
    }
  }

  const previewBody = (
    <>
      <MapPin aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
      <span className="min-w-0 flex-1 text-sm text-app-fg">{previewText}</span>
      <IconButton
        type="button"
        size="sm"
        variant="secondary"
        aria-label={t('forum.placeRemove')}
        disabled={fieldsDisabled}
        onClick={() => {
          void commit(null);
        }}
      >
        <X aria-hidden="true" className="h-4 w-4" />
      </IconButton>
    </>
  );

  const panelBody = unavailable ? (
    <>
      <p className="text-sm text-app-muted">{t('forum.placeUnavailable')}</p>
      {saveError ? (
        <p role="alert" className="mt-3 text-sm text-app-danger">
          {saveErrorKey !== null ? t(saveErrorKey) : t('forum.placeSaveFailed')}
        </p>
      ) : null}
      {!showPreview && props.place !== null ? (
        <IconButton
          type="button"
          size="sm"
          variant="secondary"
          className="mt-3 shrink-0"
          aria-label={t('forum.placeRemove')}
          disabled={fieldsDisabled}
          onClick={() => {
            void commit(null);
          }}
        >
          <X aria-hidden="true" className="h-4 w-4" />
        </IconButton>
      ) : null}
    </>
  ) : (
    <>
      <div
        ref={mapElRef}
        className={
          shopDetails
            ? 'h-64 min-h-32 w-full shrink rounded-xl'
            : 'h-64 min-h-0 w-full shrink rounded-xl'
        }
      />
      {shopDetails ? (
        <Scrollport className="mt-3 flex min-h-24 flex-1 flex-col gap-3">
          <div className={SHOP_NAME_WRAP_CLASS}>
            <label htmlFor={shopNameId}>{t('shops.placeName')}</label>
            <input
              id={shopNameId}
              className={SHOP_NAME_CONTROL_CLASS}
              required
              maxLength={80}
              autoComplete="off"
              value={labelDraft}
              disabled={fieldsDisabled}
              onChange={(event) => {
                clearSaveError();
                setLabelDraft(event.target.value);
              }}
            />
          </div>
          <p className="text-sm text-app-muted">{t('shops.placeNameHint')}</p>
          <ShopAddressFields
            value={addressValue}
            disabled={fieldsDisabled}
            onChange={(next) => {
              clearSaveError();
              setAddressDraft(next);
            }}
          />
          {shopHint !== null ? <p className="text-sm text-app-muted">{shopHint}</p> : null}
        </Scrollport>
      ) : (
        <input
          type="text"
          maxLength={80}
          aria-label={t('forum.placeLabel')}
          value={labelDraft}
          disabled={fieldsDisabled}
          onChange={(event) => {
            clearSaveError();
            setLabelDraft(event.target.value);
          }}
          className="mt-3 w-full shrink-0 rounded-2xl border border-app-border-strong px-4 py-2.5 text-base text-app-fg"
        />
      )}
      {saveError ? (
        <p role="alert" className="mt-3 text-sm text-app-danger">
          {saveErrorKey !== null ? t(saveErrorKey) : t('forum.placeSaveFailed')}
        </p>
      ) : null}
      {markerPos !== null ? (
        <Button
          type="button"
          variant="secondary"
          className="mt-3 shrink-0"
          disabled={fieldsDisabled || shopCommitBlocked}
          onClick={() => {
            const trimmed = labelDraft.trim();
            if (shopDetails) {
              const street = addressDraft.street.trim();
              const houseNumber = addressDraft.houseNumber.trim();
              const postalCode = addressDraft.postalCode.trim();
              const city = addressDraft.city.trim();
              const country = addressDraft.country.trim().toUpperCase();
              void commit({
                lat: markerPos.lat,
                lng: markerPos.lng,
                label: trimmed,
                address: { street, houseNumber, postalCode, city, country },
              });
              return;
            }
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
      {!showPreview && props.place !== null ? (
        <IconButton
          type="button"
          size="sm"
          variant="secondary"
          className="mt-3 shrink-0"
          aria-label={t('forum.placeRemove')}
          disabled={fieldsDisabled}
          onClick={() => {
            void commit(null);
          }}
        >
          <X aria-hidden="true" className="h-4 w-4" />
        </IconButton>
      ) : null}
    </>
  );

  return (
    <SundayWritingGate>
      <div ref={anchorRef} className="relative shrink-0">
        <IconButton
          type="button"
          size={buttonSize}
          variant={buttonVariant}
          aria-label={ariaLabel}
          title={ariaLabel}
          aria-expanded={open}
          disabled={fieldsDisabled}
          onClick={() => {
            if (!open) {
              clearSaveError();
            }
            setOpen((current) => !current);
          }}
        >
          <MapPin
            aria-hidden="true"
            className={buttonSize === 'sm' ? 'h-4 w-4 shrink-0' : 'block h-5 w-5 shrink-0'}
          />
        </IconButton>
        {!sunday && showPreview && props.place !== null && !open ? (
          placedBox !== null ? (
            createPortal(
              <div
                className="fixed z-20 flex items-start gap-3 overflow-clip rounded-2xl border border-app-border bg-app-card-muted p-3"
                style={placedBoxStyle(placedBox, false)}
              >
                {previewBody}
              </div>,
              document.body,
            )
          ) : (
            <div className="absolute left-0 top-full z-20 mt-2 flex w-64 items-start gap-3 rounded-2xl border border-app-border bg-app-card-muted p-3">
              {previewBody}
            </div>
          )
        ) : null}
        {!sunday && open && !props.disabled && (unavailable || mapsKey !== null) ? (
          placedBox !== null ? (
            createPortal(
              <div
                className={
                  placedBox.top !== null
                    ? 'pointer-events-none fixed z-30 flex flex-col justify-start overflow-clip'
                    : 'pointer-events-none fixed z-30 flex flex-col justify-end overflow-clip'
                }
                style={placedBoxStyle(placedBox, true)}
              >
                <div className="pointer-events-auto flex max-h-full min-h-0 w-full flex-col overflow-clip rounded-2xl border border-app-border bg-app-card-muted p-3">
                  {panelBody}
                </div>
              </div>,
              document.body,
            )
          ) : (
            <div className="absolute left-0 top-full z-30 mt-2 w-full max-w-sm rounded-2xl border border-app-border bg-app-card-muted p-3">
              {panelBody}
            </div>
          )
        ) : null}
      </div>
    </SundayWritingGate>
  );
}
