/** Selector of the one Maps JavaScript API script on the page. */
const GOOGLE_MAPS_SCRIPT_SELECTOR = 'script[data-gmaps="weekly"]';

type MapsWindow = Window & { google?: { maps?: unknown } };

/** The script this module watches and the promise every caller shares. */
let pending: { script: HTMLScriptElement; promise: Promise<void> } | null = null;

/**
 * Load the Maps JavaScript API once per page for every caller.
 *
 * `GoogleMapCanvas` and `PlaceField` share this loader. Calls made while the
 * script is still loading get the same promise, so the page never holds a
 * second script. A script that failed, or loaded without installing
 * `google.maps`, is marked `data-gmaps-state="error"` and stays failed until it
 * is removed from the document. The URL is
 * `https://maps.googleapis.com/maps/api/js?key=…&v=weekly` with no extra
 * libraries.
 *
 * @param key - Browser key from GET /maps/key. Not logged. A script already on
 *   the page keeps the key it was created with.
 * @returns Resolves when `google.maps` exists; rejects when the script fails.
 */
export function loadGoogleMaps(key: string): Promise<void> {
  const host = window as MapsWindow;
  if (host.google?.maps !== undefined) {
    return Promise.resolve();
  }
  if (pending?.script.isConnected === true) {
    return pending.promise;
  }
  const existing = document.querySelector(GOOGLE_MAPS_SCRIPT_SELECTOR);
  const script =
    existing instanceof HTMLScriptElement ? existing : document.createElement('script');
  const promise = new Promise<void>((resolve, reject) => {
    const fail = (): void => {
      script.dataset['gmapsState'] = 'error';
      reject(new Error('map'));
    };
    if (script.dataset['gmapsState'] === 'error') {
      reject(new Error('map'));
      return;
    }
    script.addEventListener('load', () => {
      if (host.google?.maps === undefined) {
        fail();
        return;
      }
      resolve();
    });
    script.addEventListener('error', fail);
  });
  // Callers that only await may drop a failure; keep it out of unhandled rejections.
  promise.catch(() => undefined);
  if (script !== existing) {
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&v=weekly`;
    script.async = true;
    script.dataset['gmaps'] = 'weekly';
    document.head.appendChild(script);
  }
  pending = { script, promise };
  return promise;
}
