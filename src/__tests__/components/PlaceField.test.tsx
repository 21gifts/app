import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
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
    const Marker = vi.fn(() => ({
      setPosition: () => undefined,
      getPosition: () => ({ lat: () => 14.6, lng: () => 120.98 }),
      addListener: () => undefined,
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
});
