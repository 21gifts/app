import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GoogleMapCanvas } from '@/components/GoogleMapCanvas';

afterEach(() => {
  cleanup();
  document.querySelectorAll('script[data-gmaps="weekly"]').forEach((node) => node.remove());
  delete (window as { google?: unknown }).google;
});

describe('GoogleMapCanvas', () => {
  it('renders a bounded empty frame when there is no maps key', () => {
    render(
      <GoogleMapCanvas
        mapsKey={null}
        points={[{ lat: 47.37, lng: 8.54 }]}
        anchor={{ lat: 47.37, lng: 8.54 }}
        fitAll={false}
        testId="shop-map"
      />,
    );
    const frame = screen.getByTestId('shop-map');
    expect(frame.className).toContain('h-64');
    expect(frame.childElementCount).toBe(0);
  });

  it('does not load a map without both a point and an anchor', () => {
    const empty = render(
      <GoogleMapCanvas
        mapsKey="browser-key"
        points={[]}
        anchor={undefined}
        fitAll={false}
        testId="empty-map"
      />,
    );
    expect(screen.getByTestId('empty-map').childElementCount).toBe(0);
    empty.unmount();

    render(
      <GoogleMapCanvas
        mapsKey="browser-key"
        points={[{ lat: 47.37, lng: 8.54 }]}
        anchor={undefined}
        fitAll={false}
        testId="anchorless-map"
      />,
    );
    expect(screen.getByTestId('anchorless-map').childElementCount).toBe(0);
  });

  it('does not draw when unmounted while the map script loads', async () => {
    const view = render(
      <GoogleMapCanvas
        mapsKey="browser-key"
        points={[{ lat: 47.37, lng: 8.54 }]}
        anchor={{ lat: 47.37, lng: 8.54 }}
        fitAll={false}
        testId="shop-map"
      />,
    );
    const script = document.querySelector('script[data-gmaps="weekly"]');
    expect(script).toBeTruthy();
    view.unmount();
    const Map = vi.fn();
    (window as { google?: unknown }).google = { maps: { Map, Marker: vi.fn() } };
    script?.dispatchEvent(new Event('load'));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(Map).not.toHaveBeenCalled();
  });

  it('loads a fresh script on the next mount after a script error', async () => {
    const props = {
      mapsKey: 'browser-key',
      points: [{ lat: 47.37, lng: 8.54 }],
      anchor: { lat: 47.37, lng: 8.54 },
      fitAll: false,
      testId: 'shop-map',
    };
    const first = render(<GoogleMapCanvas {...props} />);
    const failed = document.querySelector('script[data-gmaps="weekly"]');
    failed?.dispatchEvent(new Event('error'));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(document.querySelector('script[data-gmaps="weekly"]')).toBeNull();
    first.unmount();
    render(<GoogleMapCanvas {...props} />);
    const retry = document.querySelector('script[data-gmaps="weekly"]');
    expect(retry).toBeTruthy();
    expect(retry).not.toBe(failed);
    const Map = vi.fn(() => ({ setCenter: vi.fn() }));
    (window as { google?: unknown }).google = { maps: { Map, Marker: vi.fn() } };
    retry?.dispatchEvent(new Event('load'));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(Map).toHaveBeenCalledTimes(1);
  });

  it('leaves the frame empty when google.maps disappears after the load resolved', async () => {
    let reads = 0;
    Object.defineProperty(window, 'google', {
      configurable: true,
      get() {
        reads += 1;
        return reads === 1 ? { maps: { Map: vi.fn(), Marker: vi.fn() } } : undefined;
      },
    });
    render(
      <GoogleMapCanvas
        mapsKey="browser-key"
        points={[{ lat: 47.37, lng: 8.54 }]}
        anchor={{ lat: 47.37, lng: 8.54 }}
        fitAll={false}
        testId="shop-map"
      />,
    );
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(reads).toBe(2);
    expect(screen.getByTestId('shop-map').childElementCount).toBe(0);
    expect(document.querySelector('script[data-gmaps="weekly"]')).toBeNull();
  });

  it('does not load the map after Google rejected the key', async () => {
    const view = render(
      <GoogleMapCanvas
        mapsKey={null}
        points={[{ lat: 47.37, lng: 8.54 }]}
        anchor={{ lat: 47.37, lng: 8.54 }}
        fitAll={false}
        testId="shop-map"
      />,
    );
    (window as { gm_authFailure?: () => void }).gm_authFailure?.();
    view.rerender(
      <GoogleMapCanvas
        mapsKey="browser-key"
        points={[{ lat: 47.37, lng: 8.54 }]}
        anchor={{ lat: 47.37, lng: 8.54 }}
        fitAll={false}
        testId="shop-map"
      />,
    );
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(document.querySelector('script[data-gmaps="weekly"]')).toBeNull();
  });
});
