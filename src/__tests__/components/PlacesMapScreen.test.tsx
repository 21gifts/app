import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PlacesMapScreen } from '@/components/PlacesMapScreen';
import { renderWithLocale } from '@/__tests__/render-with-locale';
import type { ForumPlaceRow } from '@/lib/api-types';
import { useAuthStore } from '@/stores/auth-store';
import { logInteraction } from '@/lib/interaction-log';

vi.mock('@/lib/interaction-log', () => ({ logInteraction: vi.fn() }));

vi.mock('@/lib/api', () => ({
  fetchPlaces: vi.fn(),
  fetchForumMessage: vi.fn(),
  fetchShopNoteEdits: vi.fn(),
  fetchMessagePhoto: vi.fn(),
  setMessagePlace: vi.fn(),
  setMessageShopAccount: vi.fn(),
  setMessageShopPhotos: vi.fn(),
  setMessageShopText: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useSearchParams: (): URLSearchParams => new URLSearchParams(window.location.search),
}));

import { fetchForumMessage, fetchPlaces, fetchShopNoteEdits, setMessageShopText } from '@/lib/api';
import type { Account, ForumMessage } from '@/lib/api-types';

const fetchPlacesMock = vi.mocked(fetchPlaces);

const ROW = {
  id: 'm-pin',
  name: 'Ada',
  createdAt: '2026-08-28T12:00:00.000Z',
  lat: 14.6,
  lng: 120.98,
  label: 'Happyland' as string | null,
};

const SECOND_ROW = {
  ...ROW,
  id: 'm-2',
  lat: -1.95,
  lng: 37.84,
  label: 'Machakos',
};

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  useAuthStore.setState({ session: null, account: null });
  document.querySelectorAll('script[data-google-maps="1"]').forEach((node) => {
    node.remove();
  });
  delete (window as { google?: unknown }).google;
  delete (window as { gm_authFailure?: unknown }).gm_authFailure;
  window.history.replaceState(null, '', '/');
});

function jsonResponse(body: unknown): Response {
  return { json: () => Promise.resolve(body) } as Response;
}

function installGoogleMaps(zoom: number | undefined, withEvent = true) {
  const points: Array<{ lat: number; lng: number }> = [];
  const bounds = {
    extend: vi.fn((point: { lat: number; lng: number }) => {
      points.push({ ...point });
    }),
  };
  const map = {
    setCenter: vi.fn(),
    fitBounds: vi.fn(),
    getZoom: vi.fn(() => zoom),
    setZoom: vi.fn(),
  };
  const Map = vi.fn(() => map);
  const Marker = vi.fn();
  const LatLngBounds = vi.fn(() => bounds);
  let idleHandler: (() => void) | undefined;
  const addListenerOnce = vi.fn((_instance: unknown, _eventName: string, handler: () => void) => {
    idleHandler = handler;
  });
  const maps = { Map, Marker, LatLngBounds };
  (window as { google?: unknown }).google = {
    maps: withEvent ? { ...maps, event: { addListenerOnce } } : maps,
  };
  return {
    points,
    bounds,
    map,
    Map,
    Marker,
    LatLngBounds,
    addListenerOnce,
    getIdleHandler: (): (() => void) | undefined => idleHandler,
  };
}

describe('PlacesMapScreen', () => {
  it('stays on loading when there is no session', () => {
    renderWithLocale(<PlacesMapScreen />);
    expect(screen.getByText('Loading…')).toBeTruthy();
    expect(fetchPlacesMock).not.toHaveBeenCalled();
  });

  it('records an opened shop pin once, and no other pin', async () => {
    vi.mocked(logInteraction).mockClear();
    window.history.replaceState(null, '', '/map?pin=m-pin');
    useAuthStore.setState({ session: 'tok' });
    fetchPlacesMock.mockResolvedValue([{ ...ROW, shop: true }]);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ key: null })));
    renderWithLocale(<PlacesMapScreen />);
    expect(await screen.findByRole('link', { name: 'Ada · Happyland' })).toBeTruthy();
    expect(vi.mocked(logInteraction).mock.calls).toEqual([['shop_opened', { placeId: 'm-pin' }]]);
  });

  it('lists pins, coordinates, and the selected pin', async () => {
    vi.mocked(logInteraction).mockClear();
    window.history.replaceState(null, '', '/map?pin=m-pin');
    useAuthStore.setState({ session: 'tok' });
    fetchPlacesMock.mockResolvedValue([ROW, { ...ROW, id: 'm-2', label: null, lat: 1, lng: 2 }]);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ key: null })));
    const view = renderWithLocale(<PlacesMapScreen />);
    expect(await screen.findByRole('link', { name: 'Ada · Happyland' })).toBeTruthy();
    expect(logInteraction).not.toHaveBeenCalledWith('shop_opened', expect.anything());
    expect(screen.getByRole('link', { name: 'Ada · Happyland' }).className).toContain('min-w-0');
    expect(screen.getByRole('link', { name: 'Ada · Happyland' }).className).toContain('max-w-full');
    expect(screen.getByRole('link', { name: 'Ada · Happyland' }).className).toContain(
      'break-words',
    );
    expect(screen.getByRole('link', { name: 'Ada · 1.00000, 2.00000' })).toBeTruthy();
    expect(
      screen.getByRole('link', { name: 'Ada · Happyland' }).getAttribute('data-selected'),
    ).toBe('true');
    window.history.replaceState(null, '', '/map');
    view.rerender(<PlacesMapScreen />);
    expect(
      screen.getByRole('link', { name: 'Ada · Happyland' }).getAttribute('data-selected'),
    ).toBe('false');
  });

  it('links a 21.gifts author and keeps an external name as text', async () => {
    window.history.replaceState(null, '', '/map?pin=m-pin');
    useAuthStore.setState({ session: 'tok' });
    fetchPlacesMock.mockResolvedValue([
      { ...ROW, accountId: 'acc-ada' },
      { ...ROW, id: 'm-2', accountId: 'acc-ada', label: 'Other' },
    ]);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ key: null })));
    renderWithLocale(<PlacesMapScreen />);
    const authors = await screen.findAllByRole('link', { name: 'View profile' });
    expect(authors[0]?.getAttribute('href')).toBe('/members/acc-ada');
    expect(authors[0]?.textContent).toBe('Ada');
    expect(authors[0]?.parentElement?.getAttribute('data-selected')).toBe('true');
    expect(authors[0]?.parentElement?.className).toContain('min-w-0');
    expect(authors[0]?.parentElement?.className).toContain('max-w-full');
    expect(authors[0]?.parentElement?.className).toContain('break-words');
    expect(authors[1]?.parentElement?.getAttribute('data-selected')).toBe('false');
    expect(screen.getByRole('link', { name: 'Happyland' }).getAttribute('href')).toBe(
      '/messages/m-pin',
    );
  });

  it('shows the empty state', async () => {
    useAuthStore.setState({ session: 'tok' });
    fetchPlacesMock.mockResolvedValue([]);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse('nope')));
    renderWithLocale(<PlacesMapScreen />);
    expect(await screen.findByText('No places yet.')).toBeTruthy();
  });

  it('keeps the list when the map key request fails', async () => {
    useAuthStore.setState({ session: 'tok' });
    fetchPlacesMock.mockResolvedValue([ROW]);
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('key down')));
    renderWithLocale(<PlacesMapScreen />);
    expect(await screen.findByRole('link', { name: 'Ada · Happyland' })).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('shows an error and retries', async () => {
    useAuthStore.setState({ session: 'tok' });
    fetchPlacesMock.mockRejectedValueOnce(new Error('down')).mockResolvedValueOnce([]);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ key: 1 })));
    renderWithLocale(<PlacesMapScreen />);
    expect(await screen.findByText('Could not load places. Please try again.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('No places yet.')).toBeTruthy();
  });

  it('draws markers when a key and Google Maps are present', async () => {
    useAuthStore.setState({ session: 'tok' });
    fetchPlacesMock.mockResolvedValue([ROW]);
    const map = { setCenter: vi.fn() };
    const Marker = vi.fn();
    (window as { google?: unknown }).google = {
      maps: { Map: vi.fn(() => map), Marker },
    };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ key: 'browser-key' })));
    renderWithLocale(<PlacesMapScreen />);
    await screen.findByRole('link', { name: 'Ada · Happyland' });
    await waitFor(() => {
      expect(Marker).toHaveBeenCalled();
    });
    expect(map.setCenter).toHaveBeenCalledWith({ lat: 14.6, lng: 120.98 });
  });

  it('keeps only the pins of the chosen country and fits the map to them', async () => {
    useAuthStore.setState({ session: 'tok' });
    const manila = { ...ROW, id: 'm-ph-1', shop: true, countryCode: 'PH' };
    const cebu = {
      ...ROW,
      id: 'm-ph-2',
      label: 'Cebu',
      lat: 10.3,
      lng: 123.9,
      shop: true,
      countryCode: 'PH',
    };
    const kenya = { ...SECOND_ROW, shop: true, countryCode: 'KE' };
    const sea = { ...ROW, id: 'm-sea', label: 'Boat', lat: 30, lng: -40, countryCode: null };
    // A forum note pinned in Manila that is not a shop is not one of the country's shops.
    const note = {
      ...ROW,
      id: 'm-note',
      label: 'Plaza',
      lat: 14.59,
      lng: 120.97,
      countryCode: 'PH',
    };
    fetchPlacesMock.mockResolvedValue([manila, cebu, kenya, sea, note]);
    const maps = installGoogleMaps(4);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ key: 'browser-key' })));
    const view = renderWithLocale(<PlacesMapScreen embedded country="PH" />);
    expect(await screen.findByRole('link', { name: 'Ada · Happyland' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Ada · Cebu' })).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Ada · Machakos' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Ada · Boat' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Ada · Plaza' })).toBeNull();
    await waitFor(() => {
      expect(maps.map.fitBounds).toHaveBeenCalledWith(maps.bounds, 32);
    });
    expect(maps.points).toEqual([
      { lat: 14.6, lng: 120.98 },
      { lat: 10.3, lng: 123.9 },
    ]);
    expect(maps.Marker).toHaveBeenCalledTimes(2);
    maps.Marker.mockClear();
    view.rerender(<PlacesMapScreen embedded country="KE" />);
    expect(await screen.findByRole('link', { name: 'Ada · Machakos' })).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Ada · Happyland' })).toBeNull();
    await waitFor(() => {
      expect(maps.Marker).toHaveBeenCalledTimes(1);
    });
    expect(maps.map.setCenter).toHaveBeenCalledWith({ lat: -1.95, lng: 37.84 });
    view.rerender(<PlacesMapScreen embedded country="CH" />);
    expect(await screen.findByText('No places yet.')).toBeTruthy();
    view.rerender(<PlacesMapScreen embedded />);
    expect(await screen.findByRole('link', { name: 'Ada · Boat' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Ada · Plaza' })).toBeTruthy();
  });

  it('loads the Maps script once and keeps the newer map when the country changes before it loads', async () => {
    useAuthStore.setState({ session: 'tok' });
    fetchPlacesMock.mockResolvedValue([
      { ...ROW, shop: true, countryCode: 'PH' },
      { ...SECOND_ROW, shop: true, countryCode: 'KE' },
    ]);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ key: 'browser-key' })));
    const view = renderWithLocale(<PlacesMapScreen embedded country="PH" />);
    await screen.findByRole('link', { name: 'Ada · Happyland' });
    view.rerender(<PlacesMapScreen embedded country="KE" />);
    await screen.findByRole('link', { name: 'Ada · Machakos' });
    const scripts = document.querySelectorAll('script[data-google-maps="1"]');
    expect(scripts).toHaveLength(1);
    const maps = installGoogleMaps(4);
    (scripts[0] as HTMLScriptElement).onload?.(new Event('load'));
    await waitFor(() => {
      expect(maps.Map).toHaveBeenCalledTimes(1);
    });
    // Only the Kenya draw runs; the superseded Philippines draw leaves the frame alone.
    expect(maps.map.setCenter).toHaveBeenCalledWith({ lat: -1.95, lng: 37.84 });
    expect(screen.getByTestId('places-map').childElementCount).toBe(0);
    expect(maps.Marker).toHaveBeenCalledTimes(1);
  });

  it('frames every pin when several places have no matching query', async () => {
    useAuthStore.setState({ session: 'tok' });
    fetchPlacesMock.mockResolvedValue([ROW, SECOND_ROW]);
    const maps = installGoogleMaps(4);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ key: 'browser-key' })));
    renderWithLocale(<PlacesMapScreen />);
    await screen.findByRole('link', { name: 'Ada · Happyland' });
    await waitFor(() => {
      expect(maps.map.fitBounds).toHaveBeenCalledWith(maps.bounds, 32);
    });
    expect(maps.points).toEqual([
      { lat: 14.6, lng: 120.98 },
      { lat: -1.95, lng: 37.84 },
    ]);
    expect(maps.map.setCenter).not.toHaveBeenCalled();
    expect(maps.Marker).toHaveBeenCalledTimes(2);
    expect(maps.Map).toHaveBeenCalledWith(expect.any(HTMLElement), {
      center: { lat: 14.6, lng: 120.98 },
      zoom: 2,
    });
    expect(maps.addListenerOnce).toHaveBeenCalledWith(maps.map, 'idle', expect.any(Function));
    maps.getIdleHandler()?.();
    expect(maps.map.getZoom).toHaveBeenCalledOnce();
    expect(maps.map.setZoom).not.toHaveBeenCalled();
  });

  it('caps a tight fit at zoom 14', async () => {
    useAuthStore.setState({ session: 'tok' });
    fetchPlacesMock.mockResolvedValue([ROW, SECOND_ROW]);
    const maps = installGoogleMaps(21);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ key: 'browser-key' })));
    renderWithLocale(<PlacesMapScreen />);
    await screen.findByRole('link', { name: 'Ada · Happyland' });
    await waitFor(() => {
      expect(maps.map.fitBounds).toHaveBeenCalledWith(maps.bounds, 32);
    });
    maps.getIdleHandler()?.();
    expect(maps.map.setZoom).toHaveBeenCalledOnce();
    expect(maps.map.setZoom).toHaveBeenCalledWith(14);
  });

  it('ignores a non-numeric zoom after fitting', async () => {
    useAuthStore.setState({ session: 'tok' });
    fetchPlacesMock.mockResolvedValue([ROW, SECOND_ROW]);
    const maps = installGoogleMaps(undefined);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ key: 'browser-key' })));
    renderWithLocale(<PlacesMapScreen />);
    await screen.findByRole('link', { name: 'Ada · Happyland' });
    await waitFor(() => {
      expect(maps.map.fitBounds).toHaveBeenCalledWith(maps.bounds, 32);
    });
    maps.getIdleHandler()?.();
    expect(maps.map.getZoom).toHaveBeenCalledOnce();
    expect(maps.map.setZoom).not.toHaveBeenCalled();
  });

  it('does not fit after unmount', async () => {
    useAuthStore.setState({ session: 'tok' });
    fetchPlacesMock.mockResolvedValue([ROW, SECOND_ROW]);
    const maps = installGoogleMaps(21);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ key: 'browser-key' })));
    const view = renderWithLocale(<PlacesMapScreen />);
    await screen.findByRole('link', { name: 'Ada · Happyland' });
    await waitFor(() => {
      expect(maps.addListenerOnce).toHaveBeenCalledWith(maps.map, 'idle', expect.any(Function));
    });
    view.unmount();
    maps.getIdleHandler()?.();
    expect(maps.map.getZoom).not.toHaveBeenCalled();
    expect(maps.map.setZoom).not.toHaveBeenCalled();
  });

  it('keeps a matching pin centered when other pins exist', async () => {
    window.history.replaceState(null, '', '/map?pin=m-pin');
    useAuthStore.setState({ session: 'tok' });
    fetchPlacesMock.mockResolvedValue([ROW, SECOND_ROW]);
    const maps = installGoogleMaps(4);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ key: 'browser-key' })));
    renderWithLocale(<PlacesMapScreen />);
    await screen.findByRole('link', { name: 'Ada · Happyland' });
    await waitFor(() => {
      expect(maps.map.setCenter).toHaveBeenCalledWith({ lat: 14.6, lng: 120.98 });
    });
    expect(maps.LatLngBounds).not.toHaveBeenCalled();
    expect(maps.map.fitBounds).not.toHaveBeenCalled();
    expect(maps.Map).toHaveBeenCalledWith(expect.any(HTMLElement), {
      center: { lat: 14.6, lng: 120.98 },
      zoom: 14,
    });
  });

  it('fits every pin when the query does not match', async () => {
    window.history.replaceState(null, '', '/map?pin=missing');
    useAuthStore.setState({ session: 'tok' });
    fetchPlacesMock.mockResolvedValue([ROW, SECOND_ROW]);
    const maps = installGoogleMaps(4, false);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ key: 'browser-key' })));
    renderWithLocale(<PlacesMapScreen />);
    await screen.findByRole('link', { name: 'Ada · Happyland' });
    await waitFor(() => {
      expect(maps.map.fitBounds).toHaveBeenCalledWith(maps.bounds, 32);
    });
    expect(maps.map.setCenter).not.toHaveBeenCalled();
    expect(maps.addListenerOnce).not.toHaveBeenCalled();
  });

  it('keeps the list when the map script fails', async () => {
    useAuthStore.setState({ session: 'tok' });
    fetchPlacesMock.mockResolvedValue([ROW]);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ key: 'browser-key' })));
    renderWithLocale(<PlacesMapScreen />);
    await screen.findByRole('link', { name: 'Ada · Happyland' });
    await waitFor(() => {
      expect(document.querySelector('script[data-google-maps="1"]')).toBeTruthy();
    });
    document.querySelector('script[data-google-maps="1"]')?.dispatchEvent(new Event('error'));
    expect(screen.getByRole('link', { name: 'Ada · Happyland' })).toBeTruthy();
  });

  it('ignores a script load that does not install maps and a cancelled fetch', async () => {
    useAuthStore.setState({ session: 'tok' });
    fetchPlacesMock.mockResolvedValue([ROW]);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ key: 'browser-key' })));
    const view = renderWithLocale(<PlacesMapScreen />);
    await screen.findByRole('link', { name: 'Ada · Happyland' });
    await waitFor(() => {
      expect(document.querySelector('script[data-google-maps="1"]')).toBeTruthy();
    });
    const script = document.querySelector('script[data-google-maps="1"]');
    script?.dispatchEvent(new Event('load'));
    await Promise.resolve();
    view.unmount();
    document.querySelectorAll('script[data-google-maps="1"]').forEach((node) => {
      node.remove();
    });
    const again = renderWithLocale(<PlacesMapScreen />);
    await screen.findByRole('link', { name: 'Ada · Happyland' });
    await waitFor(() => {
      expect(document.querySelector('script[data-google-maps="1"]')).toBeTruthy();
    });
    const pending = document.querySelector('script[data-google-maps="1"]');
    again.unmount();
    pending?.dispatchEvent(new Event('load'));
    await Promise.resolve();

    useAuthStore.setState({ session: 'tok-2' });
    let resolvePlaces: (rows: ForumPlaceRow[]) => void = () => undefined;
    fetchPlacesMock.mockReturnValue(
      new Promise<ForumPlaceRow[]>((resolve) => {
        resolvePlaces = resolve;
      }),
    );
    const second = renderWithLocale(<PlacesMapScreen />);
    second.unmount();
    resolvePlaces([]);
    await Promise.resolve();
  });

  it('drops a rejected load after unmount and skips a map when the list is empty', async () => {
    useAuthStore.setState({ session: 'tok' });
    let rejectPlaces: (error: Error) => void = () => undefined;
    fetchPlacesMock.mockReturnValue(
      new Promise((_resolve, reject) => {
        rejectPlaces = reject;
      }),
    );
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(new Promise(() => undefined)));
    const view = renderWithLocale(<PlacesMapScreen />);
    view.unmount();
    rejectPlaces(new Error('down'));
    await Promise.resolve();

    useAuthStore.setState({ session: 'tok' });
    fetchPlacesMock.mockResolvedValue([]);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ key: 'browser-key' })));
    renderWithLocale(<PlacesMapScreen />);
    expect(await screen.findByText('No places yet.')).toBeTruthy();
    expect(document.querySelector('script[data-google-maps="1"]')).toBeNull();
  });

  it('treats a null, missing, blank, or non-string key as no map', async () => {
    for (const body of [null, {}, { key: 1 }, { key: '' }, { key: '   ' }]) {
      useAuthStore.setState({ session: 'tok' });
      fetchPlacesMock.mockResolvedValue([ROW]);
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(body)));
      const view = renderWithLocale(<PlacesMapScreen />);
      expect(await screen.findByRole('link', { name: 'Ada · Happyland' })).toBeTruthy();
      expect(document.querySelector('script[data-google-maps="1"]')).toBeNull();
      view.unmount();
    }
  });

  it('centers the first pin when the query does not match', async () => {
    useAuthStore.setState({ session: 'tok' });
    window.history.replaceState(null, '', '/map?pin=missing');
    fetchPlacesMock.mockResolvedValue([ROW]);
    const map = { setCenter: vi.fn() };
    const Marker = vi.fn();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ key: 'browser-key' })));
    renderWithLocale(<PlacesMapScreen />);
    await screen.findByRole('link', { name: 'Ada · Happyland' });
    await waitFor(() => {
      expect(document.querySelector('script[data-google-maps="1"]')).toBeTruthy();
    });
    (window as { google?: unknown }).google = {
      maps: { Map: vi.fn(() => map), Marker },
    };
    document.querySelector('script[data-google-maps="1"]')?.dispatchEvent(new Event('load'));
    await waitFor(() => {
      expect(map.setCenter).toHaveBeenCalledWith({ lat: 14.6, lng: 120.98 });
    });
  });

  it('does not draw after Google rejects the key before the list arrives', async () => {
    useAuthStore.setState({ session: 'tok' });
    let resolvePlaces: (rows: ForumPlaceRow[]) => void = () => undefined;
    fetchPlacesMock.mockReturnValue(
      new Promise<ForumPlaceRow[]>((resolve) => {
        resolvePlaces = resolve;
      }),
    );
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ key: 'browser-key' })));
    const Marker = vi.fn();
    (window as { google?: unknown }).google = { maps: { Map: vi.fn(), Marker } };
    renderWithLocale(<PlacesMapScreen />);
    await waitFor(() => {
      expect((window as { gm_authFailure?: () => void }).gm_authFailure).toBeTypeOf('function');
    });
    (window as { gm_authFailure?: () => void }).gm_authFailure?.();
    resolvePlaces([ROW]);
    expect(await screen.findByRole('link', { name: 'Ada · Happyland' })).toBeTruthy();
    await Promise.resolve();
    expect(Marker).not.toHaveBeenCalled();
    expect(document.querySelector('script[data-google-maps="1"]')).toBeNull();
  });

  it('clears the frame when Google rejects the key after the map is drawn', async () => {
    useAuthStore.setState({ session: 'tok' });
    fetchPlacesMock.mockResolvedValue([ROW]);
    const map = { setCenter: vi.fn() };
    const Marker = vi.fn();
    (window as { google?: unknown }).google = { maps: { Map: vi.fn(() => map), Marker } };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ key: ' browser-key ' })));
    const view = renderWithLocale(<PlacesMapScreen />);
    await screen.findByRole('link', { name: 'Ada · Happyland' });
    await waitFor(() => {
      expect(Marker).toHaveBeenCalled();
    });
    const frame = screen.getByTestId('places-map');
    const overlay = document.createElement('div');
    overlay.setAttribute('data-google-error', '1');
    frame.appendChild(overlay);
    (window as { gm_authFailure?: () => void }).gm_authFailure?.();
    expect(frame.querySelector('[data-google-error]')).toBeNull();
    const calls = Marker.mock.calls.length;
    window.history.replaceState(null, '', '/map?pin=m-pin');
    view.rerender(<PlacesMapScreen />);
    expect(await screen.findByRole('link', { name: 'Ada · Happyland' })).toBeTruthy();
    expect(Marker.mock.calls.length).toBe(calls);
  });

  it('does not construct a map when Google rejects the key as the script loads', async () => {
    useAuthStore.setState({ session: 'tok' });
    fetchPlacesMock.mockResolvedValue([ROW]);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ key: 'browser-key' })));
    const Map = vi.fn(() => ({ setCenter: vi.fn() }));
    const Marker = vi.fn();
    renderWithLocale(<PlacesMapScreen />);
    await screen.findByRole('link', { name: 'Ada · Happyland' });
    const script = await waitFor(() => {
      const node = document.querySelector('script[data-google-maps="1"]');
      expect(node).toBeTruthy();
      return node as HTMLScriptElement;
    });
    (window as { google?: unknown }).google = { maps: { Map, Marker } };
    (window as { gm_authFailure?: () => void }).gm_authFailure?.();
    script.dispatchEvent(new Event('load'));
    await Promise.resolve();
    expect(Map).not.toHaveBeenCalled();
    expect(Marker).not.toHaveBeenCalled();
  });

  it('does not add markers when Google rejects the key while constructing the map', async () => {
    useAuthStore.setState({ session: 'tok' });
    fetchPlacesMock.mockResolvedValue([ROW]);
    const Marker = vi.fn();
    const Map = vi.fn(() => {
      (window as { gm_authFailure?: () => void }).gm_authFailure?.();
      return { setCenter: vi.fn() };
    });
    (window as { google?: unknown }).google = { maps: { Map, Marker } };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ key: 'browser-key' })));
    renderWithLocale(<PlacesMapScreen />);
    await screen.findByRole('link', { name: 'Ada · Happyland' });
    await waitFor(() => {
      expect(Map).toHaveBeenCalled();
    });
    expect(Marker).not.toHaveBeenCalled();
  });

  it('omits the Map heading when embedded', async () => {
    useAuthStore.setState({ session: 'tok' });
    fetchPlacesMock.mockResolvedValue([]);
    renderWithLocale(<PlacesMapScreen embedded />);
    expect(await screen.findByText('No places yet.')).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Map' })).toBeNull();
  });

  it('opens the pin editor without a change callback', async () => {
    useAuthStore.setState({
      session: 'tok',
      account: {
        id: 'acc',
        linkingKey: '02',
        role: 'moderator',
        name: 'Ada',
        location: null,
        lightningAddress: null,
        lightningAddressVerified: false,
        forumLawsDismissed: true,
        createdAt: 1,
        rulesAgreedAt: 1,
        viewKey: 'a'.repeat(64),
        aboutMe: null,
        aboutMeHasPhoto: false,
        setup: null,
        missing: [],
      } as Account,
    });
    fetchPlacesMock.mockResolvedValue([{ ...ROW, shop: true }]);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ key: null })));
    vi.mocked(fetchShopNoteEdits).mockResolvedValue([]);
    vi.mocked(fetchForumMessage).mockResolvedValueOnce({
      id: 'm-pin',
      name: 'Ada',
      text: 'Cafe Luna\n\n#21GiftsShop',
      createdAt: '2026-08-28T12:00:00.000Z',
      sats: 5,
      payable: true,
      hasPhoto: false,
      photoCount: 0,
      hasVideo: false,
      videoContentType: null,
      role: 'basis',
      replyCount: 0,
    });
    renderWithLocale(<PlacesMapScreen />);
    fireEvent.click(await screen.findByRole('button', { name: 'Edit shop note' }));
    expect(await screen.findByText('1 / 5 · Photos')).toBeTruthy();
  });

  it('edits a shop pin and refuses a missing, plain, or failed note', async () => {
    const moderator = {
      id: 'acc',
      linkingKey: '02',
      role: 'moderator',
      name: 'Ada',
      location: null,
      lightningAddress: null,
      lightningAddressVerified: false,
      forumLawsDismissed: true,
      createdAt: 1,
      rulesAgreedAt: 1,
      viewKey: 'a'.repeat(64),
      aboutMe: null,
      aboutMeHasPhoto: false,
      setup: null,
      missing: [],
    } as Account;
    const note: ForumMessage = {
      id: 'm-pin',
      name: 'Ada',
      text: 'Cafe Luna\n\n#21GiftsShop',
      createdAt: '2026-08-28T12:00:00.000Z',
      sats: 5,
      payable: true,
      hasPhoto: false,
      photoCount: 0,
      hasVideo: false,
      videoContentType: null,
      role: 'basis',
      replyCount: 0,
      place: { lat: 14.6, lng: 120.98, label: 'Happyland' },
    };
    useAuthStore.setState({ session: 'tok', account: null });
    fetchPlacesMock.mockResolvedValue([
      { ...ROW, shop: true },
      { ...ROW, id: 'm-2', label: 'Other', shop: true },
      { ...ROW, id: 'm-plain', label: 'Plain' },
    ]);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ key: null })));
    vi.mocked(fetchShopNoteEdits).mockResolvedValue([]);
    vi.mocked(fetchForumMessage)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ ...note, id: 'm-2', text: 'Hello' })
      .mockRejectedValueOnce(new Error('down'))
      .mockResolvedValueOnce(note);
    vi.mocked(setMessageShopText).mockResolvedValue({
      ...note,
      text: 'Cafe Sol\n\n#21GiftsShop',
      place: { lat: 3, lng: 4, label: 'Stall' },
    });
    const shopsChanged = vi.fn();
    renderWithLocale(<PlacesMapScreen onShopsChanged={shopsChanged} />);
    expect(await screen.findByRole('link', { name: 'Ada · Happyland' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Edit shop note' })).toBeNull();
    useAuthStore.setState({ session: 'tok', account: { ...moderator, role: 'basis' } });
    expect(await screen.findByRole('link', { name: 'Ada · Happyland' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Edit shop note' })).toBeNull();
    useAuthStore.setState({ session: 'tok', account: moderator });
    const pencils = await screen.findAllByRole('button', { name: 'Edit shop note' });
    expect(pencils).toHaveLength(2);
    fireEvent.click(pencils[0]!);
    expect((await screen.findByRole('alert')).textContent).toContain(
      'Could not load this shop note',
    );
    fireEvent.click(pencils[1]!);
    await waitFor(() => {
      expect(screen.getAllByRole('alert')).toHaveLength(2);
    });
    fireEvent.click(pencils[0]!);
    await waitFor(() => {
      expect(screen.getAllByRole('alert')).toHaveLength(2);
    });
    fireEvent.click(pencils[0]!);
    expect(await screen.findByText('1 / 5 · Photos')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Shop text' }), {
      target: { value: 'Cafe Sol' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(await screen.findByRole('link', { name: 'Ada · Stall' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Ada · Other' })).toBeTruthy();

    const saveOpened = async (value: string): Promise<void> => {
      fireEvent.click(screen.getAllByRole('button', { name: 'Edit shop note' })[0]!);
      fireEvent.click(await screen.findByRole('button', { name: 'Next' }));
      fireEvent.click(screen.getByRole('button', { name: 'Next' }));
      fireEvent.change(screen.getByRole('textbox', { name: 'Shop text' }), {
        target: { value },
      });
      fireEvent.click(screen.getByRole('button', { name: 'Next' }));
      fireEvent.click(screen.getByRole('button', { name: 'Next' }));
      fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    };

    vi.mocked(setMessageShopText).mockResolvedValue({
      ...note,
      text: 'Cafe Norte\n\n#21GiftsShop',
      place: { lat: 3, lng: 4, label: null },
    });
    await saveOpened('Cafe Norte');
    expect(await screen.findByRole('link', { name: 'Ada · 3.00000, 4.00000' })).toBeTruthy();

    const withoutPlace: ForumMessage = { ...note, text: 'Cafe Sur\n\n#21GiftsShop' };
    delete withoutPlace.place;
    vi.mocked(setMessageShopText).mockResolvedValue(withoutPlace);
    await saveOpened('Cafe Sur');
    await waitFor(() => {
      expect(screen.queryByRole('link', { name: 'Ada · 3.00000, 4.00000' })).toBeNull();
    });
    expect(screen.getByRole('link', { name: 'Ada · Other' })).toBeTruthy();
    useAuthStore.setState({ session: null, account: null });
    await waitFor(() => {
      expect(screen.queryAllByRole('button', { name: 'Edit shop note' })).toHaveLength(0);
    });
    expect(shopsChanged).toHaveBeenCalled();
  });
});
