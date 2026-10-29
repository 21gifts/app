'use client';

import { useEffect, useId, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { ChangeEvent, ReactElement } from 'react';
import { CircleHelp } from 'lucide-react';
import { SHOP_NPUB_RE } from '@/lib/api-types';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { FilterMenu, type MenuOption } from './FilterMenu';

type HomeShopsCopy = {
  title: string;
  lead: string;
  view: string;
  map: string;
  table: string;
  country: string;
  name: string;
  blockchain: string;
  asset: string;
  activity: string;
  all: string;
  empty: string;
  error: string;
  retry: string;
  colName: string;
  colLocation: string;
  colCountry: string;
  colShop: string;
  colProvider: string;
  colActivity: string;
  colUrl: string;
  csv: string;
  helpLabel: string;
  daily: string;
  weekly: string;
  monthly: string;
  idle: string;
  none: string;
  dailyHelp: string;
  weeklyHelp: string;
  monthlyHelp: string;
  idleHelp: string;
  noneHelp: string;
  hierarchy: string;
  zoomIn: string;
  zoomOut: string;
  resetBearing: string;
  toggleAttribution: string;
  mapFeedback: string;
  closePopup: string;
  mapTitle: string;
};

type LngLat = [number, number];

type ShopView = 'map' | 'table';

type Pair = { blockchain: string; asset: string };

type GiftsProvider = {
  blockchains: string[];
  assets: string[];
  pairs: Pair[] | null;
};

type Filters = {
  countries: string[];
  shopNames: string[];
  activities: string[];
  techProviders: unknown;
};

type Ready = { filters: Filters; places: Record<string, unknown>[]; query: string };

type Selection = {
  country: string;
  shopName: string;
  blockchain: string;
  asset: string;
  activity: string;
};

type ShopRow = {
  key: string;
  name: string;
  href: string | null;
  location: string;
  country: string;
  shop: string;
  provider: string;
  activity: string;
  markerClass: string;
  markerTitle: string;
  position: LngLat | null;
  category: string;
  coverPhotoUrl: string | null;
};

type MapHandle = {
  addControl: (control: object, position: string) => void;
  resize: () => void;
  setCenter: (center: LngLat) => void;
  setZoom: (zoom: number) => void;
  fitBounds: (bounds: LngLatBoundsHandle, options: { padding: number; maxZoom: number }) => void;
  remove: () => void;
};

type LngLatBoundsHandle = { extend: (position: LngLat) => void };

type MarkerHandle = {
  setLngLat: (position: LngLat) => void;
  setPopup: (popup: PopupHandle) => MarkerHandle;
  addTo: (map: MapHandle) => void;
  remove: () => void;
  getLngLat: () => { lng: number; lat: number };
};

type PopupHandle = { setDOMContent: (content: HTMLElement) => PopupHandle };

type MapLibreNamespace = {
  Map: new (options: {
    container: HTMLElement;
    style: string;
    center: LngLat;
    zoom: number;
    locale?: Record<string, string>;
  }) => MapHandle;
  NavigationControl: new () => object;
  Marker: new (options: { element: HTMLElement }) => MarkerHandle;
  Popup: new (options: { offset: number }) => PopupHandle;
  LngLatBounds: new () => LngLatBoundsHandle;
};

type MapSession = { map: MapHandle; lib: MapLibreNamespace };

declare global {
  interface Window {
    maplibregl?: MapLibreNamespace;
  }
}

const PROD_PLACES = 'https://api.opencryptopay.io/map/places';
const DEV_PLACES = 'https://dev-api.opencryptopay.io/map/places';
const MAP_STYLE_URL = 'https://unpkg.com/maplibre-gl@5.6.1/dist/maplibre-gl.css';
const MAP_SCRIPT_URL = 'https://unpkg.com/maplibre-gl@5.6.1/dist/maplibre-gl.js';
const TILE_STYLE = 'https://tiles.openfreemap.org/styles/liberty';
const HOME_CENTER: LngLat = [8.23, 46.8];
const HOME_ZOOM = 7;
const SINGLE_ZOOM = 12;
const BOUNDS_PADDING = 48;
const BOUNDS_MAX_ZOOM = 12;
const GIFTS = '21.gifts';

function viewButtonClass(selected: boolean): string {
  if (selected) {
    return 'min-h-11 rounded-full border-0 bg-[#272b38] px-3.5 text-white';
  }
  return 'min-h-11 rounded-full border-0 bg-transparent px-3.5 text-[#272b38]';
}

function placesEndpoint(hostname: string): string {
  if (hostname === GIFTS || hostname === `www.${GIFTS}`) return PROD_PLACES;
  return DEV_PLACES;
}

function filtersEndpoint(places: string): string {
  return places.replace(/\/places$/, '/filters');
}

function placesQuery(input: {
  country: string;
  shopName: string;
  blockchain: string;
  asset: string;
}): string {
  const params = new URLSearchParams();
  if (input.country !== '') params.set('country', input.country);
  if (input.shopName === 'SPAR' || input.shopName === 'others') {
    params.set('shopName', input.shopName);
  }
  if (input.blockchain !== '') params.set('blockchain', input.blockchain);
  if (input.asset !== '') params.set('asset', input.asset);
  return params.toString();
}

function withQuery(endpoint: string, query: string): string {
  if (query === '') return endpoint;
  return `${endpoint}?${query}`;
}

function queryCovers(loaded: string, current: string): boolean {
  const currentParams = new URLSearchParams(current);
  for (const [key, value] of new URLSearchParams(loaded)) {
    if (currentParams.get(key) !== value) return false;
  }
  return true;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of value) {
    if (typeof item !== 'string') continue;
    const trimmed = item.trim();
    if (trimmed === '' || seen.has(trimmed)) continue;
    seen.add(trimmed);
    result.push(trimmed);
  }
  return result;
}

function readPairs(value: unknown): Pair[] | null {
  if (!Array.isArray(value)) return null;
  const pairs: Pair[] = [];
  for (const item of value) {
    if (!isRecord(item)) continue;
    const blockchain = item['blockchain'];
    const asset = item['asset'];
    if (typeof blockchain !== 'string' || typeof asset !== 'string') continue;
    pairs.push({ blockchain, asset });
  }
  return pairs;
}

function readGiftsProvider(value: unknown): GiftsProvider | null {
  if (!Array.isArray(value)) return null;
  for (const entry of value) {
    if (!isRecord(entry)) continue;
    if (entry['name'] !== GIFTS) continue;
    return {
      blockchains: stringList(entry['blockchains']),
      assets: stringList(entry['assets']),
      pairs: readPairs(entry['pairs']),
    };
  }
  return null;
}

function readFilters(value: unknown): Filters | null {
  if (!isRecord(value)) return null;
  return {
    countries: stringList(value['countries']),
    shopNames: stringList(value['shopNames']),
    activities: stringList(value['activities']),
    techProviders: value['techProviders'],
  };
}

function readPlaces(value: unknown): Record<string, unknown>[] | null {
  if (!isRecord(value)) return null;
  const places = value['places'];
  if (!Array.isArray(places)) return null;
  const rows: Record<string, unknown>[] = [];
  for (const place of places) {
    if (!isRecord(place)) continue;
    rows.push(place);
  }
  return rows;
}

function sortWithLessThan(values: readonly string[]): string[] {
  const sorted: string[] = [];
  for (const value of values) {
    let index = sorted.length;
    let cursor = 0;
    for (const current of sorted) {
      if (value < current) {
        index = cursor;
        break;
      }
      cursor += 1;
    }
    sorted.splice(index, 0, value);
  }
  return sorted;
}

function assetsFromPairs(pairs: readonly Pair[], blockchain: string): string[] {
  const seen = new Set<string>();
  const values: string[] = [];
  for (const pair of pairs) {
    if (pair.blockchain !== blockchain) continue;
    if (seen.has(pair.asset)) continue;
    seen.add(pair.asset);
    values.push(pair.asset);
  }
  return sortWithLessThan(values);
}

function assetsFor(provider: GiftsProvider | null, blockchain: string): string[] {
  if (provider === null) return [];
  if (blockchain === '') return provider.assets;
  if (provider.pairs === null) return provider.assets;
  return assetsFromPairs(provider.pairs, blockchain);
}

function trimmedString(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function joinPart(left: string, right: string): string {
  if (left !== '' && right !== '') return `${left} ${right}`;
  if (left !== '') return left;
  return right;
}

function locationText(place: Record<string, unknown>): string {
  const street = joinPart(trimmedString(place['street']), trimmedString(place['houseNumber']));
  const city = joinPart(trimmedString(place['postalCode']), trimmedString(place['city']));
  if (street !== '' && city !== '') return `${street}, ${city}`;
  if (street !== '') return street;
  return city;
}

function countryMatches(country: unknown, selected: string): boolean {
  if (selected === '') return true;
  return country === selected;
}

function shopNameMatches(shopName: unknown, selected: string): boolean {
  if (selected === '') return true;
  if (selected === 'SPAR') return shopName === 'SPAR';
  if (selected === 'others') return shopName !== 'SPAR';
  return shopName === selected;
}

function activityMatches(activity: string, selected: string): boolean {
  if (selected === '') return true;
  if (selected === 'olderThan30Days') return activity === 'olderThan30Days';
  if (selected === 'none') return activity === 'none';
  if (selected === 'daily') return activity === 'daily';
  if (selected === 'within7Days') {
    return activity === 'daily' || activity === 'within7Days';
  }
  if (selected === 'within30Days') {
    return activity === 'daily' || activity === 'within7Days' || activity === 'within30Days';
  }
  return activity === selected;
}

function activityOptionLabel(token: string, copy: HomeShopsCopy): string {
  if (token === 'daily') return copy.daily;
  if (token === 'within7Days') return copy.weekly;
  if (token === 'within30Days') return copy.monthly;
  if (token === 'olderThan30Days') return copy.idle;
  if (token === 'none') return copy.none;
  return token;
}

function activitySwatch(token: string): string | null {
  if (token === 'daily') return 'shop-place-marker is-daily';
  if (token === 'within7Days') return 'shop-place-marker is-weekly';
  if (token === 'within30Days') return 'shop-place-marker is-monthly';
  if (token === 'olderThan30Days') return 'shop-place-marker is-idle';
  if (token === 'none') return 'shop-place-marker is-none';
  return null;
}

function markerClass(activity: string): string {
  if (activity === 'daily') return 'shop-place-marker is-daily';
  if (activity === 'within7Days') return 'shop-place-marker is-weekly';
  if (activity === 'within30Days') return 'shop-place-marker is-monthly';
  if (activity === 'olderThan30Days') return 'shop-place-marker is-idle';
  return 'shop-place-marker is-none';
}

function markerTitle(activity: string, copy: HomeShopsCopy): string {
  if (activity === 'daily') return copy.daily;
  if (activity === 'within7Days') return copy.weekly;
  if (activity === 'within30Days') return copy.monthly;
  if (activity === 'olderThan30Days') return copy.idle;
  if (activity === 'none') return copy.none;
  return activity;
}

function markerAriaLabel(name: string, title: string): string {
  if (name !== '' && title !== '') return `${name}, ${title}`;
  if (name !== '') return name;
  return title;
}

function coverPhotoUrl(place: Record<string, unknown>): string | null {
  const coverPhoto = place['coverPhoto'];
  if (!isRecord(coverPhoto)) return null;
  const url = coverPhoto['url'];
  if (typeof url !== 'string' || !url.startsWith('https://')) return null;
  return url;
}

function entryMatches(entry: unknown, blockchain: string, asset: string): boolean {
  if (!isRecord(entry)) return false;
  if (blockchain !== '' && entry['blockchain'] !== blockchain) return false;
  if (asset !== '' && entry['asset'] !== asset) return false;
  return true;
}

function chainMatches(
  place: Record<string, unknown>,
  provider: GiftsProvider,
  blockchain: string,
  asset: string,
): boolean {
  const supports = place['supports'];
  if (Array.isArray(supports) && supports.length > 0) {
    for (const entry of supports) {
      if (entryMatches(entry, blockchain, asset)) return true;
    }
    return false;
  }
  if (supports !== undefined && supports !== null && !Array.isArray(supports)) return false;
  if (provider.pairs === null) return false;
  for (const pair of provider.pairs) {
    if (entryMatches(pair, blockchain, asset)) return true;
  }
  return false;
}

function readCoordinate(value: unknown, min: number, max: number): number | null {
  if (typeof value !== 'number') return null;
  if (!Number.isFinite(value)) return null;
  if (value < min || value > max) return null;
  return value;
}

function readPosition(place: Record<string, unknown>): LngLat | null {
  const lat = readCoordinate(place['lat'], -90, 90);
  const lon = readCoordinate(place['lon'], -180, 180);
  if (lat === null || lon === null) return null;
  return [lon, lat];
}

function hrefFor(id: unknown): string | null {
  if (typeof id !== 'string') return null;
  if (!SHOP_NPUB_RE.test(id)) return null;
  return `/${id}`;
}

function rowKey(id: unknown, index: number): string {
  if (typeof id === 'string') return `${id}#${index}`;
  return `row-${index}`;
}

function buildRows(
  places: readonly Record<string, unknown>[],
  provider: GiftsProvider | null,
  selection: Selection,
  copy: HomeShopsCopy,
): ShopRow[] {
  const rows: ShopRow[] = [];
  for (const place of places) {
    const techProvider = place['techProvider'];
    if (techProvider !== GIFTS) continue;
    if (!countryMatches(place['country'], selection.country)) continue;
    if (!shopNameMatches(place['shopName'], selection.shopName)) continue;
    const activity = typeof place['activity'] === 'string' ? place['activity'] : '';
    if (!activityMatches(activity, selection.activity)) continue;
    if (selection.blockchain !== '' || selection.asset !== '') {
      if (!chainMatches(place, provider as GiftsProvider, selection.blockchain, selection.asset)) {
        continue;
      }
    }
    const id = place['id'];
    rows.push({
      key: rowKey(id, rows.length),
      name: trimmedString(place['name']),
      href: hrefFor(id),
      location: locationText(place),
      country: trimmedString(place['country']),
      shop: trimmedString(place['shopName']),
      provider: techProvider,
      activity: activityOptionLabel(activity, copy),
      markerClass: markerClass(activity),
      markerTitle: markerTitle(activity, copy),
      position: readPosition(place),
      category: trimmedString(place['category']),
      coverPhotoUrl: coverPhotoUrl(place),
    });
  }
  return rows;
}

function sortRows(rows: readonly ShopRow[]): ShopRow[] {
  const sorted = [...rows];
  sorted.sort((left, right) => left.name.localeCompare(right.name));
  return sorted;
}

function textChoices(tokens: readonly string[], allLabel: string): MenuOption[] {
  const options: MenuOption[] = [{ value: '', label: allLabel, swatch: null }];
  for (const token of tokens) options.push({ value: token, label: token, swatch: null });
  return options;
}

function activityChoices(tokens: readonly string[], copy: HomeShopsCopy): MenuOption[] {
  const options: MenuOption[] = [{ value: '', label: copy.all, swatch: null }];
  for (const token of tokens) {
    options.push({
      value: token,
      label: activityOptionLabel(token, copy),
      swatch: activitySwatch(token),
    });
  }
  return options;
}

function onTextChoice(
  event: ChangeEvent<HTMLSelectElement>,
  current: string,
  apply: (next: string) => void,
): void {
  const next = event.target.value;
  if (next === current) return;
  apply(next);
}

function findByUrl(tagName: 'script' | 'link', url: string): Element | null {
  const nodes = document.getElementsByTagName(tagName);
  for (const node of nodes) {
    const value = tagName === 'script' ? node.getAttribute('src') : node.getAttribute('href');
    if (value === url) return node;
  }
  return null;
}

function frameMap(map: MapHandle, lib: MapLibreNamespace, positions: readonly LngLat[]): void {
  if (positions.length > 1) {
    const bounds = new lib.LngLatBounds();
    for (const position of positions) bounds.extend(position);
    map.fitBounds(bounds, { padding: BOUNDS_PADDING, maxZoom: BOUNDS_MAX_ZOOM });
    return;
  }
  if (positions.length === 0) {
    map.setCenter(HOME_CENTER);
    map.setZoom(HOME_ZOOM);
    return;
  }
  const position = positions[0] as LngLat;
  map.setCenter(position);
  map.setZoom(SINGLE_ZOOM);
}

function popupContent(row: ShopRow, navigate: (href: string) => void): HTMLElement {
  const content = document.createElement('div');
  if (row.coverPhotoUrl !== null) {
    const image = document.createElement('img');
    image.src = row.coverPhotoUrl;
    image.alt = '';
    image.setAttribute('loading', 'lazy');
    image.setAttribute('referrerpolicy', 'no-referrer');
    image.className = 'block h-auto max-h-80 w-full max-w-full object-contain';
    content.appendChild(image);
  }
  if (row.href === null) {
    const name = document.createElement('strong');
    name.textContent = row.name;
    content.appendChild(name);
  } else {
    const name = document.createElement('a');
    const href = row.href;
    name.href = href;
    name.className = 'font-medium underline underline-offset-2';
    // A plain click stays in this document (no document load inside the app);
    // a modified or middle click keeps the browser's own handling.
    name.addEventListener('click', (event: MouseEvent) => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return;
      }
      event.preventDefault();
      navigate(href);
    });
    name.textContent = row.name;
    content.appendChild(name);
  }
  if (row.markerTitle !== '') {
    const activity = document.createElement('p');
    activity.textContent = row.markerTitle;
    content.appendChild(activity);
  }
  if (row.category !== '') {
    const category = document.createElement('p');
    category.textContent = row.category;
    content.appendChild(category);
  }
  return content;
}

function csvField(value: string): string {
  let safe = value;
  if (/^[=+\-@\t\r]/.test(safe)) safe = `'${safe}`;
  if (/[,"\r\n]/.test(safe)) return `"${safe.replaceAll('"', '""')}"`;
  return safe;
}

function markerPositions(rows: readonly ShopRow[], failed: boolean): LngLat[] {
  if (failed) return [];
  const positions: LngLat[] = [];
  for (const row of rows) {
    if (row.position === null) continue;
    positions.push(row.position);
  }
  return positions;
}

function isAbortError(error: unknown): boolean {
  return isRecord(error) && error['name'] === 'AbortError';
}

/**
 * Renders the homepage shop filters with map and table views.
 *
 * @param props - Localized copy for the shop section.
 * @returns The interactive homepage shop section.
 */
export function HomeShops({ copy }: { copy: HomeShopsCopy }): ReactElement {
  const router = useRouter();
  const [country, setCountry] = useState('');
  const [shopName, setShopName] = useState('');
  const [blockchain, setBlockchain] = useState('');
  const [asset, setAsset] = useState('');
  const [activity, setActivity] = useState('');
  const [view, setView] = useState<ShopView>('map');
  const [attempt, setAttempt] = useState(0);
  const [filters, setFilters] = useState<Filters | null>(null);
  const [ready, setReady] = useState<Ready | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [scriptFailed, setScriptFailed] = useState(false);
  const helpId = useId();
  const sessionRef = useRef<MapSession | null>(null);
  const markersRef = useRef<MarkerHandle[]>([]);
  const awaitingRef = useRef(false);
  const rowsRef = useRef<ShopRow[]>([]);
  const failedRef = useRef(false);
  const viewRef = useRef<ShopView>('map');
  const startedOnMap = useRef(true);
  const provider = filters === null ? null : readGiftsProvider(filters.techProviders);
  const blockchainOptions = provider === null ? [] : provider.blockchains;
  const blockchainActive = blockchainOptions.includes(blockchain) ? blockchain : '';
  const assetOptions = assetsFor(provider, blockchainActive);
  const assetActive = assetOptions.includes(asset) ? asset : '';
  const countries = filters === null ? [] : filters.countries;
  const shopNames = filters === null ? [] : filters.shopNames;
  const activities = filters === null ? [] : filters.activities;
  const countryActive = countries.includes(country) ? country : '';
  const shopNameActive = shopNames.includes(shopName) ? shopName : '';
  const activityActive = activities.includes(activity) ? activity : '';
  const selection: Selection = {
    country: countryActive,
    shopName: shopNameActive,
    blockchain: blockchainActive,
    asset: assetActive,
    activity: activityActive,
  };
  const query = placesQuery({
    country: countryActive,
    shopName: shopNameActive,
    blockchain: blockchainActive,
    asset: assetActive,
  });
  const covered = ready !== null && queryCovers(ready.query, query);
  const rows =
    ready !== null && covered ? sortRows(buildRows(ready.places, provider, selection, copy)) : [];
  rowsRef.current = rows;
  failedRef.current = loadFailed || scriptFailed;
  viewRef.current = view;
  awaitingRef.current = !covered;
  const showError = loadFailed || scriptFailed;
  const showEmpty = !showError && covered && rows.length === 0;
  const rowsKey = `${loadFailed ? 1 : 0}${scriptFailed ? 1 : 0}${covered ? 1 : 0}:${JSON.stringify(rows)}`;
  function paintMarkers(): void {
    const session = sessionRef.current;
    if (session === null) return;
    for (const marker of markersRef.current) marker.remove();
    markersRef.current = [];
    if (awaitingRef.current) return;
    const positions = markerPositions(rowsRef.current, failedRef.current);
    if (!failedRef.current) {
      for (const row of rowsRef.current) {
        if (row.position === null) continue;
        const element = document.createElement('button');
        element.type = 'button';
        element.className = row.markerClass;
        element.title = row.markerTitle;
        element.setAttribute('aria-label', markerAriaLabel(row.name, row.markerTitle));
        element.addEventListener('keydown', (event: KeyboardEvent) => {
          if (event.key !== 'Enter' && event.key !== ' ') return;
          event.preventDefault();
          element.click();
        });
        const marker = new session.lib.Marker({ element });
        marker.setLngLat(row.position);
        marker.setPopup(
          new session.lib.Popup({ offset: 16 }).setDOMContent(
            popupContent(row, (href) => router.push(href)),
          ),
        );
        marker.addTo(session.map);
        markersRef.current.push(marker);
      }
    }
    if (viewRef.current === 'map') frameMap(session.map, session.lib, positions);
  }

  const assetKey = assetOptions.join('\u0000');
  const blockchainKey = blockchainOptions.join('\u0000');
  const countryKey = countries.join('\u0000');
  const shopNameKey = shopNames.join('\u0000');
  const activityKey = activities.join('\u0000');

  useEffect(() => {
    if (asset !== '' && !assetKey.split('\u0000').includes(asset)) setAsset('');
  }, [asset, assetKey]);

  useEffect(() => {
    if (blockchain !== '' && !blockchainKey.split('\u0000').includes(blockchain)) setBlockchain('');
  }, [blockchain, blockchainKey]);

  useEffect(() => {
    if (country !== '' && !countryKey.split('\u0000').includes(country)) setCountry('');
  }, [country, countryKey]);

  useEffect(() => {
    if (shopName !== '' && !shopNameKey.split('\u0000').includes(shopName)) setShopName('');
  }, [shopName, shopNameKey]);

  useEffect(() => {
    if (activity !== '' && !activityKey.split('\u0000').includes(activity)) setActivity('');
  }, [activity, activityKey]);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    const hostname = window.location.hostname;
    const places = placesEndpoint(hostname);
    const filtersUrl = filtersEndpoint(places);

    async function loadFilters(): Promise<void> {
      try {
        setLoadFailed(false);
        const filtersResponse = await fetch(filtersUrl, {
          credentials: 'omit',
          signal: controller.signal,
        });
        if (!filtersResponse.ok) throw new Error('load failed');
        const filtersJson: unknown = await filtersResponse.json();
        const nextFilters = readFilters(filtersJson);
        if (nextFilters === null) throw new Error('load failed');
        if (!active) return;
        setFilters(nextFilters);
        setLoadFailed(false);
      } catch (error: unknown) {
        if (!active) return;
        if (isAbortError(error)) return;
        setFilters(null);
        setReady(null);
        setLoadFailed(true);
      }
    }

    void loadFilters();
    return () => {
      active = false;
      controller.abort();
    };
  }, [attempt]);

  useEffect(() => {
    if (filters === null) return undefined;
    const loadedFilters = filters;
    const requestedQuery = query;
    const controller = new AbortController();
    let active = true;
    const placesUrl = withQuery(placesEndpoint(window.location.hostname), requestedQuery);

    async function loadPlaces(): Promise<void> {
      try {
        setLoadFailed(false);
        const response = await fetch(placesUrl, {
          credentials: 'omit',
          signal: controller.signal,
        });
        if (!response.ok) throw new Error('load failed');
        const body: unknown = await response.json();
        const nextPlaces = readPlaces(body);
        if (nextPlaces === null) throw new Error('load failed');
        if (!active) return;
        setReady({ filters: loadedFilters, places: nextPlaces, query: requestedQuery });
        setLoadFailed(false);
      } catch (error: unknown) {
        if (!active || isAbortError(error)) return;
        setReady(null);
        setLoadFailed(true);
      }
    }

    void loadPlaces();
    return () => {
      active = false;
      controller.abort();
    };
  }, [filters, query]);

  useEffect(() => {
    paintMarkers();
  }, [rowsKey]);

  useEffect(() => {
    const session = sessionRef.current;
    const showAgain = view === 'map' && !startedOnMap.current;
    if (showAgain && session !== null) {
      session.map.resize();
      if (!awaitingRef.current) {
        frameMap(session.map, session.lib, markerPositions(rowsRef.current, failedRef.current));
      }
    }
    startedOnMap.current = view === 'map';
  }, [view]);

  useEffect(() => {
    let cancelled = false;

    function onLoad(script: Element): void {
      const lib = window.maplibregl;
      if (lib === undefined) {
        script.remove();
        if (cancelled) return;
        setScriptFailed(true);
        setView('table');
        return;
      }
      if (cancelled) return;
      const container = document.getElementById('shop-places-map');
      if (!(container instanceof HTMLElement)) {
        setScriptFailed(true);
        setView('table');
        return;
      }
      if (sessionRef.current !== null) return;
      try {
        const map = new lib.Map({
          container,
          style: TILE_STYLE,
          center: HOME_CENTER,
          zoom: HOME_ZOOM,
          locale: {
            'NavigationControl.ZoomIn': copy.zoomIn,
            'NavigationControl.ZoomOut': copy.zoomOut,
            'NavigationControl.ResetBearing': copy.resetBearing,
            'AttributionControl.ToggleAttribution': copy.toggleAttribution,
            'AttributionControl.MapFeedback': copy.mapFeedback,
            'Popup.Close': copy.closePopup,
            'Map.Title': copy.mapTitle,
          },
        });
        map.addControl(new lib.NavigationControl(), 'top-right');
        sessionRef.current = { map, lib };
        paintMarkers();
      } catch {
        setScriptFailed(true);
        setView('table');
      }
    }

    function onError(script: Element): void {
      script.remove();
      if (cancelled) return;
      setScriptFailed(true);
      setView('table');
    }

    function listen(script: Element): void {
      script.addEventListener('load', () => {
        onLoad(script);
      });
      script.addEventListener('error', () => {
        onError(script);
      });
    }

    function appendScript(): void {
      const script = document.createElement('script');
      script.src = MAP_SCRIPT_URL;
      script.async = true;
      script.setAttribute('data-shops-map', 'loading');
      listen(script);
      document.head.appendChild(script);
    }

    if (findByUrl('link', MAP_STYLE_URL) === null) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = MAP_STYLE_URL;
      document.head.appendChild(link);
    }
    const existing = findByUrl('script', MAP_SCRIPT_URL);
    if (window.maplibregl !== undefined && existing !== null) {
      onLoad(existing);
    } else if (existing === null) {
      appendScript();
    } else if (existing.getAttribute('data-shops-map') === 'loading') {
      listen(existing);
    } else {
      setScriptFailed(true);
      setView('table');
    }

    return () => {
      cancelled = true;
      const session = sessionRef.current;
      if (session !== null) session.map.remove();
      sessionRef.current = null;
      for (const marker of markersRef.current) marker.remove();
      markersRef.current = [];
    };
  }, [
    copy.zoomIn,
    copy.zoomOut,
    copy.resetBearing,
    copy.toggleAttribution,
    copy.mapFeedback,
    copy.closePopup,
    copy.mapTitle,
  ]);

  function retryFilters(): void {
    setAttempt((current) => current + 1);
  }

  function downloadCsv(): void {
    if (rows.length === 0) return;
    const header = [
      copy.colName,
      copy.colLocation,
      copy.colCountry,
      copy.colShop,
      copy.colProvider,
      copy.colActivity,
      copy.colUrl,
    ];
    const lines = [
      header,
      ...rows.map((row) => [
        row.name,
        row.location,
        row.country,
        row.shop,
        row.provider,
        row.activity,
        row.href === null ? '' : `${window.location.origin}${row.href}`,
      ]),
    ];
    const csv = `\uFEFF${lines.map((line) => line.map(csvField).join(',')).join('\r\n')}`;
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'stores.csv';
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <section
      id="shops"
      className="bg-[#fff] text-[#272b38] [--color-app-danger:#b91c1c] [--color-app-focus:#171717] [--color-app-btn:#171717] [--color-app-btn-fg:#ffffff] [--color-app-btn-hover:#404040]"
    >
      <div className="mx-auto max-w-[1100px] px-5 py-20">
        <h2 className="text-2xl font-semibold">{copy.title}</h2>
        <p>{copy.lead}</p>
        <div className="flex flex-wrap items-end gap-4">
          <label>
            {copy.country}
            <select
              className="min-h-11 rounded-lg border border-[#ced1da] bg-[#fff] px-3"
              value={countryActive}
              onChange={(event) => onTextChoice(event, countryActive, setCountry)}
            >
              <option value="">{copy.all}</option>
              {countries.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          <label>
            {copy.name}
            <select
              className="min-h-11 rounded-lg border border-[#ced1da] bg-[#fff] px-3"
              value={shopNameActive}
              onChange={(event) => onTextChoice(event, shopNameActive, setShopName)}
            >
              <option value="">{copy.all}</option>
              {shopNames.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          <FilterMenu
            label={copy.blockchain}
            value={blockchainActive}
            allLabel={copy.all}
            options={textChoices(blockchainOptions, copy.all)}
            onChange={setBlockchain}
          />
          <FilterMenu
            label={copy.asset}
            value={asset}
            allLabel={copy.all}
            options={textChoices(assetOptions, copy.all)}
            onChange={setAsset}
          />
          <FilterMenu
            label={copy.activity}
            value={activityActive}
            allLabel={copy.all}
            options={activityChoices(activities, copy)}
            onChange={setActivity}
          />
          <IconButton
            type="button"
            aria-label={copy.helpLabel}
            popoverTarget={helpId}
            variant="primary"
            size="md"
          >
            <CircleHelp aria-hidden="true" className="h-4 w-4" />
          </IconButton>
          <div className="basis-full">
            <div
              role="group"
              aria-label={copy.view}
              className="inline-flex min-h-11 items-center rounded-full border border-[#ced1da] bg-[#fff] px-1"
            >
              <button
                type="button"
                aria-pressed={view === 'map'}
                className={viewButtonClass(view === 'map')}
                onClick={() => setView('map')}
              >
                {copy.map}
              </button>
              <button
                type="button"
                aria-pressed={view === 'table'}
                className={viewButtonClass(view === 'table')}
                onClick={() => setView('table')}
              >
                {copy.table}
              </button>
            </div>
          </div>
        </div>
        <div
          id={helpId}
          popover="auto"
          className="border border-[#ced1da] bg-[#fff] text-[#272b38] [color-scheme:light]"
        >
          <dl>
            <div>
              <dt>
                <span className="shop-place-marker is-daily" aria-hidden="true" />
                {copy.daily}
              </dt>
              <dd>{copy.dailyHelp}</dd>
            </div>
            <div>
              <dt>
                <span className="shop-place-marker is-weekly" aria-hidden="true" />
                {copy.weekly}
              </dt>
              <dd>{copy.weeklyHelp}</dd>
            </div>
            <div>
              <dt>
                <span className="shop-place-marker is-monthly" aria-hidden="true" />
                {copy.monthly}
              </dt>
              <dd>{copy.monthlyHelp}</dd>
            </div>
            <div>
              <dt>
                <span className="shop-place-marker is-idle" aria-hidden="true" />
                {copy.idle}
              </dt>
              <dd>{copy.idleHelp}</dd>
            </div>
            <div>
              <dt>
                <span className="shop-place-marker is-none" aria-hidden="true" />
                {copy.none}
              </dt>
              <dd>{copy.noneHelp}</dd>
            </div>
          </dl>
          <p>{copy.hierarchy}</p>
        </div>
        {showError ? (
          <div className="flex flex-wrap items-center gap-3">
            <p role="alert" className="text-center text-sm text-app-danger">
              {copy.error}
            </p>
            <Button type="button" onClick={retryFilters}>
              {copy.retry}
            </Button>
          </div>
        ) : null}
        {showEmpty ? <p>{copy.empty}</p> : null}
        <div
          id="shop-places-map"
          hidden={view !== 'map'}
          className="h-[28rem] min-h-[28rem] w-full"
        />
        <div hidden={view !== 'table'}>
          <Button type="button" onClick={downloadCsv}>
            {copy.csv}
          </Button>
          <div hidden={view !== 'table'} className="w-full min-w-0 max-w-full">
            <table className="w-full table-fixed">
              <thead>
                <tr>
                  <th className="min-w-0 break-words align-top">{copy.colName}</th>
                  <th className="min-w-0 break-words align-top">{copy.colLocation}</th>
                  <th className="min-w-0 break-words align-top">{copy.colCountry}</th>
                  <th className="min-w-0 break-words align-top">{copy.colShop}</th>
                  <th className="min-w-0 break-words align-top">{copy.colProvider}</th>
                  <th className="min-w-0 break-words align-top">{copy.colActivity}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.key}>
                    <td className="min-w-0 break-words align-top">
                      {row.href === null ? (
                        row.name
                      ) : (
                        <Link href={row.href} className="font-medium underline underline-offset-2">
                          {row.name}
                        </Link>
                      )}
                    </td>
                    <td className="min-w-0 break-words align-top">{row.location}</td>
                    <td className="min-w-0 break-words align-top">{row.country}</td>
                    <td className="min-w-0 break-words align-top">{row.shop}</td>
                    <td className="min-w-0 break-words align-top">{row.provider}</td>
                    <td className="min-w-0 break-words align-top">{row.activity}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
}
