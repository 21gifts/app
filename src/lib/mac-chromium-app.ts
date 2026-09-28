/** Minimal window surface used to detect an installed macOS Chromium app. */
export interface MacChromiumAppHost {
  navigator: { userAgent: string; platform?: string; maxTouchPoints?: number };
  matchMedia: (query: string) => { matches: boolean };
}

/**
 * Resolve the host to inspect, preferring an explicit argument.
 *
 * @param win - Optional host override.
 * @returns The host, or `undefined` when running without a window (SSR).
 */
function resolveHost(win?: MacChromiumAppHost): MacChromiumAppHost | undefined {
  if (win !== undefined) {
    return win;
  }
  if (typeof globalThis.window === 'undefined') {
    return undefined;
  }
  return globalThis.window as unknown as MacChromiumAppHost;
}

/**
 * True when the page is an installed macOS Chrome, Chromium, or Edge app
 * that cannot complete a WebAuthn passkey ceremony.
 *
 * Requires a Macintosh / Mac OS X UA, a Chrome/Chromium/Edge token (not
 * CriOS/FxiOS/EdgiOS), and a standalone-like display-mode. iPhone/iPad/iPod
 * and iPadOS desktop-site are false. Missing `win` (SSR) is false.
 *
 * @param win - Host to inspect; defaults to `globalThis.window` when present.
 * @returns Whether passkeys should not be started here.
 */
export function isMacChromiumInstalledApp(win?: MacChromiumAppHost): boolean {
  const host = resolveHost(win);
  if (host === undefined) {
    return false;
  }
  const ua = host.navigator.userAgent;
  if (/iPhone|iPad|iPod/i.test(ua)) {
    return false;
  }
  if (host.navigator.platform === 'MacIntel' && (host.navigator.maxTouchPoints ?? 0) > 1) {
    return false;
  }
  if (!/Macintosh|Mac OS X/i.test(ua)) {
    return false;
  }
  if (!/Chrome\/|Chromium\/|Edg\//.test(ua) || /CriOS|FxiOS|EdgiOS/.test(ua)) {
    return false;
  }
  return (
    host.matchMedia('(display-mode: standalone)').matches ||
    host.matchMedia('(display-mode: minimal-ui)').matches ||
    host.matchMedia('(display-mode: window-controls-overlay)').matches
  );
}
