import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PlacesMapScreen } from '@/components/PlacesMapScreen';
import { renderWithLocale } from '@/__tests__/render-with-locale';
import { useAuthStore } from '@/stores/auth-store';

vi.mock('@/lib/api', () => ({
  fetchPlaces: vi.fn(),
}));

import { fetchPlaces } from '@/lib/api';

const fetchPlacesMock = vi.mocked(fetchPlaces);

const ROW = {
  id: 'm-pin',
  name: 'Ada',
  createdAt: '2026-08-28T12:00:00.000Z',
  lat: 14.6,
  lng: 120.98,
  label: 'Happyland' as string | null,
};

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  useAuthStore.setState({ session: null, account: null });
  document.querySelectorAll('script[data-google-maps="1"]').forEach((node) => {
    node.remove();
  });
  delete (window as { google?: unknown }).google;
  window.history.replaceState(null, '', '/');
});

function jsonResponse(body: unknown): Response {
  return { json: () => Promise.resolve(body) } as Response;
}

describe('PlacesMapScreen', () => {
  it('stays on loading when there is no session', () => {
    renderWithLocale(<PlacesMapScreen />);
    expect(screen.getByText('Loading…')).toBeTruthy();
    expect(fetchPlacesMock).not.toHaveBeenCalled();
  });

  it('lists pins, coordinates, and the selected pin', async () => {
    window.history.replaceState(null, '', '/map?pin=m-pin');
    useAuthStore.setState({ session: 'tok' });
    fetchPlacesMock.mockResolvedValue([ROW, { ...ROW, id: 'm-2', label: null, lat: 1, lng: 2 }]);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ key: null })));
    renderWithLocale(<PlacesMapScreen />);
    expect(await screen.findByRole('link', { name: 'Ada · Happyland' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Ada · 1.00000, 2.00000' })).toBeTruthy();
    expect(
      screen.getByRole('link', { name: 'Ada · Happyland' }).getAttribute('data-selected'),
    ).toBe('true');
  });

  it('shows the empty state', async () => {
    useAuthStore.setState({ session: 'tok' });
    fetchPlacesMock.mockResolvedValue([]);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse('nope')));
    renderWithLocale(<PlacesMapScreen />);
    expect(await screen.findByText('No places yet.')).toBeTruthy();
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
    view.unmount();
    script?.dispatchEvent(new Event('load'));

    useAuthStore.setState({ session: 'tok-2' });
    let resolvePlaces: (rows: unknown) => void = () => undefined;
    fetchPlacesMock.mockReturnValue(
      new Promise((resolve) => {
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

  it('treats a null, missing, or non-string key as no map', async () => {
    for (const body of [null, {}, { key: 1 }]) {
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
});
