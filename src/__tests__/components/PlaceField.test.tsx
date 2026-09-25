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
    fireEvent.click(screen.getByRole('button', { name: 'Use this place' }));
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
});
