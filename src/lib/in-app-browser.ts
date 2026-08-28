/** Minimal window surface used to detect an embedded in-app browser. */
export interface InAppBrowserHost {
  navigator: { userAgent: string };
  TelegramWebviewProxy?: unknown;
  TelegramWebview?: unknown;
  Telegram?: { WebApp?: { openLink?: (url: string) => unknown } | unknown };
}

/** Window surface used to leave an in-app browser. */
export interface SystemBrowserHost extends InAppBrowserHost {
  location: { href: string; origin: string; pathname: string };
  open: (url: string, target?: string, features?: string) => unknown;
}

/** Case-insensitive UA tokens that mark known in-app WebViews. */
const IN_APP_UA =
  /Telegram|Instagram|FBAN|FBAV|FB_IAB|FBIOS|FB4A|Messenger|Orca-Android|WhatsApp|BytedanceWebview|musical_ly|TikTok|TwitterAndroid|\bTwitter\b|LinkedInApp|Snapchat|Pinterest|Reddit|MicroMessenger|\bLine\/|KAKAOTALK|Weibo|NAVER|baiduboxapp|\bGSA\b|Barcelona/i;

/**
 * Resolve the host to inspect, preferring an explicit argument.
 *
 * @param win - Optional host override.
 * @returns The host, or `undefined` when running without a window (SSR).
 */
function resolveHost(win?: InAppBrowserHost): InAppBrowserHost | undefined {
  if (win !== undefined) {
    return win;
  }
  if (typeof globalThis.window === 'undefined') {
    return undefined;
  }
  return globalThis.window as unknown as InAppBrowserHost;
}

/** True when the host looks like a Telegram WebView or Mini App. */
function isTelegramHost(host: InAppBrowserHost): boolean {
  return (
    host.TelegramWebviewProxy !== undefined ||
    host.TelegramWebview !== undefined ||
    host.Telegram?.WebApp !== undefined ||
    /Telegram/i.test(host.navigator.userAgent)
  );
}

/**
 * True when the page is inside an embedded in-app browser that cannot
 * complete a WebAuthn passkey ceremony (Telegram, Instagram, …).
 *
 * Detection order: Telegram JS bridges / UA, then a broader UA token list.
 * Missing `win` (SSR) is false.
 *
 * @param win - Host to inspect; defaults to `globalThis.window` when present.
 * @returns Whether passkeys should not be started here.
 */
export function isInAppBrowser(win?: InAppBrowserHost): boolean {
  const host = resolveHost(win);
  if (host === undefined) {
    return false;
  }
  if (isTelegramHost(host)) {
    return true;
  }
  return IN_APP_UA.test(host.navigator.userAgent);
}

/**
 * Best-effort handoff to the system browser for `url`.
 *
 * Android → Chrome intent URL on `location.href`.
 * Else if Telegram Mini App (`Telegram.WebApp.openLink` is a function) →
 * `openLink(url)`.
 * Else if iOS Telegram (any of `TelegramWebviewProxy`, `TelegramWebview`,
 * `Telegram.WebApp`, or UA `Telegram`, plus iPhone/iPad/iPod, and `url`
 * starting with `https://`) → `x-safari-` + url on `location.href`.
 * Otherwise → `host.open(url, '_blank', 'noopener,noreferrer')`.
 *
 * @param url - Absolute https login URL to open.
 * @param win - Host to drive; defaults to `globalThis.window`.
 */
export function openInSystemBrowser(url: string, win?: SystemBrowserHost): void {
  const host =
    win ??
    (typeof globalThis.window === 'undefined'
      ? undefined
      : (globalThis.window as unknown as SystemBrowserHost));
  if (host === undefined) {
    return;
  }
  const ua = host.navigator.userAgent;
  if (/Android/i.test(ua)) {
    const hostAndPath = url.replace(/^https:\/\//u, '');
    host.location.href = `intent://${hostAndPath}#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(url)};end`;
    return;
  }
  const webApp = host.Telegram?.WebApp;
  const openLink =
    typeof webApp === 'object' && webApp !== null
      ? (webApp as { openLink?: unknown }).openLink
      : undefined;
  if (typeof openLink === 'function') {
    openLink(url);
    return;
  }
  if (/iPhone|iPad|iPod/i.test(ua) && isTelegramHost(host) && url.startsWith('https://')) {
    host.location.href = `x-safari-${url}`;
    return;
  }
  host.open(url, '_blank', 'noopener,noreferrer');
}
