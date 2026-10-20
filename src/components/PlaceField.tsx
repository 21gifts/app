'use client';

import { MapPin, X } from 'lucide-react';
import { useCallback, useEffect, useId, useRef, useState, type ReactElement } from 'react';
import { createPortal } from 'react-dom';
import { useTranslations } from '@/components/LocaleProvider';
import { ShopAddressFields, type ForumPlaceAddressDraft } from '@/components/ShopAddressFields';
import { SundayWritingGate, useLocalSunday } from '@/components/SundayWritingGate';
import { Button, Field, IconButton } from '@/components/ui';
import { Scrollport } from '@/components/ui/Scrollport';
import type { ForumPlaceAddress, ForumPlacePin } from '@/lib/api-types';
import {
  SHOP_API_MESSAGE,
  formatPlacePinText,
  shopAddressProblems,
  shopApiProblem,
  shopNameProblem,
  type ShopAddressField,
  type ShopAddressFieldProblem,
  type ShopApiProblem,
} from '@/lib/forum-shop';
import type { MessageKey } from '@/lib/messages';

const EMPTY_ADDRESS: ForumPlaceAddressDraft = {
  street: '',
  houseNumber: '',
  postalCode: '',
  city: '',
  country: '',
};

type GoogleLatLng = { lat: () => number; lng: () => number };
type GoogleMapMouseEvent = { latLng: GoogleLatLng | null };
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

function addressFromDraft(draft: ForumPlaceAddressDraft): ForumPlaceAddress | null {
  if (Object.values(draft).every((value) => value === '')) return null;
  return { ...draft };
}

function draftFromAddress(address: ForumPlaceAddress | null | undefined): ForumPlaceAddressDraft {
  return address === null || address === undefined ? { ...EMPTY_ADDRESS } : { ...address };
}

const ADDRESS_ERROR_KEY: Record<ShopAddressField, Record<ShopAddressFieldProblem, MessageKey>> = {
  street: {
    required: 'shops.problemStreetRequired',
    length: 'shops.problemStreetLength',
    controls: 'shops.problemStreetControls',
    format: 'shops.problemStreetLength',
    formatChLi: 'shops.problemStreetLength',
    formatOther: 'shops.problemStreetLength',
    letter: 'shops.problemStreetLength',
    characters: 'shops.problemStreetLength',
    invalid: 'shops.problemStreetLength',
  },
  houseNumber: {
    required: 'shops.problemHouseNumberRequired',
    length: 'shops.problemHouseNumberLength',
    controls: 'shops.problemHouseNumberControls',
    format: 'shops.problemHouseNumberFormat',
    formatChLi: 'shops.problemHouseNumberFormat',
    formatOther: 'shops.problemHouseNumberFormat',
    letter: 'shops.problemHouseNumberFormat',
    characters: 'shops.problemHouseNumberCharacters',
    invalid: 'shops.problemHouseNumberFormat',
  },
  postalCode: {
    required: 'shops.problemPostalCodeRequired',
    length: 'shops.problemPostalCodeOther',
    controls: 'shops.problemPostalCodeControls',
    format: 'shops.problemPostalCodeOther',
    formatChLi: 'shops.problemPostalCodeChLi',
    formatOther: 'shops.problemPostalCodeOther',
    letter: 'shops.problemPostalCodeOther',
    characters: 'shops.problemPostalCodeOther',
    invalid: 'shops.problemPostalCodeOther',
  },
  city: {
    required: 'shops.problemCityRequired',
    length: 'shops.problemCityLength',
    controls: 'shops.problemCityControls',
    format: 'shops.problemCityLetter',
    formatChLi: 'shops.problemCityLetter',
    formatOther: 'shops.problemCityLetter',
    letter: 'shops.problemCityLetter',
    characters: 'shops.problemCityLetter',
    invalid: 'shops.problemCityLetter',
  },
  country: {
    required: 'shops.problemCountryRequired',
    length: 'shops.problemCountryInvalid',
    controls: 'shops.problemCountryInvalid',
    format: 'shops.problemCountryInvalid',
    formatChLi: 'shops.problemCountryInvalid',
    formatOther: 'shops.problemCountryInvalid',
    letter: 'shops.problemCountryInvalid',
    characters: 'shops.problemCountryInvalid',
    invalid: 'shops.problemCountryInvalid',
  },
};

/**
 * Optional place pin control for a forum composer or staff editor.
 *
 * @param props - Current pin, change handler, optional staff commit, and shop validation state.
 * @returns Attach button, optional preview, and the place dialog.
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
  problem?: ShopApiProblem | null;
  onAvailabilityChange?: (unavailable: boolean) => void;
}): ReactElement {
  const { t, locale } = useTranslations();
  const sunday = useLocalSunday();
  const titleId = `${useId()}-title`;
  const shopNameId = `${useId()}-shop-name`;
  const shopDetails = props.shopDetails === true;
  const buttonSize = props.buttonSize ?? 'lg';
  const buttonVariant = props.buttonVariant ?? 'secondary';
  const showPreview = props.showPreview ?? true;
  const ariaLabel = props.ariaLabel ?? t('forum.addPlace');
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<MessageKey | null>(null);
  const [unknownSaveError, setUnknownSaveError] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const [scriptReady, setScriptReady] = useState(false);
  const [mapsKey, setMapsKey] = useState<string | null>(null);
  const [labelDraft, setLabelDraft] = useState('');
  const [addressDraft, setAddressDraft] = useState<ForumPlaceAddressDraft>({ ...EMPTY_ADDRESS });
  const [markerPos, setMarkerPos] = useState<{ lat: number; lng: number } | null>(null);
  const [nameTouched, setNameTouched] = useState(false);
  const [addressTouched, setAddressTouched] = useState<ReadonlySet<ShopAddressField>>(
    () => new Set(),
  );
  const mapElRef = useRef<HTMLDivElement | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const markerRef = useRef<GoogleMarker | null>(null);
  const authFailedRef = useRef(false);
  const savingRef = useRef(false);
  savingRef.current = saving;
  const fieldsDisabled = props.disabled || saving;

  const resetDraft = useCallback((): void => {
    setLabelDraft(props.place?.label ?? '');
    setAddressDraft(draftFromAddress(props.place?.address));
    setMarkerPos(props.place === null ? null : { lat: props.place.lat, lng: props.place.lng });
    setNameTouched(false);
    setAddressTouched(new Set());
    setSaveError(null);
    setUnknownSaveError(false);
  }, [props.place]);

  useEffect(() => {
    if (props.disabled) {
      setOpen(false);
    }
  }, [props.disabled]);

  useEffect(() => {
    const problem = props.problem;
    if (
      !shopDetails ||
      problem === undefined ||
      problem === null ||
      !['shopName', 'shopNameAddress', 'shopNameLong', 'shopAddress', 'placeAddress'].includes(
        problem,
      )
    ) {
      return;
    }
    resetDraft();
    setOpen(true);
    if (problem === 'shopName' || problem === 'shopNameAddress' || problem === 'shopNameLong') {
      setNameTouched(true);
    }
    setSaveError(SHOP_API_MESSAGE[problem]);
  }, [props.problem, resetDraft, shopDetails]);

  useEffect(() => {
    props.onAvailabilityChange?.(unavailable);
  }, [props.onAvailabilityChange, unavailable]);

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
        const raw = typeof body === 'object' && body !== null && 'key' in body ? body.key : null;
        const nextKey = typeof raw === 'string' && raw.trim() !== '' ? raw.trim() : null;
        if (nextKey === null) {
          setMapsKey(null);
          setUnavailable(true);
          setScriptReady(false);
          return;
        }
        setMapsKey(nextKey);
        const googleWindow = window as GoogleWindow;
        const rejectKey = (): void => {
          authFailedRef.current = true;
          if (!cancelled) {
            setUnavailable(true);
            setScriptReady(false);
          }
        };
        const acceptKey = (): void => {
          if (!cancelled && !authFailedRef.current) {
            setUnavailable(false);
            setScriptReady(true);
          }
        };
        googleWindow.gm_authFailure = rejectKey;
        if (authFailedRef.current) {
          setUnavailable(true);
          setScriptReady(false);
          return;
        }
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
            setUnavailable(true);
            setScriptReady(false);
            return;
          }
          acceptKey();
        };
        const onError = (): void => {
          if (!cancelled) {
            setUnavailable(true);
            setScriptReady(false);
          }
        };
        if (existing instanceof HTMLScriptElement) {
          if (existing.dataset['gmapsState'] === 'error' || authFailedRef.current) {
            setUnavailable(true);
            setScriptReady(false);
            return;
          }
          existing.addEventListener('load', onLoad, { once: true });
          existing.addEventListener('error', onError, { once: true });
          return;
        }
        const script = document.createElement('script');
        script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(nextKey)}&v=weekly`;
        script.dataset['gmaps'] = 'weekly';
        script.addEventListener('load', onLoad, { once: true });
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
      (window as GoogleWindow).gm_authFailure = () => {
        authFailedRef.current = true;
      };
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const opener = document.activeElement as HTMLElement | null;
    const closeOnEscape = (event: KeyboardEvent): void => {
      if (event.key === 'Escape' && !savingRef.current) {
        setOpen(false);
      }
    };
    dialogRef.current?.focus();
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('keydown', closeOnEscape);
      opener?.focus();
    };
  }, [open]);

  useEffect(() => {
    if (!open || unavailable || mapsKey === null || !scriptReady) {
      return;
    }
    const el = mapElRef.current;
    const maps = (window as GoogleWindow).google?.maps;
    if (el === null || maps === undefined) {
      return;
    }
    const saved = props.place;
    const savedPosition = saved === null ? null : { lat: saved.lat, lng: saved.lng };
    const map = new maps.Map(el, { center: savedPosition ?? START_CENTER, zoom: 2 });
    if (authFailedRef.current) {
      el.replaceChildren();
      return;
    }
    markerRef.current = null;
    const updateFromMarker = (marker: GoogleMarker): void => {
      if (savingRef.current) {
        return;
      }
      const next = marker.getPosition();
      if (next !== null) {
        setMarkerPos({ lat: next.lat(), lng: next.lng() });
      }
    };
    if (saved !== null) {
      const marker = new maps.Marker({
        position: { lat: saved.lat, lng: saved.lng },
        map,
        draggable: true,
      });
      marker.addListener('dragend', () => updateFromMarker(marker));
      markerRef.current = marker;
    }
    map.addListener('click', (event) => {
      if (savingRef.current || event.latLng === null) {
        return;
      }
      const pos = { lat: event.latLng.lat(), lng: event.latLng.lng() };
      if (markerRef.current !== null) {
        markerRef.current.setPosition(pos);
      } else {
        const marker = new maps.Marker({ position: pos, map, draggable: true });
        marker.addListener('dragend', () => updateFromMarker(marker));
        markerRef.current = marker;
      }
      setMarkerPos(pos);
    });
    if (saved === null && navigator.geolocation !== undefined) {
      navigator.geolocation.getCurrentPosition(
        (position) =>
          map.setCenter({ lat: position.coords.latitude, lng: position.coords.longitude }),
        () => map.setCenter(START_CENTER),
      );
    }
    const observer =
      typeof ResizeObserver === 'undefined'
        ? null
        : new ResizeObserver(() => maps.event?.trigger(map, 'resize'));
    observer?.observe(el);
    return () => {
      observer?.disconnect();
      el.replaceChildren();
    };
  }, [open, unavailable, mapsKey, scriptReady, props.place, sunday]);

  const addressValue = addressFromDraft(addressDraft);
  const addressProblems = shopDetails ? shopAddressProblems(addressValue) : {};
  const nameProblem = shopDetails ? shopNameProblem(labelDraft, addressValue) : null;
  const nameError = !shopDetails
    ? undefined
    : !nameTouched && labelDraft.trim() === '' && saveError === null
      ? undefined
      : nameProblem === 'name'
        ? t('shops.problemName')
        : nameProblem === 'nameAddress'
          ? t('shops.problemNameAddress')
          : nameProblem === 'nameLong'
            ? t('shops.problemNameLong')
            : nameProblem === 'nameControls'
              ? t('shops.problemNameControls')
              : saveError !== null &&
                  [
                    'shops.problemName',
                    'shops.problemNameAddress',
                    'shops.problemNameLong',
                  ].includes(saveError)
                ? t(saveError)
                : undefined;
  const shownAddressErrors: Partial<Record<ShopAddressField, string>> = {};
  for (const field of Object.keys(addressProblems) as ShopAddressField[]) {
    if (addressTouched.has(field) || addressDraft[field].trim() !== '') {
      const problem = addressProblems[field];
      if (problem !== undefined) {
        shownAddressErrors[field] = t(ADDRESS_ERROR_KEY[field][problem]);
      }
    }
  }
  const invalidFields = Object.keys(addressProblems) as ShopAddressField[];
  const blocked =
    markerPos === null ||
    unavailable ||
    saveError !== null ||
    (shopDetails && (nameProblem !== null || invalidFields.length > 0));
  const fieldLabel: Record<ShopAddressField, string> = {
    street: t('shops.addressStreet'),
    houseNumber: t('shops.addressHouseNumber'),
    postalCode: t('shops.addressPostalCode'),
    city: t('shops.addressCity'),
    country: t('shops.addressCountry'),
  };
  const missing = [
    ...(markerPos === null ? [t('shops.mapPin')] : []),
    ...(shopDetails && labelDraft.trim() === '' ? [t('shops.placeName')] : []),
    ...invalidFields
      .filter((field) => addressDraft[field].trim() === '')
      .map((field) => fieldLabel[field]),
  ];
  // The unavailable map is already explained where the map would be.
  const footerReason =
    saveError !== null && nameError === undefined
      ? t(saveError)
      : unavailable
        ? null
        : missing.length > 0
          ? t('shops.fillIn', { fields: missing.join(', ') })
          : blocked
            ? t('shops.fixFields')
            : null;

  async function commit(next: ForumPlacePin | null): Promise<void> {
    if (props.onCommit === undefined) {
      props.onChange(next);
      setOpen(false);
      return;
    }
    setSaving(true);
    setSaveError(null);
    setUnknownSaveError(false);
    try {
      await props.onCommit(next);
      setOpen(false);
    } catch (error) {
      const problem = error instanceof Error ? shopApiProblem(error.message) : null;
      if (problem === null) {
        setUnknownSaveError(true);
      } else {
        setSaveError(SHOP_API_MESSAGE[problem]);
      }
    } finally {
      setSaving(false);
    }
  }

  const previewText = props.place === null ? '' : formatPlacePinText(props.place, locale);
  const dialog =
    !sunday && open && !props.disabled
      ? createPortal(
          <div
            ref={dialogRef}
            className="fixed inset-0 z-50 flex items-end justify-center bg-app-overlay outline-none sm:items-center sm:p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            tabIndex={-1}
          >
            <div className="flex h-full w-full max-w-[560px] flex-col bg-app-card sm:h-auto sm:max-h-[calc(100vh-2rem)] sm:rounded-2xl sm:border sm:border-app-border">
              <div className="flex shrink-0 items-center justify-between border-b border-app-border px-4 py-3">
                <h2 id={titleId} className="text-base font-medium text-app-fg">
                  {shopDetails ? t('shops.placeDialogTitle') : t('forum.addPlace')}
                </h2>
                <IconButton
                  type="button"
                  size="sm"
                  variant="secondary"
                  aria-label={t('forum.payClose')}
                  disabled={saving}
                  onClick={() => setOpen(false)}
                >
                  <X aria-hidden="true" className="h-4 w-4" />
                </IconButton>
              </div>
              <Scrollport className="min-h-0 flex-1">
                <div className="flex flex-col gap-3 p-4">
                  {unavailable ? (
                    <p className="text-sm text-app-danger">{t('forum.placeUnavailable')}</p>
                  ) : (
                    <>
                      <div ref={mapElRef} className="h-64 min-h-64 w-full rounded-xl" />
                      {markerPos === null ? (
                        <p className="text-sm text-app-muted">{t('shops.placeMapHint')}</p>
                      ) : null}
                    </>
                  )}
                  {shopDetails ? (
                    <>
                      <Field
                        id={shopNameId}
                        label={t('shops.placeName')}
                        required
                        autoComplete="off"
                        value={labelDraft}
                        disabled={fieldsDisabled}
                        hint={t('shops.placeNameHint')}
                        {...(nameError === undefined ? {} : { error: nameError })}
                        onBlur={() => setNameTouched(true)}
                        onChange={(event) => {
                          const value = event.target.value;
                          setLabelDraft(value);
                          if (value !== '') {
                            setNameTouched(true);
                          }
                          setSaveError(null);
                          setUnknownSaveError(false);
                        }}
                      />
                      <ShopAddressFields
                        value={addressValue}
                        disabled={fieldsDisabled}
                        errors={shownAddressErrors}
                        onBlur={(field) =>
                          setAddressTouched((current) => new Set(current).add(field))
                        }
                        onChange={(next) => {
                          setAddressDraft(next);
                          const changed = (Object.keys(next) as ShopAddressField[]).find(
                            (field) => next[field] !== addressDraft[field],
                          );
                          if (changed !== undefined && next[changed] !== '') {
                            setAddressTouched((current) => new Set(current).add(changed));
                          }
                          setSaveError(null);
                          setUnknownSaveError(false);
                        }}
                      />
                    </>
                  ) : (
                    <input
                      type="text"
                      maxLength={80}
                      aria-label={t('forum.placeLabel')}
                      value={labelDraft}
                      disabled={fieldsDisabled}
                      onChange={(event) => {
                        setLabelDraft(event.target.value);
                        setSaveError(null);
                        setUnknownSaveError(false);
                      }}
                      className="w-full rounded-2xl border border-app-border-strong px-4 py-2.5 text-base text-app-fg"
                    />
                  )}
                  {unknownSaveError ? (
                    <p role="alert" className="text-sm text-app-danger">
                      {t('forum.placeSaveFailed')}
                    </p>
                  ) : null}
                </div>
              </Scrollport>
              <div className="shrink-0 border-t border-app-border bg-app-card px-4 py-3">
                {footerReason === null ? null : (
                  <p className="mb-2 text-sm text-app-danger">{footerReason}</p>
                )}
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={fieldsDisabled || blocked}
                    onClick={() => {
                      const label = labelDraft.trim();
                      void commit({
                        ...markerPos!,
                        label: label === '' ? null : label,
                        ...(shopDetails
                          ? {
                              label,
                              address: {
                                street: addressDraft.street.trim(),
                                houseNumber: addressDraft.houseNumber.trim(),
                                postalCode: addressDraft.postalCode.trim(),
                                city: addressDraft.city.trim(),
                                country: addressDraft.country.trim().toUpperCase(),
                              },
                            }
                          : {}),
                      });
                    }}
                  >
                    {t('forum.placeDone')}
                  </Button>
                  {!showPreview && props.place !== null ? (
                    <IconButton
                      type="button"
                      size="sm"
                      variant="secondary"
                      aria-label={t('forum.placeRemove')}
                      disabled={fieldsDisabled}
                      onClick={() => void commit(null)}
                    >
                      <X aria-hidden="true" className="h-4 w-4" />
                    </IconButton>
                  ) : null}
                </div>
              </div>
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <SundayWritingGate>
      <div className="relative shrink-0">
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
              resetDraft();
            }
            setOpen((current) => !current);
          }}
        >
          <MapPin aria-hidden="true" className={buttonSize === 'sm' ? 'h-4 w-4' : 'h-5 w-5'} />
        </IconButton>
        {!sunday && showPreview && props.place !== null && !open ? (
          <div className="absolute left-0 top-full z-20 mt-2 flex w-64 items-start gap-3 rounded-2xl border border-app-border bg-app-card-muted p-3">
            <MapPin aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
            <span className="min-w-0 flex-1 text-sm text-app-fg">{previewText}</span>
            <IconButton
              type="button"
              size="sm"
              variant="secondary"
              aria-label={t('forum.placeRemove')}
              disabled={fieldsDisabled}
              onClick={() => void commit(null)}
            >
              <X aria-hidden="true" className="h-4 w-4" />
            </IconButton>
          </div>
        ) : null}
        {dialog}
      </div>
    </SundayWritingGate>
  );
}
