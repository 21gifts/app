import { cleanup, render, screen, within, fireEvent, waitFor, act } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HomeShops } from '@/app/(marketing)/HomeShops';
import { getCatalog } from '@/lib/messages';

const messages = getCatalog('en');

const copy = {
  title: messages['homeShops.title'],
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
  empty: messages['homeShops.empty'],
  error: messages['homeShops.error'],
  retry: messages['homeShops.retry'],
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
const TILE_STYLE = 'https://tiles.openfreemap.org/styles/liberty';
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
  addControl: ReturnType<typeof vi.fn>;
  resize: ReturnType<typeof vi.fn>;
  setCenter: ReturnType<typeof vi.fn>;
  setZoom: ReturnType<typeof vi.fn>;
  fitBounds: ReturnType<typeof vi.fn>;
  remove: ReturnType<typeof vi.fn>;
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
};

type BoundsDouble = { extend: ReturnType<typeof vi.fn> };

type MapOptions = {
  container: HTMLElement;
  style: string;
  center: [number, number];
  zoom: number;
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
  return render(<HomeShops copy={copy} />);
}

function countrySelect(): HTMLSelectElement {
  const element = screen.getByRole('combobox', { name: copy.country });
  if (!(element instanceof HTMLSelectElement)) throw new Error('country select');
  return element;
}

function nameSelect(): HTMLSelectElement {
  const element = screen.getByRole('combobox', { name: copy.name });
  if (!(element instanceof HTMLSelectElement)) throw new Error('name select');
  return element;
}

function changeSelect(element: HTMLSelectElement, value: string): void {
  fireEvent.change(element, { target: { value } });
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
  const option = listboxOptions().find((item) => item.textContent?.trim() === label);
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

function selectValues(element: HTMLSelectElement): string[] {
  return [...element.options].map((option) => option.value);
}

function popoverTarget(button: HTMLElement): string {
  const lower = button.getAttribute('popovertarget');
  if (lower !== null && lower !== '') return lower;
  const upper = button.getAttribute('popoverTarget');
  if (upper !== null && upper !== '') return upper;
  throw new Error('missing popover target');
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
    const map: MapDouble = {
      addControl: vi.fn(),
      resize: vi.fn(),
      setCenter: vi.fn(),
      setZoom: vi.fn(),
      fitBounds: vi.fn(),
      remove: vi.fn(),
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
    const popup: PopupDouble = {
      offset: input.offset,
      content: null,
      setDOMContent: vi.fn((content: HTMLElement) => {
        popup.content = content;
        return popup;
      }),
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

async function fireScript(type: 'load' | 'error'): Promise<void> {
  const script = mapScript();
  await act(async () => {
    script.dispatchEvent(new Event(type));
  });
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
    vi.unstubAllGlobals();
  });

  it('loads dev filters before places and keeps the map in front', async () => {
    renderShops();
    expectNoSecretWords();
    expect(document.getElementById('shops')).toBeTruthy();
    expect(screen.getByRole('heading', { name: copy.title })).toBeTruthy();
    expect(screen.getByText(copy.lead)).toBeTruthy();
    const section = document.getElementById('shops');
    if (section === null) throw new Error('missing shops');
    expect(section.getAttribute('style')).toBeNull();
    expect(section.querySelector('style')).toBeNull();
    expect(section.className).toBe(
      'bg-[#fff] text-[#272b38] [--color-app-danger:#b91c1c] [--color-app-focus:#171717] [--color-app-btn:#171717] [--color-app-btn-fg:#ffffff] [--color-app-btn-hover:#404040]',
    );
    expect(screen.getByRole('heading', { name: copy.title }).className).toBe(
      'text-2xl font-semibold',
    );
    const mapNode = document.getElementById('shop-places-map');
    if (mapNode === null) throw new Error('missing map');
    expect(mapNode.getAttribute('style')).toBeNull();
    expect(mapNode.className).toBe('h-[28rem] min-h-[28rem] w-full');
    expect(mapNode.hasAttribute('hidden')).toBe(false);
    expect(tableShell().hasAttribute('hidden')).toBe(true);
    expect(countrySelect().className).toBe(
      'min-h-11 rounded-lg border border-[#ced1da] bg-[#fff] px-3',
    );
    expect(nameSelect().className).toBe(
      'min-h-11 rounded-lg border border-[#ced1da] bg-[#fff] px-3',
    );
    expect(menuButton(copy.blockchain).className).toBe(
      'min-h-11 rounded-lg border border-[#ced1da] bg-[#fff] px-3',
    );
    const csv = screen.getByRole('button', { name: copy.csv, hidden: true });
    expect(csv.className).toContain('min-h-11');
    expect(csv.getAttribute('type')).toBe('button');
    const help = screen.getByRole('button', { name: copy.helpLabel, hidden: true });
    const helpPopover = help.getAttribute('popovertarget') ?? help.getAttribute('popoverTarget');
    expect(helpPopover).not.toBeNull();
    expect(help.className).toContain('h-11');
    expect(help.className).toContain('w-11');
    expect(help.className).toContain('bg-app-btn');
    expect(help.textContent).not.toContain('?');
    const viewGroup = screen.getByRole('group', { name: copy.view });
    expect(viewGroup.getAttribute('style')).toBeNull();
    expect(viewGroup.className).toBe(
      'inline-flex min-h-11 items-center rounded-full border border-[#ced1da] bg-[#fff] px-1',
    );
    const mapButton = screen.getByRole('button', { name: copy.map });
    const tableButton = screen.getByRole('button', { name: copy.table });
    expect(mapButton.getAttribute('style')).toBeNull();
    expect(tableButton.getAttribute('style')).toBeNull();
    expect(mapButton.className).toBe(
      'min-h-11 rounded-full border-0 bg-[#272b38] px-3.5 text-white',
    );
    expect(tableButton.className).toBe(
      'min-h-11 rounded-full border-0 bg-transparent px-3.5 text-[#272b38]',
    );
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
      placesBody([giftsPlace('Retained', {})]),
    );
    changeSelect(countrySelect(), 'PH');
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
    await act(async () => latestFilters().resolve(jsonResponse(basicFilters({}), 200)));
    await waitFor(() => expect(callsTo('/map/places')).toHaveLength(1));
    const first = latestPlaces();
    changeSelect(countrySelect(), 'PH');
    expect(first.signal.aborted).toBe(true);
    expect(callsTo('/map/filters')).toHaveLength(1);
    await act(async () => {
      first.resolve(jsonResponse(placesBody([giftsPlace('Sample', {})]), 200));
    });
    expect(screen.queryByText('Sample')).toBeNull();
    await waitFor(() => expect(callsTo('/map/places')).toHaveLength(2));
    expect(latestPlaces().url).toBe(`${DEV_PLACES}?country=PH`);
    await act(async () => {
      latestPlaces().resolve(jsonResponse(placesBody([giftsPlace('Sample', {})]), 200));
    });
    await waitFor(() => {
      expect(screen.getByText('Sample')).toBeTruthy();
    });
  });

  it('shows empty only when the list is ready and has no rows', async () => {
    renderShops();
    await resolveLatest(basicFilters({}), placesBody([]));
    await waitFor(() => {
      expect(screen.getByText(copy.empty)).toBeTruthy();
    });
    expect(screen.queryByText(copy.error)).toBeNull();
    expect(screen.getByRole('heading', { name: copy.title })).toBeTruthy();
  });

  it('opens, closes, and chooses listbox options without bubbling', async () => {
    const onParent = vi.fn();
    render(
      <div onClick={onParent}>
        <HomeShops copy={copy} />
      </div>,
    );
    for (const label of [copy.blockchain, copy.asset, copy.activity]) {
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
    expect(all.className).toContain('min-h-11');
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

  it('opens a closed menu from ArrowDown on the current option', () => {
    renderShops();
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
    await resolveLatest(basicFilters({}), placesBody([giftsPlace('Sample', {})]));
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
    await resolveLatest(basicFilters({}), placesBody([giftsPlace('Sample', {})]));
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
    await resolveLatest(basicFilters({}), placesBody([giftsPlace('Sample', {})]));
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
    await resolveLatest(basicFilters({}), placesBody([giftsPlace('Sample', {})]));
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
    expect(button.textContent).toBe('Bitcoin');
    expect(document.activeElement).toBe(button);
  });

  it('opens with Space and commits the highlighted blockchain', async () => {
    renderShops();
    await resolveLatest(basicFilters({}), placesBody([giftsPlace('Sample', {})]));
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
    expect(button.textContent).toBe('Bitcoin');
    expect(document.activeElement).toBe(button);
  });

  it('leaves the listbox open when the trigger receives a letter', () => {
    renderShops();
    const button = menuButton(copy.blockchain);
    fireEvent.keyDown(button, { key: 'ArrowDown' });
    const active = button.getAttribute('aria-activedescendant');
    fireEvent.keyDown(button, { key: 'a' });
    expect(button.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByRole('listbox')).toBeTruthy();
    expect(button.getAttribute('aria-activedescendant')).toBe(active);
  });

  it('closes from Escape on document and returns focus from Escape on the trigger', () => {
    renderShops();
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
    await resolveLatest(basicFilters({}), placesBody([giftsPlace('Sample', {})]));
    openMenu(copy.blockchain);
    const base = 'min-h-11 min-w-11 border-0 bg-transparent p-0 text-left font-inherit';
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
          pairs: [{ blockchain: 'Bitcoin', asset: 'BTC' }],
        }),
      ],
    });
    const rows = placesBody([giftsPlace('Sample', {})]);
    renderShops();
    await resolveLatest(filters, rows);
    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'PH', hidden: true })).toBeTruthy();
    });

    const beforeCountry = pending.length;
    changeSelect(countrySelect(), 'PH');
    changeSelect(countrySelect(), 'PH');
    expect(pending.length).toBe(beforeCountry + 1);
    expect(latestPlaces().url).toBe(`${DEV_PLACES}?country=PH`);
    await resolvePlaces(rows);

    const beforeName = pending.length;
    changeSelect(nameSelect(), 'SPAR');
    changeSelect(nameSelect(), 'SPAR');
    expect(pending.length).toBe(beforeName + 1);
    expect(latestPlaces().url).toBe(`${DEV_PLACES}?country=PH&shopName=SPAR`);
    await resolvePlaces(rows);

    const beforeAsset = pending.length;
    openMenu(copy.asset);
    chooseOption('BTC');
    expect(pending.length).toBe(beforeAsset + 1);
    expect(menuButton(copy.asset).textContent).toBe('BTC');
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
    expect(menuButton(copy.asset).textContent).toBe(copy.all);
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
    const rows = placesBody([giftsPlace('Sample', {})]);
    renderShops();
    await resolveLatest(firstFilters, rows);
    openMenu(copy.blockchain);
    chooseOption('Bitcoin');
    expect(latestPlaces().url).toContain('blockchain=Bitcoin');
    await resolvePlaces(rows);
    expect(callsTo('/map/filters')).toHaveLength(1);
    expect(menuButton(copy.blockchain).textContent).toBe('Bitcoin');
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
    expect(selectValues(countrySelect())).toEqual(['', 'PH', 'DE']);
    expect(selectValues(nameSelect())).toEqual(['', 'SPAR', 'others', 'Mini']);

    changeSelect(countrySelect(), 'PH');
    expect(bodyNames()).toEqual(['Ann', 'Dee', 'Eve']);
    changeSelect(countrySelect(), 'DE');
    expect(bodyNames()).toEqual(['Bea']);
    changeSelect(countrySelect(), '');
    expect(bodyNames()).toEqual(['Ann', 'Bea', 'Cia', 'Dee', 'Eve']);

    changeSelect(nameSelect(), 'SPAR');
    expect(bodyNames()).toEqual(['Ann', 'Cia']);
    changeSelect(nameSelect(), 'others');
    expect(bodyNames()).toEqual(['Bea', 'Dee', 'Eve']);
    changeSelect(nameSelect(), 'Mini');
    expect(bodyNames()).toEqual(['Bea']);
    changeSelect(nameSelect(), '');
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
    const beforeMini = callsTo('/map/places').length;
    changeSelect(nameSelect(), 'Mini');
    expect(callsTo('/map/places').length).toBe(beforeMini);
    expect(bodyNames()).toEqual(['Bea']);
    for (const call of callsTo('/map/places')) {
      expect(call.url).not.toContain('shopName=Mini');
    }

    changeSelect(nameSelect(), 'SPAR');
    expect(latestPlaces().url).toBe(`${DEV_PLACES}?shopName=SPAR`);
    await resolvePlaces(rows);

    changeSelect(nameSelect(), 'others');
    expect(latestPlaces().url).toBe(`${DEV_PLACES}?shopName=others`);
    await resolvePlaces(rows);

    changeSelect(nameSelect(), 'SPAR');
    expect(latestPlaces().url).toBe(`${DEV_PLACES}?shopName=SPAR`);
    await resolvePlaces(rows);

    const beforeSwitch = callsTo('/map/places').length;
    changeSelect(nameSelect(), 'Mini');
    expect(callsTo('/map/places').length).toBe(beforeSwitch + 1);
    expect(latestPlaces().url).toBe(DEV_PLACES);
    expect(latestPlaces().url).not.toContain('shopName');
    await resolvePlaces(rows);
    expect(bodyNames()).toEqual(['Bea']);
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
    expect(cellTexts('Fay')[5]).toBe('weird');
    expect(cellTexts('Gus')[5]).toBe('');
    expect(cellTexts('Hal')[5]).toBe('');
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
    const legend = document.querySelectorAll('[popover] .shop-place-marker');
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

  it('keeps the activity menu at All when activities are missing or not a list', async () => {
    const withoutActivities = basicFilters({});
    delete withoutActivities['activities'];
    renderShops();
    await resolveLatest(withoutActivities, placesBody([]));
    openMenu(copy.activity);
    expect(optionLabels()).toEqual([copy.all]);
    cleanup();
    pending.length = 0;

    renderShops();
    await resolveLatest(basicFilters({ activities: 'daily' }), placesBody([]));
    openMenu(copy.activity);
    expect(optionLabels()).toEqual([copy.all]);
  });

  it('renders location, links, provider, and sorted names in the table', async () => {
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
      'PH',
      'SPAR',
      '21.gifts',
      copy.daily,
    ]);
    const zedLink = within(rowByName('Zed')).getByRole('link', { hidden: true });
    expect(zedLink.getAttribute('href')).toBe(`/${npub('z')}`);
    expect(zedLink.className).toBe('font-medium underline underline-offset-2');
    expect(zedLink.className).not.toContain('text-accent');
    expect(cellTexts('Ann')[1]).toBe('OnlyStreet');
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
    expect(textOf(headers[4])).toBe(copy.colProvider);
    expect(textOf(headers[5])).toContain(copy.colActivity);

    const help = screen.getByRole('button', { name: copy.helpLabel, hidden: true });
    expect(help.textContent).not.toContain('?');
    const popover = document.getElementById(popoverTarget(help));
    if (popover === null) throw new Error('missing popover');
    expect(popover.getAttribute('popover')).toBe('auto');
    expect(popover.className).toBe(
      'border border-[#ced1da] bg-[#fff] text-[#272b38] [color-scheme:light]',
    );
    expect(popover.textContent).toContain(copy.dailyHelp);
    expect(popover.textContent).toContain(copy.weeklyHelp);
    expect(popover.textContent).toContain(copy.monthlyHelp);
    expect(popover.textContent).toContain(copy.idleHelp);
    expect(popover.textContent).toContain(copy.noneHelp);
    expect(popover.textContent).toContain(copy.hierarchy);
    expect(popover.querySelectorAll('dt .shop-place-marker')).toHaveLength(5);
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
    expect(optionLabels()).toEqual([copy.all, 'Bitcoin', 'Side', 'NoneChain']);
    expect(screen.queryByRole('option', { name: 'Liquid' })).toBeNull();
    openMenu(copy.asset);
    expect(optionLabels()).toEqual([copy.all, 'BTC', 'ABC']);
    expect(screen.queryByRole('option', { name: 'L-BTC' })).toBeNull();

    openMenu(copy.blockchain);
    chooseOption('Bitcoin');
    openMenu(copy.asset);
    expect(optionLabels()).toEqual([copy.all, 'ABC', 'BTC', 'SSS']);
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
    expect(optionLabels()).toEqual([copy.all]);
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

  it('offers only All for chain menus when 21.gifts is missing', async () => {
    renderShops();
    await resolveLatest(
      basicFilters({ techProviders: [null, dfxProvider()] }),
      placesBody([giftsPlace('Sample', {})]),
    );
    openMenu(copy.blockchain);
    expect(optionLabels()).toEqual([copy.all]);
    openMenu(copy.asset);
    expect(optionLabels()).toEqual([copy.all]);
    cleanup();
    pending.length = 0;

    renderShops();
    await resolveLatest(
      basicFilters({ techProviders: { name: '21.gifts' } }),
      placesBody([giftsPlace('Kept', {})]),
    );
    openMenu(copy.blockchain);
    expect(optionLabels()).toEqual([copy.all]);
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
    expect(options.style).toBe(TILE_STYLE);
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
    expect(map.setCenter).toHaveBeenCalledWith([121, 14.6]);
    expect(map.setZoom).toHaveBeenCalledWith(12);
    expect(map.fitBounds).not.toHaveBeenCalled();
    expect(map.resize).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: copy.table }));
    expect(map.resize).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: copy.map }));
    expect(map.resize).toHaveBeenCalledTimes(1);
    expect(map.setZoom).toHaveBeenCalledTimes(2);

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
    expect(map.fitBounds).toHaveBeenCalledWith(lib.bounds[0], { padding: 48, maxZoom: 12 });
    expect(map.setZoom).not.toHaveBeenCalled();
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
    const paragraphs = [...gus.content.querySelectorAll('p')];
    expect(paragraphs.some((paragraph) => paragraph.textContent === copy.none)).toBe(false);
    expect(paragraphs.some((paragraph) => paragraph.textContent === '')).toBe(false);
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
    expect(popupLink?.getAttribute('class')).toBe('font-medium underline underline-offset-2');
    expect(popupLink?.getAttribute('class')).not.toContain('text-accent');
    expect(linked.content.textContent).toContain('Cafe');
    expect(linked.content.textContent).toContain(copy.daily);
    const image = linked.content.querySelector('img');
    expect(image?.getAttribute('src')).toBe('https://images.example/cover.jpg');
    expect(image?.getAttribute('alt')).toBe('');
    expect(image?.getAttribute('loading')).toBe('lazy');
    expect(image?.getAttribute('referrerpolicy')).toBe('no-referrer');
    expect(image?.getAttribute('class')).toBe(
      'block h-auto max-h-80 w-full max-w-full object-contain',
    );
    expect(plain.content.querySelector('a')).toBeNull();
    expect(plain.content.querySelector('strong')?.textContent).toBe('Plain');
    expect(plain.content.querySelector('img')).toBeNull();
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
      `${header}\r\n"'=Shop, ""One""","Line\nBreak",'+PH,'@Store,21.gifts,'\todd,https://localhost/${npub('q')}\r\nPlain,,PH,SPAR,21.gifts,${copy.daily},`,
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
    expect(map.setCenter).toHaveBeenCalledWith(HOME_CENTER);
    expect(map.setZoom).toHaveBeenCalledWith(7);
    expect(map.fitBounds).not.toHaveBeenCalled();
    expect(lib.markers).toHaveLength(0);
    expect(map.resize).not.toHaveBeenCalled();
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
    expect(map.setCenter).toHaveBeenCalledTimes(1);
    expect(map.setZoom).toHaveBeenCalledTimes(1);
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
    expect(map.setCenter).not.toHaveBeenCalled();
    expect(map.setZoom).not.toHaveBeenCalled();
    expect(map.fitBounds).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: copy.map }));
    expect(map.resize).toHaveBeenCalledTimes(1);
    expect(map.setCenter).toHaveBeenCalledWith([121, 14.6]);
    expect(map.setZoom).toHaveBeenCalledWith(12);
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
    renderShops();
    await act(async () => {
      latestFilters().resolve(jsonResponse(basicFilters({ countries: ['PH', 'DE'] }), 200));
    });
    await waitFor(() => expect(callsTo('/map/places')).toHaveLength(1));
    changeSelect(countrySelect(), 'PH');
    expect(callsTo('/map/places')).toHaveLength(2);
    expect(latestPlaces().url).toBe(`${DEV_PLACES}?country=PH`);
    await resolvePlaces(placesBody([giftsPlace('Manila', { country: 'PH' })]));
    await waitFor(() => {
      expect(screen.getByText('Manila')).toBeTruthy();
    });
    await fireScript('load');
    const map = firstMap(lib);
    const marker = lib.markers[0];
    if (marker === undefined) throw new Error('missing marker');
    expect(marker.remove).not.toHaveBeenCalled();
    const centerCalls = map.setCenter.mock.calls.length;
    const zoomCalls = map.setZoom.mock.calls.length;
    const boundsCalls = map.fitBounds.mock.calls.length;

    changeSelect(countrySelect(), 'DE');
    expect(latestPlaces().url).toBe(`${DEV_PLACES}?country=DE`);
    expect(screen.queryByText('Manila')).toBeNull();
    expect(bodyNames()).toEqual([]);
    expect(screen.queryByText(copy.empty)).toBeNull();
    expect(map.setCenter).toHaveBeenCalledTimes(centerCalls);
    expect(map.setZoom).toHaveBeenCalledTimes(zoomCalls);
    expect(map.fitBounds).toHaveBeenCalledTimes(boundsCalls);
    expect(marker.remove).toHaveBeenCalledTimes(1);
    expect(lib.markers).toHaveLength(1);

    fireEvent.click(screen.getByRole('button', { name: copy.table }));
    fireEvent.click(screen.getByRole('button', { name: copy.map }));
    expect(map.setCenter).toHaveBeenCalledTimes(centerCalls);
    expect(map.setZoom).toHaveBeenCalledTimes(zoomCalls);
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
    changeSelect(nameSelect(), 'SPAR');
    expect(callsTo('/map/places')).toHaveLength(2);
    expect(latestPlaces().url).toBe(`${DEV_PLACES}?shopName=SPAR`);
    expect(screen.getByText('Ann')).toBeTruthy();
    expect(screen.queryByText(copy.empty)).toBeNull();
    for (const marker of previous) {
      expect(marker.remove).toHaveBeenCalledTimes(1);
    }
    expect(lib.markers).toHaveLength(previous.length + 1);
    const redrawn = lib.markers[previous.length];
    if (redrawn === undefined) throw new Error('missing redrawn marker');
    expect(redrawn.remove).not.toHaveBeenCalled();
  });

  it('drops country, shop name, and activity when a reloaded filter list omits them', async () => {
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
    changeSelect(countrySelect(), 'PH');
    changeSelect(nameSelect(), 'SPAR');
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
    expect(countrySelect().value).toBe('PH');
    expect(nameSelect().value).toBe('SPAR');
    expect(latestPlaces().url).toContain('country=PH');
    expect(latestPlaces().url).toContain('shopName=SPAR');
    expect(latestPlaces().url).not.toContain('activity');
    await resolvePlaces(rows);
    expect(bodyNames()).toEqual(['Fay']);

    const placesBeforeDrop = callsTo('/map/places').length;
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
    await waitFor(() => expect(callsTo('/map/places').length).toBe(placesBeforeDrop + 1));
    expect(countrySelect().value).toBe('');
    expect(nameSelect().value).toBe('');
    expect(menuButton(copy.activity).textContent).toBe(copy.all);
    expect(latestPlaces().url).not.toContain('country=PH');
    expect(latestPlaces().url).not.toContain('shopName=SPAR');
    expect(latestPlaces().url).not.toContain('shopName=others');
    await resolvePlaces(rows);
    expect(bodyNames()).toEqual(['Ann', 'Bea', 'Fay']);

    changeSelect(countrySelect(), 'DE');
    const filtersBeforeFailure = callsTo('/map/filters').length;
    fireEvent.click(screen.getByRole('button', { name: copy.retry }));
    await waitFor(() => expect(callsTo('/map/filters').length).toBe(filtersBeforeFailure + 1));
    await act(async () => {
      latestFilters().resolve(jsonResponse({ countries: ['DE'] }, 500));
    });
    await waitFor(() => expect(countrySelect().value).toBe(''));
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
