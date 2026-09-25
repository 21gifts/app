import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PlacesMapScreen } from '@/components/PlacesMapScreen';
import { renderWithLocale } from '@/__tests__/render-with-locale';
import type { ForumPlaceRow } from '@/lib/api-types';
import { useAuthStore } from '@/stores/auth-store';

vi.mock('@/lib/api', () => ({
  fetchPlaces: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useSearchParams: (): URLSearchParams => new URLSearchParams(window.location.search),
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
  delete (window as { gm_authFailure?: unknown }).gm_authFailure;
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
    const view = renderWithLocale(<PlacesMapScreen />);
    expect(await screen.findByRole('link', { name: 'Ada · Happyland' })).toBeTruthy();
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
});
