import { Profiler } from 'react';
import { act, cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PlaceField } from '@/components/PlaceField';
import { renderWithLocale } from '@/__tests__/render-with-locale';

type LatLng = { lat: () => number; lng: () => number };

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  document.querySelectorAll('script[data-gmaps="weekly"]').forEach((node) => {
    node.remove();
  });
  delete (window as { google?: unknown }).google;
  delete (window as { gm_authFailure?: unknown }).gm_authFailure;
});

function jsonResponse(body: unknown): Response {
  return { json: () => Promise.resolve(body) } as Response;
}

describe('PlaceField', () => {
  it('shows a label preview and removes the pin', () => {
    const onChange = vi.fn();
    renderWithLocale(
      <PlaceField
        place={{ lat: 14.6, lng: 120.98, label: 'Happyland' }}
        disabled={false}
        onChange={onChange}
      />,
    );
    expect(screen.getByText('Happyland')).toBeTruthy();
    expect(screen.queryByText('Add a place')).toBeNull();
    expect(screen.queryByText('Remove place')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Remove place' }));
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it('shows coordinates when the label is null', () => {
    renderWithLocale(
      <PlaceField
        place={{ lat: 1, lng: 2, label: null }}
        disabled={false}
        onChange={() => undefined}
      />,
    );
    expect(screen.getByText('1.00000, 2.00000')).toBeTruthy();
  });

  it('says the map is unavailable when the key request fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('down')));
    renderWithLocale(<PlaceField place={null} disabled={false} onChange={() => undefined} />);
    expect(screen.queryByText('Add a place')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Add a place' }));
    expect(await screen.findByText('The map is not available.')).toBeTruthy();
  });

  it('says the map is unavailable when the key is blank or not a string', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ key: '   ' }))
      .mockResolvedValueOnce(jsonResponse({ key: 1 }))
      .mockResolvedValueOnce(jsonResponse(null));
    vi.stubGlobal('fetch', fetchMock);
    const view = renderWithLocale(
      <PlaceField place={null} disabled={false} onChange={() => undefined} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Add a place' }));
    expect(await screen.findByText('The map is not available.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Add a place' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add a place' }));
    expect(await screen.findByText('The map is not available.')).toBeTruthy();
    view.unmount();
  });

  it('drops a pin, ignores an empty click, and confirms a label', async () => {
    const onChange = vi.fn();
    const listeners = new Map<string, (event?: unknown) => void>();
    const markerListeners = new Map<string, () => void>();
    let markerPos: LatLng | null = null;
    const marker = {
      setPosition: (pos: { lat: number; lng: number }) => {
        markerPos = { lat: () => pos.lat, lng: () => pos.lng };
      },
      getPosition: () => markerPos,
      addListener: (event: string, handler: () => void) => {
        markerListeners.set(event, handler);
      },
    };
    const map = {
      setCenter: vi.fn(),
      addListener: (event: string, handler: (event?: unknown) => void) => {
        listeners.set(event, handler);
      },
    };
    (window as { google?: unknown }).google = {
      maps: {
        Map: vi.fn(() => map),
        Marker: vi.fn(() => marker),
      },
    };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ key: ' browser-key ' })));
    const geo = {
      getCurrentPosition: (
        ok: (pos: { coords: { latitude: number; longitude: number } }) => void,
        err: () => void,
      ) => {
        ok({ coords: { latitude: 14, longitude: 121 } });
        err();
      },
    };
    vi.stubGlobal('navigator', { ...navigator, geolocation: geo });
    renderWithLocale(<PlaceField place={null} disabled={false} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add a place' }));
    await waitFor(() => {
      expect(listeners.has('click')).toBe(true);
    });
    listeners.get('click')?.({ latLng: null });
    listeners.get('click')?.({
      latLng: { lat: () => 14.5, lng: () => 120.9 },
    });
    listeners.get('click')?.({
      latLng: { lat: () => 14.6, lng: () => 121 },
    });
    markerListeners.get('dragend')?.();
    markerPos = null;
    markerListeners.get('dragend')?.();
    fireEvent.change(screen.getByLabelText('Place name'), { target: { value: '  Stall  ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Use this place' }));
    expect(onChange).toHaveBeenCalledWith({ lat: 14.6, lng: 121, label: 'Stall' });
  });

  it('restores the confirmed pin when the map opens again', async () => {
    const listeners = new Map<string, (event?: unknown) => void>();
    const map = {
      setCenter: vi.fn(),
      addListener: (event: string, handler: (event?: unknown) => void) => {
        listeners.set(event, handler);
      },
    };
    const markerListeners = new Map<string, () => void>();
    let markerPos: LatLng | null = { lat: () => 14.6, lng: () => 120.98 };
    const Marker = vi.fn(() => ({
      setPosition: () => undefined,
      getPosition: () => markerPos,
      addListener: (event: string, handler: () => void) => {
        markerListeners.set(event, handler);
      },
    }));
    (window as { google?: unknown }).google = { maps: { Map: vi.fn(() => map), Marker } };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ key: 'k' })));
    vi.stubGlobal('navigator', { geolocation: undefined });
    renderWithLocale(
      <PlaceField
        place={{ lat: 14.6, lng: 120.98, label: 'Happyland' }}
        disabled={false}
        onChange={() => undefined}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Add a place' }));
    expect(await screen.findByRole('button', { name: 'Use this place' })).toBeTruthy();
    expect(screen.getByLabelText('Place name')).toHaveProperty('value', 'Happyland');
    expect(Marker).toHaveBeenCalledWith({
      position: { lat: 14.6, lng: 120.98 },
      map,
      draggable: true,
    });
    markerListeners.get('dragend')?.();
    markerPos = null;
    markerListeners.get('dragend')?.();
  });

  it('does not show an empty frame while the map key is loading', () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => new Promise(() => undefined)),
    );
    renderWithLocale(<PlaceField place={null} disabled={false} onChange={() => undefined} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add a place' }));
    expect(screen.queryByText('The map is not available.')).toBeNull();
    expect(screen.queryByLabelText('Place name')).toBeNull();
  });

  it('removes a saved pin when the map is unavailable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ key: null })));
    const onCommit = vi.fn().mockResolvedValue(undefined);
    renderWithLocale(
      <PlaceField
        place={{ lat: 1, lng: 2, label: 'Stall' }}
        disabled={false}
        showPreview={false}
        ariaLabel="Edit place"
        onChange={() => undefined}
        onCommit={onCommit}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Edit place' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Remove place' }));
    await waitFor(() => {
      expect(onCommit).toHaveBeenCalledWith(null);
    });
  });

  it('clears a hidden preview from the open pin without a staff commit', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ key: null })));
    const onChange = vi.fn();
    renderWithLocale(
      <PlaceField
        place={{ lat: 1, lng: 2, label: 'Stall' }}
        disabled={false}
        showPreview={false}
        onChange={onChange}
      />,
    );
    expect(screen.queryByRole('button', { name: 'Remove place' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Add a place' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Remove place' }));
    expect(onChange).toHaveBeenCalledWith(null);
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Remove place' })).toBeNull();
    });
  });

  it('keeps the unavailable panel open when removing a pin fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ key: null })));
    const onCommit = vi.fn().mockRejectedValue(new Error('denied'));
    renderWithLocale(
      <PlaceField
        place={{ lat: 1, lng: 2, label: 'Stall' }}
        disabled={false}
        showPreview={false}
        ariaLabel="Edit place"
        onChange={() => undefined}
        onCommit={onCommit}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Edit place' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Remove place' }));
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.getByRole('alert').textContent).toContain(
      'The place could not be saved. Please try again.',
    );
    expect(screen.getByRole('button', { name: 'Remove place' })).toBeTruthy();
  });

  it('closes the place panel while a post is in flight', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ key: null })));
    const view = renderWithLocale(
      <PlaceField place={null} disabled={false} onChange={() => undefined} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Add a place' }));
    expect(await screen.findByText('The map is not available.')).toBeTruthy();
    view.rerender(<PlaceField place={null} disabled onChange={() => undefined} />);
    await waitFor(() => {
      expect(screen.queryByText('The map is not available.')).toBeNull();
    });
  });

  it('keeps the attach control disabled and confirms a blank label as null', async () => {
    const onChange = vi.fn();
    const listeners = new Map<string, (event?: unknown) => void>();
    const map = {
      setCenter: vi.fn(),
      addListener: (event: string, handler: (event?: unknown) => void) => {
        listeners.set(event, handler);
      },
    };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ key: 'k' })));
    vi.stubGlobal('navigator', { geolocation: undefined });
    const disabled = renderWithLocale(
      <PlaceField place={null} disabled={true} onChange={onChange} />,
    );
    expect(screen.getByRole('button', { name: 'Add a place' }).hasAttribute('disabled')).toBe(true);
    disabled.unmount();
    renderWithLocale(<PlaceField place={null} disabled={false} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add a place' }));
    await waitFor(() => {
      expect(document.querySelector('script[data-gmaps="weekly"]')).toBeTruthy();
    });
    (window as { google?: unknown }).google = {
      maps: { Map: vi.fn(() => map), Marker: vi.fn(() => ({ addListener: () => undefined })) },
    };
    document.querySelector('script[data-gmaps="weekly"]')?.dispatchEvent(new Event('load'));
    await waitFor(() => {
      expect(listeners.has('click')).toBe(true);
    });
    listeners.get('click')?.({ latLng: { lat: () => 1, lng: () => 2 } });
    fireEvent.change(screen.getByLabelText('Place name'), { target: { value: '   ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Use this place' }));
    expect(onChange).toHaveBeenCalledWith({ lat: 1, lng: 2, label: null });
  });

  it('reports a script error and a loaded script that never installs maps', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ key: 'k' })));
    const view = renderWithLocale(
      <PlaceField place={null} disabled={false} onChange={() => undefined} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Add a place' }));
    await waitFor(() => {
      expect(document.querySelector('script[data-gmaps="weekly"]')).toBeTruthy();
    });
    document.querySelector('script[data-gmaps="weekly"]')?.dispatchEvent(new Event('error'));
    expect(await screen.findByText('The map is not available.')).toBeTruthy();
    view.unmount();
    document.querySelectorAll('script[data-gmaps="weekly"]').forEach((node) => {
      node.remove();
    });

    const existing = document.createElement('script');
    existing.dataset['gmaps'] = 'weekly';
    let loads = 0;
    const orig = existing.addEventListener.bind(existing);
    existing.addEventListener = ((type: string, listener: EventListener) => {
      if (type === 'load' || type === 'error') {
        loads += 1;
      }
      orig(type, listener);
    }) as typeof existing.addEventListener;
    document.head.appendChild(existing);
    renderWithLocale(<PlaceField place={null} disabled={false} onChange={() => undefined} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add a place' }));
    await waitFor(() => {
      expect(loads).toBeGreaterThan(0);
    });
    existing.dispatchEvent(new Event('error'));
    expect(await screen.findByText('The map is not available.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Add a place' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add a place' }));
    expect(await screen.findByText('The map is not available.')).toBeTruthy();
  });

  it('does not draw when maps disappear before the panel effect', async () => {
    let armed = false;
    Object.defineProperty(window, 'google', {
      configurable: true,
      get() {
        if (!armed) {
          armed = true;
          return {
            maps: { Map: vi.fn(), Marker: vi.fn() },
          };
        }
        return undefined;
      },
    });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ key: 'k' })));
    vi.stubGlobal('navigator', { geolocation: undefined });
    renderWithLocale(<PlaceField place={null} disabled={false} onChange={() => undefined} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add a place' }));
    expect(await screen.findByLabelText('Place name')).toBeTruthy();
  });

  it('stays unavailable when a failed map script is opened again', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ key: 'k' })));
    renderWithLocale(<PlaceField place={null} disabled={false} onChange={() => undefined} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add a place' }));
    await waitFor(() => {
      expect(document.querySelector('script[data-gmaps="weekly"]')).toBeTruthy();
    });
    document.querySelector('script[data-gmaps="weekly"]')?.dispatchEvent(new Event('error'));
    expect(await screen.findByText('The map is not available.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Add a place' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add a place' }));
    expect(await screen.findByText('The map is not available.')).toBeTruthy();
  });

  it('marks an existing script that loads without maps and ignores a later load', async () => {
    const existing = document.createElement('script');
    existing.dataset['gmaps'] = 'weekly';
    let loads = 0;
    const orig = existing.addEventListener.bind(existing);
    existing.addEventListener = ((type: string, listener: EventListener) => {
      if (type === 'load') {
        loads += 1;
      }
      orig(type, listener);
    }) as typeof existing.addEventListener;
    document.head.appendChild(existing);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ key: 'k' })));
    renderWithLocale(<PlaceField place={null} disabled={false} onChange={() => undefined} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add a place' }));
    await waitFor(() => {
      expect(loads).toBeGreaterThan(0);
    });
    existing.dispatchEvent(new Event('load'));
    expect(await screen.findByText('The map is not available.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Add a place' }));
    existing.dispatchEvent(new Event('load'));
    await Promise.resolve();
  });

  it('marks a new script that loads without maps and ignores an error after close', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ key: 'k' })));
    renderWithLocale(<PlaceField place={null} disabled={false} onChange={() => undefined} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add a place' }));
    await waitFor(() => {
      expect(document.querySelector('script[data-gmaps="weekly"]')).toBeTruthy();
    });
    const script = document.querySelector('script[data-gmaps="weekly"]');
    script?.dispatchEvent(new Event('load'));
    expect(await screen.findByText('The map is not available.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Add a place' }));
    script?.dispatchEvent(new Event('error'));
    await Promise.resolve();
  });

  it('cancels an in-flight key load on close', async () => {
    let started = false;
    let resolveJson: (body: unknown) => void = () => undefined;
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        json: () =>
          new Promise((resolve) => {
            started = true;
            resolveJson = resolve;
          }),
      }),
    );
    renderWithLocale(<PlaceField place={null} disabled={false} onChange={() => undefined} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add a place' }));
    await waitFor(() => {
      expect(started).toBe(true);
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add a place' }));
    resolveJson({ key: 'k' });
    await Promise.resolve();
    expect(screen.queryByText('The map is not available.')).toBeNull();
  });

  it('shows the unavailable copy when Google rejects the key', async () => {
    const Map = vi.fn(() => ({ setCenter: vi.fn(), addListener: vi.fn() }));
    (window as { google?: unknown }).google = {
      maps: {
        Map,
        Marker: vi.fn(() => ({
          addListener: vi.fn(),
          setPosition: vi.fn(),
          getPosition: () => null,
        })),
      },
    };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ key: 'k' })));
    vi.stubGlobal('navigator', { geolocation: undefined });
    const view = renderWithLocale(
      <PlaceField place={null} disabled={false} onChange={() => undefined} />,
    );
    const toggle = screen.getByRole('button', { name: 'Add a place' });
    fireEvent.click(toggle);
    expect(await screen.findByLabelText('Place name')).toBeTruthy();
    await waitFor(() => {
      expect(Map).toHaveBeenCalled();
    });
    const drawn = Map.mock.calls.length;
    const fail = (window as { gm_authFailure?: () => void }).gm_authFailure;
    expect(fail).toBeTypeOf('function');
    fail?.();
    expect(await screen.findByText('The map is not available.')).toBeTruthy();
    fireEvent.click(toggle);
    fireEvent.click(toggle);
    expect(await screen.findByText('The map is not available.')).toBeTruthy();
    expect(screen.queryByLabelText('Place name')).toBeNull();
    expect(Map.mock.calls.length).toBe(drawn);
    view.unmount();
    fail?.();
    (window as { gm_authFailure?: () => void }).gm_authFailure?.();
  });

  it('stays unavailable when a rejected key is opened with no map script', async () => {
    const Map = vi.fn(() => ({ setCenter: vi.fn(), addListener: vi.fn() }));
    (window as { google?: unknown }).google = {
      maps: {
        Map,
        Marker: vi.fn(() => ({
          addListener: vi.fn(),
          setPosition: vi.fn(),
          getPosition: () => null,
        })),
      },
    };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ key: 'k' })));
    vi.stubGlobal('navigator', { geolocation: undefined });
    renderWithLocale(<PlaceField place={null} disabled={false} onChange={() => undefined} />);
    const toggle = screen.getByRole('button', { name: 'Add a place' });
    fireEvent.click(toggle);
    expect(await screen.findByLabelText('Place name')).toBeTruthy();
    await waitFor(() => {
      expect(Map).toHaveBeenCalled();
    });
    const drawn = Map.mock.calls.length;
    (window as { gm_authFailure?: () => void }).gm_authFailure?.();
    expect(await screen.findByText('The map is not available.')).toBeTruthy();
    delete (window as { google?: unknown }).google;
    document.querySelector('script[data-gmaps="weekly"]')?.remove();
    fireEvent.click(toggle);
    fireEvent.click(toggle);
    expect(await screen.findByText('The map is not available.')).toBeTruthy();
    expect(document.querySelector('script[data-gmaps="weekly"]')).toBeNull();
    expect(Map.mock.calls.length).toBe(drawn);
  });

  it('stops drawing when Google rejects the key while the map is constructed', async () => {
    const geo = vi.fn();
    vi.stubGlobal('navigator', { geolocation: { getCurrentPosition: geo } });
    const addListener = vi.fn();
    const Marker = vi.fn(() => ({
      addListener: vi.fn(),
      setPosition: vi.fn(),
      getPosition: () => null,
    }));
    const Map = vi.fn(() => {
      (window as { gm_authFailure?: () => void }).gm_authFailure?.();
      return { setCenter: vi.fn(), addListener };
    });
    (window as { google?: unknown }).google = { maps: { Map, Marker } };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ key: 'k' })));
    const view = renderWithLocale(
      <PlaceField place={null} disabled={false} onChange={() => undefined} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Add a place' }));
    await waitFor(() => {
      expect(Map).toHaveBeenCalled();
    });
    expect(addListener).not.toHaveBeenCalled();
    expect(Marker).not.toHaveBeenCalled();
    expect(geo).not.toHaveBeenCalled();
    expect(await screen.findByText('The map is not available.')).toBeTruthy();
    view.unmount();
    const saved = { lat: 14.6, lng: 120.98, label: 'Happyland' };
    const MarkerSaved = vi.fn(() => ({
      addListener: vi.fn(),
      setPosition: vi.fn(),
      getPosition: () => null,
    }));
    const MapSaved = vi.fn(() => {
      (window as { gm_authFailure?: () => void }).gm_authFailure?.();
      return { setCenter: vi.fn(), addListener: vi.fn() };
    });
    (window as { google?: unknown }).google = { maps: { Map: MapSaved, Marker: MarkerSaved } };
    renderWithLocale(<PlaceField place={saved} disabled={false} onChange={() => undefined} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add a place' }));
    await waitFor(() => {
      expect(MapSaved).toHaveBeenCalled();
    });
    expect(MarkerSaved).not.toHaveBeenCalled();
    expect(await screen.findByText('The map is not available.')).toBeTruthy();
  });

  function clientRect(left: number, top: number, right: number, bottom: number): DOMRect {
    return {
      x: left,
      y: top,
      left,
      top,
      right,
      bottom,
      width: right - left,
      height: bottom - top,
      toJSON() {
        return {};
      },
    } as DOMRect;
  }

  function stubMaps(): Map<string, (event?: unknown) => void> {
    const listeners = new Map<string, (event?: unknown) => void>();
    const map = {
      setCenter: vi.fn(),
      addListener: (event: string, handler: (event?: unknown) => void) => {
        listeners.set(event, handler);
      },
    };
    (window as { google?: unknown }).google = {
      maps: {
        Map: vi.fn(() => map),
        Marker: vi.fn(() => ({
          setPosition: () => undefined,
          getPosition: () => ({ lat: () => 14.6, lng: () => 120.98 }),
          addListener: () => undefined,
        })),
      },
    };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ key: 'k' })));
    vi.stubGlobal('navigator', { geolocation: undefined });
    return listeners;
  }

  it('commits through onCommit without calling onChange', async () => {
    const onChange = vi.fn();
    const onCommit = vi.fn().mockResolvedValue(undefined);
    const listeners = stubMaps();
    renderWithLocale(
      <PlaceField place={null} disabled={false} onChange={onChange} onCommit={onCommit} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Add a place' }));
    await waitFor(() => {
      expect(listeners.has('click')).toBe(true);
    });
    listeners.get('click')?.({ latLng: { lat: () => 14.6, lng: () => 120.98 } });
    fireEvent.change(screen.getByLabelText('Place name'), { target: { value: 'Happyland' } });
    fireEvent.click(screen.getByRole('button', { name: 'Use this place' }));
    await waitFor(() => {
      expect(onCommit).toHaveBeenCalledWith({ lat: 14.6, lng: 120.98, label: 'Happyland' });
    });
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Use this place' })).toBeNull();
  });

  it('keeps the panel open and shows the save error when onCommit rejects', async () => {
    const onChange = vi.fn();
    const onCommit = vi.fn().mockRejectedValue(new Error('denied'));
    const listeners = stubMaps();
    renderWithLocale(
      <PlaceField place={null} disabled={false} onChange={onChange} onCommit={onCommit} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Add a place' }));
    await waitFor(() => {
      expect(listeners.has('click')).toBe(true);
    });
    listeners.get('click')?.({ latLng: { lat: () => 14.6, lng: () => 120.98 } });
    fireEvent.click(await screen.findByRole('button', { name: 'Use this place' }));
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.getByRole('alert').textContent).toContain(
      'The place could not be saved. Please try again.',
    );
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Use this place' })).toBeTruthy();
  });

  it('disables Done and Remove while onCommit is pending', async () => {
    let resolveCommit!: () => void;
    const onCommit = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveCommit = resolve;
        }),
    );
    stubMaps();
    renderWithLocale(
      <PlaceField
        place={{ lat: 14.6, lng: 120.98, label: 'Happyland' }}
        disabled={false}
        onChange={() => undefined}
        onCommit={onCommit}
        showPreview={false}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Add a place' }));
    expect(await screen.findByRole('button', { name: 'Use this place' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Use this place' }));
    expect(screen.getByRole('button', { name: 'Use this place' }).hasAttribute('disabled')).toBe(
      true,
    );
    expect(screen.getByRole('button', { name: 'Remove place' }).hasAttribute('disabled')).toBe(
      true,
    );
    await act(async () => {
      resolveCommit();
    });
  });

  it('uses custom size, variant, and accessible name', () => {
    renderWithLocale(
      <PlaceField
        place={null}
        disabled={false}
        onChange={() => undefined}
        buttonSize="sm"
        buttonVariant="ghost"
        ariaLabel="Staff place"
      />,
    );
    const button = screen.getByRole('button', { name: 'Staff place' });
    expect(button.className).toContain('h-6 w-6');
    expect(button.className).toContain('text-app-muted');
    expect(screen.queryByRole('button', { name: 'Add a place' })).toBeNull();
  });

  it('hides the floating chip when showPreview is false', () => {
    renderWithLocale(
      <PlaceField
        place={{ lat: 14.6, lng: 120.98, label: 'Happyland' }}
        disabled={false}
        onChange={() => undefined}
        showPreview={false}
      />,
    );
    expect(screen.queryByText('Happyland')).toBeNull();
    expect(screen.getByRole('button', { name: 'Add a place' })).toBeTruthy();
  });

  it('measures a shown preview inside the app frame', () => {
    renderWithLocale(
      <div data-app-frame>
        <PlaceField
          place={{ lat: 14.6, lng: 120.98, label: 'Happyland' }}
          disabled={false}
          onChange={() => undefined}
        />
      </div>,
    );
    expect(screen.getByText('Happyland')).toBeTruthy();
  });

  it('removes a saved place from the open map panel', async () => {
    const onChange = vi.fn();
    stubMaps();
    renderWithLocale(
      <PlaceField
        place={{ lat: 14.6, lng: 120.98, label: 'Happyland' }}
        disabled={false}
        showPreview={false}
        onChange={onChange}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Add a place' }));
    expect(await screen.findByRole('textbox', { name: 'Place name' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Remove place' }));
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it('clears the map when the panel closes', async () => {
    const listeners = stubMaps();
    renderWithLocale(<PlaceField place={null} disabled={false} onChange={() => undefined} />);
    const toggle = screen.getByRole('button', { name: 'Add a place' });
    fireEvent.click(toggle);
    await waitFor(() => {
      expect(listeners.has('click')).toBe(true);
    });
    fireEvent.click(toggle);
    expect(screen.queryByRole('textbox', { name: 'Place name' })).toBeNull();
  });

  it('portals a downward preview inside the app frame', async () => {
    const originalRect = HTMLElement.prototype.getBoundingClientRect;
    const originalWidth = window.innerWidth;
    const originalHeight = window.innerHeight;
    window.innerWidth = 400;
    window.innerHeight = 500;
    HTMLElement.prototype.getBoundingClientRect = function getBoundingClientRect() {
      if (this.hasAttribute('data-app-frame')) {
        return clientRect(-20, -10, 900, 900);
      }
      return clientRect(30, 40, 70, 80);
    };
    try {
      renderWithLocale(
        <div data-app-frame>
          <PlaceField
            place={{ lat: 14.6, lng: 120.98, label: 'Happyland' }}
            disabled={false}
            onChange={() => undefined}
          />
        </div>,
      );
      await waitFor(() => {
        expect(screen.getByText('Happyland').parentElement?.parentElement).toBe(document.body);
      });
      const preview = screen.getByText('Happyland').parentElement as HTMLElement;
      expect(preview.style.left).toBe('30px');
      expect(preview.style.width).toBe('256px');
      expect(preview.style.maxHeight).toBe('');
      expect(preview.style.top).toBe('88px');
      expect(preview.style.bottom).toBe('');
      expect(preview.style.overflow).toBe('');
      expect(preview.className.split(/\s+/)).toContain('overflow-clip');
      expect(preview.className.split(/\s+/)).not.toContain('flex-col');
      expect(preview.parentElement).toBe(document.body);
    } finally {
      HTMLElement.prototype.getBoundingClientRect = originalRect;
      window.innerWidth = originalWidth;
      window.innerHeight = originalHeight;
    }
  });

  it('clamps a downward preview to the visual viewport', async () => {
    const originalRect = HTMLElement.prototype.getBoundingClientRect;
    const originalWidth = window.innerWidth;
    const originalHeight = window.innerHeight;
    window.innerWidth = 400;
    window.innerHeight = 500;
    HTMLElement.prototype.getBoundingClientRect = function getBoundingClientRect() {
      if (this.hasAttribute('data-app-frame')) {
        return clientRect(-20, -10, 900, 900);
      }
      return clientRect(30, 40, 70, 80);
    };
    const previous = Object.getOwnPropertyDescriptor(window, 'visualViewport');
    Object.defineProperty(window, 'visualViewport', {
      configurable: true,
      value: {
        offsetTop: 120,
        height: 250,
        addEventListener(): void {},
        removeEventListener(): void {},
      },
    });
    try {
      renderWithLocale(
        <div data-app-frame>
          <PlaceField
            place={{ lat: 14.6, lng: 120.98, label: 'Happyland' }}
            disabled={false}
            onChange={() => undefined}
          />
        </div>,
      );
      await waitFor(() => {
        expect(screen.getByText('Happyland').parentElement?.parentElement).toBe(document.body);
      });
      const preview = screen.getByText('Happyland').parentElement as HTMLElement;
      expect(preview.style.top).toBe('136px');
      expect(preview.style.bottom).toBe('');
      expect(preview.style.left).toBe('30px');
      expect(preview.style.width).toBe('256px');
    } finally {
      HTMLElement.prototype.getBoundingClientRect = originalRect;
      window.innerWidth = originalWidth;
      window.innerHeight = originalHeight;
      if (previous === undefined) {
        delete (window as { visualViewport?: unknown }).visualViewport;
      } else {
        Object.defineProperty(window, 'visualViewport', previous);
      }
    }
  });

  it('opens the map panel upward with flex-col and shrink-0 controls', async () => {
    const originalRect = HTMLElement.prototype.getBoundingClientRect;
    const originalWidth = window.innerWidth;
    const originalHeight = window.innerHeight;
    window.innerWidth = 400;
    window.innerHeight = 800;
    HTMLElement.prototype.getBoundingClientRect = function getBoundingClientRect() {
      return clientRect(56, 660, 96, 700);
    };
    const listeners = stubMaps();
    try {
      renderWithLocale(<PlaceField place={null} disabled={false} onChange={() => undefined} />);
      fireEvent.click(screen.getByRole('button', { name: 'Add a place' }));
      await waitFor(() => {
        expect(listeners.has('click') || screen.queryByLabelText('Place name') !== null).toBe(true);
      });
      await waitFor(() => {
        expect(listeners.has('click')).toBe(true);
      });
      const input = screen.getByLabelText('Place name');
      expect(input.parentElement?.style.top).toBe('');
      expect(input.parentElement?.style.bottom).toBe('');
      const clamp = input.parentElement?.parentElement as HTMLElement;
      expect(clamp.style.left).toBe('16px');
      expect(clamp.style.width).toBe('368px');
      expect(clamp.style.maxHeight).toBe('');
      expect(clamp.style.top).toBe('16px');
      expect(clamp.style.bottom).toBe('148px');
      expect(clamp.style.overflow).toBe('');
      const clampTokens = clamp.className.split(/\s+/);
      expect(clampTokens).toContain('fixed');
      expect(clampTokens).toContain('overflow-clip');
      expect(clampTokens).toContain('pointer-events-none');
      expect(clampTokens).toContain('flex-col');
      expect(clampTokens).toContain('justify-end');
      expect(clampTokens).not.toContain('justify-start');
      const innerTokens = (input.parentElement as HTMLElement).className.split(/\s+/);
      expect(innerTokens).toContain('pointer-events-auto');
      expect(innerTokens).toContain('flex');
      expect(innerTokens).toContain('flex-col');
      expect(innerTokens).toContain('min-h-0');
      expect(innerTokens).toContain('max-h-full');
      expect(innerTokens).toContain('overflow-clip');
      const map = clamp.querySelector('.h-64') as HTMLElement;
      expect(map.style.height).toBe('');
      listeners.get('click')?.({ latLng: { lat: () => 14.6, lng: () => 120.98 } });
      const confirm = await screen.findByRole('button', { name: 'Use this place' });
      expect(input.className.split(/\s+/)).toContain('shrink-0');
      expect(confirm.className.split(/\s+/)).toContain('shrink-0');
    } finally {
      HTMLElement.prototype.getBoundingClientRect = originalRect;
      window.innerWidth = originalWidth;
      window.innerHeight = originalHeight;
    }
  });

  it('gives the short map no fixed height', async () => {
    const originalRect = HTMLElement.prototype.getBoundingClientRect;
    const originalWidth = window.innerWidth;
    const originalHeight = window.innerHeight;
    window.innerWidth = 400;
    window.innerHeight = 400;
    HTMLElement.prototype.getBoundingClientRect = function getBoundingClientRect() {
      if (this.hasAttribute('data-app-frame')) {
        return clientRect(0, 0, 400, 200);
      }
      return clientRect(56, 90, 96, 110);
    };
    stubMaps();
    try {
      renderWithLocale(
        <div data-app-frame>
          <PlaceField place={null} disabled={false} onChange={() => undefined} />
        </div>,
      );
      fireEvent.click(screen.getByRole('button', { name: 'Add a place' }));
      const input = await screen.findByLabelText('Place name');
      await waitFor(() => {
        expect(input.parentElement?.parentElement?.style.bottom).toBe('216px');
      });
      const clamp = input.parentElement?.parentElement as HTMLElement;
      expect(clamp.style.left).toBe('16px');
      expect(clamp.style.width).toBe('368px');
      expect(clamp.style.maxHeight).toBe('');
      expect(clamp.style.top).toBe('16px');
      expect(clamp.style.bottom).toBe('216px');
      expect(clamp.style.overflow).toBe('');
      expect(clamp.className.split(/\s+/)).toContain('overflow-clip');
      expect(clamp.className.split(/\s+/)).toContain('justify-start');
      expect(clamp.className.split(/\s+/)).not.toContain('justify-end');
      const map = clamp.querySelector('.h-64') as HTMLElement;
      const mapTokens = map.className.split(/\s+/);
      expect(mapTokens).toContain('min-h-0');
      expect(map.style.height).toBe('');
    } finally {
      HTMLElement.prototype.getBoundingClientRect = originalRect;
      window.innerWidth = originalWidth;
      window.innerHeight = originalHeight;
    }
  });

  it('does not re-render when a second measure yields the same box', async () => {
    const originalRect = HTMLElement.prototype.getBoundingClientRect;
    const originalWidth = window.innerWidth;
    const originalHeight = window.innerHeight;
    let anchorLeft = 30;
    window.innerWidth = 400;
    window.innerHeight = 500;
    HTMLElement.prototype.getBoundingClientRect = function getBoundingClientRect() {
      if (this.hasAttribute('data-app-frame')) {
        return clientRect(-20, -10, 900, 900);
      }
      return clientRect(anchorLeft, 40, anchorLeft + 40, 80);
    };
    let renders = 0;
    try {
      renderWithLocale(
        <Profiler
          id="PlaceField"
          onRender={() => {
            renders += 1;
          }}
        >
          <div data-app-frame>
            <PlaceField
              place={{ lat: 14.6, lng: 120.98, label: 'Happyland' }}
              disabled={false}
              onChange={() => undefined}
            />
          </div>
        </Profiler>,
      );
      await waitFor(() => {
        expect(screen.getByText('Happyland').parentElement?.style.left).toBe('30px');
      });
      const preview = screen.getByText('Happyland').parentElement as HTMLElement;
      expect(preview.style.width).toBe('256px');
      expect(preview.style.maxHeight).toBe('');
      expect(preview.style.top).toBe('88px');
      expect(preview.style.bottom).toBe('');
      expect(preview.style.overflow).toBe('');
      expect(preview.className.split(/\s+/)).toContain('overflow-clip');
      expect(preview.className.split(/\s+/)).not.toContain('flex-col');
      const rendersAfterPreview = renders;
      await act(async () => {
        document.documentElement.dispatchEvent(new Event('scroll', { bubbles: false }));
      });
      expect(renders).toBe(rendersAfterPreview);
      expect(preview.style.left).toBe('30px');
      anchorLeft = 0;
      await act(async () => {
        document.documentElement.dispatchEvent(new Event('scroll', { bubbles: false }));
      });
      expect(preview.style.left).toBe('16px');
      expect(renders).toBeGreaterThan(rendersAfterPreview);
    } finally {
      HTMLElement.prototype.getBoundingClientRect = originalRect;
      window.innerWidth = originalWidth;
      window.innerHeight = originalHeight;
    }
  });

  it('keeps the panel in the anchor when the frame has no room', async () => {
    const originalRect = HTMLElement.prototype.getBoundingClientRect;
    HTMLElement.prototype.getBoundingClientRect = function getBoundingClientRect() {
      return clientRect(0, 0, 0, 0);
    };
    const listeners = stubMaps();
    try {
      renderWithLocale(
        <div data-app-frame>
          <PlaceField place={null} disabled={false} onChange={() => undefined} />
        </div>,
      );
      fireEvent.click(screen.getByRole('button', { name: 'Add a place' }));
      const input = await screen.findByLabelText('Place name');
      expect(input.closest('.fixed')).toBeNull();
      const wrapper = input.closest('.absolute');
      expect(wrapper).not.toBeNull();
      expect(wrapper?.closest('.relative')).not.toBeNull();
      const map = wrapper?.querySelector('.h-64') as HTMLElement;
      expect(map.style.height).toBe('');
      await waitFor(() => {
        expect(
          (window as unknown as { google: { maps: { Map: ReturnType<typeof vi.fn> } } }).google.maps
            .Map,
        ).toHaveBeenCalled();
      });
      listeners.get('click')?.({ latLng: { lat: () => 1, lng: () => 2 } });
      expect(await screen.findByRole('button', { name: 'Use this place' })).toBeTruthy();
    } finally {
      HTMLElement.prototype.getBoundingClientRect = originalRect;
    }
  });

  it('registers visualViewport resize and scroll for a shown preview', () => {
    const resizeListeners = new Set<EventListener>();
    const scrollListeners = new Set<EventListener>();
    const viewport = {
      addEventListener(type: string, listener: EventListener): void {
        if (type === 'resize') {
          resizeListeners.add(listener);
        }
        if (type === 'scroll') {
          scrollListeners.add(listener);
        }
      },
      removeEventListener(type: string, listener: EventListener): void {
        if (type === 'resize') {
          resizeListeners.delete(listener);
        }
        if (type === 'scroll') {
          scrollListeners.delete(listener);
        }
      },
    };
    const previous = Object.getOwnPropertyDescriptor(window, 'visualViewport');
    Object.defineProperty(window, 'visualViewport', {
      configurable: true,
      value: viewport,
    });
    try {
      const view = renderWithLocale(
        <PlaceField
          place={{ lat: 14.6, lng: 120.98, label: 'Happyland' }}
          disabled={false}
          onChange={() => undefined}
        />,
      );
      expect(resizeListeners.size).toBe(1);
      expect(scrollListeners.size).toBe(1);
      view.unmount();
      expect(resizeListeners.size).toBe(0);
      expect(scrollListeners.size).toBe(0);
    } finally {
      if (previous === undefined) {
        delete (window as { visualViewport?: unknown }).visualViewport;
      } else {
        Object.defineProperty(window, 'visualViewport', previous);
      }
    }
  });
});
