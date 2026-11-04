import { cleanup, render, screen, within, fireEvent, waitFor, act } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HomeShops } from '@/app/(marketing)/HomeShops';
import { getCatalog } from '@/lib/messages';

const messages = getCatalog('en');

const copy = {
  lead: messages['homeShops.lead'],
  view: messages['homeShops.view'],
  map: messages['homeShops.map'],
  table: messages['homeShops.table'],
  country: messages['homeShops.country'],
  name: messages['homeShops.name'],
  blockchain: messages['homeShops.blockchain'],
  asset: messages['homeShops.asset'],
  activity: messages['homeShops.activity'],
  all: messages['homeShops.all'],
  otherShops: messages['homeShops.otherShops'],
  empty: messages['homeShops.empty'],
  error: messages['map.error'],
  retry: messages['forum.retry'],
  colName: messages['homeShops.colName'],
  colLocation: messages['homeShops.colLocation'],
  colCountry: messages['homeShops.colCountry'],
  colShop: messages['homeShops.colShop'],
  colProvider: messages['homeShops.colProvider'],
  colActivity: messages['homeShops.colActivity'],
  colUrl: messages['homeShops.colUrl'],
  csv: messages['homeShops.csv'],
  helpLabel: messages['homeShops.helpLabel'],
  daily: messages['homeShops.daily'],
  weekly: messages['homeShops.weekly'],
  monthly: messages['homeShops.monthly'],
  idle: messages['homeShops.idle'],
  none: messages['homeShops.none'],
  dailyHelp: messages['homeShops.dailyHelp'],
  weeklyHelp: messages['homeShops.weeklyHelp'],
  monthlyHelp: messages['homeShops.monthlyHelp'],
  idleHelp: messages['homeShops.idleHelp'],
  noneHelp: messages['homeShops.noneHelp'],
  hierarchy: messages['homeShops.hierarchy'],
  zoomIn: messages['homeShops.zoomIn'],
  zoomOut: messages['homeShops.zoomOut'],
  resetBearing: messages['homeShops.resetBearing'],
  toggleAttribution: messages['homeShops.toggleAttribution'],
  mapFeedback: messages['homeShops.mapFeedback'],
  closePopup: messages['homeShops.closePopup'],
  mapTitle: messages['homeShops.mapTitle'],
};

const PROD_PLACES = 'https://api.opencryptopay.io/map/places';
const DEV_PLACES = 'https://dev-api.opencryptopay.io/map/places';
const PROD_FILTERS = 'https://api.opencryptopay.io/map/filters';
const DEV_FILTERS = 'https://dev-api.opencryptopay.io/map/filters';
const MAP_SCRIPT = 'https://unpkg.com/maplibre-gl@5.6.1/dist/maplibre-gl.js';
const MAP_CSS = 'https://unpkg.com/maplibre-gl@5.6.1/dist/maplibre-gl.css';
const TILE_STYLE = 'https://tiles.openfreemap.org/styles/positron';
const FRAME_PADDING = { top: 56, bottom: 72, left: 56, right: 88 };
const HOME_CENTER: [number, number] = [8.23, 46.8];

const originalLocation = window.location;

type Place = Record<string, unknown>;

type PendingCall = {
  url: string;
  init: RequestInit;
  signal: AbortSignal;
  resolve: (response: Response) => void;
  reject: (reason: unknown) => void;
};

type MapDouble = {
  zoom: number | undefined;
  transform: { zoom: number | undefined };
  addControl: ReturnType<typeof vi.fn>;
  resize: ReturnType<typeof vi.fn>;
  setCenter: ReturnType<typeof vi.fn>;
  setZoom: ReturnType<typeof vi.fn>;
  easeTo: ReturnType<typeof vi.fn>;
  fitBounds: ReturnType<typeof vi.fn>;
  remove: ReturnType<typeof vi.fn>;
  getZoom?: ReturnType<typeof vi.fn>;
  loaded?: () => boolean;
};

type MarkerDouble = {
  element: HTMLElement;
  setLngLat: ReturnType<typeof vi.fn>;
  setPopup: ReturnType<typeof vi.fn>;
  addTo: ReturnType<typeof vi.fn>;
  remove: ReturnType<typeof vi.fn>;
  getLngLat: ReturnType<typeof vi.fn>;
};

type PopupDouble = {
  offset: number;
  content: HTMLElement | null;
  setDOMContent: ReturnType<typeof vi.fn>;
  remove: ReturnType<typeof vi.fn>;
  on: ReturnType<typeof vi.fn>;
  emit: (event: string) => void;
};

type BoundsDouble = { extend: ReturnType<typeof vi.fn> };

type MapOptions = {
  container: HTMLElement;
  style: string | Record<string, unknown>;
  center: [number, number];
  zoom: number;
  renderWorldCopies?: boolean;
  trackResize?: boolean;
  attributionControl?: { compact: boolean; customAttribution: string };
  locale?: Record<string, string>;
};

type LibDouble = {
  maps: MapDouble[];
  options: MapOptions[];
  markers: MarkerDouble[];
  popups: PopupDouble[];
  bounds: BoundsDouble[];
  navigationCalls: { count: number };
};

type MapLibreLib = NonNullable<Window['maplibregl']>;

const pending: PendingCall[] = [];

function setHostname(hostname: string): void {
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { hostname, href: `https://${hostname}/`, origin: `https://${hostname}` },
  });
}

function restoreHostname(): void {
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: originalLocation,
  });
}

function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.href;
  return input.url;
}

function installFetch(): void {
  const fetchMock: typeof fetch = (input, init) => {
    if (init === undefined) throw new Error('missing init');
    const signal = init.signal;
    if (signal === null || signal === undefined) throw new Error('missing signal');
    const url = requestUrl(input);
    return new Promise<Response>((resolve, reject) => {
      pending.push({ url, init, signal, resolve, reject });
    });
  };
  vi.stubGlobal('fetch', fetchMock);
}

function callsTo(part: string): PendingCall[] {
  return pending.filter((item) => item.url.includes(part));
}

function latestFilters(): PendingCall {
  const call = callsTo('/map/filters').at(-1);
  if (call === undefined) throw new Error('missing filters call');
  return call;
}

function latestPlaces(): PendingCall {
  const call = callsTo('/map/places').at(-1);
  if (call === undefined) throw new Error('missing places call');
  return call;
}

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function rawJsonResponse(body: unknown): Response {
  const response = new Response('null', {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
  Object.defineProperty(response, 'json', { value: () => Promise.resolve(body) });
  return response;
}

async function resolveLatest(filtersBody: unknown, placesBody: unknown): Promise<void> {
  await act(async () => {
    latestFilters().resolve(jsonResponse(filtersBody, 200));
  });
  await waitFor(() => expect(callsTo('/map/places')).toHaveLength(1));
  await act(async () => {
    latestPlaces().resolve(jsonResponse(placesBody, 200));
  });
}

async function resolveRaw(filtersResponse: Response, placesResponse: Response): Promise<void> {
  await act(async () => {
    latestFilters().resolve(filtersResponse);
  });
  if (!filtersResponse.ok) return;
  await waitFor(() => expect(callsTo('/map/places')).toHaveLength(1));
  await act(async () => {
    latestPlaces().resolve(placesResponse);
  });
}

async function resolvePlaces(body: unknown, status = 200): Promise<void> {
  await act(async () => {
    latestPlaces().resolve(jsonResponse(body, status));
  });
}

function npub(seed: string): string {
  return `npub1${seed.repeat(58)}`;
}

function giftsPlace(name: string, extra: Place): Place {
  return {
    id: npub('q'),
    name,
    shopName: 'SPAR',
    country: 'PH',
    activity: 'daily',
    lat: 14.6,
    lon: 121,
    techProvider: '21.gifts',
    ...extra,
  };
}

function omitKeys(name: string, keys: readonly string[]): Place {
  const row = giftsPlace(name, {});
  for (const key of keys) delete row[key];
  return row;
}

function provider(extra: Place): Place {
  return {
    name: '21.gifts',
    blockchains: ['Bitcoin'],
    assets: ['BTC'],
    pairs: [{ blockchain: 'Bitcoin', asset: 'BTC' }],
    ...extra,
  };
}

function dfxProvider(): Place {
  return {
    name: 'DFX.swiss',
    blockchains: ['Liquid'],
    assets: ['L-BTC'],
    pairs: [{ blockchain: 'Liquid', asset: 'L-BTC' }],
  };
}

function basicFilters(extra: Place): Place {
  return {
    activities: ['daily', 'within7Days', 'within30Days', 'olderThan30Days', 'none'],
    countries: ['PH'],
    shopNames: ['SPAR'],
    techProviders: [null, dfxProvider(), provider({})],
    ...extra,
  };
}

function placesBody(rows: readonly unknown[]): { places: readonly unknown[] } {
  return { places: rows };
}

function renderShops(): ReturnType<typeof render> {
  return render(<HomeShops copy={copy} locale="en" />);
}

function menuValue(label: string): string {
  const node = menuButton(label).querySelector('[data-shop-value]');
  if (node === null || node.textContent === null) throw new Error('missing value');
  return node.textContent;
}

function changeMenu(label: string, value: string): void {
  openMenu(label);
  const option = listboxOptions().find((item) => item.getAttribute('data-value') === value);
  if (option === undefined) throw new Error(`missing option ${value}`);
  fireEvent.click(option);
}

function openValues(label: string): string[] {
  openMenu(label);
  return listboxOptions().map((option) => option.getAttribute('data-value') ?? '');
}

function menuButton(label: string): HTMLElement {
  return screen.getByRole('combobox', { name: label });
}

function openMenu(label: string): HTMLElement {
  const button = menuButton(label);
  for (const other of screen.queryAllByRole('combobox')) {
    if (other !== button && other.getAttribute('aria-expanded') === 'true') {
      fireEvent.click(other);
    }
  }
  if (button.getAttribute('aria-expanded') !== 'true') fireEvent.click(button);
  return button;
}

function activeOption(button: HTMLElement): HTMLElement {
  const id = button.getAttribute('aria-activedescendant');
  if (id === null || id === '') throw new Error('missing active option');
  const option = document.getElementById(id);
  if (option === null) throw new Error('missing active option');
  return option;
}

function listboxOptions(): HTMLElement[] {
  return screen.getAllByRole('listbox').flatMap((box) => within(box).getAllByRole('option'));
}

function chooseOption(label: string): void {
  const option = listboxOptions().find(
    (item) => item.getAttribute('data-value') === label || item.textContent?.trim() === label,
  );
  if (option === undefined) throw new Error(`missing option ${label}`);
  fireEvent.click(option);
}

function optionLabels(): string[] {
  const boxes = screen.getAllByRole('listbox');
  const box = boxes[boxes.length - 1];
  if (box === undefined) throw new Error('listbox');
  return within(box)
    .getAllByRole('option')
    .map((option) => {
      const text = option.textContent;
      if (text === null) throw new Error('option');
      return text;
    });
}

function readBlobBytes(blob: Blob): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (!(reader.result instanceof ArrayBuffer)) {
        reject(new Error('csv bytes'));
        return;
      }
      resolve(new Uint8Array(reader.result));
    };
    reader.onerror = () => {
      reject(reader.error ?? new Error('csv bytes'));
    };
    reader.readAsArrayBuffer(blob);
  });
}

function tableShell(): HTMLElement {
  const table = screen.getByRole('table', { hidden: true });
  const parent = table.parentElement;
  if (parent === null) throw new Error('table shell');
  return parent;
}

function bodyNames(): string[] {
  const table = screen.getByRole('table', { hidden: true });
  const names: string[] = [];
  for (const row of within(table).getAllByRole('row', { hidden: true })) {
    const cell = within(row).queryAllByRole('cell', { hidden: true })[0];
    if (cell === undefined) continue;
    const text = cell.textContent;
    if (text === null) throw new Error('cell');
    names.push(text);
  }
  return names;
}

function rowByName(name: string): HTMLElement {
  const table = screen.getByRole('table', { hidden: true });
  for (const row of within(table).getAllByRole('row', { hidden: true })) {
    const cell = within(row).queryAllByRole('cell', { hidden: true })[0];
    if (cell !== undefined && cell.textContent === name) return row;
  }
  throw new Error(`missing row ${name}`);
}

function cellTexts(name: string): string[] {
  return within(rowByName(name))
    .getAllByRole('cell', { hidden: true })
    .map((cell) => {
      const text = cell.textContent;
      if (text === null) throw new Error('cell');
      return text;
    });
}

function chainSplitRows(): { places: readonly unknown[] } {
  return placesBody([
    giftsPlace('Sample', { supports: [{ blockchain: 'Bitcoin', asset: 'BTC' }] }),
    giftsPlace('Other', { supports: ['bad'] }),
  ]);
}

function addDecoys(): void {
  const script = document.createElement('script');
  script.src = 'https://example.com/other.js';
  document.head.appendChild(script);
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = 'https://example.com/other.css';
  document.head.appendChild(link);
}

function clearMapDom(): void {
  for (const node of document.querySelectorAll('script')) {
    const src = node.getAttribute('src');
    if (src === MAP_SCRIPT || src === 'https://example.com/other.js') node.remove();
  }
  for (const node of document.querySelectorAll('link')) {
    const href = node.getAttribute('href');
    if (href === MAP_CSS || href === 'https://example.com/other.css') node.remove();
  }
  delete window.maplibregl;
}

function mapScript(): HTMLScriptElement {
  for (const node of document.querySelectorAll('script')) {
    if (node.getAttribute('src') === MAP_SCRIPT && node instanceof HTMLScriptElement) return node;
  }
  throw new Error('missing map script');
}

function installMapLibre(): LibDouble {
  const maps: MapDouble[] = [];
  const options: MapOptions[] = [];
  const markers: MarkerDouble[] = [];
  const popups: PopupDouble[] = [];
  const bounds: BoundsDouble[] = [];
  const navigationCalls = { count: 0 };

  function NavigationControl(): object {
    navigationCalls.count += 1;
    return {};
  }

  function Map(_options: MapOptions): MapDouble {
    options.push(_options);
    const transform: { zoom: number | undefined } = { zoom: _options.zoom };
    function mapZoom(this: { transform: { zoom: number | undefined } }): number | undefined {
      return this.transform.zoom;
    }
    const map: MapDouble = {
      zoom: transform.zoom,
      transform,
      addControl: vi.fn(mapZoom),
      resize: vi.fn(mapZoom),
      setCenter: vi.fn(mapZoom),
      setZoom: vi.fn(mapZoom),
      easeTo: vi.fn(mapZoom),
      fitBounds: vi.fn(mapZoom),
      remove: vi.fn(mapZoom),
      getZoom: vi.fn(mapZoom),
    };
    maps.push(map);
    return map;
  }

  function Marker(input: { element: HTMLElement }): MarkerDouble {
    const marker: MarkerDouble = {
      element: input.element,
      setLngLat: vi.fn(),
      setPopup: vi.fn(() => marker),
      addTo: vi.fn(() => {
        document.body.appendChild(input.element);
      }),
      remove: vi.fn(() => {
        if (input.element.parentNode !== null) input.element.remove();
      }),
      getLngLat: vi.fn(() => ({ lng: 0, lat: 0 })),
    };
    markers.push(marker);
    return marker;
  }

  function Popup(input: { offset: number }): PopupDouble {
    const handlers: Record<string, (() => void)[]> = {};
    const popup: PopupDouble = {
      offset: input.offset,
      content: null,
      setDOMContent: vi.fn((content: HTMLElement) => {
        popup.content = content;
        return popup;
      }),
      remove: vi.fn(),
      on: vi.fn((event: string, handler: () => void) => {
        const list = handlers[event] ?? [];
        list.push(handler);
        handlers[event] = list;
      }),
      emit(event: string): void {
        for (const handler of handlers[event] ?? []) handler();
      },
    };
    popups.push(popup);
    return popup;
  }

  function LngLatBounds(): BoundsDouble {
    const box: BoundsDouble = { extend: vi.fn() };
    bounds.push(box);
    return box;
  }

  window.maplibregl = {
    Map,
    NavigationControl,
    Marker,
    Popup,
    LngLatBounds,
  } as unknown as MapLibreLib;

  return { maps, options, markers, popups, bounds, navigationCalls };
}

function firstMap(lib: LibDouble): MapDouble {
  const map = lib.maps[0];
  if (map === undefined) throw new Error('missing map');
  return map;
}

function firstOptions(lib: LibDouble): MapOptions {
  const options = lib.options[0];
  if (options === undefined) throw new Error('missing map options');
  return options;
}

async function settleStyle(): Promise<void> {
  const call = callsTo('openfreemap').at(-1);
  if (call === undefined) return;
  await act(async () => {
    call.resolve(jsonResponse({ layers: [] }, 200));
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

async function fireScript(type: 'load' | 'error', settle = true): Promise<void> {
  const script = mapScript();
  await act(async () => {
    script.dispatchEvent(new Event(type));
  });
  if (settle && type === 'load') await settleStyle();
}

function expectOmit(call: PendingCall): void {
  expect(call.init.credentials).toBe('omit');
  expect(call.signal).toBeInstanceOf(AbortSignal);
}

function expectNoSecretWords(): void {
  const section = document.getElementById('shops');
  if (section === null) throw new Error('missing shops');
  const text = section.textContent;
  if (text === null) throw new Error('missing text');
  expect(text).not.toContain('Lightning');
  expect(text).not.toContain('LNURL');
  expect(text).not.toContain('passkey');
}

describe('HomeShops', () => {
  beforeEach(() => {
    pending.length = 0;
    setHostname('localhost');
    installFetch();
    addDecoys();
  });

  afterEach(() => {
    cleanup();
    pending.length = 0;
    restoreHostname();
    clearMapDom();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('loads dev filters before places and keeps the map in front', async () => {
    renderShops();
    expectNoSecretWords();
    expect(document.getElementById('shops')).toBeTruthy();
    const heading = screen.getByRole('heading', { name: copy.lead });
    expect(heading).toBeTruthy();
    expect(screen.getAllByRole('heading', { name: copy.lead })).toHaveLength(1);
    const section = document.getElementById('shops');
    if (section === null) throw new Error('missing shops');
    expect(section.getAttribute('style')).toBeNull();
    expect(section.querySelector('style')).toBeNull();
    expect(section.getAttribute('aria-labelledby')).toBe(heading.id);
    expect(section.className).toBe(
      'scroll-mt-20 border-b border-ink/10 bg-paper px-5 py-16 text-ink scheme-light sm:py-20',
    );
    expect(heading.className).toBe(
      'text-3xl leading-tight font-semibold tracking-tight text-balance sm:text-4xl',
    );
    const mapNode = document.getElementById('shop-places-map');
    if (mapNode === null) throw new Error('missing map');
    expect(mapNode.getAttribute('style')).toBeNull();
    expect(mapNode.className).toBe('h-[26rem] w-full sm:h-[30rem]');
    expect(mapNode.hasAttribute('hidden')).toBe(false);
    expect(tableShell().hasAttribute('hidden')).toBe(true);
    expect(screen.queryByRole('combobox')).toBeNull();
    const csv = screen.getByRole('button', { name: copy.csv, hidden: true });
    expect(csv.className).toContain('min-h-11');
    expect(csv.className).toContain('rounded-full');
    expect(csv.className).toContain('border');
    expect(csv.getAttribute('type')).toBe('button');
    const help = screen.getByRole('button', { name: copy.helpLabel, hidden: true });
    expect(help.hasAttribute('popovertarget')).toBe(false);
    expect(help.hasAttribute('popover')).toBe(false);
    expect(help.className).toContain('h-11');
    expect(help.className).toContain('w-11');
    expect(help.className).toContain('border-ink/12');
    expect(help.className).not.toContain('bg-app-btn');
    expect(help.textContent).not.toContain('?');
    expect(screen.queryByText(copy.helpLabel)).toBeNull();
    const viewGroup = screen.getByRole('group', { name: copy.view });
    expect(viewGroup.getAttribute('style')).toBeNull();
    expect(viewGroup.className).toContain('rounded-full');
    expect(viewGroup.className).toContain('bg-app-card-muted');
    expect(viewGroup.className).toContain('sm:ml-auto');
    const mapButton = screen.getByRole('button', { name: copy.map });
    const tableButton = screen.getByRole('button', { name: copy.table });
    expect(mapButton.getAttribute('style')).toBeNull();
    expect(tableButton.getAttribute('style')).toBeNull();
    expect(mapButton.getAttribute('aria-pressed')).toBe('true');
    expect(mapButton.className).toContain('bg-app-btn');
    expect(mapButton.className).toContain('text-app-btn-fg');
    expect(tableButton.getAttribute('aria-pressed')).toBe('false');
    expect(tableButton.className).toContain('text-app-muted');
    expect(screen.queryByText(copy.error)).toBeNull();
    expect(screen.queryByText(copy.empty)).toBeNull();
    expect(callsTo('/map/places')).toHaveLength(0);
    const filtersCall = latestFilters();
    expect(filtersCall.url).toBe(DEV_FILTERS);
    expectOmit(filtersCall);
    await act(async () => {
      filtersCall.resolve(jsonResponse(basicFilters({}), 200));
    });
    await waitFor(() => expect(callsTo('/map/places')).toHaveLength(1));
    const placesCall = latestPlaces();
    expect(placesCall.url).toBe(DEV_PLACES);
    expect(placesCall.url).not.toContain('?');
    expectOmit(placesCall);
    expect(placesCall.url).not.toContain('activity');
    expect(placesCall.url).not.toContain('techProvider');
    expect(document.querySelectorAll(`script[src="${MAP_SCRIPT}"]`)).toHaveLength(1);
    expect(mapScript().getAttribute('data-shops-map')).toBe('loading');
    expect(document.querySelectorAll(`link[href="${MAP_CSS}"]`)).toHaveLength(1);

    fireEvent.click(screen.getByRole('button', { name: copy.table }));
    expect(mapNode.hasAttribute('hidden')).toBe(true);
    expect(tableShell().hasAttribute('hidden')).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: copy.map }));
    expect(mapNode.hasAttribute('hidden')).toBe(false);
    expect(tableShell().hasAttribute('hidden')).toBe(true);
  });

  it('copies the page nonce onto the map script', () => {
    const carrier = document.createElement('script');
    carrier.nonce = 'qCnoncevaluehere==';
    document.head.appendChild(carrier);
    try {
      renderShops();
      expect(mapScript().nonce).toBe('qCnoncevaluehere==');
    } finally {
      carrier.remove();
    }
  });

  it('uses the production host for 21.gifts and www.21.gifts', async () => {
    setHostname('21.gifts');
    const first = renderShops();
    expect(latestFilters().url).toBe(PROD_FILTERS);
    await act(async () => latestFilters().resolve(jsonResponse(basicFilters({}), 200)));
    await waitFor(() => expect(callsTo('/map/places')).toHaveLength(1));
    expect(latestPlaces().url).toBe(PROD_PLACES);
    expectOmit(latestPlaces());
    first.unmount();
    pending.length = 0;
    setHostname('www.21.gifts');
    renderShops();
    expect(latestFilters().url).toBe(PROD_FILTERS);
    await act(async () => latestFilters().resolve(jsonResponse(basicFilters({}), 200)));
    await waitFor(() => expect(callsTo('/map/places')).toHaveLength(1));
    expect(latestPlaces().url).toBe(PROD_PLACES);
  });

  it('uses the production map on the local preview host', async () => {
    setHostname('127.0.0.1');
    renderShops();
    expect(latestFilters().url).toBe(PROD_FILTERS);
    await act(async () => latestFilters().resolve(jsonResponse(basicFilters({}), 200)));
    await waitFor(() => expect(callsTo('/map/places')).toHaveLength(1));
    expect(latestPlaces().url).toBe(PROD_PLACES);
  });

  it('shows the error text when the response is not usable and hides empty', async () => {
    renderShops();
    await resolveRaw(jsonResponse({ countries: [] }, 500), jsonResponse({ places: [] }, 200));
    await waitFor(() => {
      expect(screen.getByText(copy.error)).toBeTruthy();
    });
    expect(screen.queryByText(copy.empty)).toBeNull();
    expect(callsTo('/map/places')).toHaveLength(0);
    cleanup();
    pending.length = 0;

    renderShops();
    await resolveRaw(jsonResponse({ countries: [] }, 200), jsonResponse({ places: [] }, 404));
    await waitFor(() => {
      expect(screen.getByText(copy.error)).toBeTruthy();
    });
    expect(screen.queryByText(copy.empty)).toBeNull();
    cleanup();
    pending.length = 0;

    renderShops();
    await act(async () => latestFilters().resolve(new Response('NOPE', { status: 200 })));
    await waitFor(() => {
      expect(screen.getByText(copy.error)).toBeTruthy();
    });
    expect(callsTo('/map/places')).toHaveLength(0);
    cleanup();
    pending.length = 0;

    renderShops();
    await act(async () => latestFilters().resolve(jsonResponse(null, 200)));
    await waitFor(() => {
      expect(screen.getByText(copy.error)).toBeTruthy();
    });
    expect(screen.queryByText('Sample')).toBeNull();
    expect(screen.queryByText(copy.empty)).toBeNull();
    expect(callsTo('/map/places')).toHaveLength(0);
    cleanup();
    pending.length = 0;

    renderShops();
    await resolveLatest(
      { countries: [], shopNames: [], activities: [], techProviders: [] },
      { places: { bad: true } },
    );
    await waitFor(() => {
      expect(screen.getByText(copy.error)).toBeTruthy();
    });
    cleanup();
    pending.length = 0;

    renderShops();
    await resolveLatest(basicFilters({}), null);
    await waitFor(() => {
      expect(screen.getByText(copy.error)).toBeTruthy();
    });
    expect(screen.queryByText(copy.empty)).toBeNull();
  });

  it('reloads filters from Try again and does not request places when that reload fails', async () => {
    renderShops();
    await act(async () => {
      latestFilters().resolve(jsonResponse({ countries: [] }, 500));
    });
    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toBe(copy.error);
    });
    const alert = screen.getByRole('alert');
    expect(alert.className).toBe('text-center text-sm text-app-danger');
    expect(screen.queryByText(copy.empty)).toBeNull();
    expect(callsTo('/map/places')).toHaveLength(0);
    expect(screen.getByRole('button', { name: copy.map }).getAttribute('aria-pressed')).toBe(
      'true',
    );
    const retry = screen.getByRole('button', { name: copy.retry });
    expect(retry.getAttribute('type')).toBe('button');
    expect(retry.className).toContain('min-h-11');
    expect(retry.className).toContain('rounded-full');

    fireEvent.click(retry);
    await waitFor(() => {
      expect(callsTo('/map/filters')).toHaveLength(2);
    });
    expect(callsTo('/map/places')).toHaveLength(0);
    await act(async () => {
      latestFilters().resolve(jsonResponse({ countries: [] }, 500));
    });
    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toBe(copy.error);
    });
    expect(callsTo('/map/places')).toHaveLength(0);
    expect(screen.queryByText(copy.empty)).toBeNull();
  });

  it('ignores an abort and a late result, and shows a non-error throw', async () => {
    const view = renderShops();
    const filtersCall = latestFilters();
    view.unmount();
    await act(async () => {
      filtersCall.resolve(jsonResponse(basicFilters({}), 200));
    });
    expect(document.body.textContent).not.toContain('Sample');
    pending.length = 0;

    const rejected = renderShops();
    const failing = latestFilters();
    rejected.unmount();
    await act(async () => {
      failing.reject(new Error('late'));
    });
    expect(document.body.textContent).not.toContain(copy.error);
    pending.length = 0;

    renderShops();
    await act(async () => latestFilters().resolve(jsonResponse(basicFilters({}), 200)));
    await waitFor(() => expect(callsTo('/map/places')).toHaveLength(1));
    const aborted = latestPlaces();
    await act(async () => {
      aborted.reject(new DOMException('aborted', 'AbortError'));
    });
    await waitFor(() => {
      expect(screen.queryByText(copy.error)).toBeNull();
    });
    cleanup();
    pending.length = 0;

    renderShops();
    await resolveLatest(
      basicFilters({ countries: ['PH', 'DE'] }),
      placesBody([
        giftsPlace('Retained', { country: 'PH' }),
        giftsPlace('Berlin', { country: 'DE' }),
      ]),
    );
    changeMenu(copy.country, 'PH');
    await act(async () => {
      latestPlaces().reject(new DOMException('aborted', 'AbortError'));
    });
    expect(screen.getByText('Retained')).toBeTruthy();
    expect(screen.queryByText(copy.error)).toBeNull();
    cleanup();
    pending.length = 0;

    renderShops();
    await act(async () => {
      latestFilters().reject(new DOMException('aborted', 'AbortError'));
    });
    expect(screen.queryByText(copy.error)).toBeNull();
    expect(callsTo('/map/places')).toHaveLength(0);
    cleanup();
    pending.length = 0;

    renderShops();
    const thrown = latestFilters();
    await act(async () => {
      thrown.reject('boom');
    });
    await waitFor(() => {
      expect(screen.getByText(copy.error)).toBeTruthy();
    });
    expect(screen.queryByText(copy.empty)).toBeNull();
  });

  it('aborts the previous signal when the query changes and drops a stale payload', async () => {
    renderShops();
    await resolveLatest(
      basicFilters({}),
      placesBody([
        giftsPlace('Manila', { country: 'PH' }),
        giftsPlace('Berlin', { country: 'DE' }),
      ]),
    );
    const first = latestPlaces();
    changeMenu(copy.country, 'PH');
    expect(first.signal.aborted).toBe(true);
    expect(callsTo('/map/filters')).toHaveLength(1);
    await waitFor(() => expect(callsTo('/map/places')).toHaveLength(2));
    const second = latestPlaces();
    expect(second.url).toBe(`${DEV_PLACES}?country=PH`);
    changeMenu(copy.country, 'DE');
    expect(second.signal.aborted).toBe(true);
    await act(async () => {
      second.resolve(jsonResponse(placesBody([giftsPlace('Stale', { country: 'DE' })]), 200));
    });
    expect(screen.queryByText('Stale')).toBeNull();
    expect(screen.queryByText('Manila')).toBeNull();
    expect(screen.getByText('Berlin')).toBeTruthy();
    await waitFor(() => expect(callsTo('/map/places')).toHaveLength(3));
    expect(latestPlaces().url).toBe(`${DEV_PLACES}?country=DE`);
    await act(async () => {
      latestPlaces().resolve(
        jsonResponse(placesBody([giftsPlace('Later', { country: 'DE' })]), 200),
      );
    });
    await waitFor(() => {
      expect(screen.getByText('Later')).toBeTruthy();
    });
    expect(screen.queryByText('Stale')).toBeNull();
  });

  it('shows empty only when the list is ready and has no rows', async () => {
    renderShops();
    await resolveLatest(basicFilters({}), placesBody([]));
    await waitFor(() => {
      expect(screen.getByText(copy.empty)).toBeTruthy();
    });
    expect(screen.queryByText(copy.error)).toBeNull();
    expect(screen.getByRole('heading', { name: copy.lead })).toBeTruthy();
    expect(screen.queryByRole('combobox')).toBeNull();
    expect(screen.queryByRole('button', { name: copy.helpLabel })).toBeNull();
    expect(document.querySelector('.shop-legend')).toBeNull();
  });

  it('opens, closes, and chooses listbox options without bubbling', async () => {
    const onParent = vi.fn();
    render(
      <div onClick={onParent}>
        <HomeShops copy={copy} locale="en" />
      </div>,
    );
    await resolveLatest(basicFilters({}), chainSplitRows());
    expect(screen.queryByRole('combobox', { name: copy.activity })).toBeNull();
    for (const label of [copy.blockchain, copy.asset]) {
      expect(menuButton(label).getAttribute('aria-haspopup')).toBe('listbox');
    }
    const button = menuButton(copy.blockchain);
    expect(button.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(button);
    expect(button.getAttribute('aria-expanded')).toBe('true');
    fireEvent.click(button);
    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByRole('listbox')).toBeNull();

    fireEvent.click(button);
    const all = within(screen.getByRole('listbox')).getByRole('option', { name: copy.all });
    expect(all.className).toContain('h-10');
    expect(all.querySelector('.shop-place-marker')).toBeNull();
    onParent.mockClear();
    const before = pending.length;
    fireEvent.click(all);
    expect(onParent).not.toHaveBeenCalled();
    expect(pending.length).toBe(before);
    expect(screen.queryByRole('listbox')).toBeNull();

    fireEvent.click(button);
    fireEvent.mouseDown(
      within(screen.getByRole('listbox')).getByRole('option', { name: copy.all }),
    );
    expect(screen.getByRole('listbox')).toBeTruthy();
    fireEvent.keyDown(document, { key: 'a' });
    expect(screen.getByRole('listbox')).toBeTruthy();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('listbox')).toBeNull();

    fireEvent.click(button);
    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole('listbox')).toBeNull();

    fireEvent.click(button);
    await act(async () => {
      document.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    });
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('opens a closed menu from ArrowDown on the current option', async () => {
    renderShops();
    await resolveLatest(basicFilters({}), chainSplitRows());
    const button = menuButton(copy.blockchain);
    expect(button.getAttribute('role')).toBe('combobox');
    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(button.hasAttribute('aria-activedescendant')).toBe(false);
    fireEvent.keyDown(button, { key: 'ArrowDown' });
    expect(button.getAttribute('aria-expanded')).toBe('true');
    const listbox = screen.getByRole('listbox');
    expect(button.getAttribute('aria-controls')).toBe(listbox.id);
    const selected = within(listbox).getByRole('option', { selected: true });
    expect(button.getAttribute('aria-activedescendant')).toBe(selected.id);
    expect(button.getAttribute('role')).toBe('combobox');
  });

  it('moves ArrowDown one option and stops on the last option', async () => {
    renderShops();
    await resolveLatest(basicFilters({}), chainSplitRows());
    const button = menuButton(copy.blockchain);
    fireEvent.keyDown(button, { key: 'ArrowDown' });
    const first = button.getAttribute('aria-activedescendant');
    fireEvent.keyDown(button, { key: 'ArrowDown' });
    const second = button.getAttribute('aria-activedescendant');
    expect(second).not.toBe(first);
    expect(activeOption(button).textContent).toBe('Bitcoin');
    const selected = within(screen.getByRole('listbox')).getByRole('option', { selected: true });
    expect(selected.textContent).toBe(copy.all);
    fireEvent.keyDown(button, { key: 'ArrowDown' });
    expect(button.getAttribute('aria-activedescendant')).toBe(second);
    expect(activeOption(button).textContent).toBe('Bitcoin');
  });

  it('keeps ArrowUp on the first option and opens a closed menu upward', async () => {
    renderShops();
    await resolveLatest(basicFilters({}), chainSplitRows());
    const button = menuButton(copy.blockchain);
    fireEvent.keyDown(button, { key: 'ArrowDown' });
    const first = button.getAttribute('aria-activedescendant');
    fireEvent.keyDown(button, { key: 'ArrowUp' });
    expect(button.getAttribute('aria-activedescendant')).toBe(first);
    expect(activeOption(button).textContent).toBe(copy.all);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(button.getAttribute('aria-expanded')).toBe('false');
    fireEvent.keyDown(button, { key: 'ArrowUp' });
    expect(button.getAttribute('aria-expanded')).toBe('true');
    expect(button.getAttribute('aria-activedescendant')).toBe(
      within(screen.getByRole('listbox')).getByRole('option', { selected: true }).id,
    );
  });

  it('ignores Home and End while closed and jumps to the ends while open', async () => {
    renderShops();
    await resolveLatest(basicFilters({}), chainSplitRows());
    const button = menuButton(copy.blockchain);
    fireEvent.keyDown(button, { key: 'Home' });
    fireEvent.keyDown(button, { key: 'End' });
    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByRole('listbox')).toBeNull();
    fireEvent.keyDown(button, { key: 'ArrowDown' });
    fireEvent.keyDown(button, { key: 'ArrowDown' });
    const last = button.getAttribute('aria-activedescendant');
    fireEvent.keyDown(button, { key: 'Home' });
    const options = within(screen.getByRole('listbox')).getAllByRole('option');
    const firstOption = options[0];
    if (firstOption === undefined) throw new Error('missing first option');
    expect(button.getAttribute('aria-activedescendant')).toBe(firstOption.id);
    fireEvent.keyDown(button, { key: 'End' });
    expect(button.getAttribute('aria-activedescendant')).toBe(last);
    expect(activeOption(button).textContent).toBe('Bitcoin');
  });

  it('opens with Enter and commits the highlighted blockchain without activity', async () => {
    renderShops();
    await resolveLatest(basicFilters({}), chainSplitRows());
    const button = menuButton(copy.blockchain);
    const before = callsTo('/map/places').length;
    fireEvent.keyDown(button, { key: 'Enter' });
    expect(button.getAttribute('aria-expanded')).toBe('true');
    fireEvent.keyDown(button, { key: 'Enter' });
    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(callsTo('/map/places').length).toBe(before);
    expect(document.activeElement).toBe(button);
    fireEvent.keyDown(button, { key: 'Enter' });
    fireEvent.keyDown(button, { key: 'ArrowDown' });
    fireEvent.keyDown(button, { key: 'Enter' });
    expect(callsTo('/map/places').length).toBe(before + 1);
    expect(latestPlaces().url).toBe(`${DEV_PLACES}?blockchain=Bitcoin`);
    expect(latestPlaces().url).not.toContain('activity');
    expect(latestPlaces().url).not.toContain('techProvider');
    expect(menuValue(copy.blockchain)).toBe('Bitcoin');
    expect(document.activeElement).toBe(button);
  });

  it('opens with Space and commits the highlighted blockchain', async () => {
    renderShops();
    await resolveLatest(basicFilters({}), chainSplitRows());
    const button = menuButton(copy.blockchain);
    const before = callsTo('/map/places').length;
    fireEvent.keyDown(button, { key: ' ' });
    expect(button.getAttribute('aria-expanded')).toBe('true');
    fireEvent.keyDown(button, { key: ' ' });
    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(callsTo('/map/places').length).toBe(before);
    expect(document.activeElement).toBe(button);
    fireEvent.keyDown(button, { key: ' ' });
    fireEvent.keyDown(button, { key: 'ArrowDown' });
    fireEvent.keyDown(button, { key: ' ' });
    expect(callsTo('/map/places').length).toBe(before + 1);
    expect(latestPlaces().url).toBe(`${DEV_PLACES}?blockchain=Bitcoin`);
    expect(latestPlaces().url).not.toContain('activity');
    expect(latestPlaces().url).not.toContain('techProvider');
    expect(menuValue(copy.blockchain)).toBe('Bitcoin');
    expect(document.activeElement).toBe(button);
  });

  it('leaves the listbox open when the trigger receives a letter', async () => {
    renderShops();
    await resolveLatest(basicFilters({}), chainSplitRows());
    const button = menuButton(copy.blockchain);
    fireEvent.keyDown(button, { key: 'ArrowDown' });
    const active = button.getAttribute('aria-activedescendant');
    fireEvent.keyDown(button, { key: 'a' });
    expect(button.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByRole('listbox')).toBeTruthy();
    expect(button.getAttribute('aria-activedescendant')).toBe(active);
  });

  it('closes from Escape on document and returns focus from Escape on the trigger', async () => {
    renderShops();
    await resolveLatest(basicFilters({}), chainSplitRows());
    const button = menuButton(copy.blockchain);
    fireEvent.keyDown(button, { key: 'ArrowDown' });
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('listbox')).toBeNull();
    fireEvent.keyDown(button, { key: 'ArrowDown' });
    fireEvent.keyDown(button, { key: 'Escape' });
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(document.activeElement).toBe(button);
    fireEvent.keyDown(button, { key: 'Escape' });
    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('keeps the option classes and marks only the highlighted option', async () => {
    renderShops();
    await resolveLatest(basicFilters({}), chainSplitRows());
    openMenu(copy.blockchain);
    const base =
      'flex h-10 w-full items-center gap-2 rounded-lg px-3 text-left text-sm font-inherit';
    const options = within(screen.getByRole('listbox')).getAllByRole('option');
    const highlighted = options.filter((option) => option.className.includes('is-active'));
    expect(highlighted).toHaveLength(1);
    for (const option of options) {
      expect(option.className).toContain(base);
    }
    const active = highlighted[0];
    if (active === undefined) throw new Error('missing highlighted option');
    expect(active.className).toContain('is-active');
    expect(active.getAttribute('aria-selected')).toBe('true');
  });

  it('sends only set query fields and drops an asset the chain no longer lists', async () => {
    const filters = basicFilters({
      countries: ['PH', 'DE'],
      shopNames: ['SPAR', 'Mini'],
      techProviders: [
        provider({
          assets: ['BTC', 'ZZZ'],
          pairs: [
            { blockchain: 'Bitcoin', asset: 'BTC' },
            { blockchain: 'Side', asset: 'ZZZ' },
          ],
        }),
      ],
    });
    const rows = placesBody([
      giftsPlace('Ann', {
        country: 'PH',
        shopName: 'SPAR',
        activity: 'daily',
        supports: [{ blockchain: 'Bitcoin', asset: 'BTC' }],
      }),
      giftsPlace('Bea', {
        country: 'DE',
        shopName: 'Mini',
        activity: 'within7Days',
        supports: [{ blockchain: 'Side', asset: 'ZZZ' }],
      }),
    ]);
    renderShops();
    await resolveLatest(filters, rows);
    await waitFor(() => {
      expect(bodyNames()).toEqual(['Ann', 'Bea']);
    });

    const beforeCountry = pending.length;
    changeMenu(copy.country, 'PH');
    changeMenu(copy.country, 'PH');
    expect(pending.length).toBe(beforeCountry + 1);
    expect(latestPlaces().url).toBe(`${DEV_PLACES}?country=PH`);
    await resolvePlaces(rows);

    const beforeName = pending.length;
    changeMenu(copy.name, 'SPAR');
    changeMenu(copy.name, 'SPAR');
    expect(pending.length).toBe(beforeName + 1);
    expect(latestPlaces().url).toBe(`${DEV_PLACES}?country=PH&shopName=SPAR`);
    await resolvePlaces(rows);

    const beforeAsset = pending.length;
    openMenu(copy.asset);
    chooseOption('BTC');
    expect(pending.length).toBe(beforeAsset + 1);
    expect(menuValue(copy.asset)).toBe('BTC');
    expect(latestPlaces().url).toBe(`${DEV_PLACES}?country=PH&shopName=SPAR&asset=BTC`);
    await resolvePlaces(rows);

    openMenu(copy.asset);
    chooseOption('ZZZ');
    expect(latestPlaces().url).toBe(`${DEV_PLACES}?country=PH&shopName=SPAR&asset=ZZZ`);
    await resolvePlaces(rows);

    const beforeChain = pending.length;
    openMenu(copy.blockchain);
    chooseOption('Bitcoin');
    openMenu(copy.blockchain);
    chooseOption('Bitcoin');
    expect(pending.length).toBe(beforeChain + 1);
    expect(latestPlaces().url).toBe(`${DEV_PLACES}?country=PH&shopName=SPAR&blockchain=Bitcoin`);
    expect(menuValue(copy.asset)).toBe(copy.all);
    await resolvePlaces(rows);

    openMenu(copy.asset);
    expect(optionLabels()).toEqual([copy.all, 'BTC']);
    chooseOption('BTC');
    expect(latestPlaces().url).toBe(
      `${DEV_PLACES}?country=PH&shopName=SPAR&blockchain=Bitcoin&asset=BTC`,
    );
    const beforeActivity = pending.length;
    openMenu(copy.activity);
    chooseOption(copy.daily);
    expect(pending.length).toBe(beforeActivity);
    for (const call of callsTo('/map/places')) {
      expect(call.url).not.toContain('activity=');
      expect(call.url).not.toContain('techProvider');
    }
    for (const call of callsTo('/map/filters')) {
      expect(call.url).not.toContain('?');
    }
  });

  it('loads filters once and retains their blockchain choices across places reloads', async () => {
    const firstFilters = basicFilters({
      techProviders: [provider({ blockchains: ['Bitcoin'] })],
    });
    const rows = placesBody([
      giftsPlace('Sample', { supports: [{ blockchain: 'Bitcoin', asset: 'BTC' }] }),
      giftsPlace('Other', { supports: [{ blockchain: 'Liquid', asset: 'L-BTC' }] }),
    ]);
    renderShops();
    await resolveLatest(firstFilters, rows);
    openMenu(copy.blockchain);
    chooseOption('Bitcoin');
    expect(latestPlaces().url).toContain('blockchain=Bitcoin');
    await resolvePlaces(rows);
    expect(callsTo('/map/filters')).toHaveLength(1);
    expect(menuValue(copy.blockchain)).toBe('Bitcoin');
  });

  it('lists cleaned country and name choices and filters rows on the client', async () => {
    const filters = basicFilters({
      countries: [' PH ', 'PH', '', 2, 'DE', 'DE'],
      shopNames: [' SPAR ', 'SPAR', '', 'others', 4, 'Mini', '  ', 'Mini'],
    });
    const rows = placesBody([
      giftsPlace('Ann', { country: 'PH', shopName: 'SPAR' }),
      giftsPlace('Bea', { country: 'DE', shopName: 'Mini' }),
      giftsPlace('Cia', { country: ' PH ', shopName: 'SPAR' }),
      giftsPlace('Dee', { country: 'PH', shopName: ' SPAR ' }),
      giftsPlace('Eve', { country: 'PH', shopName: 'Other' }),
    ]);
    renderShops();
    await resolveLatest(filters, rows);
    await waitFor(() => {
      expect(bodyNames()).toEqual(['Ann', 'Bea', 'Cia', 'Dee', 'Eve']);
    });
    expect(openValues(copy.country)).toEqual(['', 'DE', 'PH']);
    expect(openValues(copy.name)).toEqual(['', 'SPAR', 'others']);

    changeMenu(copy.country, 'PH');
    expect(bodyNames()).toEqual(['Ann', 'Cia', 'Dee', 'Eve']);
    changeMenu(copy.country, 'DE');
    expect(bodyNames()).toEqual(['Bea']);
    changeMenu(copy.country, '');
    expect(bodyNames()).toEqual(['Ann', 'Bea', 'Cia', 'Dee', 'Eve']);

    expect(cellTexts('Dee')).toContain('SPAR');
    changeMenu(copy.name, 'SPAR');
    expect(bodyNames()).toEqual(['Ann', 'Cia', 'Dee']);
    changeMenu(copy.name, 'others');
    expect(bodyNames()).toEqual(['Bea', 'Eve']);
    changeMenu(copy.name, '');
    expect(bodyNames()).toEqual(['Ann', 'Bea', 'Cia', 'Dee', 'Eve']);
  });

  it('sends shopName only for SPAR and others and still filters other names', async () => {
    const filters = basicFilters({
      shopNames: ['SPAR', 'others', 'Mini'],
    });
    const rows = placesBody([
      giftsPlace('Ann', { shopName: 'SPAR' }),
      giftsPlace('Bea', { shopName: 'Mini' }),
      giftsPlace('Cara', { shopName: 'Other' }),
      giftsPlace('Mia', { shopName: 'Minis' }),
    ]);
    renderShops();
    await resolveLatest(filters, rows);
    expect(openValues(copy.name)).toEqual(['', 'SPAR', 'others']);
    expect(screen.queryByRole('combobox', { name: copy.country })).toBeNull();

    changeMenu(copy.name, 'SPAR');
    expect(latestPlaces().url).toBe(`${DEV_PLACES}?shopName=SPAR`);
    expect(bodyNames()).toEqual(['Ann']);
    await resolvePlaces(rows);
    expect(bodyNames()).toEqual(['Ann']);

    changeMenu(copy.name, 'others');
    expect(latestPlaces().url).toBe(`${DEV_PLACES}?shopName=others`);
    expect(bodyNames()).toEqual([]);
    expect(screen.queryByText(copy.empty)).toBeNull();
    await resolvePlaces(rows);
    expect(bodyNames()).toEqual(['Bea', 'Cara', 'Mia']);

    changeMenu(copy.name, '');
    expect(latestPlaces().url).toBe(DEV_PLACES);
    expect(latestPlaces().url).not.toContain('shopName');
    expect(bodyNames()).toEqual([]);
    await resolvePlaces(rows);
    expect(bodyNames()).toEqual(['Ann', 'Bea', 'Cara', 'Mia']);
    for (const call of callsTo('/map/places')) {
      expect(call.url).not.toContain('shopName=Mini');
    }
  });

  it('filters activity on the client and shows a place for a listed unknown token', async () => {
    const filters = basicFilters({
      activities: [
        ' daily ',
        'daily',
        '',
        1,
        'within7Days',
        'within30Days',
        'olderThan30Days',
        'none',
        'weird',
        'weird',
      ],
    });
    const rows = placesBody([
      giftsPlace('Ann', { activity: 'daily' }),
      giftsPlace('Bea', { activity: 'within7Days' }),
      giftsPlace('Cia', { activity: 'within30Days' }),
      giftsPlace('Dee', { activity: 'olderThan30Days' }),
      giftsPlace('Eve', { activity: 'none' }),
      giftsPlace('Fay', { activity: 'weird' }),
      giftsPlace('Gus', { activity: 5 }),
      omitKeys('Hal', ['activity']),
    ]);
    renderShops();
    await resolveLatest(filters, rows);
    await waitFor(() => {
      expect(bodyNames()).toEqual(['Ann', 'Bea', 'Cia', 'Dee', 'Eve', 'Fay', 'Gus', 'Hal']);
    });
    expect(cellTexts('Fay')[2]).toBe('weird');
    expect(cellTexts('Gus')[2]).toBe('');
    expect(cellTexts('Hal')[2]).toBe('');
    openMenu(copy.activity);
    expect(optionLabels()).toEqual([
      copy.all,
      copy.daily,
      copy.weekly,
      copy.monthly,
      copy.idle,
      copy.none,
      'weird',
    ]);
    const menu = screen.getByRole('listbox');
    const daily = within(menu).getByRole('option', { name: copy.daily });
    const dailySwatch = daily.querySelector('.shop-place-marker.is-daily');
    expect(dailySwatch).toBeTruthy();
    expect(dailySwatch?.getAttribute('aria-hidden')).toBe('true');
    expect(
      within(menu).getByRole('option', { name: copy.all }).querySelector('.shop-place-marker'),
    ).toBe(null);
    expect(
      within(menu).getByRole('option', { name: 'weird' }).querySelector('.shop-place-marker'),
    ).toBe(null);
    const legend = document.querySelectorAll('.shop-legend .shop-place-marker');
    expect(legend).toHaveLength(5);
    for (const swatch of legend) {
      expect(swatch.getAttribute('aria-hidden')).toBe('true');
    }
    chooseOption(copy.idle);
    expect(bodyNames()).toEqual(['Dee']);
    openMenu(copy.activity);
    chooseOption(copy.none);
    expect(bodyNames()).toEqual(['Eve']);
    openMenu(copy.activity);
    chooseOption(copy.daily);
    expect(bodyNames()).toEqual(['Ann']);
    openMenu(copy.activity);
    chooseOption(copy.weekly);
    expect(bodyNames()).toEqual(['Ann', 'Bea']);
    openMenu(copy.activity);
    chooseOption(copy.monthly);
    expect(bodyNames()).toEqual(['Ann', 'Bea', 'Cia']);
    openMenu(copy.activity);
    chooseOption('weird');
    expect(bodyNames()).toEqual(['Fay']);
    expect(screen.queryByText(copy.error)).toBeNull();
  });

  it('hides the activity menu when no shop is loaded and still lists shop tokens', async () => {
    const withoutActivities = basicFilters({});
    delete withoutActivities['activities'];
    renderShops();
    await resolveLatest(withoutActivities, placesBody([]));
    expect(screen.queryByRole('combobox', { name: copy.activity })).toBeNull();
    cleanup();
    pending.length = 0;

    renderShops();
    await resolveLatest(basicFilters({ activities: 'daily' }), placesBody([]));
    expect(screen.queryByRole('combobox', { name: copy.activity })).toBeNull();
    cleanup();
    pending.length = 0;

    renderShops();
    await resolveLatest(
      withoutActivities,
      placesBody([
        giftsPlace('Ann', { activity: 'daily' }),
        giftsPlace('Bea', { activity: 'within7Days' }),
      ]),
    );
    openMenu(copy.activity);
    expect(optionLabels()).toEqual([copy.all, copy.daily, copy.weekly]);
  });

  it('renders location, links, and sorted names in the table', async () => {
    const rows = placesBody([
      null,
      ['skip'],
      giftsPlace('Zed', {
        id: npub('z'),
        street: 'Rizal',
        houseNumber: '1',
        postalCode: '1000',
        city: 'Manila',
        shopName: 'SPAR',
        country: ' PH ',
      }),
      giftsPlace('Ann', {
        id: npub('p'),
        street: 'OnlyStreet',
        shopName: '',
        country: 'DE',
      }),
      giftsPlace('Only city', { city: 'OnlyCity', id: 'not-an-npub' }),
      giftsPlace('Blank spot', omitAddress()),
      giftsPlace('House only', { houseNumber: '9', id: 42 }),
      giftsPlace('Postal only', { postalCode: '4000' }),
      giftsPlace('Other desk', { techProvider: 'DFX.swiss', id: 'dfx-hidden' }),
      giftsPlace('Spaced gifts', { techProvider: '21.gifts ' }),
      omitKeys('No provider', ['techProvider']),
      giftsPlace('   ', { name: 12, shopName: '   ' }),
    ]);
    renderShops();
    await resolveLatest(basicFilters({}), rows);
    await waitFor(() => {
      expect(bodyNames()[0]).toBe('');
    });
    expect(bodyNames()).toEqual([
      '',
      'Ann',
      'Blank spot',
      'House only',
      'Only city',
      'Postal only',
      'Zed',
    ]);
    expect(screen.queryByText('Other desk')).toBeNull();
    expect(screen.queryByText('Spaced gifts')).toBeNull();
    expect(screen.queryByText('No provider')).toBeNull();

    expect(cellTexts('Zed')).toEqual([
      'Zed',
      'Rizal 1, 1000 Manila',
      'Philippines',
      'SPAR',
      copy.daily,
    ]);
    const zedLink = within(rowByName('Zed')).getByRole('link', { hidden: true });
    expect(zedLink.getAttribute('href')).toBe(`/${npub('z')}`);
    expect(zedLink.className).toBe('font-medium underline underline-offset-2');
    expect(zedLink.className).not.toContain('text-accent');
    expect(cellTexts('Ann')[1]).toBe('OnlyStreet');
    expect(cellTexts('Ann')[2]).toBe('Germany');
    expect(cellTexts('Ann')[3]).toBe('');
    expect(within(rowByName('Ann')).getByRole('link', { hidden: true }).getAttribute('href')).toBe(
      `/${npub('p')}`,
    );
    expect(cellTexts('Only city')[1]).toBe('OnlyCity');
    expect(within(rowByName('Only city')).queryByRole('link', { hidden: true })).toBeNull();
    expect(cellTexts('Blank spot')[1]).toBe('');
    expect(cellTexts('House only')[1]).toBe('9');
    expect(within(rowByName('House only')).queryByRole('link', { hidden: true })).toBeNull();
    expect(cellTexts('Postal only')[1]).toBe('4000');
    expect(cellTexts('')[3]).toBe('');

    const table = screen.getByRole('table', { hidden: true });
    const headers = within(table).getAllByRole('columnheader', { hidden: true });
    expect(headers.map((header) => header.textContent?.startsWith(copy.colName))).toBeTruthy();
    expect(textOf(headers[0])).toBe(copy.colName);
    expect(textOf(headers[1])).toBe(copy.colLocation);
    expect(textOf(headers[2])).toBe(copy.colCountry);
    expect(textOf(headers[3])).toBe(copy.colShop);
    expect(textOf(headers[4])).toBe(copy.colActivity);
    expect(headers[5]).toBeUndefined();
    const header = headers[0];
    if (header === undefined) throw new Error('missing header');
    const headerRow = header.closest('tr');
    if (headerRow === null) throw new Error('missing header row');
    expect(headerRow.className).toContain('text-ink/60');

    const help = screen.getByRole('button', { name: copy.helpLabel, hidden: true });
    expect(help.textContent).not.toContain('?');
    expect(screen.queryByText(copy.helpLabel)).toBeNull();
    fireEvent.click(help);
    const panel = screen.getByRole('dialog', { name: copy.helpLabel });
    expect(panel.className).toBe(
      'fixed z-40 rounded-xl border border-ink/10 bg-paper p-4 shadow-lg',
    );
    expect(panel.style.top).toBe('16px');
    expect(panel.style.left).toBe('16px');
    expect(panel.style.width).toBe('320px');
    expect(panel.textContent).toContain(copy.dailyHelp);
    expect(panel.textContent).toContain(copy.weeklyHelp);
    expect(panel.textContent).toContain(copy.monthlyHelp);
    expect(panel.textContent).toContain(copy.idleHelp);
    expect(panel.textContent).toContain(copy.noneHelp);
    expect(panel.textContent).toContain(copy.hierarchy);
    expect(panel.querySelectorAll('dt .shop-place-marker')).toHaveLength(5);
  });

  it('builds chain menus only from 21.gifts and matches supports or pairs', async () => {
    const filters = basicFilters({
      techProviders: [
        null,
        { name: '21.gifts ', blockchains: ['Liquid'], assets: ['L-BTC'], pairs: [] },
        dfxProvider(),
        provider({
          blockchains: ['Bitcoin', ' Bitcoin ', 'Bitcoin', '', 1, 'Side', 'NoneChain'],
          assets: ['BTC', 'ABC', ' BTC '],
          pairs: [
            { blockchain: 'Bitcoin', asset: 'BTC' },
            { blockchain: 'Bitcoin', asset: 'ABC' },
            { blockchain: 'Bitcoin', asset: 'BTC' },
            { blockchain: 'Bitcoin', asset: 'SSS' },
            { blockchain: 'Side', asset: 'ZZZ' },
            null,
            { blockchain: 1, asset: 'BTC' },
            { asset: 'BTC' },
          ],
        }),
      ],
    });
    const rows = placesBody([
      giftsPlace('Match', { supports: [null, { blockchain: 'Bitcoin', asset: 'BTC' }] }),
      giftsPlace('MissB', { supports: [{ blockchain: 'Other', asset: 'BTC' }] }),
      giftsPlace('MissA', { supports: [{ blockchain: 'Bitcoin', asset: 'NO' }] }),
      giftsPlace('BadIn', { supports: ['bad', 2] }),
      giftsPlace('EmptySup', { supports: [] }),
      giftsPlace('NullSup', { supports: null }),
      giftsPlace('Missing', {}),
      giftsPlace('ObjSup', { supports: { blockchain: 'Bitcoin', asset: 'BTC' } }),
      giftsPlace('Own', { supports: [{ blockchain: 'NoneChain', asset: 'X' }] }),
    ]);
    renderShops();
    await resolveLatest(filters, rows);
    await waitFor(() => {
      expect(bodyNames()).toHaveLength(9);
    });
    openMenu(copy.blockchain);
    expect(optionLabels()).toEqual([copy.all, 'Bitcoin', 'NoneChain', 'Other', 'Side']);
    expect(screen.queryByRole('option', { name: 'Liquid' })).toBeNull();
    openMenu(copy.asset);
    expect(optionLabels()).toEqual([copy.all, 'ABC', 'BTC', 'NO', 'SSS', 'X', 'ZZZ']);
    expect(screen.queryByRole('option', { name: 'L-BTC' })).toBeNull();

    openMenu(copy.blockchain);
    chooseOption('Bitcoin');
    openMenu(copy.asset);
    expect(optionLabels()).toEqual([copy.all, 'ABC', 'BTC', 'NO', 'SSS']);
    chooseOption('BTC');
    expect(bodyNames()).toEqual(['EmptySup', 'Match', 'Missing', 'NullSup']);

    openMenu(copy.asset);
    chooseOption(copy.all);
    expect(bodyNames()).toEqual(['EmptySup', 'Match', 'MissA', 'Missing', 'NullSup']);

    openMenu(copy.blockchain);
    chooseOption(copy.all);
    openMenu(copy.asset);
    chooseOption('BTC');
    expect(bodyNames()).toContain('MissB');
    expect(bodyNames()).not.toContain('MissA');
    expect(bodyNames()).not.toContain('ObjSup');

    openMenu(copy.asset);
    chooseOption(copy.all);
    openMenu(copy.blockchain);
    chooseOption('NoneChain');
    expect(bodyNames()).toEqual(['Own']);
    openMenu(copy.asset);
    expect(optionLabels()).toEqual([copy.all, 'X']);
  });

  it('drops a place without supports when the provider pairs are not a list', async () => {
    const filters = basicFilters({
      techProviders: [provider({ pairs: { not: 'array' }, assets: ['BTC'] })],
    });
    const rows = placesBody([
      giftsPlace('Fallback', {}),
      giftsPlace('Own', { supports: [{ blockchain: 'Bitcoin', asset: 'BTC' }] }),
    ]);
    renderShops();
    await resolveLatest(filters, rows);
    openMenu(copy.blockchain);
    chooseOption('Bitcoin');
    expect(bodyNames()).toEqual(['Own']);
    openMenu(copy.asset);
    expect(optionLabels()).toEqual([copy.all, 'BTC']);
  });

  it('offers no chain menu when one shop has no chain split', async () => {
    renderShops();
    await resolveLatest(
      basicFilters({ techProviders: [null, dfxProvider()] }),
      placesBody([giftsPlace('Sample', {})]),
    );
    expect(screen.queryByRole('combobox')).toBeNull();
    expect(bodyNames()).toEqual(['Sample']);
    cleanup();
    pending.length = 0;

    renderShops();
    await resolveLatest(
      basicFilters({ techProviders: { name: '21.gifts' } }),
      placesBody([giftsPlace('Kept', {})]),
    );
    expect(screen.queryByRole('combobox')).toBeNull();
    expect(bodyNames()).toEqual(['Kept']);
  });

  it('frames one marker, skips bad coordinates, and does not resize on the first map', async () => {
    const lib = installMapLibre();
    const rows = placesBody([
      giftsPlace('Pin', { lat: 14.6, lon: 121, activity: 'daily' }),
      giftsPlace('BadString', { lat: '14', lon: 121 }),
      giftsPlace('BadNan', { lat: Number.NaN, lon: 121 }),
      giftsPlace('BadInf', { lat: Number.POSITIVE_INFINITY, lon: 121 }),
      giftsPlace('BadHigh', { lat: 91, lon: 0 }),
      giftsPlace('BadLow', { lat: -91, lon: 0 }),
      giftsPlace('BadLonHigh', { lat: 0, lon: 181 }),
      giftsPlace('BadLonLow', { lat: 0, lon: -181 }),
      omitKeys('NoLat', ['lat']),
      omitKeys('NoLon', ['lon']),
      giftsPlace('Other desk', { techProvider: 'DFX.swiss', lat: 14.7, lon: 121.1 }),
      giftsPlace('Spaced gifts', { techProvider: '21.gifts ' }),
      omitKeys('No provider', ['techProvider']),
    ]);
    renderShops();
    await act(async () => latestFilters().resolve(jsonResponse(basicFilters({}), 200)));
    await waitFor(() => expect(callsTo('/map/places')).toHaveLength(1));
    await act(async () => latestPlaces().resolve(rawJsonResponse(rows)));
    expect(lib.maps).toHaveLength(0);
    await fireScript('load');
    const map = firstMap(lib);
    const options = firstOptions(lib);
    expect(options.container).toBe(document.getElementById('shop-places-map'));
    expect(options.style).toEqual({ layers: [] });
    expect(options.center).toEqual(HOME_CENTER);
    expect(options.locale).toEqual({
      'NavigationControl.ZoomIn': copy.zoomIn,
      'NavigationControl.ZoomOut': copy.zoomOut,
      'NavigationControl.ResetBearing': copy.resetBearing,
      'AttributionControl.ToggleAttribution': copy.toggleAttribution,
      'AttributionControl.MapFeedback': copy.mapFeedback,
      'Popup.Close': copy.closePopup,
      'Map.Title': copy.mapTitle,
    });
    expect(options.zoom).toBe(7);
    expect(options.renderWorldCopies).toBe(false);
    expect(options.trackResize).toBe(false);
    expect(options.attributionControl).toEqual({
      compact: true,
      customAttribution: '<a href="https://maplibre.org/" target="_blank">MapLibre</a>',
    });
    expect(lib.navigationCalls.count).toBe(1);
    expect(map.addControl).toHaveBeenCalledWith({}, 'top-right');
    expect(lib.markers).toHaveLength(1);
    const marker = lib.markers[0];
    if (marker === undefined) throw new Error('missing marker');
    expect(marker.element.tagName).toBe('BUTTON');
    expect(marker.element.getAttribute('type')).toBe('button');
    expect(marker.element.getAttribute('style')).toBeNull();
    expect(marker.element.className).toBe('shop-place-marker is-daily');
    expect(marker.element.title).toBe(copy.daily);
    expect(marker.element.getAttribute('aria-label')).toBe(`Pin, ${copy.daily}`);
    expect(marker.setLngLat).toHaveBeenCalledWith([121, 14.6]);
    expect(marker.setPopup).toHaveBeenCalledWith(lib.popups[0]);
    expect(marker.addTo).toHaveBeenCalledWith(map);
    expect(map.easeTo).toHaveBeenCalledWith({
      center: [121, 14.6],
      zoom: 12,
      duration: 0,
      animate: false,
    });
    expect(map.setCenter).not.toHaveBeenCalled();
    expect(map.setZoom).not.toHaveBeenCalled();
    expect(map.fitBounds).not.toHaveBeenCalled();
    expect(map.resize).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: copy.table }));
    expect(map.resize).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: copy.map }));
    expect(map.resize).toHaveBeenCalledTimes(1);
    expect(map.easeTo).toHaveBeenNthCalledWith(2, {
      center: [121, 14.6],
      zoom: 12,
      duration: 800,
    });

    expect(document.body.contains(marker.element)).toBe(true);
    const pinClick = vi.spyOn(marker.element, 'click');
    fireEvent.keyDown(marker.element, { key: 'Enter' });
    fireEvent.keyDown(marker.element, { key: ' ' });
    fireEvent.keyDown(marker.element, { key: 'a' });
    expect(pinClick).toHaveBeenCalledTimes(2);
    pinClick.mockRestore();
    cleanup();
    expect(map.remove).toHaveBeenCalledTimes(1);
    expect(marker.remove).toHaveBeenCalledTimes(1);
    expect(document.body.contains(marker.element)).toBe(false);
  });

  it('fits several markers and paints every activity class', async () => {
    const lib = installMapLibre();
    const rows = placesBody([
      giftsPlace('Ann', { activity: 'daily', lat: 14.6, lon: 121, id: npub('q') }),
      giftsPlace('Bea', { activity: 'within7Days', lat: 10, lon: 20, id: npub('p') }),
      giftsPlace('Cia', { activity: 'within30Days', lat: 1, lon: 2, id: npub('z') }),
      giftsPlace('Dee', { activity: 'olderThan30Days', lat: -90, lon: -180, id: npub('a') }),
      giftsPlace('Eve', { activity: 'none', lat: 90, lon: 180, id: npub('c') }),
      giftsPlace('Fay', { activity: 'weird', lat: 5, lon: 6, id: npub('d') }),
      giftsPlace('Gus', { activity: '', lat: 7, lon: 8, id: npub('g') }),
    ]);
    renderShops();
    await resolveLatest(basicFilters({}), rows);
    await fireScript('load');
    const map = firstMap(lib);
    expect(map.fitBounds).toHaveBeenCalledWith(lib.bounds[0], {
      padding: FRAME_PADDING,
      maxZoom: 12,
      duration: 0,
      animate: false,
    });
    expect(map.setCenter).not.toHaveBeenCalled();
    expect(map.setZoom).not.toHaveBeenCalled();
    expect(map.easeTo).not.toHaveBeenCalled();
    const box = lib.bounds[0];
    if (box === undefined) throw new Error('bounds');
    expect(box.extend).toHaveBeenCalledWith([-180, -90]);
    expect(box.extend).toHaveBeenCalledWith([180, 90]);
    const classes = lib.markers.map((item) => item.element.className).sort();
    expect(classes).toEqual(
      [
        'shop-place-marker is-daily',
        'shop-place-marker is-idle',
        'shop-place-marker is-monthly',
        'shop-place-marker is-none',
        'shop-place-marker is-none',
        'shop-place-marker is-none',
        'shop-place-marker is-weekly',
      ].sort(),
    );
    const titles = lib.markers.map((item) => item.element.title).sort();
    expect(titles).toEqual(
      [copy.daily, copy.weekly, copy.monthly, copy.idle, copy.none, 'weird', ''].sort(),
    );
    const markerByTitle = (title: string): HTMLElement => {
      const found = lib.markers.find((item) => item.element.title === title);
      if (found === undefined) throw new Error(`missing marker ${title}`);
      return found.element;
    };
    expect(markerByTitle(copy.daily).getAttribute('aria-label')).toBe(`Ann, ${copy.daily}`);
    expect(markerByTitle('').getAttribute('aria-label')).toBe('Gus');
    expect(markerByTitle('weird').getAttribute('aria-label')).toBe('Fay, weird');
    const gus = lib.popups.find(
      (popup) => popup.content?.querySelector('a')?.textContent === 'Gus',
    );
    if (gus === undefined || gus.content === null) throw new Error('missing Gus popup');
    expect(gus.content.querySelectorAll('p')).toHaveLength(0);
    expect(gus.content.querySelector('.shop-popup-chip')).toBeNull();
  });

  it('jumps the first frame and an unloaded map, then animates a later frame', async () => {
    const lib = installMapLibre();
    const Original = window.maplibregl?.Map;
    if (window.maplibregl === undefined || Original === undefined) throw new Error('missing map');
    let mapLoaded = true;
    function MapWithLoaded(options: MapOptions): MapDouble {
      const map = new (Original as new (options: MapOptions) => MapDouble)(options);
      map.loaded = () => mapLoaded;
      return map;
    }
    window.maplibregl.Map = MapWithLoaded as unknown as MapLibreLib['Map'];
    const rows = placesBody([
      giftsPlace('Ann', { lat: 14.6204, lon: 120.9581 }),
      giftsPlace('Bea', { lat: -1.29, lon: 36.82 }),
    ]);
    renderShops();
    await resolveLatest(basicFilters({}), rows);
    await fireScript('load');
    const map = firstMap(lib);
    const still = { padding: FRAME_PADDING, maxZoom: 12, duration: 0, animate: false };
    expect(map.loaded?.()).toBe(true);
    expect(map.fitBounds).toHaveBeenNthCalledWith(1, lib.bounds[0], still);
    fireEvent.click(screen.getByRole('button', { name: copy.table }));
    fireEvent.click(screen.getByRole('button', { name: copy.map }));
    expect(map.fitBounds).toHaveBeenNthCalledWith(2, lib.bounds[1], {
      padding: FRAME_PADDING,
      maxZoom: 12,
      duration: 800,
    });
    mapLoaded = false;
    expect(map.loaded?.()).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: copy.table }));
    fireEvent.click(screen.getByRole('button', { name: copy.map }));
    expect(map.fitBounds).toHaveBeenNthCalledWith(3, lib.bounds[2], still);
  });

  it('eases to one pin and to none after a two-pin frame', async () => {
    const lib = installMapLibre();
    renderShops();
    await resolveLatest(
      basicFilters({ countries: ['PH', 'DE'] }),
      placesBody([
        giftsPlace('Manila', { country: 'PH', lat: 14.6, lon: 121 }),
        giftsPlace('Berlin', { country: 'DE', lat: 52.5, lon: 13.4 }),
      ]),
    );
    await fireScript('load');
    const map = firstMap(lib);
    expect(map.fitBounds).toHaveBeenCalledTimes(1);
    expect(map.easeTo).not.toHaveBeenCalled();
    changeMenu(copy.country, 'PH');
    await resolvePlaces(placesBody([giftsPlace('Manila', { country: 'PH', lat: 14.6, lon: 121 })]));
    expect(map.easeTo).toHaveBeenLastCalledWith({
      center: [121, 14.6],
      zoom: 12,
      duration: 800,
    });
    changeMenu(copy.country, 'DE');
    await resolvePlaces(placesBody([]));
    expect(map.easeTo).toHaveBeenLastCalledWith({
      center: HOME_CENTER,
      zoom: 7,
      duration: 800,
    });
    expect(map.setCenter).not.toHaveBeenCalled();
    expect(map.setZoom).not.toHaveBeenCalled();
  });

  it('jumps a cluster click on an unloaded map, then animates the next click', async () => {
    const lib = installMapLibre();
    let mapLoaded = false;
    wrapMap((map) => {
      map.loaded = () => mapLoaded;
      Object.assign(map, {
        project(this: { transform: object }) {
          void this.transform;
          return { x: 10, y: 10 };
        },
        unproject(this: { transform: object }) {
          void this.transform;
          return { lng: 121, lat: 14.6 };
        },
        getContainer(this: { transform: object }) {
          void this.transform;
          const node = document.getElementById('shop-places-map');
          if (node === null) throw new Error('missing map');
          return node;
        },
      });
    });
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      queueMicrotask(() => callback(0));
      return 0;
    });
    renderShops();
    const mapNode = document.getElementById('shop-places-map');
    if (mapNode === null) throw new Error('missing map');
    setRect(mapNode, { top: 0, left: 0, bottom: 600, right: 800, width: 800, height: 600 });
    await resolveLatest(
      basicFilters({}),
      placesBody([
        giftsPlace('Ann', { lat: 14.6, lon: 121 }),
        giftsPlace('Bea', { lat: 14.61, lon: 121.01 }),
      ]),
    );
    await fireScript('load');
    await act(async () => {
      await Promise.resolve();
    });
    const map = firstMap(lib);
    expect(map.loaded?.()).toBe(false);
    const cluster = screen.getByRole('button', { name: '2 shops' });
    fireEvent.click(cluster);
    const jumped = lib.bounds.at(-1);
    if (jumped === undefined) throw new Error('missing bounds');
    expect(map.fitBounds).toHaveBeenLastCalledWith(jumped, {
      padding: FRAME_PADDING,
      maxZoom: 17.5,
      duration: 0,
      animate: false,
    });
    mapLoaded = true;
    expect(map.loaded?.()).toBe(true);
    fireEvent.click(cluster);
    const animated = lib.bounds.at(-1);
    if (animated === undefined) throw new Error('missing bounds');
    expect(map.fitBounds).toHaveBeenLastCalledWith(animated, {
      padding: FRAME_PADDING,
      maxZoom: 17.5,
      duration: 600,
    });
  });

  it('frames again when the map receives its real size, and stops after a cluster click', async () => {
    const observers: { callback: ResizeObserverCallback; disconnect: ReturnType<typeof vi.fn> }[] =
      [];
    class RecordingObserver {
      disconnect = vi.fn();
      observe = vi.fn();
      unobserve = vi.fn();
      constructor(callback: ResizeObserverCallback) {
        observers.push({ callback, disconnect: this.disconnect });
      }
    }
    vi.stubGlobal('ResizeObserver', RecordingObserver);
    const lib = installMapLibre();
    let width = 0;
    let height = 0;
    wrapMap((map) => {
      Object.assign(map, {
        project(this: { transform: object }) {
          void this.transform;
          return { x: 10, y: 10 };
        },
        unproject(this: { transform: object }) {
          void this.transform;
          return { lng: 121, lat: 14.6 };
        },
        getContainer(this: { transform: object }) {
          void this.transform;
          const node = document.getElementById('shop-places-map');
          if (node === null) throw new Error('missing map');
          return node;
        },
      });
    });
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      queueMicrotask(() => callback(0));
      return 0;
    });
    renderShops();
    const mapNode = document.getElementById('shop-places-map');
    if (mapNode === null) throw new Error('missing map');
    Object.defineProperty(mapNode, 'clientWidth', { configurable: true, get: () => width });
    Object.defineProperty(mapNode, 'clientHeight', { configurable: true, get: () => height });
    setRect(mapNode, { top: 0, left: 0, bottom: 416, right: 334, width: 334, height: 416 });
    await resolveLatest(
      basicFilters({}),
      placesBody([
        giftsPlace('Ann', { lat: 14.6, lon: 121 }),
        giftsPlace('Bea', { lat: 14.61, lon: 121.01 }),
      ]),
    );
    await fireScript('load');
    const map = firstMap(lib);
    expect(map.fitBounds).not.toHaveBeenCalled();
    expect(map.resize).not.toHaveBeenCalled();

    width = 334;
    const observer = observers.at(-1);
    if (observer === undefined) throw new Error('missing observer');
    observer.callback([], observer as unknown as ResizeObserver);
    expect(map.fitBounds).not.toHaveBeenCalled();

    height = 416;
    observer.callback([], observer as unknown as ResizeObserver);
    expect(map.resize).toHaveBeenCalledTimes(1);
    expect(map.fitBounds).toHaveBeenCalledTimes(1);
    const fitted = lib.bounds.at(-1);
    if (fitted === undefined) throw new Error('missing bounds');
    expect(map.fitBounds).toHaveBeenLastCalledWith(fitted, {
      padding: FRAME_PADDING,
      maxZoom: 12,
      duration: 0,
      animate: false,
    });

    observer.callback([], observer as unknown as ResizeObserver);
    expect(map.fitBounds).toHaveBeenCalledTimes(1);

    width = 400;
    observer.callback([], observer as unknown as ResizeObserver);
    expect(map.resize).toHaveBeenCalledTimes(2);
    expect(map.fitBounds).toHaveBeenCalledTimes(2);
    const snapped = lib.bounds.at(-1);
    if (snapped === undefined) throw new Error('missing snapped bounds');
    expect(map.fitBounds).toHaveBeenLastCalledWith(snapped, {
      padding: FRAME_PADDING,
      maxZoom: 12,
      duration: 0,
      animate: false,
    });

    fireEvent.click(screen.getByRole('button', { name: '2 shops' }));
    const afterClick = map.fitBounds.mock.calls.length;
    width = 360;
    observer.callback([], observer as unknown as ResizeObserver);
    expect(map.fitBounds).toHaveBeenCalledTimes(afterClick);
    expect(map.resize).toHaveBeenCalledTimes(3);
    observer.callback([], observer as unknown as ResizeObserver);
    expect(map.fitBounds).toHaveBeenCalledTimes(afterClick);
    expect(map.resize).toHaveBeenCalledTimes(3);

    cleanup();
    expect(observer.disconnect).toHaveBeenCalledTimes(1);
  });

  it('does not frame the empty map while shops are still loading', async () => {
    const observers: { callback: ResizeObserverCallback; disconnect: ReturnType<typeof vi.fn> }[] =
      [];
    class RecordingObserver {
      disconnect = vi.fn();
      observe = vi.fn();
      unobserve = vi.fn();
      constructor(callback: ResizeObserverCallback) {
        observers.push({ callback, disconnect: this.disconnect });
      }
    }
    vi.stubGlobal('ResizeObserver', RecordingObserver);
    const lib = installMapLibre();
    wrapMap((map) => {
      Object.assign(map, {
        getContainer(this: { transform: object }) {
          void this.transform;
          const node = document.getElementById('shop-places-map');
          if (node === null) throw new Error('missing map');
          return node;
        },
      });
    });
    renderShops();
    const mapNode = document.getElementById('shop-places-map');
    if (mapNode === null) throw new Error('missing map');
    Object.defineProperty(mapNode, 'clientWidth', { configurable: true, get: () => 1000 });
    Object.defineProperty(mapNode, 'clientHeight', { configurable: true, get: () => 480 });
    await fireScript('load');
    const map = firstMap(lib);
    const observer = observers.at(-1);
    if (observer === undefined) throw new Error('missing observer');
    observer.callback([], observer as unknown as ResizeObserver);
    expect(map.fitBounds).not.toHaveBeenCalled();
    expect(map.easeTo).not.toHaveBeenCalled();

    await resolveLatest(
      basicFilters({}),
      placesBody([
        giftsPlace('Ann', { lat: 14.6, lon: 121 }),
        giftsPlace('Bea', { lat: 14.61, lon: 121.01 }),
      ]),
    );
    expect(map.fitBounds).toHaveBeenCalledTimes(1);
    const fitted = lib.bounds.at(-1);
    if (fitted === undefined) throw new Error('missing bounds');
    expect(map.fitBounds).toHaveBeenLastCalledWith(fitted, {
      padding: FRAME_PADDING,
      maxZoom: 12,
      duration: 0,
      animate: false,
    });
  });

  it('does not fit the map while the canvas is still the stand-in', async () => {
    const observers: { callback: ResizeObserverCallback; disconnect: ReturnType<typeof vi.fn> }[] =
      [];
    class RecordingObserver {
      disconnect = vi.fn();
      observe = vi.fn();
      unobserve = vi.fn();
      constructor(callback: ResizeObserverCallback) {
        observers.push({ callback, disconnect: this.disconnect });
      }
    }
    vi.stubGlobal('ResizeObserver', RecordingObserver);
    const lib = installMapLibre();
    const canvas = document.createElement('canvas');
    canvas.style.width = '400px';
    canvas.style.height = '480px';
    wrapMap((map) => {
      Object.assign(map, {
        getContainer(this: { transform: object }) {
          void this.transform;
          const node = document.getElementById('shop-places-map');
          if (node === null) throw new Error('missing map');
          return node;
        },
        getCanvas(this: { transform: object }) {
          void this.transform;
          return canvas;
        },
      });
    });
    renderShops();
    const mapNode = document.getElementById('shop-places-map');
    if (mapNode === null) throw new Error('missing map');
    Object.defineProperty(mapNode, 'clientWidth', { configurable: true, get: () => 1000 });
    Object.defineProperty(mapNode, 'clientHeight', { configurable: true, get: () => 480 });
    await resolveLatest(
      basicFilters({}),
      placesBody([
        giftsPlace('Ann', { lat: 14.6, lon: 121 }),
        giftsPlace('Bea', { lat: 14.61, lon: 121.01 }),
      ]),
    );
    await fireScript('load');
    const map = firstMap(lib);
    expect(map.fitBounds).not.toHaveBeenCalled();

    const observer = observers.at(-1);
    if (observer === undefined) throw new Error('missing observer');
    canvas.style.width = '1000px';
    canvas.style.height = '300px';
    observer.callback([], observer as unknown as ResizeObserver);
    expect(map.fitBounds).not.toHaveBeenCalled();

    canvas.style.height = '480px';
    observer.callback([], observer as unknown as ResizeObserver);
    expect(map.fitBounds).toHaveBeenCalledTimes(1);
    const fitted = lib.bounds.at(-1);
    if (fitted === undefined) throw new Error('missing bounds');
    expect(map.fitBounds).toHaveBeenLastCalledWith(fitted, {
      padding: FRAME_PADDING,
      maxZoom: 12,
      duration: 0,
      animate: false,
    });
  });

  it('frames the map without resizing when the container is not an element', async () => {
    const lib = installMapLibre();
    wrapMap((map) => {
      Object.assign(map, {
        getContainer(this: { transform: object }) {
          void this.transform;
          return document.createTextNode('x');
        },
      });
    });
    renderShops();
    await resolveLatest(
      basicFilters({}),
      placesBody([
        giftsPlace('Ann', { lat: 14.6, lon: 121 }),
        giftsPlace('Bea', { lat: 14.61, lon: 121.01 }),
      ]),
    );
    await fireScript('load');
    const map = firstMap(lib);
    expect(map.resize).not.toHaveBeenCalled();
    expect(map.fitBounds).toHaveBeenCalledTimes(1);
  });

  it('labels a nameless pin with its activity title or an empty label', async () => {
    const lib = installMapLibre();
    renderShops();
    await resolveLatest(
      basicFilters({}),
      placesBody([
        giftsPlace('', { activity: 'none', lat: 1, lon: 2 }),
        giftsPlace('', { activity: '', lat: 3, lon: 4 }),
      ]),
    );
    await fireScript('load');
    const noneMarker = lib.markers.find((item) => item.element.title === copy.none);
    const emptyMarker = lib.markers.find((item) => item.element.title === '');
    if (noneMarker === undefined || emptyMarker === undefined) throw new Error('missing marker');
    expect(noneMarker.element.tagName).toBe('BUTTON');
    expect(noneMarker.element.getAttribute('aria-label')).toBe(copy.none);
    expect(emptyMarker.element.getAttribute('aria-label')).toBe('');
  });

  it('builds marker popups with safe photos, local links, and categories', async () => {
    const lib = installMapLibre();
    renderShops();
    await resolveLatest(
      basicFilters({}),
      placesBody([
        giftsPlace('Linked', {
          id: npub('p'),
          category: 'Cafe',
          coverPhoto: { url: 'https://images.example/cover.jpg' },
        }),
        giftsPlace('Plain', {
          id: 'https://opencryptopay.io/plain',
          coverPhoto: { url: 'http://images.example/insecure.jpg' },
        }),
      ]),
    );
    await fireScript('load');
    expect(lib.popups).toHaveLength(2);
    const linked = lib.popups[0];
    const plain = lib.popups[1];
    if (
      linked === undefined ||
      linked.content === null ||
      plain === undefined ||
      plain.content === null
    ) {
      throw new Error('missing popup');
    }
    expect(linked.offset).toBe(16);
    const popupLink = linked.content.querySelector('a');
    expect(popupLink?.getAttribute('href')).toBe(`/${npub('p')}`);
    expect(popupLink?.getAttribute('class')).toBe('shop-popup-name');
    expect(popupLink?.querySelector('.shop-popup-arrow')).toBeTruthy();
    const close = linked.content.querySelector('.shop-popup-close');
    expect(close?.getAttribute('aria-label')).toBe(copy.closePopup);
    if (!(close instanceof HTMLButtonElement)) throw new Error('missing close');
    close.click();
    expect(linked.remove).toHaveBeenCalledTimes(1);
    await new Promise((resolve) => {
      setTimeout(resolve, 0);
    });
    expect(linked.content.querySelector('.shop-popup-close')).toBe(close);
    expect(linked.content.querySelector('.shop-popup-category')?.textContent).toBe('Cafe');
    expect(linked.content.querySelector('.shop-popup-chip')?.textContent).toContain(copy.daily);
    expect(linked.content.querySelector('p')).toBeNull();
    const image = linked.content.querySelector('img');
    expect(image?.getAttribute('src')).toBe('https://images.example/cover.jpg');
    expect(image?.getAttribute('alt')).toBe('');
    expect(image?.getAttribute('loading')).toBe('lazy');
    expect(image?.getAttribute('referrerpolicy')).toBe('no-referrer');
    expect(image?.getAttribute('class')).toBe('shop-popup-photo');
    expect(plain.content.querySelector('a')).toBeNull();
    expect(plain.content.querySelector('strong')?.textContent).toBe('Plain');
    expect(plain.content.querySelector('strong')?.className).toBe('shop-popup-name');
    expect(plain.content.querySelector('img')).toBeNull();
    expect(plain.content.querySelector('.shop-popup-category')).toBeNull();
    expect(plain.content.innerHTML).not.toContain('opencryptopay.io');
  });

  it('downloads quoted CSV rows and does nothing for an empty table', async () => {
    let downloaded: Blob | null = null;
    let downloadedName = '';
    const createObjectURL = vi.fn((blob: Blob) => {
      downloaded = blob;
      return 'blob:shops';
    });
    const revokeObjectURL = vi.fn();
    const originalCreate = URL.createObjectURL;
    const originalRevoke = URL.revokeObjectURL;
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: createObjectURL });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: revokeObjectURL });
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(function rememberDownload(this: HTMLAnchorElement) {
        downloadedName = this.download;
      });

    renderShops();
    await resolveLatest(
      basicFilters({}),
      placesBody([
        giftsPlace('=Shop, "One"', {
          id: npub('q'),
          street: 'Line\nBreak',
          country: '+PH',
          shopName: '@Store',
          activity: '\todd',
        }),
        giftsPlace('Plain', { id: 'not-an-npub' }),
      ]),
    );
    fireEvent.click(screen.getByRole('button', { name: copy.table }));
    fireEvent.click(screen.getByRole('button', { name: copy.csv }));
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(click).toHaveBeenCalledTimes(1);
    expect(downloadedName).toBe('stores.csv');
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:shops');
    const csvBlob = downloaded as Blob | null;
    if (csvBlob === null) throw new Error('missing CSV blob');
    const bytes = await readBlobBytes(csvBlob);
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    const text = new TextDecoder().decode(bytes.slice(3));
    const header = [
      copy.colName,
      copy.colLocation,
      copy.colCountry,
      copy.colShop,
      copy.colProvider,
      copy.colActivity,
      copy.colUrl,
    ].join(',');
    expect(text).toBe(
      `${header}\r\n"'=Shop, ""One""","Line\nBreak",'+PH,'@Store,21.gifts,'\todd,https://localhost/${npub('q')}\r\nPlain,,Philippines,SPAR,21.gifts,${copy.daily},`,
    );

    cleanup();
    pending.length = 0;
    downloaded = null;
    createObjectURL.mockClear();
    click.mockClear();
    renderShops();
    await resolveLatest(basicFilters({}), placesBody([]));
    fireEvent.click(screen.getByRole('button', { name: copy.table }));
    fireEvent.click(screen.getByRole('button', { name: copy.csv }));
    expect(createObjectURL).not.toHaveBeenCalled();
    expect(click).not.toHaveBeenCalled();

    click.mockRestore();
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: originalCreate });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: originalRevoke });
  });

  it('frames home when no marker qualifies', async () => {
    const lib = installMapLibre();
    renderShops();
    await resolveLatest(basicFilters({}), placesBody([]));
    await fireScript('load');
    const map = firstMap(lib);
    expect(map.easeTo).toHaveBeenCalledWith({
      center: HOME_CENTER,
      zoom: 7,
      duration: 0,
      animate: false,
    });
    expect(map.setCenter).not.toHaveBeenCalled();
    expect(map.setZoom).not.toHaveBeenCalled();
    expect(map.fitBounds).not.toHaveBeenCalled();
    expect(lib.markers).toHaveLength(0);
    expect(map.resize).not.toHaveBeenCalled();
  });

  it('does not frame the map when the places response is not ok', async () => {
    const lib = installMapLibre();
    renderShops();
    await act(async () => {
      latestFilters().resolve(jsonResponse(basicFilters({}), 200));
    });
    await waitFor(() => expect(callsTo('/map/places')).toHaveLength(1));
    await fireScript('load');
    const map = firstMap(lib);
    expect(map.setCenter).not.toHaveBeenCalled();
    expect(map.setZoom).not.toHaveBeenCalled();
    expect(map.easeTo).not.toHaveBeenCalled();
    expect(map.fitBounds).not.toHaveBeenCalled();
    await resolvePlaces({ places: [] }, 500);
    await waitFor(() => {
      expect(screen.getByText(copy.error)).toBeTruthy();
    });
    expect(map.setCenter).not.toHaveBeenCalled();
    expect(map.setZoom).not.toHaveBeenCalled();
    expect(map.easeTo).not.toHaveBeenCalled();
    expect(map.fitBounds).not.toHaveBeenCalled();
  });

  it('keeps the session on a later error without framing the hidden map', async () => {
    const lib = installMapLibre();
    renderShops();
    await resolveLatest(basicFilters({}), placesBody([giftsPlace('Pin', {})]));
    await fireScript('load');
    expect(lib.markers).toHaveLength(1);
    await fireScript('load');
    expect(lib.maps).toHaveLength(1);
    await fireScript('error');
    await waitFor(() => {
      expect(screen.getByText(copy.error)).toBeTruthy();
    });
    const map = firstMap(lib);
    expect(map.remove).not.toHaveBeenCalled();
    expect(lib.maps).toHaveLength(1);
    expect(lib.markers).toHaveLength(1);
    const marker = lib.markers[0];
    if (marker === undefined) throw new Error('missing marker');
    expect(document.body.contains(marker.element)).toBe(false);
    expect(tableShell().hasAttribute('hidden')).toBe(false);
    expect(map.easeTo).toHaveBeenCalledTimes(1);
    expect(map.easeTo).toHaveBeenCalledWith({
      center: [121, 14.6],
      zoom: 12,
      duration: 0,
      animate: false,
    });
    expect(map.setCenter).not.toHaveBeenCalled();
    expect(map.setZoom).not.toHaveBeenCalled();
  });

  it('opens the table and shows an error when the library or the map node is missing', async () => {
    renderShops();
    await fireScript('load');
    await waitFor(() => {
      expect(screen.getByText(copy.error)).toBeTruthy();
    });
    expect(document.querySelectorAll(`script[src="${MAP_SCRIPT}"]`)).toHaveLength(0);
    expect(tableShell().hasAttribute('hidden')).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: copy.map }));
    expect(screen.getByText(copy.error)).toBeTruthy();
    cleanup();
    pending.length = 0;
    clearMapDom();
    addDecoys();

    const lib = installMapLibre();
    renderShops();
    document.getElementById('shop-places-map')?.removeAttribute('id');
    await fireScript('load');
    await waitFor(() => {
      expect(screen.getByText(copy.error)).toBeTruthy();
    });
    expect(lib.maps).toHaveLength(0);
    expect(document.querySelectorAll(`script[src="${MAP_SCRIPT}"]`)).toHaveLength(1);
    expect(tableShell().hasAttribute('hidden')).toBe(false);
  });

  it('opens the table when the map constructor throws', async () => {
    installMapLibre();
    if (window.maplibregl === undefined) throw new Error('missing library');
    window.maplibregl.Map = function BrokenMap(): never {
      throw new Error('broken map');
    } as unknown as MapLibreLib['Map'];
    renderShops();
    await fireScript('load');
    expect(screen.getByText(copy.error)).toBeTruthy();
    expect(tableShell().hasAttribute('hidden')).toBe(false);
    expect(screen.queryByText(copy.empty)).toBeNull();
    expect(document.querySelectorAll(`script[src="${MAP_SCRIPT}"]`)).toHaveLength(1);
  });

  it('waits to resize and frame until a hidden map is shown', async () => {
    const lib = installMapLibre();
    renderShops();
    await resolveLatest(basicFilters({}), placesBody([giftsPlace('Pin', {})]));
    fireEvent.click(screen.getByRole('button', { name: copy.table }));
    await fireScript('load');
    const map = firstMap(lib);
    expect(map.easeTo).not.toHaveBeenCalled();
    expect(map.setCenter).not.toHaveBeenCalled();
    expect(map.setZoom).not.toHaveBeenCalled();
    expect(map.fitBounds).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: copy.map }));
    expect(map.resize).toHaveBeenCalledTimes(1);
    expect(map.easeTo).toHaveBeenCalledWith({
      center: [121, 14.6],
      zoom: 12,
      duration: 0,
      animate: false,
    });
    expect(map.setCenter).not.toHaveBeenCalled();
    expect(map.setZoom).not.toHaveBeenCalled();
  });

  it('uses an existing script and does not add a second stylesheet', async () => {
    const existing = document.createElement('script');
    existing.src = MAP_SCRIPT;
    document.head.appendChild(existing);
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = MAP_CSS;
    document.head.appendChild(link);
    renderShops();
    expect(document.querySelectorAll(`script[src="${MAP_SCRIPT}"]`)).toHaveLength(1);
    expect(document.querySelectorAll(`link[href="${MAP_CSS}"]`)).toHaveLength(1);
    expect(screen.getByText(copy.error)).toBeTruthy();
    expect(tableShell().hasAttribute('hidden')).toBe(false);
    await act(async () => {
      existing.dispatchEvent(new Event('load'));
    });
    expect(screen.getByText(copy.error)).toBeTruthy();
    expect(existing.isConnected).toBe(true);
    cleanup();
    pending.length = 0;
    clearMapDom();
    addDecoys();

    const again = document.createElement('script');
    again.src = MAP_SCRIPT;
    document.head.appendChild(again);
    const lib = installMapLibre();
    renderShops();
    expect(document.querySelectorAll(`script[src="${MAP_SCRIPT}"]`)).toHaveLength(1);
    await settleStyle();
    expect(lib.maps).toHaveLength(1);
    cleanup();
    pending.length = 0;
    clearMapDom();
    addDecoys();

    const loading = document.createElement('script');
    loading.src = MAP_SCRIPT;
    loading.setAttribute('data-shops-map', 'loading');
    document.head.appendChild(loading);
    const hidden = renderShops();
    expect(screen.queryByText(copy.error)).toBeNull();
    expect(tableShell().hasAttribute('hidden')).toBe(true);
    expect(loading.isConnected).toBe(true);
    hidden.unmount();
    expect(loading.isConnected).toBe(true);
    expect(loading.getAttribute('data-shops-map')).toBe('loading');
    pending.length = 0;

    renderShops();
    expect(screen.queryByText(copy.error)).toBeNull();
    expect(loading.getAttribute('data-shops-map')).toBe('loading');
    const revived = installMapLibre();
    await act(async () => {
      loading.dispatchEvent(new Event('load'));
    });
    await settleStyle();
    expect(revived.maps).toHaveLength(1);
    expect(loading.isConnected).toBe(true);
  });

  it('does not build a map when load or error arrives after unmount', async () => {
    const lib = installMapLibre();
    const view = renderShops();
    expect(lib.maps).toHaveLength(0);
    const script = mapScript();
    view.unmount();
    await act(async () => {
      script.dispatchEvent(new Event('load'));
      script.dispatchEvent(new Event('error'));
    });
    expect(lib.maps).toHaveLength(0);
  });

  it('removes a script that fails after unmount and shows the table when the next load fails', async () => {
    const first = renderShops();
    const script = mapScript();
    expect(script.getAttribute('data-shops-map')).toBe('loading');
    expect(screen.queryByText(copy.error)).toBeNull();
    first.unmount();
    await act(async () => {
      script.dispatchEvent(new Event('load'));
    });
    expect(script.isConnected).toBe(false);
    const second = renderShops();
    const next = mapScript();
    expect(next).not.toBe(script);
    expect(next.getAttribute('data-shops-map')).toBe('loading');
    expect(screen.queryByText(copy.error)).toBeNull();
    await act(async () => {
      next.dispatchEvent(new Event('error'));
    });
    expect(second.container.contains(screen.getByText(copy.error))).toBe(true);
    expect(tableShell().hasAttribute('hidden')).toBe(false);
    expect(next.isConnected).toBe(false);
  });

  it('reports a script error before the map exists', async () => {
    renderShops();
    await fireScript('error');
    await waitFor(() => {
      expect(screen.getByText(copy.error)).toBeTruthy();
    });
    expect(screen.queryByText(copy.empty)).toBeNull();
    expect(tableShell().hasAttribute('hidden')).toBe(false);
    expect(document.querySelectorAll(`script[src="${MAP_SCRIPT}"]`)).toHaveLength(0);
  });

  it('keeps a visible table load error after a remount when the script is not loading and does not clear places', async () => {
    const finished = document.createElement('script');
    finished.src = MAP_SCRIPT;
    document.head.appendChild(finished);
    renderShops();
    expect(finished.isConnected).toBe(true);
    expect(finished.hasAttribute('data-shops-map')).toBe(false);
    expect(screen.getByRole('button', { name: copy.table }).getAttribute('aria-pressed')).toBe(
      'true',
    );
    expect(tableShell().hasAttribute('hidden')).toBe(false);
    expect(screen.getByText(copy.error)).toBeTruthy();
    await resolveLatest(basicFilters({}), placesBody([giftsPlace('Kept', {})]));
    expect(callsTo('/map/places')).toHaveLength(1);
    expect(bodyNames()).toEqual(['Kept']);
    expect(screen.getByText(copy.error)).toBeTruthy();
    expect(screen.queryByText(copy.empty)).toBeNull();

    cleanup();
    pending.length = 0;
    expect(finished.isConnected).toBe(true);

    renderShops();
    expect(finished.isConnected).toBe(true);
    expect(finished.hasAttribute('data-shops-map')).toBe(false);
    expect(screen.getByText(copy.error)).toBeTruthy();
    expect(screen.queryByText(copy.empty)).toBeNull();
    expect(tableShell().hasAttribute('hidden')).toBe(false);
    expect(screen.getByRole('button', { name: copy.table }).getAttribute('aria-pressed')).toBe(
      'true',
    );
    const mapNode = document.getElementById('shop-places-map');
    if (mapNode === null) throw new Error('missing map');
    expect(mapNode.hasAttribute('hidden')).toBe(true);
    await resolveLatest(basicFilters({}), placesBody([giftsPlace('Kept', {})]));
    expect(callsTo('/map/places')).toHaveLength(1);
    expect(bodyNames()).toEqual(['Kept']);
    expect(screen.getByText(copy.error)).toBeTruthy();
    expect(screen.queryByText(copy.empty)).toBeNull();
  });

  it('hides a loaded country while the next country response is still missing', async () => {
    const lib = installMapLibre();
    const rows = placesBody([
      giftsPlace('Manila', { country: 'PH', lat: 14.6, lon: 121 }),
      giftsPlace('Berlin', { country: 'DE', lat: 52.5, lon: 13.4 }),
    ]);
    renderShops();
    await resolveLatest(basicFilters({ countries: ['PH', 'DE'] }), rows);
    await fireScript('load');
    changeMenu(copy.country, 'PH');
    expect(latestPlaces().url).toBe(`${DEV_PLACES}?country=PH`);
    await resolvePlaces(rows);
    const map = firstMap(lib);
    const centerCalls = map.setCenter.mock.calls.length;
    const zoomCalls = map.setZoom.mock.calls.length;
    const easeCalls = map.easeTo.mock.calls.length;
    const boundsCalls = map.fitBounds.mock.calls.length;
    const markerCount = lib.markers.length;
    const latest = lib.markers[lib.markers.length - 1];
    if (latest === undefined) throw new Error('missing marker');
    expect(latest.remove).not.toHaveBeenCalled();

    changeMenu(copy.country, 'DE');
    expect(latestPlaces().url).toBe(`${DEV_PLACES}?country=DE`);
    expect(screen.queryByText('Manila')).toBeNull();
    expect(bodyNames()).toEqual([]);
    expect(screen.queryByText(copy.empty)).toBeNull();
    expect(map.setCenter).toHaveBeenCalledTimes(centerCalls);
    expect(map.setZoom).toHaveBeenCalledTimes(zoomCalls);
    expect(map.easeTo).toHaveBeenCalledTimes(easeCalls);
    expect(map.fitBounds).toHaveBeenCalledTimes(boundsCalls);
    expect(latest.remove).toHaveBeenCalledTimes(1);
    expect(lib.markers).toHaveLength(markerCount);

    fireEvent.click(screen.getByRole('button', { name: copy.table }));
    fireEvent.click(screen.getByRole('button', { name: copy.map }));
    expect(map.resize).toHaveBeenCalled();
    expect(map.setCenter).toHaveBeenCalledTimes(centerCalls);
    expect(map.setZoom).toHaveBeenCalledTimes(zoomCalls);
    expect(map.easeTo).toHaveBeenCalledTimes(easeCalls);
    expect(map.fitBounds).toHaveBeenCalledTimes(boundsCalls);
  });

  it('keeps a SPAR row from an unfiltered list while the shop name is still loading', async () => {
    const lib = installMapLibre();
    renderShops();
    await resolveLatest(
      basicFilters({}),
      placesBody([
        giftsPlace('Ann', { shopName: 'SPAR' }),
        giftsPlace('Bea', { shopName: 'Mini' }),
      ]),
    );
    await waitFor(() => {
      expect(screen.getByText('Ann')).toBeTruthy();
    });
    await fireScript('load');
    expect(lib.markers).toHaveLength(2);
    const previous = lib.markers.slice();
    changeMenu(copy.name, 'SPAR');
    expect(callsTo('/map/places')).toHaveLength(2);
    expect(latestPlaces().url).toBe(`${DEV_PLACES}?shopName=SPAR`);
    expect(screen.getByText('Ann')).toBeTruthy();
    expect(screen.queryByText('Bea')).toBeNull();
    expect(screen.queryByText(copy.empty)).toBeNull();
    for (const marker of previous) {
      expect(marker.remove).toHaveBeenCalledTimes(1);
    }
    expect(lib.markers).toHaveLength(previous.length + 1);
    const redrawn = lib.markers[previous.length];
    if (redrawn === undefined) throw new Error('missing redrawn marker');
    expect(redrawn.remove).not.toHaveBeenCalled();
  });

  it('keeps a selection the shops still have when a reloaded filter list omits it', async () => {
    const kept = basicFilters({
      countries: ['PH', 'DE'],
      shopNames: ['SPAR', 'others'],
      activities: ['daily', 'weird'],
    });
    const rows = placesBody([
      giftsPlace('Ann', { activity: 'daily', country: 'PH', shopName: 'SPAR' }),
      giftsPlace('Fay', { activity: 'weird', country: 'PH', shopName: 'SPAR' }),
      giftsPlace('Bea', { activity: 'daily', country: 'DE', shopName: 'others' }),
    ]);
    renderShops();
    await resolveLatest(kept, rows);
    changeMenu(copy.country, 'PH');
    await resolvePlaces(rows);
    changeMenu(copy.name, 'SPAR');
    const placesUrl = latestPlaces().url;
    openMenu(copy.activity);
    chooseOption('weird');
    expect(latestPlaces().url).toBe(placesUrl);
    expect(placesUrl).not.toContain('activity');
    expect(placesUrl).toContain('country=PH');
    expect(placesUrl).toContain('shopName=SPAR');
    expect(bodyNames()).toEqual(['Fay']);

    const filtersBefore = callsTo('/map/filters').length;
    const placesBefore = callsTo('/map/places').length;
    await fireScript('error');
    fireEvent.click(screen.getByRole('button', { name: copy.retry }));
    await waitFor(() => expect(callsTo('/map/filters').length).toBe(filtersBefore + 1));
    await act(async () => {
      latestFilters().resolve(jsonResponse(kept, 200));
    });
    await waitFor(() => expect(callsTo('/map/places').length).toBe(placesBefore + 1));
    expect(menuValue(copy.country)).toBe('Philippines');
    expect(menuValue(copy.name)).toBe('SPAR');
    expect(menuValue(copy.activity)).toBe('weird');
    expect(latestPlaces().url).toContain('country=PH');
    expect(latestPlaces().url).toContain('shopName=SPAR');
    expect(latestPlaces().url).not.toContain('activity');
    await resolvePlaces(rows);
    expect(bodyNames()).toEqual(['Fay']);

    const placesBeforeKeep = callsTo('/map/places').length;
    fireEvent.click(screen.getByRole('button', { name: copy.retry }));
    await waitFor(() => expect(callsTo('/map/filters').length).toBe(filtersBefore + 2));
    await act(async () => {
      latestFilters().resolve(
        jsonResponse(
          basicFilters({
            countries: ['DE'],
            shopNames: ['others'],
            activities: ['daily'],
          }),
          200,
        ),
      );
    });
    await waitFor(() => expect(callsTo('/map/places').length).toBe(placesBeforeKeep + 1));
    expect(menuValue(copy.country)).toBe('Philippines');
    expect(menuValue(copy.name)).toBe('SPAR');
    expect(menuValue(copy.activity)).toBe('weird');
    await resolvePlaces(rows);
    expect(bodyNames()).toEqual(['Fay']);

    changeMenu(copy.country, 'DE');
    const filtersBeforeFailure = callsTo('/map/filters').length;
    fireEvent.click(screen.getByRole('button', { name: copy.retry }));
    await waitFor(() => expect(callsTo('/map/filters').length).toBe(filtersBeforeFailure + 1));
    await act(async () => {
      latestFilters().resolve(jsonResponse({ countries: ['DE'] }, 500));
    });
    await waitFor(() => expect(menuValue(copy.country)).toBe('Germany'));

    changeMenu(copy.country, '');
    changeMenu(copy.name, '');
    changeMenu(copy.activity, '');
    fireEvent.click(screen.getByRole('button', { name: copy.retry }));
    await waitFor(() => expect(callsTo('/map/filters').length).toBe(filtersBeforeFailure + 2));
    await act(async () => {
      latestFilters().resolve(jsonResponse(basicFilters({ countries: ['DE'] }), 200));
    });
    await waitFor(() => expect(latestPlaces().url).toBe(DEV_PLACES));
    await resolvePlaces(
      placesBody([giftsPlace('Bea', { activity: 'daily', country: 'DE', shopName: 'others' })]),
    );
    expect(screen.queryByRole('combobox', { name: copy.country })).toBeNull();
    expect(screen.queryByRole('combobox', { name: copy.name })).toBeNull();
    expect(screen.queryByRole('combobox', { name: copy.activity })).toBeNull();
    expect(bodyNames()).toEqual(['Bea']);
  });

  it('keeps a blockchain the shops still have when a reloaded filter list omits it', async () => {
    const split = placesBody([
      giftsPlace('Ann', { supports: [{ blockchain: 'Bitcoin', asset: 'BTC' }] }),
      giftsPlace('Bea', { supports: [{ blockchain: 'Liquid', asset: 'L-BTC' }] }),
    ]);
    const liquidOnly = placesBody([
      giftsPlace('Ann', { supports: [{ blockchain: 'Liquid', asset: 'L-BTC' }] }),
      giftsPlace('Bea', { supports: [{ blockchain: 'Liquid', asset: 'L-BTC' }] }),
    ]);
    renderShops();
    await resolveLatest(basicFilters({}), split);
    changeMenu(copy.blockchain, 'Bitcoin');
    expect(menuValue(copy.blockchain)).toBe('Bitcoin');
    expect(latestPlaces().url).toContain('blockchain=Bitcoin');

    const filtersBefore = callsTo('/map/filters').length;
    const placesBefore = callsTo('/map/places').length;
    await fireScript('error');
    fireEvent.click(screen.getByRole('button', { name: copy.retry }));
    await waitFor(() => expect(callsTo('/map/filters').length).toBe(filtersBefore + 1));
    await act(async () => {
      latestFilters().resolve(
        jsonResponse(
          basicFilters({
            techProviders: [
              provider({
                blockchains: ['Liquid'],
                assets: ['L-BTC'],
                pairs: [{ blockchain: 'Liquid', asset: 'L-BTC' }],
              }),
            ],
          }),
          200,
        ),
      );
    });
    await waitFor(() => expect(callsTo('/map/places').length).toBe(placesBefore + 1));
    expect(menuValue(copy.blockchain)).toBe('Bitcoin');
    expect(latestPlaces().url).toContain('blockchain=Bitcoin');
    await resolvePlaces(split);
    expect(menuValue(copy.blockchain)).toBe('Bitcoin');

    changeMenu(copy.blockchain, '');
    expect(latestPlaces().url).not.toContain('blockchain=');
    await resolvePlaces(liquidOnly);
    expect(screen.queryByRole('combobox', { name: copy.blockchain })).toBeNull();

    const placesBeforeReturn = callsTo('/map/places').length;
    fireEvent.click(screen.getByRole('button', { name: copy.retry }));
    await waitFor(() => expect(callsTo('/map/filters').length).toBe(filtersBefore + 2));
    await act(async () => {
      latestFilters().resolve(jsonResponse(basicFilters({}), 200));
    });
    await waitFor(() => expect(callsTo('/map/places').length).toBe(placesBeforeReturn + 1));
    expect(latestPlaces().url).not.toContain('blockchain=');
    await resolvePlaces(split);
    expect(menuValue(copy.blockchain)).toBe(copy.all);

    changeMenu(copy.blockchain, 'Bitcoin');
    expect(menuValue(copy.blockchain)).toBe('Bitcoin');
    expect(latestPlaces().url).toContain('blockchain=Bitcoin');

    const placesBeforeKeep = callsTo('/map/places').length;
    fireEvent.click(screen.getByRole('button', { name: copy.retry }));
    await waitFor(() => expect(callsTo('/map/filters').length).toBe(filtersBefore + 3));
    await act(async () => {
      latestFilters().resolve(jsonResponse(basicFilters({}), 200));
    });
    await waitFor(() => expect(callsTo('/map/places').length).toBe(placesBeforeKeep + 1));
    expect(menuValue(copy.blockchain)).toBe('Bitcoin');
    expect(latestPlaces().url).toContain('blockchain=Bitcoin');
    await resolvePlaces(split);
    expect(menuValue(copy.blockchain)).toBe('Bitcoin');
  });

  it('resets an activity to All when reloaded shops no longer offer it', async () => {
    const first = placesBody([
      giftsPlace('Ann', { activity: 'daily' }),
      giftsPlace('Bea', { activity: 'within7Days' }),
    ]);
    renderShops();
    await resolveLatest(basicFilters({}), first);
    openMenu(copy.activity);
    chooseOption(copy.daily);
    expect(menuValue(copy.activity)).toBe(copy.daily);
    expect(bodyNames()).toEqual(['Ann']);

    const filtersBefore = callsTo('/map/filters').length;
    const placesBefore = callsTo('/map/places').length;
    await fireScript('error');
    fireEvent.click(screen.getByRole('button', { name: copy.retry }));
    await waitFor(() => expect(callsTo('/map/filters').length).toBe(filtersBefore + 1));
    await act(async () => {
      latestFilters().resolve(jsonResponse(basicFilters({}), 200));
    });
    await waitFor(() => expect(callsTo('/map/places').length).toBe(placesBefore + 1));
    expect(latestPlaces().url).toBe(DEV_PLACES);
    await resolvePlaces(
      placesBody([
        giftsPlace('Bea', { activity: 'within7Days' }),
        giftsPlace('Cia', { activity: 'within30Days' }),
      ]),
    );
    expect(menuValue(copy.activity)).toBe(copy.all);
    expect(bodyNames()).toEqual(['Bea', 'Cia']);

    const placesBeforeReturn = callsTo('/map/places').length;
    fireEvent.click(screen.getByRole('button', { name: copy.retry }));
    await waitFor(() => expect(callsTo('/map/filters').length).toBe(filtersBefore + 2));
    await act(async () => {
      latestFilters().resolve(jsonResponse(basicFilters({}), 200));
    });
    await waitFor(() => expect(callsTo('/map/places').length).toBe(placesBeforeReturn + 1));
    await resolvePlaces(first);
    expect(menuValue(copy.activity)).toBe(copy.all);
    expect(bodyNames()).toEqual(['Ann', 'Bea']);
    expect(openValues(copy.activity)).toContain('daily');
  });

  it('resets a blockchain to All when the provider no longer offers it', async () => {
    const both = [
      { blockchain: 'Bitcoin', asset: 'BTC' },
      { blockchain: 'Liquid', asset: 'L-BTC' },
    ];
    const bitcoinOnly = [{ blockchain: 'Bitcoin', asset: 'BTC' }];
    function chainFilters(pairs: readonly { blockchain: string; asset: string }[]): Place {
      return basicFilters({
        techProviders: [
          provider({
            blockchains: pairs.map((pair) => pair.blockchain),
            assets: pairs.map((pair) => pair.asset),
            pairs: [...pairs],
          }),
        ],
      });
    }
    const offered = placesBody([
      giftsPlace('Ann', { supports: [{ blockchain: 'Bitcoin', asset: 'BTC' }] }),
      giftsPlace('Bea', {}),
    ]);
    renderShops();
    await resolveLatest(chainFilters(both), offered);
    changeMenu(copy.blockchain, 'Liquid');
    expect(menuValue(copy.blockchain)).toBe('Liquid');
    expect(latestPlaces().url).toContain('blockchain=Liquid');
    await resolvePlaces(offered);

    const filtersBefore = callsTo('/map/filters').length;
    const placesBefore = callsTo('/map/places').length;
    await fireScript('error');
    fireEvent.click(screen.getByRole('button', { name: copy.retry }));
    await waitFor(() => expect(callsTo('/map/filters').length).toBe(filtersBefore + 1));
    await act(async () => {
      latestFilters().resolve(jsonResponse(chainFilters(bitcoinOnly), 200));
    });
    await waitFor(() => expect(callsTo('/map/places').length).toBe(placesBefore + 1));
    expect(latestPlaces().url).not.toContain('blockchain=');
    await resolvePlaces(
      placesBody([
        giftsPlace('Ann', { supports: [{ blockchain: 'Bitcoin', asset: 'BTC' }] }),
        giftsPlace('Bea', { supports: [{ blockchain: 'Liquid', asset: 'L-BTC' }] }),
      ]),
    );
    expect(menuValue(copy.blockchain)).toBe(copy.all);
    expect(openValues(copy.blockchain)).toEqual(['', 'Bitcoin', 'Liquid']);
  });

  it('resets an asset to All when its chain no longer offers it', async () => {
    const rows = placesBody([
      giftsPlace('Ann', { supports: [{ blockchain: 'Bitcoin', asset: 'BTC' }] }),
      giftsPlace('Bea', { supports: [{ blockchain: 'Side', asset: 'ZZZ' }] }),
    ]);
    renderShops();
    await resolveLatest(basicFilters({}), rows);
    openMenu(copy.asset);
    chooseOption('ZZZ');
    expect(latestPlaces().url).toContain('asset=ZZZ');
    await resolvePlaces(rows);
    expect(menuValue(copy.asset)).toBe('ZZZ');
    changeMenu(copy.blockchain, 'Bitcoin');
    expect(menuValue(copy.asset)).toBe(copy.all);
    expect(latestPlaces().url).toContain('blockchain=Bitcoin');
    expect(latestPlaces().url).not.toContain('asset=');
    await resolvePlaces(rows);
    changeMenu(copy.blockchain, '');
    expect(latestPlaces().url).not.toContain('blockchain=');
    expect(menuValue(copy.asset)).toBe(copy.all);
    expect(openValues(copy.asset)).toEqual(['', 'BTC', 'ZZZ']);
  });

  it('restyles positron and reveals the compact attribution', async () => {
    const onceHandlers: Array<() => void> = [];
    const lib = installMapLibre();
    wrapMap((map) => {
      Object.assign(map, {
        on: vi.fn(function (this: { transform: object }) {
          void this.transform;
        }),
        once(this: { transform: object }, _event: string, handler: () => void) {
          void this.transform;
          onceHandlers.push(handler);
        },
        getContainer(this: { transform: object }) {
          void this.transform;
          const node = document.getElementById('shop-places-map');
          if (node === null) throw new Error('missing map');
          return node;
        },
      });
    });
    render(<HomeShops copy={copy} locale="de" />);
    await resolveLatest(
      basicFilters({}),
      placesBody([giftsPlace('Ann', {}), giftsPlace('Bea', { country: 'DE' })]),
    );
    const mapNode = document.getElementById('shop-places-map');
    if (mapNode === null) throw new Error('missing map');
    await fireScript('load', false);
    const style = positronStyle().style;
    const call = latestStyle();
    expectOmit(call);
    await act(async () => {
      call.resolve(jsonResponse(style, 200));
    });
    await waitFor(() => {
      expect(onceHandlers).toHaveLength(1);
    });
    const reveal = onceHandlers[0];
    if (reveal === undefined) throw new Error('missing attribution reveal');
    const stray = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    stray.setAttribute('class', 'maplibregl-ctrl-attrib');
    mapNode.appendChild(stray);
    reveal();
    expect(stray.isConnected).toBe(true);
    stray.remove();
    reveal();
    const attrib = document.createElement('div');
    attrib.className = 'maplibregl-ctrl-attrib maplibregl-compact-show';
    attrib.setAttribute('open', '');
    mapNode.appendChild(attrib);
    reveal();
    expect(attrib.classList.contains('maplibregl-compact-show')).toBe(false);
    expect(attrib.hasAttribute('open')).toBe(false);
    const map = firstMap(lib) as MapDouble & { getContainer: () => HTMLElement };
    map.getContainer = () => document.createTextNode('x') as unknown as HTMLElement;
    reveal();

    const passed = firstOptions(lib).style;
    if (typeof passed === 'string') throw new Error('missing restyle');
    const layers = passed['layers'];
    if (!Array.isArray(layers)) throw new Error('missing restyle');
    const painted = layers;
    expect(screen.queryByText(copy.error)).toBeNull();
    expect(layerField(painted[1], 'id')).toBe(9);
    expect(paintOf(painted[0])).toEqual({ 'background-color': '#ffffff' });
    expect(paintOf(painted[1])).toEqual({ 'background-color': '#ffffff' });
    expect(paintOf(painted[2])).toEqual({ 'fill-color': '#f5f2ec' });
    expect(paintOf(painted[3])).toEqual({ 'line-width': 2, 'line-color': '#f5f2ec' });
    expect(paintOf(painted[4])).toEqual({ 'line-color': '#f5f2ec' });
    expect(paintOf(painted[5])).toEqual({ 'fill-color': '#00ff00', 'fill-opacity': 0 });
    expect(paintOf(painted[6])).toEqual({ 'fill-opacity': 0 });
    expect(paintOf(painted[7])).toEqual({ 'fill-opacity': 0 });
    expect(paintOf(painted[8])).toEqual({ 'line-width': 1, 'line-color': 'rgba(10,9,12,0.16)' });
    expect(paintOf(painted[9])).toEqual({ 'line-color': 'rgba(10,9,12,0.16)' });
    expect(layerField(painted[10], 'paint')).toBeUndefined();
    expect(lineColor(painted[11])).toBe('#d3cdc2');
    expect(lineColor(painted[12])).toBe('#efe9df');
    expect(lineColor(painted[13])).toBe('#efe9df');
    expect(lineColor(painted[14])).toBe('#ffffff');
    expect(lineColor(painted[15])).toBe('#ffffff');
    expect(lineColor(painted[16])).toBe('rgba(211,205,194,0.6)');
    expect(lineColor(painted[17])).toBe('#e3ded5');
    expect(lineColor(painted[18])).toBe('#ebe7e0');
    expect(lineColor(painted[19])).toBe('#ebe7e0');
    expect(lineColor(painted[20])).toBe('#dcd7ce');
    expect(lineColor(painted[21])).toBe('#e3ded5');
    expect(lineColor(painted[22])).toBe('#e3ded5');
    expect(paintOf(painted[23])).toEqual({ 'fill-color': '#eeebe5' });
    expect(layerField(painted[24], 'paint')).toEqual({
      'text-opacity': 1,
      'text-color': 'rgba(10,9,12,0.32)',
      'text-halo-color': '#f5f2ec',
    });
    expect(layerField(painted[24], 'layout')).toEqual({
      'text-size': 12,
      'text-field': ['coalesce', ['get', 'name:de'], ['get', 'name:latin'], ['get', 'name']],
    });
    expect(layerField(painted[25], 'paint')).toEqual({
      'text-color': 'rgba(10,9,12,0.58)',
      'text-halo-color': '#ffffff',
    });
    expect(layerField(painted[25], 'layout')).toEqual({
      'text-field': ['coalesce', ['get', 'name:de'], ['get', 'name:latin'], ['get', 'name']],
    });
    expect(layerField(painted[26], 'layout')).toEqual({});
    expect(layerField(painted[27], 'layout')).toBeUndefined();
    expect(painted[28]).toBeNull();
    expect(layerField(painted[29], 'layout')).toEqual({
      'text-field': '{ref}',
      'icon-image': 'road_1',
      visibility: 'none',
    });
    expect(paintOf(painted[29])).toEqual({});
    expect(layerField(painted[30], 'layout')).toEqual({ visibility: 'none' });
  });

  it('keeps the map when the positron style cannot be applied', async () => {
    const plain = await loadStyleMap();
    await act(async () => {
      latestStyle().resolve(jsonResponse({ layers: [] }, 200));
    });
    await waitFor(() => expect(plain.maps).toHaveLength(1));
    expect(styleSeen(plain)).toEqual([{ layers: [] }]);
    expect(screen.queryByText(copy.error)).toBeNull();
    expect(firstMap(plain).remove).not.toHaveBeenCalled();

    const refused = await loadStyleMap();
    await act(async () => {
      latestStyle().resolve(jsonResponse({}, 500));
    });
    await waitFor(() => expect(styleSeen(refused)).toEqual([TILE_STYLE]));
    expect(screen.queryByText(copy.error)).toBeNull();

    const arrayStyle = await loadStyleMap();
    await act(async () => {
      latestStyle().resolve(rawJsonResponse([]));
    });
    await waitFor(() => expect(styleSeen(arrayStyle)).toEqual([TILE_STYLE]));

    const bareStyle = await loadStyleMap();
    const bare = { layers: { id: 'bg' } };
    await act(async () => {
      latestStyle().resolve(jsonResponse(bare, 200));
    });
    await waitFor(() => expect(styleSeen(bareStyle)).toEqual([bare]));
    expect(screen.queryByText(copy.error)).toBeNull();

    const badJson = await loadStyleMap();
    const badResponse = new Response('null', { status: 200 });
    Object.defineProperty(badResponse, 'json', {
      value: () => Promise.reject(new Error('bad json')),
    });
    await act(async () => {
      latestStyle().resolve(badResponse);
    });
    await waitFor(() => expect(styleSeen(badJson)).toEqual([TILE_STYLE]));

    const network = await loadStyleMap();
    await act(async () => {
      latestStyle().reject(new Error('network'));
    });
    await waitFor(() => expect(styleSeen(network)).toEqual([TILE_STYLE]));
    expect(screen.queryByText(copy.error)).toBeNull();

    const aborted = await loadStyleMap();
    await act(async () => {
      latestStyle().reject(new DOMException('aborted', 'AbortError'));
    });
    await act(async () => {
      await Promise.resolve();
    });
    expect(styleSeen(aborted)).toEqual([]);
    expect(screen.queryByText(copy.error)).toBeNull();

    const late = await loadStyleMap();
    const lateCall = latestStyle();
    cleanup();
    await act(async () => {
      lateCall.resolve(jsonResponse({ layers: [] }, 200));
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(styleSeen(late)).toEqual([]);

    const lateError = await loadStyleMap();
    const lateErrorCall = latestStyle();
    cleanup();
    await act(async () => {
      lateErrorCall.reject(new Error('late'));
      await Promise.resolve();
    });
    expect(styleSeen(lateError)).toEqual([]);

    let finishJson: ((value: unknown) => void) | null = null;
    const deferred = await loadStyleMap();
    const deferredResponse = new Response('null', { status: 200 });
    Object.defineProperty(deferredResponse, 'json', {
      value: () =>
        new Promise((resolve) => {
          finishJson = resolve;
        }),
    });
    await act(async () => {
      latestStyle().resolve(deferredResponse);
      await Promise.resolve();
    });
    if (finishJson === null) throw new Error('missing json');
    cleanup();
    await act(async () => {
      finishJson?.({ layers: [] });
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(styleSeen(deferred)).toEqual([]);
  });

  it('hides an off-screen pin and cluster, then shows the pin back in view', async () => {
    let spot: 'far' | 'back' | 'edge' = 'far';
    const handlers: Record<string, () => void> = {};
    const lib = installMapLibre();
    wrapMap((map) => {
      Object.assign(map, {
        project(this: { transform: object }, position: [number, number]) {
          void this.transform;
          if (spot === 'edge' && position[0] === 36.82) return { x: 820, y: 200 };
          if (spot === 'edge' && position[0] === 36.9) return { x: -20, y: 200 };
          if (spot === 'edge' && position[0] === 10) return { x: 200, y: 620 };
          if (position[0] === 10) return { x: 200, y: -400 };
          if (position[0] < 40) return spot === 'back' ? { x: -19, y: 200 } : { x: -400, y: 200 };
          return { x: 200, y: 200 };
        },
        getContainer(this: { transform: object }) {
          void this.transform;
          const node = document.getElementById('shop-places-map');
          if (node === null) throw new Error('missing map');
          return node;
        },
        on(this: { transform: object }, event: string, handler: () => void) {
          void this.transform;
          handlers[event] = handler;
        },
      });
    });
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      queueMicrotask(() => callback(0));
      return 0;
    });
    renderShops();
    await resolveLatest(
      basicFilters({}),
      placesBody([
        giftsPlace('Ann', { lat: -1.29, lon: 36.82 }),
        giftsPlace('Ned', { lat: -1.29, lon: 36.9 }),
        giftsPlace('Bea', { lat: 14.6, lon: 121 }),
        giftsPlace('Cara', { lat: 14.6, lon: 10 }),
      ]),
    );
    await fireScript('load');
    const mapNode = document.getElementById('shop-places-map');
    if (mapNode === null) throw new Error('missing map');
    setRect(mapNode, { top: 0, left: 0, bottom: 600, right: 800, width: 800, height: 600 });
    for (const name of ['Ann', 'Ned', 'Bea', 'Cara']) {
      const pin = pinByName(name);
      Object.defineProperty(pin, 'offsetWidth', { configurable: true, value: 40 });
      Object.defineProperty(pin, 'offsetHeight', { configurable: true, value: 40 });
    }
    const map = firstMap(lib);
    map.transform.zoom = 10;
    await act(async () => {
      handlers['zoom']?.();
    });
    expect(pinByName('Ann').classList.contains('is-offscreen')).toBe(true);
    expect(pinByName('Ann').classList.contains('is-clustered')).toBe(true);
    expect(pinByName('Bea').classList.contains('is-offscreen')).toBe(false);
    expect(pinByName('Cara').classList.contains('is-offscreen')).toBe(true);
    const shell = document.querySelector('.shop-cluster-marker');
    if (!(shell instanceof HTMLElement)) throw new Error('missing cluster');
    expect(shell.classList.contains('is-offscreen')).toBe(true);

    map.transform.zoom = 17;
    await act(async () => {
      handlers['zoom']?.();
    });
    expect(document.querySelector('.shop-cluster-marker')).toBeNull();
    expect(pinByName('Ann').classList.contains('is-clustered')).toBe(false);
    expect(pinByName('Ann').classList.contains('is-offscreen')).toBe(true);

    Object.defineProperty(pinByName('Ann'), 'offsetWidth', { configurable: true, value: 0 });
    Object.defineProperty(pinByName('Ann'), 'offsetHeight', { configurable: true, value: 0 });
    spot = 'back';
    await act(async () => {
      handlers['zoom']?.();
    });
    expect(pinByName('Ann').classList.contains('is-offscreen')).toBe(false);
    expect(pinByName('Ned').classList.contains('is-offscreen')).toBe(false);
    expect(pinByName('Bea').classList.contains('is-offscreen')).toBe(false);
    expect(pinByName('Cara').classList.contains('is-offscreen')).toBe(true);

    spot = 'edge';
    await act(async () => {
      handlers['zoom']?.();
    });
    expect(pinByName('Ann').classList.contains('is-offscreen')).toBe(true);
    expect(pinByName('Ned').classList.contains('is-offscreen')).toBe(true);
    expect(pinByName('Cara').classList.contains('is-offscreen')).toBe(true);
    expect(pinByName('Bea').classList.contains('is-offscreen')).toBe(false);
  });

  it('clusters nearby pins, pans a popup into view, and drops a failed frame', async () => {
    const state = {
      unproject: 'point' as 'point' | 'throw' | 'nan',
    };
    const handlers: Record<string, () => void> = {};
    const lib = installMapLibre();
    wrapMap((map) => {
      Object.assign(map, {
        project(this: { transform: object }, position: [number, number]) {
          void this.transform;
          if (position[0] === 121.1) throw new Error('project');
          if (position[0] === 10.1) return { x: Number.NaN, y: 0 };
          return { x: position[0] * 10, y: position[1] * 10 };
        },
        getZoom(this: { transform: { zoom: number | undefined } }) {
          return this.transform.zoom;
        },
        unproject(this: { transform: object }) {
          void this.transform;
          if (state.unproject === 'throw') throw new Error('unproject');
          if (state.unproject === 'nan') return { lng: Number.NaN, lat: 1 };
          return { lng: 50, lat: 60 };
        },
        on(this: { transform: object }, event: string, handler: () => void) {
          void this.transform;
          handlers[event] = handler;
        },
        off: vi.fn(function (this: { transform: object }) {
          void this.transform;
        }),
        getContainer(this: { transform: object }) {
          void this.transform;
          const node = document.getElementById('shop-places-map');
          if (node === null) throw new Error('missing map');
          return node;
        },
        panBy: vi.fn(function (this: { transform: object }) {
          void this.transform;
        }),
      });
    });
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      queueMicrotask(() => callback(0));
      return 0;
    });
    renderShops();
    await resolveLatest(basicFilters({}), clusterRows());
    await fireScript('load');
    expect(document.querySelector('.shop-cluster')).toBeNull();

    const mapNode = document.getElementById('shop-places-map');
    if (mapNode === null) throw new Error('missing map');
    setRect(mapNode, { top: 0, left: 0, bottom: 600, right: 800, width: 800, height: 600 });
    const map = firstMap(lib) as MapDouble & {
      panBy: ReturnType<typeof vi.fn>;
      off: ReturnType<typeof vi.fn>;
      getContainer: () => HTMLElement;
      getZoom?: () => number | undefined;
      project?: (position: [number, number]) => { x: number; y: number };
      unproject?: () => { lng: number; lat: number };
    };
    map.transform.zoom = 10;
    await act(async () => {
      handlers['zoom']?.();
    });
    expect(document.querySelectorAll('.shop-cluster')).toHaveLength(6);
    const daily = clusterButton('is-daily');
    expect(daily.textContent).toBe('2');
    expect(daily.getAttribute('aria-label')).toBe('2 shops');
    expect(daily.getAttribute('type')).toBe('button');
    expect(clusterButton('is-weekly').textContent).toBe('2');
    expect(clusterButton('is-monthly').textContent).toBe('2');
    expect(clusterButton('is-idle').textContent).toBe('2');
    expect(document.querySelectorAll('.shop-cluster.is-none')).toHaveLength(2);
    expect(pinByName('Ann').classList.contains('is-clustered')).toBe(true);
    expect(pinByName('Bea').classList.contains('is-clustered')).toBe(true);
    expect(pinByName('Hank').classList.contains('is-clustered')).toBe(false);
    expect(pinByName('Jade').classList.contains('is-clustered')).toBe(false);
    expect(pinByName('Kirk').classList.contains('is-clustered')).toBe(false);
    expect(pinByName('Iris').classList.contains('is-clustered')).toBe(false);
    expect(clusterMarker(lib, 'is-daily').setLngLat).toHaveBeenCalledWith([50, 60]);

    fireEvent.click(daily);
    const bounds = lib.bounds.at(-1);
    if (bounds === undefined) throw new Error('missing bounds');
    expect(bounds.extend).toHaveBeenCalledTimes(2);
    expect(bounds.extend).toHaveBeenCalledWith([121, 14.6]);
    expect(bounds.extend).toHaveBeenCalledWith([121.2, 14.6]);
    expect(map.fitBounds).toHaveBeenLastCalledWith(bounds, {
      padding: FRAME_PADDING,
      maxZoom: 17.5,
      duration: 600,
    });

    state.unproject = 'throw';
    await act(async () => {
      handlers['zoom']?.();
    });
    expect(clusterMarker(lib, 'is-daily').setLngLat).toHaveBeenCalledWith([
      (121 + 121.2) / 2,
      14.6,
    ]);
    state.unproject = 'nan';
    await act(async () => {
      handlers['zoom']?.();
    });
    expect(clusterMarker(lib, 'is-daily').setLngLat).toHaveBeenCalledWith([
      (121 + 121.2) / 2,
      14.6,
    ]);
    delete map.unproject;
    await act(async () => {
      handlers['zoom']?.();
    });
    expect(clusterMarker(lib, 'is-weekly').setLngLat).toHaveBeenCalledWith([(10 + 10.2) / 2, 14.6]);

    map.transform.zoom = 17;
    await act(async () => {
      handlers['zoom']?.();
    });
    expect(document.querySelector('.shop-cluster')).toBeNull();
    expect(pinByName('Ann').classList.contains('is-clustered')).toBe(false);

    map.transform.zoom = undefined;
    await act(async () => {
      handlers['zoom']?.();
    });
    expect(document.querySelector('.shop-cluster')).toBeNull();
    const getZoom = map.getZoom;
    delete map.getZoom;
    map.transform.zoom = 10;
    await act(async () => {
      handlers['zoom']?.();
    });
    expect(document.querySelector('.shop-cluster')).toBeNull();
    if (getZoom !== undefined) map.getZoom = getZoom;

    map.getContainer = () => document.createTextNode('x') as unknown as HTMLElement;
    await act(async () => {
      handlers['zoom']?.();
    });
    expect(document.querySelector('.shop-cluster')).toBeNull();
    map.getContainer = () => mapNode;
    await act(async () => {
      handlers['zoom']?.();
    });
    expect(clusterButton('is-daily')).toBeTruthy();

    delete (map as { getContainer?: unknown }).getContainer;
    await act(async () => {
      handlers['zoom']?.();
    });
    expect(clusterButton('is-daily')).toBeTruthy();
    map.getContainer = () => mapNode;

    const hank = pinByName('Hank');
    const hankPopup = popupOf(lib, hank);
    map.getContainer = () => document.createTextNode('x') as unknown as HTMLElement;
    hankPopup.emit('open');
    expect(map.panBy).not.toHaveBeenCalled();
    map.getContainer = () => mapNode;

    hankPopup.emit('open');
    expect(map.panBy).not.toHaveBeenCalled();
    const svgPopup = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svgPopup.setAttribute('class', 'maplibregl-popup');
    mapNode.appendChild(svgPopup);
    hankPopup.emit('open');
    expect(map.panBy).not.toHaveBeenCalled();
    svgPopup.remove();
    const popup = document.createElement('div');
    popup.className = 'maplibregl-popup';
    mapNode.appendChild(popup);
    hankPopup.emit('open');
    expect(map.panBy).toHaveBeenCalledWith([-16, -16], { duration: 250 });

    setRect(mapNode, { top: 0, left: 0, bottom: 400, right: 400, width: 400, height: 400 });
    setRect(popup, { top: 40, left: 40, bottom: 100, right: 100, width: 60, height: 60 });
    map.panBy.mockClear();
    hankPopup.emit('open');
    expect(map.panBy).not.toHaveBeenCalled();
    setRect(popup, { top: 100, left: 40, bottom: 390, right: 100, width: 60, height: 290 });
    hankPopup.emit('open');
    expect(map.panBy).toHaveBeenCalledWith([0, 6], { duration: 250 });
    setRect(popup, { top: 40, left: 20, bottom: 100, right: 390, width: 370, height: 60 });
    hankPopup.emit('open');
    expect(map.panBy).toHaveBeenCalledWith([6, 0], { duration: 250 });
    const focus = vi
      .spyOn(HTMLButtonElement.prototype, 'focus')
      .mockImplementation(() => undefined);
    hankPopup.emit('open');
    expect(focus).not.toHaveBeenCalled();
    fireEvent.keyDown(hank, { key: 'Enter' });
    hankPopup.emit('open');
    expect(focus).toHaveBeenCalledTimes(1);
    hankPopup.content?.querySelector('.shop-popup-close')?.remove();
    focus.mockClear();
    fireEvent.keyDown(hank, { key: 'Enter' });
    hankPopup.emit('open');
    expect(focus).not.toHaveBeenCalled();
    const panBy = map.panBy;
    delete (map as { panBy?: unknown }).panBy;
    hankPopup.emit('open');
    map.panBy = panBy;

    changeMenu(copy.country, 'DE');
    await resolvePlaces(clusterRows());
    changeMenu(copy.country, '');
    await act(async () => {
      handlers['zoom']?.();
    });
    expect(document.querySelector('.shop-cluster')).toBeNull();
    await resolvePlaces(clusterRows());
    await fireScript('error');
    expect(document.querySelector('.shop-cluster')).toBeNull();

    const queued: FrameRequestCallback[] = [];
    vi.mocked(window.requestAnimationFrame).mockImplementation((callback) => {
      queued.push(callback);
      return 9;
    });
    const cancel = vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => undefined);
    handlers['zoom']?.();
    handlers['move']?.();
    expect(queued).toHaveLength(1);
    const project = map.project;
    delete map.project;
    const blocked = queued[0];
    if (blocked === undefined) throw new Error('missing frame');
    blocked(0);
    expect(document.querySelector('.shop-cluster')).toBeNull();
    if (project !== undefined) map.project = project;
    handlers['zoom']?.();
    expect(queued).toHaveLength(2);
    cleanup();
    expect(cancel).toHaveBeenCalledWith(9);
    expect(map.off).toHaveBeenCalledWith('move', handlers['move']);
    expect(map.off).toHaveBeenCalledWith('zoom', handlers['zoom']);
    const pendingFrame = queued[1];
    if (pendingFrame === undefined) throw new Error('missing pending frame');
    pendingFrame(0);
    expect(document.querySelector('.shop-cluster')).toBeNull();
  });

  it('pans and focuses the connected close button when the popup opens', async () => {
    const lib = installMapLibre();
    wrapMap((map) => {
      Object.assign(map, {
        getContainer(this: { transform: object }) {
          void this.transform;
          const node = document.getElementById('shop-places-map');
          if (node === null) throw new Error('missing map');
          return node;
        },
        panBy: vi.fn(function (this: { transform: object }) {
          void this.transform;
        }),
      });
    });
    renderShops();
    await resolveLatest(basicFilters({}), placesBody([giftsPlace('Pin', {})]));
    await fireScript('load');
    const mapNode = document.getElementById('shop-places-map');
    if (mapNode === null) throw new Error('missing map');
    const map = firstMap(lib) as MapDouble & { panBy: ReturnType<typeof vi.fn> };
    const pin = pinByName('Pin');
    const popup = popupOf(lib, pin);
    let connectedAtFocus: boolean | undefined;
    vi.spyOn(HTMLButtonElement.prototype, 'focus').mockImplementation(function (
      this: HTMLButtonElement,
    ) {
      if (!this.classList.contains('shop-popup-close')) return;
      connectedAtFocus = this.isConnected;
    });
    fireEvent.keyDown(pin, { key: 'Enter' });
    const shell = document.createElement('div');
    shell.className = 'maplibregl-popup';
    mapNode.appendChild(shell);
    if (popup.content === null) throw new Error('missing popup content');
    shell.appendChild(popup.content);
    popup.emit('open');
    expect(map.panBy).toHaveBeenCalledWith([-16, -16], { duration: 250 });
    expect(connectedAtFocus).toBe(true);
    map.panBy.mockClear();
    await act(async () => {
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => resolve());
        });
      });
    });
    expect(map.panBy).toHaveBeenCalledWith([-16, -16], { duration: 0 });
  });

  it('places a cluster marker on a whole pixel', async () => {
    const lib = installMapLibre();
    const seen: [number, number][] = [];
    wrapMap((map) => {
      Object.assign(map, {
        project(this: { transform: object }, position: [number, number]) {
          void this.transform;
          if (position[0] === 121) return { x: 10.25, y: 20.25 };
          return { x: 11.25, y: 21.25 };
        },
        unproject(this: { transform: object }, point: [number, number]) {
          void this.transform;
          seen.push(point);
          return { lng: point[0], lat: point[1] };
        },
        getContainer(this: { transform: object }) {
          void this.transform;
          const node = document.getElementById('shop-places-map');
          if (node === null) throw new Error('missing map');
          return node;
        },
      });
    });
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      queueMicrotask(() => callback(0));
      return 0;
    });
    renderShops();
    const mapNode = document.getElementById('shop-places-map');
    if (mapNode === null) throw new Error('missing map');
    setRect(mapNode, { top: 0, left: 0, bottom: 600, right: 800, width: 800, height: 600 });
    await resolveLatest(
      basicFilters({}),
      placesBody([
        giftsPlace('Ann', { lat: 14.6, lon: 121 }),
        giftsPlace('Bea', { lat: 14.6, lon: 121.01 }),
      ]),
    );
    await fireScript('load');
    await act(async () => {
      await Promise.resolve();
    });
    expect(seen.at(-1)).toEqual([11, 21]);
    expect(clusterMarker(lib, 'is-daily').setLngLat).toHaveBeenCalledWith([11, 21]);
  });

  it('joins a chain of pins when any pair is closer than 44px', async () => {
    await paintProjected([
      giftsPlace('Ann', { lat: 0, lon: 0 }),
      giftsPlace('Bea', { lat: 0, lon: 4 }),
      giftsPlace('Cara', { lat: 0, lon: 8 }),
    ]);
    expect(document.querySelectorAll('.shop-cluster.is-daily')).toHaveLength(1);
    expect(clusterButton('is-daily').textContent).toBe('3');
  });

  it('does not pull a farther pin into a cluster through the centroid', async () => {
    await paintProjected([
      giftsPlace('Ann', { lat: 0, lon: 0 }),
      giftsPlace('Bea', { lat: 4.3, lon: 0 }),
      giftsPlace('Cara', { lat: 2.15, lon: 4.3 }),
    ]);
    expect(document.querySelectorAll('.shop-cluster')).toHaveLength(1);
    expect(clusterButton('is-daily').textContent).toBe('2');
    expect(pinByName('Cara').classList.contains('is-clustered')).toBe(false);
  });

  it('sorts every column and keeps an equal name in ascending order', async () => {
    renderShops();
    await resolveLatest(basicFilters({}), sortRows());
    expect(bodyNames()).toEqual(['Ann', 'Bea', 'Cal', 'Dee', 'Eve']);
    expect(columnHeader(copy.colName).getAttribute('aria-sort')).toBe('ascending');
    expect(columnHeader(copy.colName).className).toContain('p-0');
    expect(headerButton(copy.colName).className).toContain('min-h-11');
    expect(headerButton(copy.colName).className).toContain('px-4');
    expect(headerButton(copy.colName).className).toContain('py-3');
    expect(columnHeader(copy.colName).textContent).toBe(copy.colName);
    expect(triangleClass(copy.colLocation)).toContain('opacity-30');
    const placesBefore = callsTo('/map/places').length;

    fireEvent.click(headerButton(copy.colLocation));
    expect(bodyNames()).toEqual(['Dee', 'Cal', 'Eve', 'Ann', 'Bea']);
    expect(columnHeader(copy.colLocation).getAttribute('aria-sort')).toBe('ascending');
    fireEvent.click(headerButton(copy.colLocation));
    expect(bodyNames()).toEqual(['Ann', 'Bea', 'Eve', 'Cal', 'Dee']);
    expect(columnHeader(copy.colLocation).getAttribute('aria-sort')).toBe('descending');
    expect(triangleClass(copy.colLocation)).toContain('rotate-180');
    expect(triangleClass(copy.colLocation)).not.toContain('opacity-30');
    expect(columnHeader(copy.colName).getAttribute('aria-sort')).toBe('none');
    expect(triangleClass(copy.colName)).toContain('opacity-30');
    fireEvent.click(headerButton(copy.colLocation));
    expect(bodyNames()).toEqual(['Dee', 'Cal', 'Eve', 'Ann', 'Bea']);
    expect(columnHeader(copy.colLocation).getAttribute('aria-sort')).toBe('ascending');
    expect(triangleClass(copy.colLocation)).not.toContain('rotate-180');

    fireEvent.click(headerButton(copy.colActivity));
    expect(bodyNames()).toEqual(['Ann', 'Bea', 'Cal', 'Dee', 'Eve']);
    fireEvent.click(headerButton(copy.colActivity));
    expect(bodyNames()).toEqual(['Eve', 'Dee', 'Cal', 'Ann', 'Bea']);
    expect(columnHeader(copy.colActivity).getAttribute('aria-sort')).toBe('descending');

    fireEvent.click(headerButton(copy.colCountry));
    expect(bodyNames()).toEqual(['Bea', 'Dee', 'Ann', 'Cal', 'Eve']);
    fireEvent.click(headerButton(copy.colCountry));
    expect(bodyNames()).toEqual(['Ann', 'Cal', 'Eve', 'Dee', 'Bea']);

    fireEvent.click(headerButton(copy.colShop));
    expect(bodyNames()).toEqual(['Bea', 'Ann', 'Cal', 'Dee', 'Eve']);
    fireEvent.click(headerButton(copy.colShop));
    expect(bodyNames()).toEqual(['Ann', 'Cal', 'Dee', 'Eve', 'Bea']);

    fireEvent.click(headerButton(copy.colName));
    expect(bodyNames()).toEqual(['Ann', 'Bea', 'Cal', 'Dee', 'Eve']);
    fireEvent.click(headerButton(copy.colName));
    expect(bodyNames()).toEqual(['Eve', 'Dee', 'Cal', 'Bea', 'Ann']);
    expect(callsTo('/map/places')).toHaveLength(placesBefore);

    fireEvent.click(headerButton(copy.colLocation));
    fireEvent.click(headerButton(copy.colLocation));
    changeMenu(copy.country, 'PH');
    expect(bodyNames()).toEqual(['Ann', 'Eve', 'Cal']);
    expect(columnHeader(copy.colLocation).getAttribute('aria-sort')).toBe('descending');
  });

  it('hides filters and the category chip when the shops do not differ', async () => {
    const lib = installMapLibre();
    renderShops();
    await resolveLatest(
      basicFilters({}),
      placesBody([
        giftsPlace('Ann', {
          shopName: null,
          category: 'shopping',
          coverPhoto: { url: 'https://images.example/ann.jpg' },
          street: 'One',
        }),
        giftsPlace('Bea', {
          shopName: null,
          category: 'shopping',
          street: 'Two',
          lat: 1,
          lon: 2,
        }),
      ]),
    );
    expect(screen.queryByRole('combobox')).toBeNull();
    expect(screen.getByRole('button', { name: copy.helpLabel })).toBeTruthy();
    expect(document.querySelectorAll('.shop-legend .shop-place-marker')).toHaveLength(5);
    const headers = within(screen.getByRole('table', { hidden: true }))
      .getAllByRole('columnheader', { hidden: true })
      .map((header) => header.textContent);
    expect(headers).toEqual([copy.colName, copy.colLocation, copy.colActivity]);
    await fireScript('load');
    const ann = lib.popups[0];
    const bea = lib.popups[1];
    if (ann === undefined || ann.content === null || bea === undefined || bea.content === null) {
      throw new Error('missing popup');
    }
    expect(ann.content.querySelector('.shop-popup-photo')?.getAttribute('src')).toBe(
      'https://images.example/ann.jpg',
    );
    expect(ann.content.querySelector('.shop-popup-category')).toBeNull();
    expect(bea.content.querySelector('.shop-popup-photo')).toBeNull();
    expect(bea.content.querySelector('.shop-popup-category')).toBeNull();
  });

  it('anchors the help panel inside the window and closes it from outside', async () => {
    renderShops();
    await resolveLatest(
      basicFilters({}),
      placesBody([giftsPlace('Ann', { country: 'PH' }), giftsPlace('Bea', { country: 'DE' })]),
    );
    expect(document.querySelector('.shop-legend')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: copy.helpLabel }));
    const dialog = screen.getByRole('dialog', { name: copy.helpLabel });
    const width = Math.min(320, window.innerWidth - 32);
    expect(dialog.style.top).toBe('16px');
    expect(dialog.style.left).toBe('16px');
    expect(dialog.style.width).toBe(`${width}px`);
    expect(dialog.className).toContain('fixed');
    expect(dialog.className).toContain('shadow-lg');
    fireEvent(window, new Event('resize'));
    expect(dialog.style.top).toBe('16px');
    expect(dialog.style.left).toBe('16px');

    const span = screen.getByRole('button', { name: copy.helpLabel }).parentElement;
    if (!(span instanceof HTMLElement)) throw new Error('missing help anchor');
    setWindowSize(1024, 768);
    setRect(span, { top: 700, left: 900, bottom: 800, right: 940, width: 40, height: 100 });
    fireEvent(window, new Event('resize'));
    expect(dialog.style.left).toBe('688px');
    expect(dialog.style.top).toBe('692px');
    expect(dialog.style.width).toBe('320px');
    setRect(span, { top: 0, left: 100, bottom: 900, right: 140, width: 40, height: 900 });
    fireEvent(window, new Event('resize'));
    expect(dialog.style.left).toBe('100px');
    expect(dialog.style.top).toBe('16px');

    setRect(span, { top: 500, left: 40, bottom: 544, right: 84, width: 44, height: 44 });
    setRect(dialog, { top: 0, left: 40, bottom: 220, right: 360, width: 320, height: 220 });
    fireEvent(window, new Event('resize'));
    expect(dialog.style.top).toBe('272px');
    expect(dialog.style.left).toBe('40px');
    expect(dialog.style.width).toBe('320px');
    expect(Number.parseFloat(dialog.style.top) + 220).toBeLessThanOrEqual(768 - 16);

    setRect(span, { top: 770, left: 40, bottom: 814, right: 84, width: 44, height: 44 });
    setRect(dialog, { top: 0, left: 40, bottom: 100, right: 360, width: 320, height: 100 });
    fireEvent(window, new Event('resize'));
    expect(dialog.style.top).toBe('652px');
    expect(Number.parseFloat(dialog.style.top) + 100).toBeLessThanOrEqual(768 - 16);
    setRect(span, { top: 120, left: 40, bottom: 164, right: 84, width: 44, height: 44 });
    setRect(dialog, { top: 0, left: 40, bottom: 100, right: 360, width: 320, height: 100 });
    fireEvent(window, new Event('scroll'));
    expect(dialog.style.top).toBe('172px');
    expect(dialog.style.left).toBe('40px');
    expect(dialog.style.bottom).toBe('496px');

    setWindowSize(1024, 768);
    setRect(span, { top: 40, left: 40, bottom: 84, right: 84, width: 44, height: 44 });
    setRect(dialog, { top: 0, left: 40, bottom: 800, right: 360, width: 320, height: 800 });
    fireEvent(window, new Event('resize'));
    expect(dialog.style.top).toBe('16px');
    expect(dialog.style.bottom).toBe('16px');
    setRect(span, { top: 120, left: 40, bottom: 164, right: 84, width: 44, height: 44 });
    setRect(dialog, { top: 0, left: 40, bottom: 100, right: 360, width: 320, height: 100 });
    fireEvent(window, new Event('resize'));
    expect(dialog.style.top).toBe('172px');
    expect(dialog.style.bottom).toBe('496px');

    fireEvent.mouseDown(dialog);
    expect(screen.getByRole('dialog', { name: copy.helpLabel })).toBe(dialog);
    fireEvent.mouseDown(span);
    expect(screen.getByRole('dialog', { name: copy.helpLabel })).toBe(dialog);
    fireEvent.keyDown(document, { key: 'a' });
    expect(screen.getByRole('dialog', { name: copy.helpLabel })).toBe(dialog);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: copy.helpLabel }));
    fireEvent.mouseDown(document);
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: copy.helpLabel }));
    fireEvent.mouseDown(screen.getByRole('heading', { name: copy.lead }));
    expect(screen.queryByRole('dialog')).toBeNull();

    changeMenu(copy.country, 'PH');
    changeMenu(copy.country, '');
    fireEvent.click(screen.getByRole('button', { name: copy.helpLabel }));
    expect(screen.getByRole('dialog', { name: copy.helpLabel })).toBeTruthy();
    await resolvePlaces(placesBody([]));
    expect(screen.queryByRole('button', { name: copy.helpLabel })).toBeNull();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.querySelector('.shop-legend')).toBeNull();
    fireEvent(window, new Event('resize'));
  });

  it('keeps the bottom inset when a tall help panel is stretched to the window', async () => {
    renderShops();
    await resolveLatest(
      basicFilters({}),
      placesBody([giftsPlace('Ann', { country: 'PH' }), giftsPlace('Bea', { country: 'DE' })]),
    );
    setWindowSize(1024, 768);
    fireEvent.click(screen.getByRole('button', { name: copy.helpLabel }));
    const dialog = screen.getByRole('dialog', { name: copy.helpLabel });
    const span = screen.getByRole('button', { name: copy.helpLabel }).parentElement;
    if (!(span instanceof HTMLElement)) throw new Error('missing help anchor');
    setRect(span, { top: 40, left: 40, bottom: 84, right: 84, width: 44, height: 44 });
    const contentHeight = 800;
    dialog.getBoundingClientRect = () => {
      const pinned = dialog.style.bottom !== '' && dialog.style.bottom !== 'auto';
      const height = pinned ? 736 : contentHeight;
      return {
        x: 40,
        y: 0,
        top: 0,
        left: 40,
        bottom: height,
        right: 360,
        width: 320,
        height,
        toJSON() {
          return {};
        },
      } as DOMRect;
    };
    fireEvent(window, new Event('resize'));
    expect(dialog.style.top).toBe('16px');
    expect(dialog.style.bottom).toBe('16px');
    fireEvent(window, new Event('resize'));
    expect(dialog.style.bottom).toBe('16px');
  });
});

function omitAddress(): Place {
  return {
    street: '',
    houseNumber: '',
    postalCode: '',
    city: '',
  };
}

function textOf(node: HTMLElement | undefined): string {
  if (node === undefined) throw new Error('missing node');
  const text = node.textContent;
  if (text === null) throw new Error('missing text');
  return text;
}

function wrapMap(augment: (map: MapDouble) => void): void {
  const lib = window.maplibregl;
  if (lib === undefined) throw new Error('missing map library');
  const Original = lib.Map;
  lib.Map = function Map(options: MapOptions): MapDouble {
    const map = new Original(
      options as unknown as ConstructorParameters<typeof Original>[0],
    ) as MapDouble;
    augment(map);
    return map;
  } as unknown as typeof lib.Map;
}

function latestStyle(): PendingCall {
  const call = callsTo('openfreemap').at(-1);
  if (call === undefined) throw new Error('missing style');
  return call;
}

async function loadStyleMap(): Promise<LibDouble> {
  cleanup();
  pending.length = 0;
  clearMapDom();
  const lib = installMapLibre();
  renderShops();
  await resolveLatest(
    basicFilters({}),
    placesBody([giftsPlace('Ann', {}), giftsPlace('Bea', { country: 'DE' })]),
  );
  await fireScript('load', false);
  return lib;
}

function styleSeen(lib: LibDouble): unknown[] {
  return lib.options.map((item) => item.style);
}

function mapLayer(id: unknown, type: string, extra: Place = {}): Place {
  return { id, type, ...extra };
}

function positronStyle(): { style: Place; layers: (Place | null)[] } {
  const layers: (Place | null)[] = [
    mapLayer('background', 'background'),
    mapLayer(9, 'background'),
    mapLayer('water', 'fill'),
    mapLayer('water-line', 'line', { paint: { 'line-width': 2 } }),
    mapLayer('waterway', 'line'),
    mapLayer('landcover', 'fill', { paint: { 'fill-color': '#00ff00' } }),
    mapLayer('landuse', 'fill'),
    mapLayer('park', 'fill'),
    mapLayer('boundary', 'line', { paint: { 'line-width': 1 } }),
    mapLayer('boundary-dash', 'line'),
    mapLayer('road-dashline', 'line'),
    mapLayer('road-casing', 'line'),
    mapLayer('road-motorway_inner', 'line'),
    mapLayer('road-motorway_bridge_inner', 'line'),
    mapLayer('road_inner', 'line'),
    mapLayer('aeroway-runway', 'line'),
    mapLayer('road_subtle', 'line'),
    mapLayer('road_minor', 'line'),
    mapLayer('road-path', 'line'),
    mapLayer('road-pier', 'line'),
    mapLayer('rail', 'line'),
    mapLayer('road', 'line'),
    mapLayer('highway', 'line'),
    mapLayer('building', 'fill'),
    mapLayer('water-label', 'symbol', {
      paint: { 'text-opacity': 1 },
      layout: { 'text-size': 12, 'text-field': '{name}' },
    }),
    mapLayer('place-label', 'symbol', { layout: { 'text-field': '{name}' } }),
    mapLayer('poi', 'symbol', { layout: {} }),
    mapLayer('road-label', 'symbol'),
    null,
    mapLayer('highway-shield-non-us', 'symbol', {
      layout: { 'text-field': '{ref}', 'icon-image': 'road_1' },
    }),
    mapLayer('road_shield_us', 'symbol'),
  ];
  return { style: { layers }, layers };
}

function layerRecord(layer: unknown): Place | null {
  if (typeof layer !== 'object' || layer === null || Array.isArray(layer)) return null;
  return layer as Place;
}

function layerField(layer: unknown, key: string): unknown {
  const record = layerRecord(layer);
  if (record === null) return undefined;
  return record[key];
}

function paintOf(layer: unknown): Place {
  const paint = layerField(layer, 'paint');
  if (typeof paint !== 'object' || paint === null || Array.isArray(paint)) return {};
  return paint as Place;
}

function lineColor(layer: unknown): unknown {
  return paintOf(layer)['line-color'];
}

function setRect(
  node: HTMLElement,
  rect: { top: number; left: number; bottom: number; right: number; width: number; height: number },
): void {
  node.getBoundingClientRect = () =>
    ({
      x: rect.left,
      y: rect.top,
      top: rect.top,
      left: rect.left,
      bottom: rect.bottom,
      right: rect.right,
      width: rect.width,
      height: rect.height,
      toJSON() {
        return {};
      },
    }) as DOMRect;
}

function setWindowSize(width: number, height: number): void {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: width });
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: height });
}

async function paintProjected(places: readonly Place[]): Promise<void> {
  installMapLibre();
  wrapMap((map) => {
    Object.assign(map, {
      project(this: { transform: object }, position: [number, number]) {
        void this.transform;
        return { x: position[0] * 10, y: position[1] * 10 };
      },
      unproject(this: { transform: object }, point: [number, number]) {
        void this.transform;
        return { lng: point[0], lat: point[1] };
      },
      getContainer(this: { transform: object }) {
        void this.transform;
        const node = document.getElementById('shop-places-map');
        if (node === null) throw new Error('missing map');
        return node;
      },
    });
  });
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
    queueMicrotask(() => callback(0));
    return 0;
  });
  renderShops();
  const mapNode = document.getElementById('shop-places-map');
  if (mapNode === null) throw new Error('missing map');
  setRect(mapNode, { top: 0, left: 0, bottom: 600, right: 800, width: 800, height: 600 });
  await resolveLatest(basicFilters({}), placesBody(places));
  await fireScript('load');
  await act(async () => {
    await Promise.resolve();
  });
}

function clusterRows(): { places: readonly unknown[] } {
  return placesBody([
    giftsPlace('Ann', { activity: 'daily', lat: 14.6, lon: 121 }),
    giftsPlace('Bea', { activity: 'daily', lat: 14.6, lon: 121.2 }),
    giftsPlace('Cara', { activity: 'within7Days', lat: 14.6, lon: 10 }),
    giftsPlace('Cole', { activity: 'within7Days', lat: 14.6, lon: 10.2 }),
    giftsPlace('Dana', { activity: 'within30Days', lat: 14.6, lon: 30 }),
    giftsPlace('Dean', { activity: 'within30Days', lat: 14.6, lon: 30.2 }),
    giftsPlace('Earl', { activity: 'olderThan30Days', lat: 14.6, lon: 50 }),
    giftsPlace('Eden', { activity: 'olderThan30Days', lat: 14.6, lon: 50.2 }),
    giftsPlace('Faye', { activity: 'none', lat: 14.6, lon: 70 }),
    giftsPlace('Fern', { activity: 'none', lat: 14.6, lon: 70.2 }),
    giftsPlace('Gail', { activity: 'zeta', lat: 14.6, lon: 90 }),
    giftsPlace('Gus', { activity: 'zeta', lat: 14.6, lon: 90.2 }),
    giftsPlace('Hank', { activity: 'within7Days', lat: 14.6, lon: 160 }),
    giftsPlace('Iris', { activity: 'daily', country: 'DE', lat: 52, lon: 180 }),
    giftsPlace('Jade', { activity: 'daily', lat: 14.6, lon: 121.1 }),
    giftsPlace('Kirk', { activity: 'within7Days', lat: 14.6, lon: 10.1 }),
  ]);
}

function sortRows(): { places: readonly unknown[] } {
  return placesBody([
    giftsPlace('Ann', { street: 'Same', country: 'PH', activity: 'daily', shopName: 'SPAR' }),
    giftsPlace('Bea', { street: 'Same', country: 'DE', activity: 'daily', shopName: null }),
    giftsPlace('Cal', { street: 'Late', country: 'PH', activity: 'within7Days', shopName: 'SPAR' }),
    giftsPlace('Dee', { street: 'Early', country: 'KE', activity: 'none', shopName: 'SPAR' }),
    giftsPlace('Eve', { street: 'Mid', country: 'PH', activity: 'zeta', shopName: 'SPAR' }),
  ]);
}

function popupOf(lib: LibDouble, pin: HTMLElement): PopupDouble {
  const marker = lib.markers.find((item) => item.element === pin);
  const popup = marker?.setPopup.mock.calls[0]?.[0] as PopupDouble | undefined;
  if (popup === undefined) throw new Error('missing popup');
  return popup;
}

function pinByName(name: string): HTMLElement {
  const node = document.querySelector(`button[aria-label^="${name},"]`);
  if (!(node instanceof HTMLElement)) throw new Error(`missing pin ${name}`);
  return node;
}

function clusterButton(className: string): HTMLElement {
  const node = document.querySelector(`.shop-cluster.${className}`);
  if (!(node instanceof HTMLElement)) throw new Error(`missing ${className}`);
  return node;
}

function clusterMarker(lib: LibDouble, className: string): MarkerDouble {
  const button = clusterButton(className);
  const marker = [...lib.markers].reverse().find((item) => item.element.contains(button));
  if (marker === undefined) throw new Error(`missing marker ${className}`);
  return marker;
}

function headerButton(label: string): HTMLElement {
  return screen.getByRole('button', { name: label, hidden: true });
}

function columnHeader(label: string): HTMLElement {
  return screen.getByRole('columnheader', { name: label, hidden: true });
}

function triangleClass(label: string): string {
  const mark = headerButton(label).querySelector('[aria-hidden="true"]');
  if (mark === null) throw new Error('missing triangle');
  return mark.className;
}
