import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadGoogleMaps, onGoogleMapsAuthFailure } from '@/lib/google-maps-loader';

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
  delete (window as { gm_authFailure?: unknown }).gm_authFailure;
});

type HookWindow = { gm_authFailure?: () => void };

function reportAuthFailure(): void {
  (window as HookWindow).gm_authFailure?.();
}

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

  it('rejects on a script error, removes that script, and retries with a fresh one', async () => {
    const first = loadGoogleMaps('k');
    const [failed] = scripts();
    failed?.dispatchEvent(new Event('error'));
    await expect(first).rejects.toThrow('map');
    expect(failed?.isConnected).toBe(false);
    expect(scripts()).toHaveLength(0);
    const retry = loadGoogleMaps('k');
    expect(retry).not.toBe(first);
    const [script, ...rest] = scripts();
    expect(rest).toHaveLength(0);
    expect(script).not.toBe(failed);
    installMaps();
    script?.dispatchEvent(new Event('load'));
    await expect(retry).resolves.toBeUndefined();
  });

  it('keeps a load without google.maps failed, even after a later error event', async () => {
    const pending = loadGoogleMaps('k');
    const [script] = scripts();
    script?.dispatchEvent(new Event('load'));
    await expect(pending).rejects.toThrow('map');
    expect(script?.dataset['gmapsState']).toBe('error');
    script?.dispatchEvent(new Event('error'));
    expect(scripts()).toEqual([script]);
    await expect(loadGoogleMaps('k')).rejects.toThrow('map');
    expect(scripts()).toEqual([script]);
  });

  it('replaces a script it did not add, whose events may already have fired', async () => {
    const existing = document.createElement('script');
    existing.dataset['gmaps'] = 'weekly';
    existing.src = 'https://maps.googleapis.com/maps/api/js?key=first&v=weekly';
    document.head.appendChild(existing);
    const pending = loadGoogleMaps('second');
    expect(existing.isConnected).toBe(false);
    const [script, ...rest] = scripts();
    expect(rest).toHaveLength(0);
    expect(script).not.toBe(existing);
    expect(script?.src).toBe('https://maps.googleapis.com/maps/api/js?key=second&v=weekly');
    installMaps();
    script?.dispatchEvent(new Event('load'));
    await expect(pending).resolves.toBeUndefined();
  });

  it('rejects at once for a script on the page that is marked failed', async () => {
    const existing = document.createElement('script');
    existing.dataset['gmaps'] = 'weekly';
    existing.dataset['gmapsState'] = 'error';
    document.head.appendChild(existing);
    await expect(loadGoogleMaps('k')).rejects.toThrow('map');
    expect(scripts()).toEqual([existing]);
  });

  it('adds a fresh script after the failed one was removed', async () => {
    const failed = loadGoogleMaps('k');
    scripts()[0]?.dispatchEvent(new Event('load'));
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

describe('onGoogleMapsAuthFailure', () => {
  it('installs one hook and tells both subscribers', () => {
    installMaps();
    const canvas = vi.fn();
    const field = vi.fn();
    const stopCanvas = onGoogleMapsAuthFailure(canvas);
    const hook = (window as HookWindow).gm_authFailure;
    const stopField = onGoogleMapsAuthFailure(field);
    expect((window as HookWindow).gm_authFailure).toBe(hook);
    reportAuthFailure();
    expect(canvas).toHaveBeenCalledTimes(1);
    expect(field).toHaveBeenCalledTimes(1);
    stopCanvas();
    stopField();
  });

  it('stops calling a listener after unsubscribe', () => {
    installMaps();
    const gone = vi.fn();
    const kept = vi.fn();
    const stop = onGoogleMapsAuthFailure(gone);
    const stopKept = onGoogleMapsAuthFailure(kept);
    stop();
    reportAuthFailure();
    expect(gone).not.toHaveBeenCalled();
    expect(kept).toHaveBeenCalledTimes(1);
    stopKept();
  });

  it('tells a late subscriber at once about a failure for the same google.maps', () => {
    installMaps();
    const early = onGoogleMapsAuthFailure(() => undefined);
    reportAuthFailure();
    early();
    const late = vi.fn();
    const stop = onGoogleMapsAuthFailure(late);
    expect(late).toHaveBeenCalledTimes(1);
    stop();
    installMaps();
    const fresh = vi.fn();
    const stopFresh = onGoogleMapsAuthFailure(fresh);
    expect(fresh).not.toHaveBeenCalled();
    stopFresh();
  });

  it('passes on a report before google.maps exists without remembering it', () => {
    const early = vi.fn();
    const stop = onGoogleMapsAuthFailure(early);
    reportAuthFailure();
    expect(early).toHaveBeenCalledTimes(1);
    stop();
    const late = vi.fn();
    const stopLate = onGoogleMapsAuthFailure(late);
    expect(late).not.toHaveBeenCalled();
    stopLate();
  });

  it('puts its hook back when another script replaced it, and loadGoogleMaps installs it too', () => {
    installMaps();
    const listener = vi.fn();
    const stop = onGoogleMapsAuthFailure(listener);
    const foreign = vi.fn();
    (window as HookWindow).gm_authFailure = foreign;
    void loadGoogleMaps('k');
    expect((window as HookWindow).gm_authFailure).not.toBe(foreign);
    reportAuthFailure();
    expect(foreign).not.toHaveBeenCalled();
    expect(listener).toHaveBeenCalledTimes(1);
    stop();
  });
});
