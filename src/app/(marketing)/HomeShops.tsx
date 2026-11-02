'use client';

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import type { ReactElement } from 'react';
import { CircleHelp } from 'lucide-react';
import { SHOP_NPUB_RE } from '@/lib/api-types';
import { countryDisplayName } from '@/lib/countries';
import type { Locale } from '@/lib/locale';
import { getCatalog } from '@/lib/messages';
import { translate } from '@/lib/translate';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { FilterMenu, type MenuOption } from './FilterMenu';

type HomeShopsCopy = {
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

type SortColumn = 'name' | 'location' | 'country' | 'shop' | 'activity';

type SortDir = 'asc' | 'desc';

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
  activityToken: string;
  markerClass: string;
  markerTitle: string;
  position: LngLat | null;
  category: string;
  coverPhotoUrl: string | null;
};

type FramePadding = { top: number; bottom: number; left: number; right: number };

type MapStyle = string | Record<string, unknown>;

type MapHandle = {
  addControl: (control: object, position: string) => void;
  resize: () => void;
  setCenter: (center: LngLat) => void;
  setZoom: (zoom: number) => void;
  fitBounds: (
    bounds: LngLatBoundsHandle,
    options: {
      padding: number | FramePadding;
      maxZoom: number;
      duration?: number;
      animate?: boolean;
    },
  ) => void;
  remove: () => void;
  project?: (position: LngLat) => { x: number; y: number };
  unproject?: (point: [number, number]) => { lng: number; lat: number };
  getZoom?: () => number;
  loaded?: () => boolean;
  getContainer?: () => HTMLElement;
  panBy?: (offset: [number, number], options?: { duration?: number }) => void;
  on?: (event: string, handler: () => void) => void;
  off?: (event: string, handler: () => void) => void;
  once?: (event: string, handler: () => void) => void;
};

type LngLatBoundsHandle = { extend: (position: LngLat) => void };

type MarkerHandle = {
  setLngLat: (position: LngLat) => MarkerHandle;
  setPopup: (popup: PopupHandle) => MarkerHandle;
  addTo: (map: MapHandle) => MarkerHandle;
  remove: () => void;
  getLngLat: () => { lng: number; lat: number };
  getElement?: () => HTMLElement;
};

type PopupHandle = {
  setDOMContent: (content: HTMLElement) => PopupHandle;
  remove: () => void;
};

type MapLibreNamespace = {
  Map: new (options: {
    container: HTMLElement;
    style: MapStyle;
    center: LngLat;
    zoom: number;
    renderWorldCopies?: boolean;
    attributionControl?: { compact: boolean; customAttribution: string };
    locale?: Record<string, string>;
  }) => MapHandle;
  NavigationControl: new (options?: { showCompass?: boolean }) => object;
  Marker: new (options: { element: HTMLElement }) => MarkerHandle;
  Popup: new (options: {
    offset: number;
    closeButton?: boolean;
    focusAfterOpen?: boolean;
    className?: string;
  }) => PopupHandle;
  LngLatBounds: new () => LngLatBoundsHandle;
};

type MapSession = { map: MapHandle; lib: MapLibreNamespace; onMove: (() => void) | null };

type PinRecord = { element: HTMLButtonElement; row: ShopRow; position: LngLat };

type HelpBox = { top: number; left: number; width: number };

function helpPanelBox(anchor: DOMRect, panelHeight: number): HelpBox {
  const margin = 16;
  const gap = 8;
  const width = Math.min(320, window.innerWidth - margin * 2);
  let left = anchor.left;
  if (left + width > window.innerWidth - margin) left = window.innerWidth - margin - width;
  if (left < margin) left = margin;
  const below = anchor.bottom + gap;
  const above = anchor.top - gap - panelHeight;
  const fitsBelow = below + panelHeight <= window.innerHeight - margin;
  let top = fitsBelow ? below : above;
  if (top < margin) top = margin;
  const limit = window.innerHeight - margin - panelHeight;
  if (top > limit) top = Math.max(margin, limit);
  return { top, left, width };
}

declare global {
  interface Window {
    maplibregl?: MapLibreNamespace;
  }
}

const PROD_PLACES = 'https://api.opencryptopay.io/map/places';
const DEV_PLACES = 'https://dev-api.opencryptopay.io/map/places';
const MAP_STYLE_URL = 'https://unpkg.com/maplibre-gl@5.6.1/dist/maplibre-gl.css';
const MAP_SCRIPT_URL = 'https://unpkg.com/maplibre-gl@5.6.1/dist/maplibre-gl.js';

/** Nonce of a script already on this page, or empty when none is set. */
function pageScriptNonce(): string {
  for (const node of document.scripts) {
    const nonce = node.nonce;
    if (nonce !== undefined && nonce !== '') {
      return nonce;
    }
  }
  return '';
}
const TILE_STYLE = 'https://tiles.openfreemap.org/styles/positron';
const HOME_CENTER: LngLat = [8.23, 46.8];
const HOME_ZOOM = 7;
const SINGLE_ZOOM = 12;
const BOUNDS_MAX_ZOOM = 12;
const CLUSTER_ZOOM = 17;
const CLUSTER_MAX_ZOOM = 17.5;
const CLUSTER_PX = 44;
const GIFTS = '21.gifts';
const FRAME_PADDING: FramePadding = { top: 56, bottom: 72, left: 56, right: 88 };
const ACTIVITY_ORDER = ['daily', 'within7Days', 'within30Days', 'olderThan30Days', 'none'] as const;
const EMPTY_SELECTION: Selection = {
  country: '',
  shopName: '',
  blockchain: '',
  asset: '',
  activity: '',
};

const HELP_ROWS: readonly (readonly [keyof HomeShopsCopy, keyof HomeShopsCopy, string])[] = [
  ['daily', 'dailyHelp', 'shop-place-marker is-daily'],
  ['weekly', 'weeklyHelp', 'shop-place-marker is-weekly'],
  ['monthly', 'monthlyHelp', 'shop-place-marker is-monthly'],
  ['idle', 'idleHelp', 'shop-place-marker is-idle'],
  ['none', 'noneHelp', 'shop-place-marker is-none'],
];

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

function giftsPlaces(places: readonly Record<string, unknown>[]): Record<string, unknown>[] {
  const rows: Record<string, unknown>[] = [];
  for (const place of places) {
    if (place['techProvider'] === GIFTS) rows.push(place);
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

function trimmedString(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function countryCode(value: unknown): string {
  return trimmedString(value);
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
  return countryCode(country) === selected;
}

function shopNameMatches(shopName: unknown, selected: string): boolean {
  if (selected === '') return true;
  if (selected === 'SPAR') return shopName === 'SPAR';
  return shopName !== 'SPAR';
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

function clusterTone(token: string): string {
  if (token === 'daily') return 'is-daily';
  if (token === 'within7Days') return 'is-weekly';
  if (token === 'within30Days') return 'is-monthly';
  if (token === 'olderThan30Days') return 'is-idle';
  return 'is-none';
}

function activityRank(token: string): number {
  let index = 0;
  for (const known of ACTIVITY_ORDER) {
    if (known === token) return index;
    index += 1;
  }
  return ACTIVITY_ORDER.length;
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
  provider: GiftsProvider | null,
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
  if (provider === null || provider.pairs === null) return false;
  for (const pair of provider.pairs) {
    if (entryMatches(pair, blockchain, asset)) return true;
  }
  return false;
}

function entriesFor(
  place: Record<string, unknown>,
  provider: GiftsProvider | null,
): readonly unknown[] | null {
  const supports = place['supports'];
  if (Array.isArray(supports) && supports.length > 0) return supports;
  if (supports !== undefined && supports !== null && !Array.isArray(supports)) return null;
  if (provider === null || provider.pairs === null) return null;
  return provider.pairs;
}

function fieldValues(
  place: Record<string, unknown>,
  provider: GiftsProvider | null,
  field: 'blockchain' | 'asset',
  blockchain: string,
): string[] {
  const entries = entriesFor(place, provider);
  if (entries === null) return [];
  const seen = new Set<string>();
  const values: string[] = [];
  for (const entry of entries) {
    if (!isRecord(entry)) continue;
    if (field === 'asset' && blockchain !== '' && entry['blockchain'] !== blockchain) continue;
    const raw = entry[field];
    if (typeof raw !== 'string' || raw === '' || seen.has(raw)) continue;
    seen.add(raw);
    values.push(raw);
  }
  return values;
}

function uniqueValues(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    if (seen.has(value)) continue;
    seen.add(value);
    result.push(value);
  }
  return sortWithLessThan(result);
}

function countWhere(
  places: readonly Record<string, unknown>[],
  matches: (place: Record<string, unknown>) => boolean,
): number {
  let count = 0;
  for (const place of places) {
    if (matches(place)) count += 1;
  }
  return count;
}

function splittingValues(
  places: readonly Record<string, unknown>[],
  values: readonly string[],
  matches: (place: Record<string, unknown>, value: string) => boolean,
): string[] {
  const total = places.length;
  if (total === 0) return [];
  const shown: string[] = [];
  let split = false;
  for (const value of values) {
    const count = countWhere(places, (place) => matches(place, value));
    if (count > 0) shown.push(value);
    if (count > 0 && count < total) split = true;
  }
  if (!split) return [];
  return shown;
}

function countryValues(places: readonly Record<string, unknown>[], locale: string): string[] {
  const codes = uniqueValues(
    places.map((place) => countryCode(place['country'])).filter((code) => code !== ''),
  );
  const shown = splittingValues(
    places,
    codes,
    (place, code) => countryCode(place['country']) === code,
  );
  const collator = new Intl.Collator(locale, { numeric: true, sensitivity: 'base' });
  shown.sort((left, right) =>
    collator.compare(countryDisplayName(left, locale), countryDisplayName(right, locale)),
  );
  return shown;
}

function nameValues(places: readonly Record<string, unknown>[]): string[] {
  const values: string[] = [];
  if (countWhere(places, (place) => place['shopName'] === 'SPAR') > 0) values.push('SPAR');
  if (countWhere(places, (place) => place['shopName'] !== 'SPAR') > 0) values.push('others');
  return splittingValues(places, values, (place, value) => {
    if (value === 'SPAR') return place['shopName'] === 'SPAR';
    return place['shopName'] !== 'SPAR';
  });
}

function activityValues(places: readonly Record<string, unknown>[]): string[] {
  const present = new Set<string>();
  for (const place of places) {
    const activity = place['activity'];
    if (typeof activity !== 'string') continue;
    const token = activity.trim();
    if (token !== '') present.add(token);
  }
  const ordered: string[] = [];
  for (const token of ACTIVITY_ORDER) {
    if (present.has(token)) ordered.push(token);
  }
  const unknown: string[] = [];
  for (const token of present) {
    if (activityRank(token) === ACTIVITY_ORDER.length) unknown.push(token);
  }
  return splittingValues(places, ordered.concat(sortWithLessThan(unknown)), (place, token) => {
    const activity = typeof place['activity'] === 'string' ? place['activity'] : '';
    return activityMatches(activity, token);
  });
}

function blockchainValues(
  places: readonly Record<string, unknown>[],
  provider: GiftsProvider | null,
): string[] {
  const values = uniqueValues(
    places.flatMap((place) => fieldValues(place, provider, 'blockchain', '')),
  );
  return splittingValues(places, values, (place, value) =>
    chainMatches(place, provider, value, ''),
  );
}

function assetValues(
  places: readonly Record<string, unknown>[],
  provider: GiftsProvider | null,
  blockchain: string,
): string[] {
  const values = uniqueValues(
    places.flatMap((place) => fieldValues(place, provider, 'asset', blockchain)),
  );
  return splittingValues(places, values, (place, value) =>
    chainMatches(place, provider, blockchain, value),
  );
}

function keptValue(selected: string, options: readonly string[]): string {
  if (selected === '') return '';
  for (const option of options) {
    if (option === selected) return selected;
  }
  return '';
}

function textChoices(tokens: readonly string[], allLabel: string): MenuOption[] {
  const options: MenuOption[] = [{ value: '', label: allLabel, swatch: null }];
  for (const token of tokens) options.push({ value: token, label: token, swatch: null });
  return options;
}

function countryChoices(codes: readonly string[], allLabel: string, locale: string): MenuOption[] {
  const options: MenuOption[] = [{ value: '', label: allLabel, swatch: null }];
  for (const code of codes) {
    options.push({ value: code, label: countryDisplayName(code, locale), swatch: null });
  }
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
      if (!chainMatches(place, provider, selection.blockchain, selection.asset)) continue;
    }
    const id = place['id'];
    rows.push({
      key: rowKey(id, rows.length),
      name: trimmedString(place['name']),
      href: hrefFor(id),
      location: locationText(place),
      country: countryCode(place['country']),
      shop: trimmedString(place['shopName']),
      provider: techProvider,
      activity: activityOptionLabel(activity, copy),
      activityToken: activity,
      markerClass: markerClass(activity),
      markerTitle: markerTitle(activity, copy),
      position: readPosition(place),
      category: trimmedString(place['category']),
      coverPhotoUrl: coverPhotoUrl(place),
    });
  }
  return rows;
}

function differs(rows: readonly ShopRow[], read: (row: ShopRow) => string): boolean {
  const first = rows[0];
  if (first === undefined) return false;
  const value = read(first);
  for (const row of rows) {
    if (read(row) !== value) return true;
  }
  return false;
}

function sortText(row: ShopRow, column: SortColumn, locale: string): string {
  if (column === 'name') return row.name;
  if (column === 'location') return row.location;
  if (column === 'country') return countryDisplayName(row.country, locale);
  if (column === 'shop') return row.shop;
  return row.activity;
}

function sortShopRows(
  rows: readonly ShopRow[],
  column: SortColumn,
  dir: SortDir,
  locale: string,
): ShopRow[] {
  const collator = new Intl.Collator(locale, { numeric: true, sensitivity: 'base' });
  const sorted = [...rows];
  sorted.sort((left, right) => {
    const primary =
      column === 'activity'
        ? activityRank(left.activityToken) - activityRank(right.activityToken)
        : collator.compare(sortText(left, column, locale), sortText(right, column, locale));
    if (primary !== 0) return dir === 'desc' ? -primary : primary;
    return collator.compare(left.name, right.name);
  });
  return sorted;
}

function findByUrl(tagName: 'script' | 'link', url: string): Element | null {
  const nodes = document.getElementsByTagName(tagName);
  for (const node of nodes) {
    const value = tagName === 'script' ? node.getAttribute('src') : node.getAttribute('href');
    if (value === url) return node;
  }
  return null;
}

const framedMaps = new WeakSet<MapHandle>();

function boundsMotion(map: MapHandle, first: boolean): { duration: number; animate?: false } {
  const unloaded = typeof map.loaded === 'function' && map.loaded() === false;
  if (first || unloaded) return { duration: 0, animate: false };
  return { duration: 800 };
}

function clusterMotion(map: MapHandle): { duration: number; animate?: false } {
  if (typeof map.loaded === 'function' && map.loaded() === false) {
    return { duration: 0, animate: false };
  }
  return { duration: 600 };
}

function frameMap(map: MapHandle, lib: MapLibreNamespace, positions: readonly LngLat[]): void {
  const first = !framedMaps.has(map);
  framedMaps.add(map);
  const motion = boundsMotion(map, first);
  if (positions.length > 1) {
    const bounds = new lib.LngLatBounds();
    for (const position of positions) bounds.extend(position);
    map.fitBounds(bounds, {
      padding: FRAME_PADDING,
      maxZoom: BOUNDS_MAX_ZOOM,
      ...motion,
    });
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

function markerPositions(rows: readonly ShopRow[], failed: boolean): LngLat[] {
  if (failed) return [];
  const positions: LngLat[] = [];
  for (const row of rows) {
    if (row.position === null) continue;
    positions.push(row.position);
  }
  return positions;
}

function svgIcon(path: string, className: string): SVGSVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('class', className);
  const shape = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  shape.setAttribute('d', path);
  svg.appendChild(shape);
  return svg;
}

function popupContent(
  row: ShopRow,
  showCategory: boolean,
  closeLabel: string,
  onClose: () => void,
): HTMLElement {
  const content = document.createElement('div');
  content.className = 'shop-popup-card';
  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'shop-popup-close';
  close.setAttribute('aria-label', closeLabel);
  close.appendChild(svgIcon('M18 6 6 18M6 6l12 12', 'shop-popup-x'));
  close.addEventListener('click', (event: MouseEvent) => {
    event.stopPropagation();
    onClose();
  });
  content.appendChild(close);
  if (row.coverPhotoUrl !== null) {
    const image = document.createElement('img');
    image.src = row.coverPhotoUrl;
    image.alt = '';
    image.setAttribute('loading', 'lazy');
    image.setAttribute('referrerpolicy', 'no-referrer');
    image.className = 'shop-popup-photo';
    content.appendChild(image);
  }
  const title = document.createElement('div');
  title.className = 'shop-popup-title';
  if (row.href === null) {
    const name = document.createElement('strong');
    name.className = 'shop-popup-name';
    name.textContent = row.name;
    title.appendChild(name);
  } else {
    const name = document.createElement('a');
    name.href = row.href;
    name.className = 'shop-popup-name';
    name.appendChild(document.createTextNode(row.name));
    name.appendChild(svgIcon('M5 12h14M12 5l7 7-7 7', 'shop-popup-arrow'));
    title.appendChild(name);
  }
  content.appendChild(title);
  const chips = document.createElement('div');
  chips.className = 'shop-popup-chips';
  if (row.markerTitle !== '') {
    const activity = document.createElement('span');
    activity.className = 'shop-popup-chip';
    const dot = document.createElement('span');
    dot.className = row.markerClass;
    dot.setAttribute('aria-hidden', 'true');
    activity.appendChild(dot);
    activity.appendChild(document.createTextNode(row.markerTitle));
    chips.appendChild(activity);
  }
  if (showCategory && row.category !== '') {
    const category = document.createElement('span');
    category.className = 'shop-popup-chip shop-popup-category';
    category.textContent = row.category;
    chips.appendChild(category);
  }
  if (chips.childNodes.length > 0) content.appendChild(chips);
  return content;
}

function paintRecord(layer: Record<string, unknown>): Record<string, unknown> {
  const paint = layer['paint'];
  if (!isRecord(paint)) return {};
  return { ...paint };
}

function roadColor(id: string): string | null {
  if (/dashline/.test(id)) return null;
  if (/casing/.test(id)) return '#d3cdc2';
  if (/motorway_inner|motorway_bridge_inner/.test(id)) return '#efe9df';
  if (/inner|runway$/.test(id)) return '#ffffff';
  if (/subtle/.test(id)) return 'rgba(211,205,194,0.6)';
  if (/minor/.test(id)) return '#e3ded5';
  if (/path|pier/.test(id)) return '#ebe7e0';
  if (/rail/.test(id)) return '#dcd7ce';
  return '#e3ded5';
}

function restyleLayers(style: Record<string, unknown>, locale: string): Record<string, unknown> {
  const layers = style['layers'];
  if (!Array.isArray(layers)) return style;
  for (const layer of layers) {
    if (!isRecord(layer)) continue;
    const id = typeof layer['id'] === 'string' ? layer['id'] : '';
    const type = layer['type'];
    if (type === 'background') {
      layer['paint'] = { 'background-color': '#ffffff' };
    } else if (/water/.test(id) && type === 'fill') {
      layer['paint'] = { 'fill-color': '#f5f2ec' };
    } else if (/water/.test(id) && type === 'line') {
      layer['paint'] = { ...paintRecord(layer), 'line-color': '#f5f2ec' };
    } else if (/landcover|landuse|park/.test(id) && type === 'fill') {
      layer['paint'] = { ...paintRecord(layer), 'fill-opacity': 0 };
    } else if (/boundary/.test(id) && type === 'line') {
      layer['paint'] = { ...paintRecord(layer), 'line-color': 'rgba(10,9,12,0.16)' };
    } else if (/road|highway|tunnel|bridge|rail|aeroway/.test(id) && type === 'line') {
      const color = roadColor(id);
      if (color !== null) layer['paint'] = { ...paintRecord(layer), 'line-color': color };
    } else if (/building/.test(id) && type === 'fill') {
      layer['paint'] = { 'fill-color': '#eeebe5' };
    }
    if (type === 'symbol') {
      const paint = paintRecord(layer);
      const water = /water/.test(id);
      paint['text-color'] = water ? 'rgba(10,9,12,0.32)' : 'rgba(10,9,12,0.58)';
      paint['text-halo-color'] = water ? '#f5f2ec' : '#ffffff';
      layer['paint'] = paint;
      const layout = layer['layout'];
      if (isRecord(layout) && layout['text-field'] !== undefined) {
        layer['layout'] = {
          ...layout,
          'text-field': [
            'coalesce',
            ['get', `name:${locale}`],
            ['get', 'name:latin'],
            ['get', 'name'],
          ],
        };
      }
    }
  }
  return style;
}

async function loadMapStyle(locale: string, signal: AbortSignal): Promise<MapStyle | null> {
  /* v8 ignore next -- the controller starts unaborted; cleanup aborts the request mid-flight */
  if (signal.aborted) return null;
  try {
    const response = await fetch(TILE_STYLE, { credentials: 'omit', signal });
    if (signal.aborted) return null;
    if (!response.ok) return TILE_STYLE;
    const json: unknown = await response.json();
    if (signal.aborted) return null;
    if (!isRecord(json)) return TILE_STYLE;
    return restyleLayers(json, locale);
  } catch (error: unknown) {
    if (signal.aborted || isAbortError(error)) return null;
    return TILE_STYLE;
  }
}

function revealAttribution(map: MapHandle): void {
  if (typeof map.getContainer !== 'function') return;
  const container = map.getContainer();
  if (!(container instanceof HTMLElement)) return;
  const attrib = container.querySelector('.maplibregl-ctrl-attrib');
  if (!(attrib instanceof HTMLElement)) return;
  attrib.classList.remove('maplibregl-compact-show');
  attrib.removeAttribute('open');
}

function fitPopup(map: MapHandle): void {
  if (typeof map.getContainer !== 'function' || typeof map.panBy !== 'function') return;
  const container = map.getContainer();
  if (!(container instanceof HTMLElement)) return;
  const popup = container.querySelector('.maplibregl-popup');
  if (!(popup instanceof HTMLElement)) return;
  const popupBox = popup.getBoundingClientRect();
  const mapBox = container.getBoundingClientRect();
  const pad = 16;
  let dx = 0;
  let dy = 0;
  if (popupBox.top < mapBox.top + pad) dy = popupBox.top - (mapBox.top + pad);
  else if (popupBox.bottom > mapBox.bottom - pad) dy = popupBox.bottom - (mapBox.bottom - pad);
  if (popupBox.left < mapBox.left + pad) dx = popupBox.left - (mapBox.left + pad);
  else if (popupBox.right > mapBox.right - pad) dx = popupBox.right - (mapBox.right - pad);
  if (dx !== 0 || dy !== 0) map.panBy([dx, dy], { duration: 250 });
}

function mapRect(map: MapHandle): DOMRect | null {
  const node =
    typeof map.getContainer === 'function'
      ? map.getContainer()
      : document.getElementById('shop-places-map');
  if (!(node instanceof HTMLElement)) return null;
  return node.getBoundingClientRect();
}

function clusterBox(map: MapHandle): DOMRect | null {
  if (typeof map.project !== 'function' || typeof map.getZoom !== 'function') return null;
  const rect = mapRect(map);
  if (rect === null) return null;
  if (rect.width === 0 && rect.height === 0) return null;
  return rect;
}

const PIN_BOX = 24;
const markerSizes = new WeakMap<HTMLElement, { width: number; height: number }>();

function liveOr(live: number, saved: number | undefined): number {
  if (live > 0) return live;
  if (saved !== undefined) return saved;
  return PIN_BOX;
}

function markerSize(element: HTMLElement): { width: number; height: number } {
  const saved = markerSizes.get(element);
  const width = liveOr(element.offsetWidth, saved === undefined ? undefined : saved.width);
  const height = liveOr(element.offsetHeight, saved === undefined ? undefined : saved.height);
  if (element.offsetWidth > 0) markerSizes.set(element, { width, height });
  return { width, height };
}

function axisMisses(start: number, size: number, limit: number): boolean {
  if (start + size <= 0) return true;
  if (start >= limit) return true;
  return false;
}

function markOffscreen(
  map: MapHandle,
  rect: DOMRect,
  element: HTMLElement,
  position: LngLat,
): void {
  const point = projectPoint(map, position);
  if (point === null) {
    element.classList.remove('is-offscreen');
    return;
  }
  const size = markerSize(element);
  const left = point.x - size.width / 2;
  const top = point.y - size.height / 2;
  const outside =
    axisMisses(left, size.width, rect.width) || axisMisses(top, size.height, rect.height);
  element.classList.toggle('is-offscreen', outside);
}

function projectPoint(map: MapHandle, position: LngLat): { x: number; y: number } | null {
  /* v8 ignore next -- clusterBox already required project */
  if (typeof map.project !== 'function') return null;
  try {
    const point = map.project(position);
    if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) return null;
    return point;
  } catch {
    return null;
  }
}

function groupCentroid(group: readonly PinRecord[]): { x: number; y: number } {
  let x = 0;
  let y = 0;
  for (const pin of group) {
    x += pin.position[0];
    y += pin.position[1];
  }
  return { x: x / group.length, y: y / group.length };
}

function screenCentroid(
  group: readonly PinRecord[],
  points: ReadonlyMap<PinRecord, { x: number; y: number }>,
): { x: number; y: number } {
  let x = 0;
  let y = 0;
  for (const pin of group) {
    const point = points.get(pin);
    /* v8 ignore next -- clusterGroups only passes pins that are already in the point map */
    if (point === undefined) continue;
    x += point.x;
    y += point.y;
  }
  return { x: x / group.length, y: y / group.length };
}

function clusterGroups(
  pins: readonly PinRecord[],
  points: ReadonlyMap<PinRecord, { x: number; y: number }>,
): PinRecord[][] {
  const groups: PinRecord[][] = pins.map((pin) => [pin]);
  let merged = true;
  while (merged) {
    merged = false;
    for (let left = 0; left < groups.length && !merged; left += 1) {
      for (let right = left + 1; right < groups.length; right += 1) {
        const leftGroup = groups[left];
        const rightGroup = groups[right];
        /* v8 ignore next -- both indexes are inside groups.length */
        if (leftGroup === undefined || rightGroup === undefined) continue;
        const a = screenCentroid(leftGroup, points);
        const b = screenCentroid(rightGroup, points);
        if (Math.hypot(a.x - b.x, a.y - b.y) >= CLUSTER_PX) continue;
        groups[left] = leftGroup.concat(rightGroup);
        groups.splice(right, 1);
        merged = true;
        break;
      }
    }
  }
  return groups;
}

function bestToken(group: readonly PinRecord[]): string {
  let best: number = ACTIVITY_ORDER.length;
  let token = 'none';
  for (const pin of group) {
    const rank = activityRank(pin.row.activityToken);
    if (rank < best) {
      best = rank;
      token = pin.row.activityToken;
    }
  }
  return token;
}

function clusterPosition(map: MapHandle, group: readonly PinRecord[]): LngLat {
  const average = groupCentroid(group);
  if (typeof map.unproject === 'function') {
    const points = new Map<PinRecord, { x: number; y: number }>();
    for (const pin of group) {
      const point = projectPoint(map, pin.position);
      if (point !== null) points.set(pin, point);
    }
    const screen = screenCentroid(group, points);
    try {
      const lngLat = map.unproject([screen.x, screen.y]);
      if (Number.isFinite(lngLat.lng) && Number.isFinite(lngLat.lat))
        return [lngLat.lng, lngLat.lat];
    } catch {
      return [average.x, average.y];
    }
  }
  return [average.x, average.y];
}

function csvField(value: string): string {
  let safe = value;
  if (/^[=+\-@\t\r]/.test(safe)) safe = `'${safe}`;
  if (/[,"\r\n]/.test(safe)) return `"${safe.replaceAll('"', '""')}"`;
  return safe;
}

function isAbortError(error: unknown): boolean {
  return isRecord(error) && error['name'] === 'AbortError';
}

function cellText(row: ShopRow, column: SortColumn, locale: string): string {
  if (column === 'country') return countryDisplayName(row.country, locale);
  return sortText(row, column, locale);
}

/**
 * Renders the homepage shop directory: filters, map, and table.
 *
 * Filters, columns, and the popup category come from the loaded 21.gifts rows.
 * A control is shown only when its values actually differ.
 *
 * @param props - Localized copy and the page locale.
 * @returns The shop section.
 */
export function HomeShops({ copy, locale }: { copy: HomeShopsCopy; locale: Locale }): ReactElement {
  const [country, setCountry] = useState('');
  const [shopName, setShopName] = useState('');
  const [blockchain, setBlockchain] = useState('');
  const [asset, setAsset] = useState('');
  const [activity, setActivity] = useState('');
  const [view, setView] = useState<ShopView>('map');
  const [attempt, setAttempt] = useState(0);
  const [filters, setFilters] = useState<Filters | null>(null);
  const [ready, setReady] = useState<Ready | null>(null);
  const [census, setCensus] = useState<Record<string, unknown>[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [scriptFailed, setScriptFailed] = useState(false);
  const [sortColumn, setSortColumn] = useState<SortColumn>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [helpOpen, setHelpOpen] = useState(false);
  const [helpBox, setHelpBox] = useState<HelpBox | null>(null);
  const headingId = useId();
  const helpPanelId = useId();
  const helpRef = useRef<HTMLSpanElement>(null);
  const helpPanelRef = useRef<HTMLDivElement>(null);
  const sessionRef = useRef<MapSession | null>(null);
  const markersRef = useRef<MarkerHandle[]>([]);
  const clusterMarkersRef = useRef<MarkerHandle[]>([]);
  const pinsRef = useRef<PinRecord[]>([]);
  const clusterFrame = useRef(0);
  const awaitingRef = useRef(false);
  const rowsRef = useRef<ShopRow[]>([]);
  const showCategoryRef = useRef(false);
  const failedRef = useRef(false);
  const viewRef = useRef<ShopView>('map');
  const startedOnMap = useRef(true);
  const localeRef = useRef(locale);
  localeRef.current = locale;
  const closeLabelRef = useRef(copy.closePopup);
  closeLabelRef.current = copy.closePopup;
  const provider = filters === null ? null : readGiftsProvider(filters.techProviders);
  const source = census ?? [];
  const countries = census === null ? [] : countryValues(source, locale);
  const shopNames = census === null ? [] : nameValues(source);
  const blockchains = census === null ? [] : blockchainValues(source, provider);
  const countryActive = keptValue(country, countries);
  const shopNameActive = keptValue(shopName, shopNames);
  const blockchainActive = keptValue(blockchain, blockchains);
  const assets = census === null ? [] : assetValues(source, provider, blockchainActive);
  const activities = census === null ? [] : activityValues(source);
  const assetActive = keptValue(asset, assets);
  const activityActive = keptValue(activity, activities);
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
  const built = ready !== null && covered ? buildRows(ready.places, provider, selection, copy) : [];
  const rows = sortShopRows(built, sortColumn, sortDir, locale);
  const censusRows = census === null ? [] : buildRows(census, provider, EMPTY_SELECTION, copy);
  const showCountry = differs(censusRows, (row) => row.country);
  const showShop = differs(censusRows, (row) => row.shop);
  const showCategory = differs(censusRows, (row) => row.category);
  const showHelp = census === null || census.length > 0;
  const showLegend = view === 'map' && census !== null && census.length > 0;
  rowsRef.current = rows;
  showCategoryRef.current = showCategory;
  failedRef.current = loadFailed || scriptFailed;
  viewRef.current = view;
  awaitingRef.current = !covered;
  const showError = loadFailed || scriptFailed;
  const showEmpty = !showError && covered && rows.length === 0;
  const rowsKey = `${loadFailed ? 1 : 0}${scriptFailed ? 1 : 0}${covered ? 1 : 0}:${JSON.stringify(built)}`;

  const clearClusters = useCallback((): void => {
    for (const marker of clusterMarkersRef.current) marker.remove();
    clusterMarkersRef.current = [];
    for (const pin of pinsRef.current) pin.element.classList.remove('is-clustered');
  }, []);

  const paintClusters = useCallback((): void => {
    const session = sessionRef.current;
    clearClusters();
    if (session === null || awaitingRef.current || failedRef.current) return;
    const rect = clusterBox(session.map);
    if (rect === null) return;
    const readZoom = session.map.getZoom;
    /* v8 ignore next -- clusterBox already required getZoom */
    if (readZoom === undefined) return;
    const zoom = readZoom.call(session.map);
    const clusters: { element: HTMLElement; position: LngLat }[] = [];
    if (typeof zoom === 'number' && zoom < CLUSTER_ZOOM) {
      const points = new Map<PinRecord, { x: number; y: number }>();
      for (const pin of pinsRef.current) {
        const point = projectPoint(session.map, pin.position);
        if (point !== null) points.set(pin, point);
      }
      const groups = clusterGroups(
        pinsRef.current.filter((pin) => points.has(pin)),
        points,
      );
      for (const group of groups) {
        if (group.length < 2) continue;
        for (const pin of group) pin.element.classList.add('is-clustered');
        const button = document.createElement('button');
        button.type = 'button';
        button.className = `shop-cluster ${clusterTone(bestToken(group))}`;
        button.textContent = String(group.length);
        button.setAttribute(
          'aria-label',
          translate(getCatalog(localeRef.current), 'homeShops.clusterCount', {
            count: group.length,
          }),
        );
        const shell = document.createElement('div');
        shell.className = 'shop-cluster-marker';
        shell.appendChild(button);
        button.addEventListener('click', () => {
          const bounds = new session.lib.LngLatBounds();
          for (const pin of group) bounds.extend(pin.position);
          session.map.fitBounds(bounds, {
            padding: FRAME_PADDING,
            maxZoom: CLUSTER_MAX_ZOOM,
            ...clusterMotion(session.map),
          });
        });
        const position = clusterPosition(session.map, group);
        const marker = new session.lib.Marker({ element: shell });
        marker.setLngLat(position);
        marker.addTo(session.map);
        clusterMarkersRef.current.push(marker);
        clusters.push({ element: shell, position });
      }
    }
    for (const pin of pinsRef.current) {
      markOffscreen(session.map, rect, pin.element, pin.position);
    }
    for (const cluster of clusters) {
      markOffscreen(session.map, rect, cluster.element, cluster.position);
    }
  }, [clearClusters]);

  const scheduleClusters = useCallback((): void => {
    const session = sessionRef.current;
    if (session === null || typeof session.map.project !== 'function') return;
    if (clusterFrame.current !== 0) return;
    clusterFrame.current = requestAnimationFrame(() => {
      clusterFrame.current = 0;
      paintClusters();
    });
  }, [paintClusters]);

  const paintMarkers = useCallback((): void => {
    const session = sessionRef.current;
    if (session === null) return;
    clearClusters();
    for (const marker of markersRef.current) marker.remove();
    markersRef.current = [];
    pinsRef.current = [];
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
        const popup = new session.lib.Popup({
          offset: 16,
          closeButton: false,
          focusAfterOpen: false,
          className: 'shop-popup',
        });
        const content = popupContent(row, showCategoryRef.current, closeLabelRef.current, () => {
          popup.remove();
        });
        element.addEventListener('keydown', (event: KeyboardEvent) => {
          if (event.key !== 'Enter' && event.key !== ' ') return;
          event.preventDefault();
          element.dataset['keyboardOpen'] = '1';
          element.click();
        });
        element.addEventListener('click', () => {
          if (element.dataset['keyboardOpen'] === '1') {
            delete element.dataset['keyboardOpen'];
            const close = content.querySelector('.shop-popup-close');
            if (close instanceof HTMLButtonElement) close.focus();
          }
          fitPopup(session.map);
        });
        const marker = new session.lib.Marker({ element });
        marker.setLngLat(row.position);
        marker.setPopup(popup.setDOMContent(content));
        marker.addTo(session.map);
        markersRef.current.push(marker);
        pinsRef.current.push({ element, row, position: row.position });
      }
    }
    if (viewRef.current === 'map') frameMap(session.map, session.lib, positions);
    scheduleClusters();
  }, [clearClusters, scheduleClusters]);

  useEffect(() => {
    if (census === null) return;
    if (blockchain !== '' && blockchainActive === '') setBlockchain('');
  }, [census, blockchain, blockchainActive]);

  useEffect(() => {
    if (census === null) return;
    if (asset !== '' && assetActive === '') setAsset('');
  }, [census, asset, assetActive]);

  useEffect(() => {
    if (census === null) return;
    if (activity !== '' && activityActive === '') setActivity('');
  }, [census, activity, activityActive]);

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
        const response = await fetch(placesUrl, { credentials: 'omit', signal: controller.signal });
        if (!response.ok) throw new Error('load failed');
        const body: unknown = await response.json();
        const nextPlaces = readPlaces(body);
        if (nextPlaces === null) throw new Error('load failed');
        if (!active) return;
        setReady({ filters: loadedFilters, places: nextPlaces, query: requestedQuery });
        if (requestedQuery === '') setCensus(giftsPlaces(nextPlaces));
        setLoadFailed(false);
      } catch (error: unknown) {
        if (!active || isAbortError(error)) return;
        setReady(null);
        setLoadFailed(true);
        if (requestedQuery === '') setCensus(null);
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
  }, [paintMarkers, rowsKey]);

  useEffect(() => {
    const session = sessionRef.current;
    const showAgain = view === 'map' && !startedOnMap.current;
    if (showAgain && session !== null) {
      session.map.resize();
      if (!awaitingRef.current) {
        frameMap(session.map, session.lib, markerPositions(rowsRef.current, failedRef.current));
        scheduleClusters();
      }
    }
    startedOnMap.current = view === 'map';
  }, [scheduleClusters, view]);

  useEffect(() => {
    let cancelled = false;
    const styleController = new AbortController();

    async function openMap(lib: MapLibreNamespace, container: HTMLElement): Promise<void> {
      const style = await loadMapStyle(localeRef.current, styleController.signal);
      if (cancelled || style === null) return;
      try {
        const map = new lib.Map({
          container,
          style,
          center: HOME_CENTER,
          zoom: HOME_ZOOM,
          renderWorldCopies: false,
          attributionControl: {
            compact: true,
            customAttribution: '<a href="https://maplibre.org/" target="_blank">MapLibre</a>',
          },
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
        map.addControl(new lib.NavigationControl({ showCompass: false }), 'top-right');
        const onMove = (): void => {
          scheduleClusters();
        };
        if (typeof map.on === 'function') {
          map.on('move', onMove);
          map.on('zoom', onMove);
        }
        if (typeof map.once === 'function') map.once('load', () => revealAttribution(map));
        else revealAttribution(map);
        sessionRef.current = { map, lib, onMove };
        paintMarkers();
      } catch {
        setScriptFailed(true);
        setView('table');
      }
    }

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
      void openMap(lib, container);
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
      const nonce = pageScriptNonce();
      if (nonce !== '') {
        script.nonce = nonce;
      }
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
      styleController.abort();
      if (clusterFrame.current !== 0) cancelAnimationFrame(clusterFrame.current);
      clusterFrame.current = 0;
      const session = sessionRef.current;
      if (session !== null) {
        if (session.onMove !== null && typeof session.map.off === 'function') {
          session.map.off('move', session.onMove);
          session.map.off('zoom', session.onMove);
        }
        session.map.remove();
      }
      sessionRef.current = null;
      for (const marker of markersRef.current) marker.remove();
      markersRef.current = [];
      clearClusters();
      pinsRef.current = [];
    };
  }, [
    copy.zoomIn,
    copy.zoomOut,
    copy.resetBearing,
    copy.toggleAttribution,
    copy.mapFeedback,
    copy.closePopup,
    copy.mapTitle,
    clearClusters,
    locale,
    paintMarkers,
    scheduleClusters,
  ]);

  useLayoutEffect(() => {
    if (!helpOpen) return undefined;
    function place(): void {
      const node = helpRef.current;
      if (node === null) return;
      const panel = helpPanelRef.current;
      const panelHeight = panel === null ? 0 : panel.getBoundingClientRect().height;
      const next = helpPanelBox(node.getBoundingClientRect(), panelHeight);
      setHelpBox((current) => {
        if (
          current !== null &&
          current.top === next.top &&
          current.left === next.left &&
          current.width === next.width
        ) {
          return current;
        }
        return next;
      });
    }
    place();
    window.addEventListener('resize', place);
    return () => {
      window.removeEventListener('resize', place);
    };
  }, [helpOpen, helpBox]);

  useEffect(() => {
    if (!helpOpen) return undefined;
    function onPointerDown(event: MouseEvent): void {
      const target = event.target;
      if (!(target instanceof Element)) {
        setHelpOpen(false);
        return;
      }
      if (helpRef.current !== null && helpRef.current.contains(target)) return;
      if (target.closest('[data-shops-help-panel]') !== null) return;
      setHelpOpen(false);
    }
    function onKeyDown(event: KeyboardEvent): void {
      if (event.key !== 'Escape') return;
      setHelpOpen(false);
    }
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [helpOpen]);

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
        countryDisplayName(row.country, locale),
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

  function chooseSort(column: SortColumn): void {
    if (sortColumn === column) {
      setSortDir((current) => (current === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSortColumn(column);
    setSortDir('asc');
  }

  const tableColumns: { key: SortColumn; label: string }[] = [
    { key: 'name', label: copy.colName },
    { key: 'location', label: copy.colLocation },
  ];
  if (showCountry) tableColumns.push({ key: 'country', label: copy.colCountry });
  if (showShop) tableColumns.push({ key: 'shop', label: copy.colShop });
  tableColumns.push({ key: 'activity', label: copy.colActivity });

  return (
    <section
      id="shops"
      aria-labelledby={headingId}
      className="scroll-mt-20 border-b border-ink/10 bg-paper px-5 py-16 text-ink scheme-light sm:py-20"
    >
      <div className="mx-auto max-w-[1100px]">
        <h2
          id={headingId}
          className="text-3xl leading-tight font-semibold tracking-tight text-balance sm:text-4xl"
        >
          {copy.lead}
        </h2>
        <div className="mt-8 rounded-2xl border border-ink/10 bg-home-card">
          <div className="grid grid-cols-2 items-center gap-2 p-3 sm:flex sm:flex-wrap">
            {countries.length > 0 ? (
              <div className="order-2 min-w-0 sm:order-none">
                <FilterMenu
                  label={copy.country}
                  value={countryActive}
                  allLabel={copy.all}
                  options={countryChoices(countries, copy.all, locale)}
                  onChange={setCountry}
                />
              </div>
            ) : null}
            {shopNames.length > 0 ? (
              <div className="order-2 min-w-0 sm:order-none">
                <FilterMenu
                  label={copy.name}
                  value={shopNameActive}
                  allLabel={copy.all}
                  options={textChoices(shopNames, copy.all)}
                  onChange={setShopName}
                />
              </div>
            ) : null}
            {blockchains.length > 0 ? (
              <div className="order-2 min-w-0 sm:order-none">
                <FilterMenu
                  label={copy.blockchain}
                  value={blockchainActive}
                  allLabel={copy.all}
                  options={textChoices(blockchains, copy.all)}
                  onChange={setBlockchain}
                />
              </div>
            ) : null}
            {assets.length > 0 ? (
              <div className="order-2 min-w-0 sm:order-none">
                <FilterMenu
                  label={copy.asset}
                  value={assetActive}
                  allLabel={copy.all}
                  options={textChoices(assets, copy.all)}
                  onChange={setAsset}
                />
              </div>
            ) : null}
            {activities.length > 0 ? (
              <div className="order-2 min-w-0 sm:order-none">
                <FilterMenu
                  label={copy.activity}
                  value={activityActive}
                  allLabel={copy.all}
                  options={activityChoices(activities, copy)}
                  onChange={setActivity}
                />
              </div>
            ) : null}
            <div className="order-1 col-span-2 flex items-center gap-2 sm:contents">
              <SegmentedControl
                tone="neutral"
                ariaLabel={copy.view}
                value={view}
                onChange={setView}
                className="min-w-0 flex-1 sm:order-last sm:ml-auto sm:w-auto sm:flex-none"
                options={[
                  { value: 'map', label: copy.map },
                  { value: 'table', label: copy.table },
                ]}
              />
              {showHelp ? (
                <span ref={helpRef} className="shrink-0">
                  <IconButton
                    type="button"
                    aria-label={copy.helpLabel}
                    aria-expanded={helpOpen}
                    aria-controls={helpPanelId}
                    variant="ghost"
                    size="md"
                    className="border border-ink/12"
                    onClick={() => {
                      setHelpOpen((open) => !open);
                    }}
                  >
                    <CircleHelp aria-hidden="true" className="h-4 w-4" />
                  </IconButton>
                </span>
              ) : null}
            </div>
          </div>
          {showError ? (
            <div className="flex flex-wrap items-center gap-3 px-4 py-3.5">
              <p role="alert" className="text-center text-sm text-app-danger">
                {copy.error}
              </p>
              <Button type="button" onClick={retryFilters}>
                {copy.retry}
              </Button>
            </div>
          ) : null}
          {showEmpty ? <p className="px-4 py-3.5 text-sm text-ink/60">{copy.empty}</p> : null}
          <div className="relative overflow-hidden rounded-b-2xl">
            <div
              id="shop-places-map"
              hidden={view !== 'map'}
              className="h-[26rem] w-full sm:h-[30rem]"
            />
            {showLegend ? (
              <div className="shop-legend pointer-events-none absolute bottom-3 left-3 z-10 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-full border border-ink/12 bg-paper/90 px-3 py-1.5 text-xs text-ink">
                {HELP_ROWS.map(([labelKey, , swatch]) => (
                  <span key={labelKey} className="inline-flex items-center gap-1.5">
                    <span className={swatch} aria-hidden="true" />
                    {copy[labelKey]}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
          <div hidden={view !== 'table'} className="w-full min-w-0 max-w-full rounded-b-2xl">
            <table className="w-full table-fixed">
              <thead>
                <tr className="bg-home-card text-xs font-semibold text-ink/50">
                  {tableColumns.map((column) => {
                    const active = sortColumn === column.key;
                    const ariaSort = active
                      ? sortDir === 'asc'
                        ? 'ascending'
                        : 'descending'
                      : 'none';
                    return (
                      <th
                        key={column.key}
                        aria-sort={ariaSort}
                        className="px-4 py-3 text-left align-top"
                      >
                        <button
                          type="button"
                          className="inline-flex w-full items-center gap-1 text-left font-semibold"
                          onClick={() => {
                            chooseSort(column.key);
                          }}
                        >
                          <span className="min-w-0 break-words">{column.label}</span>
                          <span
                            aria-hidden="true"
                            className={`inline-block h-0 w-0 shrink-0 border-x-4 border-b-[5px] border-x-transparent border-b-current ${
                              active && sortDir === 'desc' ? 'rotate-180' : ''
                            } ${active ? '' : 'opacity-30'}`}
                          />
                        </button>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.key} className="border-t border-ink/10 bg-paper text-sm">
                    {tableColumns.map((column) => (
                      <td key={column.key} className="min-w-0 break-words px-4 py-3.5 align-top">
                        {column.key === 'name' && row.href !== null ? (
                          <a href={row.href} className="font-medium underline underline-offset-2">
                            {row.name}
                          </a>
                        ) : (
                          cellText(row, column.key, locale)
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="flex justify-end px-4 py-3">
              <Button type="button" variant="secondary" onClick={downloadCsv}>
                {copy.csv}
              </Button>
            </div>
          </div>
        </div>
      </div>
      {helpOpen && helpBox !== null && showHelp ? (
        <div
          ref={helpPanelRef}
          id={helpPanelId}
          data-shops-help-panel=""
          role="dialog"
          aria-label={copy.helpLabel}
          className="fixed z-40 rounded-xl border border-ink/10 bg-paper p-4 shadow-lg"
          style={{ top: helpBox.top, left: helpBox.left, width: helpBox.width }}
        >
          <dl className="grid gap-3">
            {HELP_ROWS.map(([labelKey, helpKey, swatch]) => (
              <div key={labelKey}>
                <dt className="flex items-center gap-2 text-sm font-semibold">
                  <span className={swatch} aria-hidden="true" />
                  {copy[labelKey]}
                </dt>
                <dd className="mt-1 text-sm text-ink/60">{copy[helpKey]}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 border-t border-ink/10 pt-3 text-sm text-ink/60">{copy.hierarchy}</p>
        </div>
      ) : null}
    </section>
  );
}
