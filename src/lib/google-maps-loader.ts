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
 * second script. A script error removes the script, so the next call adds a
 * fresh one and retries. A script that loaded without installing
 * `google.maps` is marked `data-gmaps-state="error"` and stays failed until it
 * is removed from the document. A `script[data-gmaps="weekly"]` this loader
 * did not add is replaced by a fresh script, because its load or error event
 * may already have fired. The URL is
 * `https://maps.googleapis.com/maps/api/js?key=…&v=weekly` with no extra
 * libraries.
 *
 * @param key - Browser key from GET /maps/key. Not logged.
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
  if (existing instanceof HTMLScriptElement && existing.dataset['gmapsState'] === 'error') {
    const failed = Promise.reject(new Error('map'));
    failed.catch(() => undefined);
    return failed;
  }
  // A script this loader did not add may have fired load or error already.
  existing?.remove();
  const script = document.createElement('script');
  const promise = new Promise<void>((resolve, reject) => {
    let loaded = false;
    script.addEventListener('load', () => {
      loaded = true;
      if (host.google?.maps === undefined) {
        script.dataset['gmapsState'] = 'error';
        reject(new Error('map'));
        return;
      }
      resolve();
    });
    script.addEventListener('error', () => {
      // An error after load must not undo a "loaded without google.maps" failure.
      if (loaded) {
        return;
      }
      // Drop the failed script; a disconnected pending script no longer counts,
      // so the next call adds a fresh one.
      script.remove();
      reject(new Error('map'));
    });
  });
  // Callers that only await may drop a failure; keep it out of unhandled rejections.
  promise.catch(() => undefined);
  script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&v=weekly`;
  script.async = true;
  script.dataset['gmaps'] = 'weekly';
  document.head.appendChild(script);
  pending = { script, promise };
  return promise;
}
