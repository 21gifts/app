import { afterEach, describe, expect, it } from 'vitest';
import { loadGoogleMaps } from '@/lib/google-maps-loader';

const SELECTOR = 'script[data-gmaps="weekly"]';

function scripts(): HTMLScriptElement[] {
  return Array.from(document.querySelectorAll<HTMLScriptElement>(SELECTOR));
}

function installMaps(): void {
  (window as { google?: unknown }).google = { maps: {} };
}

afterEach(() => {
  scripts().forEach((node) => {
    node.remove();
  });
  delete (window as { google?: unknown }).google;
});

describe('loadGoogleMaps', () => {
  it('resolves at once without a script when google.maps already exists', async () => {
    installMaps();
    await expect(loadGoogleMaps('k')).resolves.toBeUndefined();
    expect(scripts()).toHaveLength(0);
  });

  it('shares one script and one promise between two calls before the load event', async () => {
    const first = loadGoogleMaps('a b');
    const second = loadGoogleMaps('other');
    expect(second).toBe(first);
    const [script, ...rest] = scripts();
    expect(rest).toHaveLength(0);
    expect(script?.src).toBe('https://maps.googleapis.com/maps/api/js?key=a%20b&v=weekly');
    expect(script?.async).toBe(true);
    installMaps();
    script?.dispatchEvent(new Event('load'));
    await expect(first).resolves.toBeUndefined();
    await expect(second).resolves.toBeUndefined();
  });

  it('rejects on a script error and keeps that script failed while it is on the page', async () => {
    const first = loadGoogleMaps('k');
    const [script] = scripts();
    script?.dispatchEvent(new Event('error'));
    await expect(first).rejects.toThrow('map');
    expect(script?.dataset['gmapsState']).toBe('error');
    await expect(loadGoogleMaps('k')).rejects.toThrow('map');
    expect(scripts()).toHaveLength(1);
  });

  it('rejects a load that does not install google.maps', async () => {
    const pending = loadGoogleMaps('k');
    const [script] = scripts();
    script?.dispatchEvent(new Event('load'));
    await expect(pending).rejects.toThrow('map');
    expect(script?.dataset['gmapsState']).toBe('error');
  });

  it('adopts a script already on the page and keeps its key', async () => {
    const existing = document.createElement('script');
    existing.dataset['gmaps'] = 'weekly';
    existing.src = 'https://maps.googleapis.com/maps/api/js?key=first&v=weekly';
    document.head.appendChild(existing);
    const pending = loadGoogleMaps('second');
    expect(scripts()).toEqual([existing]);
    expect(existing.src).toContain('key=first');
    installMaps();
    existing.dispatchEvent(new Event('load'));
    await expect(pending).resolves.toBeUndefined();
  });

  it('rejects at once for a script on the page that already failed', async () => {
    const existing = document.createElement('script');
    existing.dataset['gmaps'] = 'weekly';
    existing.dataset['gmapsState'] = 'error';
    document.head.appendChild(existing);
    await expect(loadGoogleMaps('k')).rejects.toThrow('map');
    expect(scripts()).toEqual([existing]);
  });

  it('adds a fresh script after the failed one was removed', async () => {
    const failed = loadGoogleMaps('k');
    scripts()[0]?.dispatchEvent(new Event('error'));
    await expect(failed).rejects.toThrow('map');
    scripts().forEach((node) => {
      node.remove();
    });
    const retry = loadGoogleMaps('k');
    const [script, ...rest] = scripts();
    expect(rest).toHaveLength(0);
    expect(script?.dataset['gmapsState']).toBeUndefined();
    installMaps();
    script?.dispatchEvent(new Event('load'));
    await expect(retry).resolves.toBeUndefined();
  });
});
