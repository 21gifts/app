import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GoogleMapCanvas } from '@/components/GoogleMapCanvas';
import { PlaceField } from '@/components/PlaceField';
import { PLACE_LABEL_API_MESSAGE } from '@/lib/entry-text';
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

function focusDocumentBody(): void {
  document.body.tabIndex = -1;
  document.body.focus();
  document.body.removeAttribute('tabindex');
}

async function expectMapUnavailable(): Promise<void> {
  const dialog = await screen.findByRole('dialog');
  const messages = await within(dialog).findAllByText('The map is not available.');
  expect(messages).toHaveLength(1);
  expect(messages.some((message) => message.className.includes('mb-2'))).toBe(false);
}

describe('PlaceField', () => {
  it('opens an accessible modal, closes on Escape, and restores trigger focus', async () => {
    stubMaps();
    renderWithLocale(<PlaceField place={null} disabled={false} onChange={() => undefined} />);
    const trigger = screen.getByRole('button', { name: 'Add a place' });
    trigger.focus();
    fireEvent.click(trigger);
    const dialog = await screen.findByRole('dialog', { name: 'Add a place' });
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(document.activeElement).toBe(dialog);
    fireEvent.keyDown(dialog, { key: 'Enter' });
    expect(document.activeElement).toBe(dialog);
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(document.activeElement).toBe(within(dialog).getByRole('button', { name: 'Close' }));
    focusDocumentBody();
    expect(document.activeElement).toBe(document.body);
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(document.activeElement).toBe(within(dialog).getByRole('button', { name: 'Close' }));
    focusDocumentBody();
    expect(document.activeElement).toBe(document.body);
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(
      within(dialog).getByRole('textbox', { name: 'Place name' }),
    );
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    expect(document.activeElement).toBe(trigger);
  });

  it('wraps Tab from the last dialog control to the first', async () => {
    stubMaps();
    renderWithLocale(
      <PlaceField
        place={{ lat: 14.6, lng: 120.98, label: 'Happyland' }}
        disabled={false}
        onChange={() => undefined}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Add a place' }));
    const dialog = await screen.findByRole('dialog', { name: 'Add a place' });
    const first = within(dialog).getByRole('button', { name: 'Close' });
    const middle = within(dialog).getByRole('textbox', { name: 'Place name' });
    const last = within(dialog).getByRole('button', { name: 'Remove place' });
    middle.focus();
    fireEvent.keyDown(middle, { key: 'Tab' });
    expect(document.activeElement).toBe(middle);
    last.focus();
    fireEvent.keyDown(last, { key: 'Tab' });
    expect(document.activeElement).toBe(first);
  });

  it('wraps Shift+Tab from the first dialog control to the last', async () => {
    stubMaps();
    renderWithLocale(
      <PlaceField
        place={{ lat: 14.6, lng: 120.98, label: 'Happyland' }}
        disabled={false}
        onChange={() => undefined}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Add a place' }));
    const dialog = await screen.findByRole('dialog', { name: 'Add a place' });
    const first = within(dialog).getByRole('button', { name: 'Close' });
    const last = within(dialog).getByRole('button', { name: 'Remove place' });
    first.focus();
    fireEvent.keyDown(first, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(last);
  });

  it('keeps Tab in the dialog while an async save disables every control', async () => {
    stubMaps();
    const onCommit = vi.fn(() => new Promise<void>(() => undefined));
    renderWithLocale(
      <PlaceField
        place={{ lat: 14.6, lng: 120.98, label: 'Happyland' }}
        disabled={false}
        onChange={() => undefined}
        onCommit={onCommit}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Add a place' }));
    const dialog = await screen.findByRole('dialog', { name: 'Add a place' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Use this place' }));
    await waitFor(() => {
      expect(
        dialog.querySelectorAll(
          'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
        ),
      ).toHaveLength(0);
    });
    expect(document.activeElement).toBe(dialog);
    focusDocumentBody();
    expect(document.activeElement).toBe(document.body);
    expect(fireEvent.keyDown(document, { key: 'Tab' })).toBe(false);
    expect(document.activeElement).toBe(dialog);
  });

  it('says the map is unavailable when the key request fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('down')));
    const onAvailabilityChange = vi.fn();
    renderWithLocale(
      <PlaceField
        place={null}
        disabled={false}
        onChange={() => undefined}
        onAvailabilityChange={onAvailabilityChange}
      />,
    );
    expect(screen.queryByText('Add a place')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Add a place' }));
    await expectMapUnavailable();
    await waitFor(() => {
      expect(onAvailabilityChange).toHaveBeenLastCalledWith(true);
    });
  });

  it('reports availability only after a loaded map has been checked', async () => {
    const listeners = stubMaps();
    const onAvailabilityChange = vi.fn();
    renderWithLocale(
      <PlaceField
        place={null}
        disabled={false}
        onChange={() => undefined}
        onAvailabilityChange={onAvailabilityChange}
      />,
    );
    expect(onAvailabilityChange).not.toHaveBeenCalledWith(false);
    fireEvent.click(screen.getByRole('button', { name: 'Add a place' }));
    await waitFor(() => {
      expect(listeners.has('click')).toBe(true);
    });
    expect(onAvailabilityChange).toHaveBeenLastCalledWith(false);
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
    await expectMapUnavailable();
    fireEvent.click(screen.getByRole('button', { name: 'Add a place' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add a place' }));
    await expectMapUnavailable();
    view.unmount();
  });

  it('says the map is unavailable when the key response is a primitive', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse('missing')));
    renderWithLocale(<PlaceField place={null} disabled={false} onChange={() => undefined} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add a place' }));
    await expectMapUnavailable();
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
    await waitFor(() => {
      expect(Marker).toHaveBeenCalledWith({
        position: { lat: 14.6, lng: 120.98 },
        map,
        draggable: true,
      });
    });
    markerListeners.get('dragend')?.();
    markerPos = null;
    markerListeners.get('dragend')?.();
  });

  it('shows the dialog and field while the map key is loading', () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => new Promise(() => undefined)),
    );
    renderWithLocale(<PlaceField place={null} disabled={false} onChange={() => undefined} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add a place' }));
    expect(screen.queryAllByText('The map is not available.')).toHaveLength(0);
    expect(screen.getByRole('dialog', { name: 'Add a place' })).toBeTruthy();
    expect(screen.getByLabelText('Place name')).toBeTruthy();
  });

  it('removes a saved pin when the map is unavailable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ key: null })));
    const onCommit = vi.fn().mockResolvedValue(undefined);
    renderWithLocale(
      <PlaceField
        place={{ lat: 1, lng: 2, label: 'Stall' }}
        disabled={false}
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
    await expectMapUnavailable();
    view.rerender(<PlaceField place={null} disabled onChange={() => undefined} />);
    await waitFor(() => {
      expect(screen.queryAllByText('The map is not available.')).toHaveLength(0);
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
    await expectMapUnavailable();
    view.unmount();
    document.querySelectorAll('script[data-gmaps="weekly"]').forEach((node) => {
      node.remove();
    });

    const existing = document.createElement('script');
    existing.dataset['gmaps'] = 'weekly';
    document.head.appendChild(existing);
    renderWithLocale(<PlaceField place={null} disabled={false} onChange={() => undefined} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add a place' }));
    // A script the loader did not add is replaced, never waited on.
    await waitFor(() => {
      expect(existing.isConnected).toBe(false);
    });
    const fresh = document.querySelector('script[data-gmaps="weekly"]');
    expect(fresh).toBeTruthy();
    fresh?.dispatchEvent(new Event('load'));
    await expectMapUnavailable();
    fireEvent.click(screen.getByRole('button', { name: 'Add a place' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add a place' }));
    await expectMapUnavailable();
    expect(document.querySelectorAll('script[data-gmaps="weekly"]')).toHaveLength(1);
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

  it('retries a failed map script when the panel is opened again', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ key: 'k' })));
    vi.stubGlobal('navigator', { geolocation: undefined });
    renderWithLocale(<PlaceField place={null} disabled={false} onChange={() => undefined} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add a place' }));
    await waitFor(() => {
      expect(document.querySelector('script[data-gmaps="weekly"]')).toBeTruthy();
    });
    const failed = document.querySelector('script[data-gmaps="weekly"]');
    failed?.dispatchEvent(new Event('error'));
    await expectMapUnavailable();
    expect(document.querySelector('script[data-gmaps="weekly"]')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Add a place' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add a place' }));
    await waitFor(() => {
      expect(document.querySelector('script[data-gmaps="weekly"]')).toBeTruthy();
    });
    const retry = document.querySelector('script[data-gmaps="weekly"]');
    expect(retry).not.toBe(failed);
    (window as { google?: unknown }).google = {
      maps: {
        Map: vi.fn(() => ({ setCenter: vi.fn(), addListener: vi.fn() })),
        Marker: vi.fn(() => ({ addListener: vi.fn() })),
      },
    };
    retry?.dispatchEvent(new Event('load'));
    expect(await screen.findByLabelText('Place name')).toBeTruthy();
    expect(screen.queryByText('The map is not available.')).toBeNull();
  });

  it('replaces an existing script, marks a load without maps, and ignores a later load', async () => {
    const existing = document.createElement('script');
    existing.dataset['gmaps'] = 'weekly';
    document.head.appendChild(existing);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ key: 'k' })));
    renderWithLocale(<PlaceField place={null} disabled={false} onChange={() => undefined} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add a place' }));
    await waitFor(() => {
      expect(existing.isConnected).toBe(false);
    });
    const fresh = document.querySelector<HTMLScriptElement>('script[data-gmaps="weekly"]');
    fresh?.dispatchEvent(new Event('load'));
    await expectMapUnavailable();
    expect(fresh?.dataset['gmapsState']).toBe('error');
    fireEvent.click(screen.getByRole('button', { name: 'Add a place' }));
    fresh?.dispatchEvent(new Event('load'));
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
    await expectMapUnavailable();
    fireEvent.click(screen.getByRole('button', { name: 'Add a place' }));
    script?.dispatchEvent(new Event('error'));
    await Promise.resolve();
  });

  it('ignores a script error after the panel closed', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ key: 'k' })));
    renderWithLocale(<PlaceField place={null} disabled={false} onChange={() => undefined} />);
    const toggle = screen.getByRole('button', { name: 'Add a place' });
    fireEvent.click(toggle);
    await waitFor(() => {
      expect(document.querySelector('script[data-gmaps="weekly"]')).toBeTruthy();
    });
    fireEvent.click(toggle);
    document.querySelector('script[data-gmaps="weekly"]')?.dispatchEvent(new Event('error'));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(screen.queryByText('The map is not available.')).toBeNull();
  });

  it('shares one map script with GoogleMapCanvas', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ key: 'k' })));
    const map = { setCenter: vi.fn(), addListener: vi.fn() };
    const canvas = renderWithLocale(
      <GoogleMapCanvas
        mapsKey="k"
        points={[{ lat: 1, lng: 2 }]}
        anchor={{ lat: 1, lng: 2 }}
        fitAll={false}
        testId="shared-map"
      />,
    );
    renderWithLocale(<PlaceField place={null} disabled={false} onChange={() => undefined} />);
    expect(document.querySelectorAll('script[data-gmaps="weekly"]')).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Add a place' }));
    await waitFor(() => {
      expect(fetch).toHaveBeenCalled();
    });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(document.querySelectorAll('script[data-gmaps="weekly"]')).toHaveLength(1);
    (window as { google?: unknown }).google = {
      maps: { Map: vi.fn(() => map), Marker: vi.fn(() => ({ addListener: vi.fn() })) },
    };
    document.querySelector('script[data-gmaps="weekly"]')?.dispatchEvent(new Event('load'));
    expect(await screen.findByLabelText('Place name')).toBeTruthy();
    expect(document.querySelectorAll('script[data-gmaps="weekly"]')).toHaveLength(1);
    canvas.unmount();
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
    expect(screen.queryAllByText('The map is not available.')).toHaveLength(0);
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
    await expectMapUnavailable();
    fireEvent.click(toggle);
    fireEvent.click(toggle);
    await expectMapUnavailable();
    expect(screen.getByLabelText('Place name')).toBeTruthy();
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
    await expectMapUnavailable();
    delete (window as { google?: unknown }).google;
    document.querySelector('script[data-gmaps="weekly"]')?.remove();
    fireEvent.click(toggle);
    fireEvent.click(toggle);
    await expectMapUnavailable();
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
    await expectMapUnavailable();
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
    await expectMapUnavailable();
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
        event: { trigger: vi.fn() },
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
    const commit = screen.getByRole('button', { name: 'Use this place' });
    expect(commit).toBeTruthy();
    await waitFor(() => {
      expect(document.activeElement).toBe(commit);
    });
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
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.getByRole('dialog')).toBeTruthy();
    await act(async () => {
      resolveCommit();
    });
  });

  it('disables shop fields and ignores map clicks while onCommit is pending', async () => {
    let resolveCommit!: () => void;
    const onCommit = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveCommit = resolve;
        }),
    );
    const listeners = new Map<string, (event?: unknown) => void>();
    const markerListeners = new Map<string, () => void>();
    const setPosition = vi.fn();
    const marker = {
      setPosition,
      getPosition: () => ({ lat: () => 47.3769, lng: () => 8.5417 }),
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
        event: { trigger: vi.fn() },
      },
    };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ key: 'k' })));
    vi.stubGlobal('navigator', { geolocation: undefined });
    renderWithLocale(
      <PlaceField
        place={null}
        disabled={false}
        onChange={() => undefined}
        onCommit={onCommit}
        shopDetails
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Add a place' }));
    await waitFor(() => {
      expect(listeners.has('click')).toBe(true);
    });
    listeners.get('click')?.({ latLng: { lat: () => 47.3769, lng: () => 8.5417 } });
    fillShopAddress();
    fireEvent.click(screen.getByRole('button', { name: 'Use this place' }));
    expect((screen.getByLabelText('Shop name') as HTMLInputElement).disabled).toBe(true);
    expect((screen.getByLabelText('Street') as HTMLInputElement).disabled).toBe(true);
    expect(screen.getByRole('button', { name: 'Add a place' }).hasAttribute('disabled')).toBe(true);
    expect(screen.getByRole('button', { name: 'Use this place' }).hasAttribute('disabled')).toBe(
      true,
    );
    setPosition.mockClear();
    listeners.get('click')?.({ latLng: { lat: () => 1, lng: () => 2 } });
    markerListeners.get('dragend')?.();
    expect(setPosition).not.toHaveBeenCalled();
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledWith({
      lat: 47.3769,
      lng: 8.5417,
      label: "Kiki's Bakery",
      address: {
        street: 'Bahnhofstrasse',
        houseNumber: '12',
        postalCode: '8001',
        city: 'Zürich',
        country: 'CH',
      },
    });
    await act(async () => {
      resolveCommit();
    });
  });

  it('ignores a saved-marker drag while onCommit is pending', async () => {
    let resolveCommit!: () => void;
    const onCommit = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveCommit = resolve;
        }),
    );
    const listeners = new Map<string, (event?: unknown) => void>();
    const markerListeners = new Map<string, () => void>();
    const setPosition = vi.fn();
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
          setPosition,
          getPosition: () => ({ lat: () => 1, lng: () => 2 }),
          addListener: (event: string, handler: () => void) => {
            markerListeners.set(event, handler);
          },
        })),
        event: { trigger: vi.fn() },
      },
    };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ key: 'k' })));
    vi.stubGlobal('navigator', { geolocation: undefined });
    renderWithLocale(
      <PlaceField
        place={{
          lat: 47.3769,
          lng: 8.5417,
          label: "Kiki's Bakery",
          address: {
            street: 'Bahnhofstrasse',
            houseNumber: '12',
            postalCode: '8001',
            city: 'Zürich',
            country: 'CH',
          },
        }}
        disabled={false}
        onChange={() => undefined}
        onCommit={onCommit}
        shopDetails
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Add a place' }));
    expect(await screen.findByRole('button', { name: 'Use this place' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Use this place' }));
    setPosition.mockClear();
    markerListeners.get('dragend')?.();
    listeners.get('click')?.({ latLng: { lat: () => 1, lng: () => 2 } });
    expect(setPosition).not.toHaveBeenCalled();
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

  it('hides the panel on the local Sunday', () => {
    document.documentElement.dataset['localSunday'] = '1';
    try {
      renderWithLocale(
        <PlaceField
          place={{ lat: 14.6, lng: 120.98, label: 'Happyland' }}
          disabled={false}
          onChange={() => undefined}
        />,
      );
      fireEvent.click(screen.getByRole('button', { name: 'Add a place' }));
      expect(screen.queryByLabelText('Place name')).toBeNull();
    } finally {
      delete document.documentElement.dataset['localSunday'];
    }
  });

  it('hides an open panel when Sunday starts and rebuilds the map afterwards', async () => {
    stubMaps();
    try {
      renderWithLocale(<PlaceField place={null} disabled={false} onChange={() => undefined} />);
      fireEvent.click(screen.getByRole('button', { name: 'Add a place' }));
      expect(await screen.findByLabelText('Place name')).toBeTruthy();
      const Map = (window as unknown as { google: { maps: { Map: ReturnType<typeof vi.fn> } } })
        .google.maps.Map;
      // Map setup is asynchronous after the dialog and key response are ready.
      await waitFor(() => {
        expect(Map.mock.calls.length).toBeGreaterThan(0);
      });
      const builtOnOpen = Map.mock.calls.length;
      document.documentElement.dataset['localSunday'] = '1';
      await waitFor(() => {
        expect(screen.queryByLabelText('Place name')).toBeNull();
      });
      expect(Map).toHaveBeenCalledTimes(builtOnOpen);
      delete document.documentElement.dataset['localSunday'];
      await waitFor(() => {
        expect(Map.mock.calls.length).toBeGreaterThan(builtOnOpen);
      });
    } finally {
      delete document.documentElement.dataset['localSunday'];
    }
  });

  it('removes a saved place from the open map panel', async () => {
    const onChange = vi.fn();
    stubMaps();
    renderWithLocale(
      <PlaceField
        place={{ lat: 14.6, lng: 120.98, label: 'Happyland' }}
        disabled={false}
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

  it('triggers a map resize when the map box shrinks', async () => {
    const previous = globalThis.ResizeObserver;
    let resizeCallback: ResizeObserverCallback | undefined;
    class FakeResizeObserver {
      constructor(callback: ResizeObserverCallback) {
        resizeCallback = callback;
      }

      observe(): void {}

      unobserve(): void {}

      disconnect(): void {}
    }
    globalThis.ResizeObserver = FakeResizeObserver as unknown as typeof ResizeObserver;
    try {
      stubMaps();
      renderWithLocale(<PlaceField place={null} disabled={false} onChange={() => undefined} />);
      fireEvent.click(screen.getByRole('button', { name: 'Add a place' }));
      const Map = (window as unknown as { google: { maps: { Map: ReturnType<typeof vi.fn> } } })
        .google.maps.Map;
      await waitFor(() => {
        expect(Map).toHaveBeenCalled();
      });
      resizeCallback?.([], {} as ResizeObserver);
      const trigger = (
        window as unknown as {
          google: { maps: { event: { trigger: ReturnType<typeof vi.fn> } } };
        }
      ).google.maps.event.trigger;
      const created = Map.mock.results[0];
      expect(created).toBeDefined();
      if (created === undefined) {
        return;
      }
      expect(trigger).toHaveBeenCalledWith(created.value, 'resize');
    } finally {
      globalThis.ResizeObserver = previous;
    }
  });

  function fillShopAddress(name = "Kiki's Bakery"): void {
    fireEvent.change(screen.getByLabelText('Shop name'), { target: { value: name } });
    fireEvent.change(screen.getByLabelText('Street'), { target: { value: 'Bahnhofstrasse' } });
    fireEvent.change(screen.getByLabelText('House number'), { target: { value: '12' } });
    fireEvent.change(screen.getByLabelText('Postal code'), { target: { value: '8001' } });
    fireEvent.change(screen.getByLabelText('City'), { target: { value: 'Zürich' } });
    fireEvent.change(screen.getByLabelText('Country'), { target: { value: 'CH' } });
  }

  it('keeps translated field capitalization in the missing-fields summary', async () => {
    stubMaps();
    renderWithLocale(
      <PlaceField place={null} disabled={false} onChange={() => undefined} shopDetails />,
      'de',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Ort hinzufügen' }));
    expect(await screen.findByRole('dialog', { name: 'Ort und Adresse des Shops' })).toBeTruthy();
    expect(
      screen.getByText(
        'Setzen Sie die Markierung auf der Karte oben. Füllen Sie aus: Shop-Name, Strasse, Hausnummer, Postleitzahl, Ort, Land.',
      ),
    ).toBeTruthy();
  });

  it('collects a shop name and address before Use this place is enabled', async () => {
    const onChange = vi.fn();
    const listeners = stubMaps();
    renderWithLocale(<PlaceField place={null} disabled={false} onChange={onChange} shopDetails />);
    fireEvent.click(screen.getByRole('button', { name: 'Add a place' }));
    await waitFor(() => {
      expect(listeners.has('click')).toBe(true);
    });
    listeners.get('click')?.({ latLng: { lat: () => 47.3769, lng: () => 8.5417 } });
    expect(screen.queryByLabelText('Place name')).toBeNull();
    const shopName = screen.getByLabelText('Shop name', { exact: true });
    expect(shopName).toBeTruthy();
    const shopNameLabel = screen.getByText('Shop name', { selector: 'label', exact: true });
    expect((shopNameLabel as HTMLLabelElement).htmlFor).toBe(shopName.id);
    expect(shopName.id.length).toBeGreaterThan(0);
    expect(shopName.parentElement?.tagName).toBe('DIV');
    expect(shopName.hasAttribute('required')).toBe(true);
    expect(shopName.hasAttribute('maxlength')).toBe(false);
    const map = document.querySelector('.h-64') as HTMLElement;
    const mapTokens = map.className.split(/\s+/);
    expect(mapTokens).toContain('h-64');
    expect(mapTokens).toContain('min-h-64');
    expect(mapTokens).not.toContain('min-h-0');
    const port = shopName.closest('[data-scrollport]') as HTMLElement;
    expect(port.className.split(/\s+/)).toContain('min-h-0');
    expect(
      screen.getByText("A short name, for example “Kiki's Bakery”. Not the address."),
    ).toBeTruthy();
    const confirm = await screen.findByRole('button', { name: 'Use this place' });
    expect(confirm.hasAttribute('disabled')).toBe(true);
    expect(screen.queryByText('Enter the shop name.')).toBeNull();
    expect(screen.getByText(/Fill in: Shop name/)).toBeTruthy();
    fireEvent.blur(shopName);
    const requiredName = screen.getByText('Enter the shop name.');
    expect(shopName.getAttribute('aria-invalid')).toBe('true');
    expect(shopName.getAttribute('aria-describedby')).toContain(requiredName.id);
    fireEvent.change(shopName, { target: { value: 'x'.repeat(81) } });
    expect(screen.getByText('The shop name must be at most 80 characters.')).toBeTruthy();
    fireEvent.change(shopName, { target: { value: 'Kiki\u0001' } });
    expect(screen.getByText('The shop name must not contain control characters.')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Shop name'), { target: { value: "Kiki's Bakery" } });
    expect(
      screen.getByText(/Fill in: Street, House number, Postal code, City, Country/),
    ).toBeTruthy();
    expect(confirm.hasAttribute('disabled')).toBe(true);
    fireEvent.change(screen.getByLabelText('Street'), { target: { value: 'Bahnhofstrasse' } });
    expect(screen.getByText(/Fill in: House number/)).toBeTruthy();
    fillShopAddress('Bahnhofstrasse Bakery');
    expect(
      screen.getByText('The shop name must not contain the street or the postal code.'),
    ).toBeTruthy();
    expect(confirm.hasAttribute('disabled')).toBe(true);
    fillShopAddress();
    expect(confirm.hasAttribute('disabled')).toBe(false);
    fireEvent.click(confirm);
    expect(onChange).toHaveBeenCalledWith({
      lat: 47.3769,
      lng: 8.5417,
      label: "Kiki's Bakery",
      address: {
        street: 'Bahnhofstrasse',
        houseNumber: '12',
        postalCode: '8001',
        city: 'Zürich',
        country: 'CH',
      },
    });
  });

  it('shows each touched address rule at its field before confirmation', async () => {
    const listeners = stubMaps();
    renderWithLocale(
      <PlaceField place={null} disabled={false} onChange={() => undefined} shopDetails />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Add a place' }));
    expect(await screen.findByRole('dialog', { name: 'Shop place and address' })).toBeTruthy();
    expect(screen.getByText('Tap the map to set the pin.')).toBeTruthy();
    await waitFor(() => {
      expect(listeners.has('click')).toBe(true);
    });
    listeners.get('click')?.({ latLng: { lat: () => 47.3769, lng: () => 8.5417 } });
    fireEvent.change(screen.getByLabelText('Shop name'), { target: { value: "Kiki's Bakery" } });
    fireEvent.blur(screen.getByLabelText('Street'));
    expect(screen.getByText('Enter the street (1–120 characters).')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Street'), { target: { value: 'Bahnhofstrasse' } });
    fireEvent.change(screen.getByLabelText('House number'), { target: { value: 'abc' } });
    fireEvent.change(screen.getByLabelText('Postal code'), { target: { value: '80' } });
    fireEvent.change(screen.getByLabelText('City'), { target: { value: '1234' } });
    fireEvent.change(screen.getByLabelText('Country'), { target: { value: 'CH' } });
    const house = screen.getByLabelText('House number');
    const postal = screen.getByLabelText('Postal code');
    const city = screen.getByLabelText('City');
    expect(
      screen.getByText('The house number must start with a digit, for example 12 or 12a.'),
    ).toBeTruthy();
    expect(
      screen.getByText('The postal code must have 4 digits for Switzerland and Liechtenstein.'),
    ).toBeTruthy();
    expect(screen.getByText('The city must contain a letter.')).toBeTruthy();
    expect(screen.getByText('Fix: House number, Postal code, City.')).toBeTruthy();
    expect(house.getAttribute('aria-invalid')).toBe('true');
    expect(postal.getAttribute('aria-invalid')).toBe('true');
    expect(city.getAttribute('aria-invalid')).toBe('true');
    expect(screen.getByRole('button', { name: 'Use this place' })).toHaveProperty('disabled', true);
  });

  it('prefills shop fields from an existing pin', async () => {
    stubMaps();
    renderWithLocale(
      <PlaceField
        place={{
          lat: 47.3769,
          lng: 8.5417,
          label: "Kiki's Bakery",
          address: {
            street: 'Bahnhofstrasse',
            houseNumber: '12',
            postalCode: '8001',
            city: 'Zürich',
            country: 'CH',
          },
        }}
        disabled={false}
        onChange={() => undefined}
        shopDetails
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Add a place' }));
    expect(await screen.findByLabelText('Shop name')).toHaveProperty('value', "Kiki's Bakery");
    expect(screen.getByLabelText('Street')).toHaveProperty('value', 'Bahnhofstrasse');
    expect(screen.getByLabelText('Country')).toHaveProperty('value', 'CH');
    expect(screen.getByRole('button', { name: 'Use this place' }).hasAttribute('disabled')).toBe(
      false,
    );
  });

  it('links a live name-versus-text problem to the shop name and blocks confirmation', async () => {
    stubMaps();
    renderWithLocale(
      <PlaceField
        place={{
          lat: 47.3769,
          lng: 8.5417,
          label: "Kiki's Bakery",
          address: {
            street: 'Bahnhofstrasse',
            houseNumber: '12',
            postalCode: '8001',
            city: 'Zürich',
            country: 'CH',
          },
        }}
        disabled={false}
        onChange={() => undefined}
        shopDetails
        shopText={'Fresh bread every morning.\n\n#21GiftsShop'}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Add a place' }));
    const name = await screen.findByLabelText('Shop name');
    fireEvent.change(name, { target: { value: 'Fresh bread every morning.' } });
    const message = screen.getByText(
      'The shop name must be shorter than the shop text. Shorten the name or edit the shop text first.',
    );
    expect(name.getAttribute('aria-invalid')).toBe('true');
    expect(name.getAttribute('aria-describedby')).toContain(message.id);
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByText('Fix: Shop name.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Use this place' })).toHaveProperty('disabled', true);
  });

  it('compares the shop text with the trimmed name that will be committed', async () => {
    stubMaps();
    renderWithLocale(
      <PlaceField
        place={{
          lat: 47.3769,
          lng: 8.5417,
          label: 'Original',
          address: {
            street: 'Bahnhofstrasse',
            houseNumber: '12',
            postalCode: '8001',
            city: 'Zürich',
            country: 'CH',
          },
        }}
        disabled={false}
        onChange={() => undefined}
        shopDetails
        shopText="12345678901234567890"
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Add a place' }));
    const name = await screen.findByLabelText('Shop name');
    fireEvent.change(name, { target: { value: '1234567890123456789  ' } });
    expect(
      screen.queryByText(
        'The shop name must be shorter than the shop text. Shorten the name or edit the shop text first.',
      ),
    ).toBeNull();
    expect(screen.getByRole('button', { name: 'Use this place' })).toHaveProperty(
      'disabled',
      false,
    );
  });

  it('announces a reported name error with the current live text until the name is edited', async () => {
    stubMaps();
    renderWithLocale(
      <PlaceField
        place={{
          lat: 47.3769,
          lng: 8.5417,
          label: 'Kiki\u0001',
          address: {
            street: 'Bahnhofstrasse',
            houseNumber: '12',
            postalCode: '8001',
            city: 'Zürich',
            country: 'CH',
          },
        }}
        disabled={false}
        onChange={() => undefined}
        shopDetails
        problem="shopName"
      />,
    );
    const name = await screen.findByLabelText('Shop name');
    const message = screen.getByText('The shop name must not contain control characters.');
    expect(screen.queryByText('Enter the shop name.')).toBeNull();
    // The reported problem is announced with the current live text until the name is edited.
    expect(screen.getByRole('alert')).toBe(message);
    expect(name.getAttribute('aria-describedby')).toContain(message.id);
    fireEvent.change(name, { target: { value: 'Kiki\u0002' } });
    expect(screen.queryByRole('alert')).toBeNull();
    expect(
      screen.getByText('The shop name must not contain control characters.').getAttribute('role'),
    ).toBeNull();
  });

  it.each([
    ['shopNameAddress', 'Shop name'],
    ['placeAddress', 'Street'],
  ] as const)(
    'focuses the field a server problem names when it opens the dialog: %s',
    async (problem, label) => {
      stubMaps();
      renderWithLocale(
        <PlaceField
          place={{
            lat: 47.3769,
            lng: 8.5417,
            label: 'Bahnhofstrasse Bakery',
            address: {
              street: 'Bahnhofstrasse',
              houseNumber: '12',
              postalCode: '8001',
              city: 'Zürich',
              country: 'CH',
            },
          }}
          disabled={false}
          onChange={() => undefined}
          shopDetails
          problem={problem}
        />,
      );
      const field = await screen.findByLabelText(label, { selector: 'input' });
      await waitFor(() => {
        expect(document.activeElement).toBe(field);
      });
    },
  );

  it.each([
    ['placeAddress', 'The address is invalid.'],
    ['shopNameAddress', 'The shop name must not contain the street or the postal code.'],
  ] as const)(
    'keeps a server reason when the visitor reopens the dialog: %s',
    async (problem, reason) => {
      stubMaps();
      renderWithLocale(
        <PlaceField
          place={{
            lat: 47.3769,
            lng: 8.5417,
            label: 'Bahnhofstrasse Bakery',
            address: {
              street: 'Bahnhofstrasse',
              houseNumber: '12',
              postalCode: '8001',
              city: 'Zürich',
              country: 'CH',
            },
          }}
          disabled={false}
          onChange={() => undefined}
          shopDetails
          problem={problem}
        />,
      );
      const dialog = await screen.findByRole('dialog');
      fireEvent.keyDown(dialog, { key: 'Escape' });
      await waitFor(() => {
        expect(screen.queryByRole('dialog')).toBeNull();
      });
      fireEvent.click(screen.getByRole('button', { name: 'Add a place' }));
      await screen.findByRole('dialog');
      expect(screen.getAllByText(new RegExp(reason.replace('.', '\\.'))).length).toBeGreaterThan(0);
      expect(screen.getByRole('button', { name: 'Use this place' })).toHaveProperty(
        'disabled',
        true,
      );
    },
  );

  it('opens without a reason when the reported problem is not about the place', async () => {
    stubMaps();
    renderWithLocale(
      <PlaceField
        place={null}
        disabled={false}
        onChange={() => undefined}
        shopDetails
        problem="shopDescription"
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Add a place' }));
    await screen.findByRole('dialog');
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('offers Remove place in a shop dialog only when it saves the place itself', async () => {
    stubMaps();
    const place = {
      lat: 47.3769,
      lng: 8.5417,
      label: "Kiki's Bakery",
      address: {
        street: 'Bahnhofstrasse',
        houseNumber: '12',
        postalCode: '8001',
        city: 'Zürich',
        country: 'CH',
      },
    };
    const wizard = renderWithLocale(
      <PlaceField place={place} disabled={false} onChange={() => undefined} shopDetails />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Add a place' }));
    await screen.findByRole('dialog');
    expect(screen.queryByRole('button', { name: 'Remove place' })).toBeNull();
    wizard.unmount();
    renderWithLocale(
      <PlaceField
        place={place}
        disabled={false}
        onChange={() => undefined}
        onCommit={() => Promise.resolve()}
        shopDetails
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Add a place' }));
    await screen.findByRole('dialog');
    expect(screen.getByRole('button', { name: 'Remove place' })).toBeTruthy();
  });

  it('returns focus to the place button after a dialog opened by a server problem', async () => {
    stubMaps();
    renderWithLocale(
      <PlaceField
        place={null}
        disabled={false}
        onChange={() => undefined}
        shopDetails
        problem="shopAddress"
      />,
    );
    const dialog = await screen.findByRole('dialog');
    fireEvent.keyDown(dialog, { key: 'Escape' });
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Add a place' }));
  });

  it.each([
    ['short', 'Too short'],
    ['long', 'x'.repeat(1001)],
  ])(
    'requires editing shop text outside 20–1000 characters before changing the name: %s',
    async (_case, shopText) => {
      stubMaps();
      renderWithLocale(
        <PlaceField
          place={{
            lat: 47.3769,
            lng: 8.5417,
            label: "Kiki's Bakery",
            address: {
              street: 'Bahnhofstrasse',
              houseNumber: '12',
              postalCode: '8001',
              city: 'Zürich',
              country: 'CH',
            },
          }}
          disabled={false}
          onChange={() => undefined}
          shopDetails
          shopText={shopText}
        />,
      );
      fireEvent.click(screen.getByRole('button', { name: 'Add a place' }));
      const name = await screen.findByLabelText('Shop name');
      const message = screen.getByText(
        'The shop text must be 20 to 1000 characters before this place can be saved. Edit the shop text first.',
      );
      expect(name.getAttribute('aria-invalid')).toBe('true');
      expect(name.getAttribute('aria-describedby')).toContain(message.id);
      expect(screen.queryByRole('alert')).toBeNull();
      expect(screen.queryByText('Fix: Shop name.')).toBeNull();
      expect(screen.getByText('Edit the shop text first.')).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Use this place' })).toHaveProperty(
        'disabled',
        true,
      );
    },
  );

  it('reopens a known server name problem at the field and blocks confirmation', async () => {
    stubMaps();
    const pin = {
      lat: 47.3769,
      lng: 8.5417,
      label: "Kiki's Bakery",
      address: {
        street: 'Bahnhofstrasse',
        houseNumber: '12',
        postalCode: '8001',
        city: 'Zürich',
        country: 'CH',
      },
    };
    renderWithLocale(
      <PlaceField
        place={pin}
        disabled={false}
        onChange={() => undefined}
        shopDetails
        problem="shopName"
      />,
    );
    const name = await screen.findByLabelText('Shop name');
    const message = screen.getByText('Enter the shop name.');
    expect(name.getAttribute('aria-invalid')).toBe('true');
    expect(name.getAttribute('aria-describedby')).toContain(message.id);
    expect(screen.getByRole('button', { name: 'Use this place' })).toHaveProperty('disabled', true);
  });

  it.each([
    ['Shop name is required', 'Enter the shop name.'],
    [
      'Shop name must not contain the address',
      'The shop name must not contain the street or the postal code.',
    ],
    [
      'Shop address is required',
      'Enter the full address: street, house number, postal code, city and country.',
    ],
    [
      'Shop description must be 20 to 1000 characters and longer than the shop name',
      'The shop name must be shorter than the shop text. Shorten the name or edit the shop text first.',
    ],
    [
      'Place address is invalid',
      'The address is invalid. The house number must start with a digit, the postal code must have 4 digits in Switzerland and Liechtenstein, the city must contain a letter, and the country must be chosen from the list.',
    ],
    ['boom', 'The place could not be saved. Please try again.'],
  ])('maps shop commit error %s', async (apiMessage, localized) => {
    const onCommit = vi.fn().mockRejectedValue(new Error(apiMessage));
    const listeners = stubMaps();
    renderWithLocale(
      <PlaceField
        place={null}
        disabled={false}
        onChange={() => undefined}
        onCommit={onCommit}
        shopDetails
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Add a place' }));
    await waitFor(() => {
      expect(listeners.has('click')).toBe(true);
    });
    listeners.get('click')?.({ latLng: { lat: () => 47.3769, lng: () => 8.5417 } });
    fillShopAddress();
    fireEvent.click(screen.getByRole('button', { name: 'Use this place' }));
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toBe(localized);
    if (apiMessage.startsWith('Shop name')) {
      const name = screen.getByLabelText('Shop name');
      expect(alert.tagName).toBe('SPAN');
      expect(alert.id).toBe(`${name.id}-error`);
      expect(name.getAttribute('aria-describedby')).toContain(alert.id);
      await waitFor(() => {
        expect(document.activeElement).toBe(name);
      });
    }
  });

  it('focuses the first invalid address field after a mapped address rejection', async () => {
    let rejectCommit!: (reason?: unknown) => void;
    const onCommit = vi.fn(
      () =>
        new Promise<void>((_resolve, reject) => {
          rejectCommit = reject;
        }),
    );
    const listeners = stubMaps();
    renderWithLocale(
      <PlaceField
        place={null}
        disabled={false}
        onChange={() => undefined}
        onCommit={onCommit}
        shopDetails
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Add a place' }));
    await waitFor(() => {
      expect(listeners.has('click')).toBe(true);
    });
    listeners.get('click')?.({ latLng: { lat: () => 47.3769, lng: () => 8.5417 } });
    fillShopAddress();
    fireEvent.click(screen.getByRole('button', { name: 'Use this place' }));
    const houseNumber = screen.getByLabelText('House number');
    houseNumber.setAttribute('aria-invalid', 'true');
    await act(async () => {
      rejectCommit(new Error('Place address is invalid'));
    });
    expect((await screen.findByRole('alert')).textContent).toContain('The address is invalid.');
    await waitFor(() => {
      expect(document.activeElement).toBe(houseNumber);
    });
  });

  it('keeps focus in a dialog without address fields after a mapped rejection', async () => {
    let rejectCommit!: (reason?: unknown) => void;
    const onCommit = vi.fn(
      () =>
        new Promise<void>((_resolve, reject) => {
          rejectCommit = reject;
        }),
    );
    const listeners = stubMaps();
    renderWithLocale(
      <PlaceField place={null} disabled={false} onChange={() => undefined} onCommit={onCommit} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Add a place' }));
    await waitFor(() => {
      expect(listeners.has('click')).toBe(true);
    });
    listeners.get('click')?.({ latLng: { lat: () => 47.3769, lng: () => 8.5417 } });
    fireEvent.change(screen.getByLabelText('Place name'), { target: { value: 'Stall' } });
    fireEvent.click(screen.getByRole('button', { name: 'Use this place' }));
    await act(async () => {
      rejectCommit(new Error('Place address is invalid'));
    });
    const dialog = await screen.findByRole('dialog');
    await waitFor(() => {
      expect(document.activeElement).not.toBe(document.body);
      expect(dialog.contains(document.activeElement)).toBe(true);
    });
  });

  it('focuses Street after an address rejection that marks no field', async () => {
    let rejectCommit!: (reason?: unknown) => void;
    const onCommit = vi.fn(
      () =>
        new Promise<void>((_resolve, reject) => {
          rejectCommit = reject;
        }),
    );
    const listeners = stubMaps();
    renderWithLocale(
      <PlaceField
        place={null}
        disabled={false}
        onChange={() => undefined}
        onCommit={onCommit}
        shopDetails
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Add a place' }));
    await waitFor(() => {
      expect(listeners.has('click')).toBe(true);
    });
    listeners.get('click')?.({ latLng: { lat: () => 47.3769, lng: () => 8.5417 } });
    fillShopAddress();
    fireEvent.click(screen.getByRole('button', { name: 'Use this place' }));
    const street = screen.getByLabelText('Street');
    await act(async () => {
      rejectCommit(new Error('Place address is invalid'));
    });
    expect((await screen.findByRole('alert')).textContent).toContain('The address is invalid.');
    await waitFor(() => {
      expect(document.activeElement).toBe(street);
    });
  });

  it('keeps Street unfocused after a rejection that is not about the address', async () => {
    const onCommit = vi.fn().mockRejectedValue(new Error('No account with that username'));
    const listeners = stubMaps();
    renderWithLocale(
      <PlaceField
        place={null}
        disabled={false}
        onChange={() => undefined}
        onCommit={onCommit}
        shopDetails
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Add a place' }));
    await waitFor(() => {
      expect(listeners.has('click')).toBe(true);
    });
    listeners.get('click')?.({ latLng: { lat: () => 47.3769, lng: () => 8.5417 } });
    fillShopAddress();
    fireEvent.click(screen.getByRole('button', { name: 'Use this place' }));
    expect((await screen.findByRole('alert')).textContent).toContain(
      'No account with that username. Check the spelling of the 21.gifts username.',
    );
    const dialog = screen.getByRole('dialog');
    await waitFor(() => {
      expect(document.activeElement).toBe(within(dialog).getByRole('button', { name: 'Close' }));
    });
    expect(document.activeElement).not.toBe(screen.getByLabelText('Street'));
  });

  it('keeps a while-typing footer reason out of the alert live region', async () => {
    stubMaps();
    renderWithLocale(
      <PlaceField place={null} disabled={false} onChange={() => undefined} shopDetails />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Add a place' }));
    const dialog = await screen.findByRole('dialog', { name: 'Shop place and address' });
    const reason = within(dialog).getByText(/Fill in: Shop name/).textContent;
    expect(reason).toContain('Set the pin on the map above.');
    expect(reason).not.toContain('Map pin');
    expect(within(dialog).queryByRole('alert')).toBeNull();
  });

  it('maps a non-Error shop commit rejection to the generic save copy', async () => {
    const onCommit = vi.fn().mockRejectedValue('boom');
    const listeners = stubMaps();
    renderWithLocale(
      <PlaceField
        place={null}
        disabled={false}
        onChange={() => undefined}
        onCommit={onCommit}
        shopDetails
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Add a place' }));
    await waitFor(() => {
      expect(listeners.has('click')).toBe(true);
    });
    listeners.get('click')?.({ latLng: { lat: () => 47.3769, lng: () => 8.5417 } });
    fillShopAddress();
    fireEvent.click(screen.getByRole('button', { name: 'Use this place' }));
    expect((await screen.findByRole('alert')).textContent).toContain(
      'The place could not be saved. Please try again.',
    );
  });

  it('clears a mapped save error when the shop name changes', async () => {
    const onCommit = vi.fn().mockRejectedValue(new Error('Shop name is required'));
    const listeners = stubMaps();
    renderWithLocale(
      <PlaceField
        place={null}
        disabled={false}
        onChange={() => undefined}
        onCommit={onCommit}
        shopDetails
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Add a place' }));
    await waitFor(() => {
      expect(listeners.has('click')).toBe(true);
    });
    listeners.get('click')?.({ latLng: { lat: () => 47.3769, lng: () => 8.5417 } });
    fillShopAddress();
    fireEvent.click(screen.getByRole('button', { name: 'Use this place' }));
    expect(await screen.findByText('Enter the shop name.')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Shop name'), { target: { value: "Kiki's Cafe" } });
    expect(screen.queryByText('Enter the shop name.')).toBeNull();
  });

  it('clears a mapped save error when an address field changes', async () => {
    const onCommit = vi.fn().mockRejectedValue(new Error('Shop name is required'));
    const listeners = stubMaps();
    renderWithLocale(
      <PlaceField
        place={null}
        disabled={false}
        onChange={() => undefined}
        onCommit={onCommit}
        shopDetails
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Add a place' }));
    await waitFor(() => {
      expect(listeners.has('click')).toBe(true);
    });
    listeners.get('click')?.({ latLng: { lat: () => 47.3769, lng: () => 8.5417 } });
    fillShopAddress();
    fireEvent.click(screen.getByRole('button', { name: 'Use this place' }));
    expect(await screen.findByText('Enter the shop name.')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Street'), { target: { value: 'Limmatquai' } });
    expect(screen.queryByText('Enter the shop name.')).toBeNull();
  });

  it('clears a mapped save error when the panel is reopened', async () => {
    const onCommit = vi.fn().mockRejectedValue(new Error('Shop name is required'));
    const listeners = stubMaps();
    renderWithLocale(
      <PlaceField
        place={null}
        disabled={false}
        onChange={() => undefined}
        onCommit={onCommit}
        shopDetails
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Add a place' }));
    await waitFor(() => {
      expect(listeners.has('click')).toBe(true);
    });
    listeners.get('click')?.({ latLng: { lat: () => 47.3769, lng: () => 8.5417 } });
    fillShopAddress();
    fireEvent.click(screen.getByRole('button', { name: 'Use this place' }));
    expect(await screen.findByText('Enter the shop name.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Add a place' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add a place' }));
    await waitFor(() => {
      expect(screen.getByLabelText('Shop name')).toBeTruthy();
    });
    expect(screen.queryByText('Enter the shop name.')).toBeNull();
  });

  it('clears a save error when the place name changes', async () => {
    const onCommit = vi.fn().mockRejectedValue(new Error('denied'));
    const listeners = stubMaps();
    renderWithLocale(
      <PlaceField place={null} disabled={false} onChange={() => undefined} onCommit={onCommit} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Add a place' }));
    await waitFor(() => {
      expect(listeners.has('click')).toBe(true);
    });
    listeners.get('click')?.({ latLng: { lat: () => 14.6, lng: () => 120.98 } });
    fireEvent.click(await screen.findByRole('button', { name: 'Use this place' }));
    expect(await screen.findByRole('alert')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Place name'), { target: { value: 'Stall' } });
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('shows a mapped shop 400 on the unavailable panel when removing a pin fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ key: null })));
    const onCommit = vi.fn().mockRejectedValue(new Error('Shop name is required'));
    renderWithLocale(
      <PlaceField
        place={{ lat: 1, lng: 2, label: 'Stall' }}
        disabled={false}
        ariaLabel="Edit place"
        onChange={() => undefined}
        onCommit={onCommit}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Edit place' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Remove place' }));
    expect(await screen.findByText('Enter the shop name.')).toBeTruthy();
    const remove = screen.getByRole('button', { name: 'Remove place' });
    await waitFor(() => {
      expect(document.activeElement).toBe(remove);
    });
    expect(screen.getByText('The map is not available.')).toBeTruthy();
  });

  it('gives each shop-mode instance distinct ids that match their own labels', async () => {
    stubMaps();
    const pin = {
      lat: 47.3769,
      lng: 8.5417,
      label: "Kiki's Bakery",
      address: {
        street: 'Bahnhofstrasse',
        houseNumber: '12',
        postalCode: '8001',
        city: 'Zürich',
        country: 'CH',
      },
    };
    renderWithLocale(
      <>
        <PlaceField place={pin} disabled={false} onChange={() => undefined} shopDetails />
        <PlaceField place={pin} disabled={false} onChange={() => undefined} shopDetails />
      </>,
    );
    const buttons = screen.getAllByRole('button', { name: 'Add a place' });
    expect(buttons).toHaveLength(2);
    fireEvent.click(buttons[0]!);
    fireEvent.click(buttons[1]!);
    await waitFor(() => {
      expect(screen.getAllByLabelText('Shop name')).toHaveLength(2);
    });
    const names = screen.getAllByLabelText('Shop name');
    expect(names[0]!.id).not.toBe(names[1]!.id);
    const ids: string[] = [];
    const allLabels = [...document.querySelectorAll('label')];
    for (const input of names) {
      const label = allLabels.find((node) => (node as HTMLLabelElement).htmlFor === input.id);
      expect(label).toBeTruthy();
      ids.push(input.id);
    }
    const roots = screen.getAllByTestId('shop-address-fields');
    expect(roots).toHaveLength(2);
    for (const root of roots) {
      const labels = root.querySelectorAll('label');
      expect(labels).toHaveLength(5);
      for (const label of labels) {
        const htmlFor = (label as HTMLLabelElement).htmlFor;
        expect(document.getElementById(htmlFor)).not.toBe(null);
        expect(root.contains(document.getElementById(htmlFor))).toBe(true);
        ids.push(htmlFor);
      }
    }
    expect(ids).toHaveLength(12);
    expect(new Set(ids).size).toBe(12);
  });

  it('shows the living-room place limit as the name is typed', async () => {
    renderWithLocale(<PlaceField place={null} disabled={false} onChange={() => undefined} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add a place' }));
    fireEvent.change(await screen.findByLabelText('Place name'), {
      target: { value: 'a'.repeat(81) },
    });
    expect(screen.getByRole('alert').textContent).toBe('Keep the place name to 80 characters');
    expect(
      (screen.getByRole('button', { name: 'Use this place' }) as HTMLButtonElement).disabled,
    ).toBe(true);
  });

  it('keeps a rejected place-label limit on a name the form already accepted', async () => {
    const onCommit = vi.fn().mockRejectedValue(new Error(PLACE_LABEL_API_MESSAGE));
    const listeners = stubMaps();
    renderWithLocale(
      <PlaceField place={null} disabled={false} onChange={() => undefined} onCommit={onCommit} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Add a place' }));
    await waitFor(() => {
      expect(listeners.has('click')).toBe(true);
    });
    listeners.get('click')?.({ latLng: { lat: () => 14.6, lng: () => 120.98 } });
    fireEvent.change(screen.getByLabelText('Place name'), { target: { value: 'Happyland' } });
    fireEvent.click(screen.getByRole('button', { name: 'Use this place' }));
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.getByRole('alert').textContent).toBe('Keep the place name to 80 characters');
    expect(screen.getByRole('button', { name: 'Use this place' })).toBeTruthy();
  });

  it('drops a rejected place-label limit when the dialog opens again', async () => {
    const onCommit = vi.fn().mockRejectedValue(new Error(PLACE_LABEL_API_MESSAGE));
    stubMaps();
    renderWithLocale(
      <PlaceField
        place={{ lat: 14.6, lng: 120.98, label: 'Happyland' }}
        disabled={false}
        onChange={() => undefined}
        onCommit={onCommit}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Add a place' }));
    fireEvent.change(await screen.findByLabelText('Place name'), { target: { value: 'Park' } });
    fireEvent.click(screen.getByRole('button', { name: 'Use this place' }));
    expect((await screen.findByRole('alert')).textContent).toBe(
      'Keep the place name to 80 characters',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add a place' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).queryByRole('alert')).toBeNull();
    expect((within(dialog).getByLabelText('Place name') as HTMLInputElement).value).toBe(
      'Happyland',
    );
    expect(
      (within(dialog).getByRole('button', { name: 'Use this place' }) as HTMLButtonElement)
        .disabled,
    ).toBe(false);
  });
});
