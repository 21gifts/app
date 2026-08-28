import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  isInAppBrowser,
  openInSystemBrowser,
  type InAppBrowserHost,
  type SystemBrowserHost,
} from '@/lib/in-app-browser';

afterEach(() => {
  vi.unstubAllGlobals();
});

/** Builds a minimal host for detection tests. */
function host(partial: Partial<InAppBrowserHost> & { userAgent?: string }): InAppBrowserHost {
  const result: InAppBrowserHost = {
    navigator: { userAgent: partial.userAgent ?? 'Mozilla/5.0' },
  };
  if (partial.TelegramWebviewProxy !== undefined) {
    result.TelegramWebviewProxy = partial.TelegramWebviewProxy;
  }
  if (partial.TelegramWebview !== undefined) {
    result.TelegramWebview = partial.TelegramWebview;
  }
  if (partial.Telegram !== undefined) {
    result.Telegram = partial.Telegram;
  }
  return result;
}

/** Builds a system-browser host with spies. */
function systemHost(partial: {
  userAgent: string;
  href?: string;
  origin?: string;
  pathname?: string;
  TelegramWebviewProxy?: unknown;
}): SystemBrowserHost & { open: ReturnType<typeof vi.fn> } {
  const location = {
    href: partial.href ?? 'https://21.gifts/login',
    origin: partial.origin ?? 'https://21.gifts',
    pathname: partial.pathname ?? '/login',
  };
  const open = vi.fn();
  const result: SystemBrowserHost & { open: ReturnType<typeof vi.fn> } = {
    navigator: { userAgent: partial.userAgent },
    location,
    open,
  };
  if (partial.TelegramWebviewProxy !== undefined) {
    result.TelegramWebviewProxy = partial.TelegramWebviewProxy;
  }
  return result;
}

describe('isInAppBrowser', () => {
  it('returns false when window is missing (SSR)', () => {
    vi.stubGlobal('window', undefined);
    expect(isInAppBrowser()).toBe(false);
  });

  it('returns true when TelegramWebviewProxy is present', () => {
    expect(isInAppBrowser(host({ TelegramWebviewProxy: {} }))).toBe(true);
  });

  it('returns true when TelegramWebview is present', () => {
    expect(isInAppBrowser(host({ TelegramWebview: {} }))).toBe(true);
  });

  it('returns true when Telegram.WebApp is present', () => {
    expect(isInAppBrowser(host({ Telegram: { WebApp: {} } }))).toBe(true);
  });

  it('returns true for a known in-app UA token', () => {
    expect(isInAppBrowser(host({ userAgent: 'Mozilla/5.0 Instagram 300.0' }))).toBe(true);
  });

  it('returns false for a clean desktop Chrome UA', () => {
    expect(
      isInAppBrowser(
        host({
          userAgent:
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        }),
      ),
    ).toBe(false);
  });

  it('returns false for the default window with a clean Chrome UA', () => {
    const originalUa = navigator.userAgent;
    Object.defineProperty(navigator, 'userAgent', {
      configurable: true,
      value:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    });
    try {
      expect(isInAppBrowser()).toBe(false);
    } finally {
      Object.defineProperty(navigator, 'userAgent', {
        configurable: true,
        value: originalUa,
      });
    }
  });
});

describe('openInSystemBrowser', () => {
  const url = 'https://21.gifts/login';

  it('is a no-op when window is missing', () => {
    vi.stubGlobal('window', undefined);
    expect(() => openInSystemBrowser(url)).not.toThrow();
  });

  it('sets an Android Chrome intent on location.href', () => {
    const win = systemHost({
      userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36',
    });
    openInSystemBrowser(url, win);
    expect(win.location.href).toBe(
      `intent://21.gifts/login#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(url)};end`,
    );
    expect(win.open).not.toHaveBeenCalled();
  });

  it('sets x-safari- href for iOS Telegram via bridge', () => {
    const win = systemHost({
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
      TelegramWebviewProxy: { postEvent() {} },
    });
    openInSystemBrowser(url, win);
    expect(win.location.href).toBe(`x-safari-${url}`);
    expect(win.open).not.toHaveBeenCalled();
  });

  it('sets x-safari- href for iOS Telegram via UA', () => {
    const win = systemHost({
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Telegram',
    });
    openInSystemBrowser(url, win);
    expect(win.location.href).toBe(`x-safari-${url}`);
    expect(win.open).not.toHaveBeenCalled();
  });

  it('falls back to window.open otherwise', () => {
    const win = systemHost({
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0.0.0',
    });
    openInSystemBrowser(url, win);
    expect(win.open).toHaveBeenCalledWith(url, '_blank', 'noopener,noreferrer');
  });

  it('opens via the default window when no host is passed', () => {
    const win = systemHost({
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0.0.0',
    });
    vi.stubGlobal('window', win);
    openInSystemBrowser(url);
    expect(win.open).toHaveBeenCalledWith(url, '_blank', 'noopener,noreferrer');
  });

  it('falls back to open for iPhone without Telegram', () => {
    const win = systemHost({
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
    });
    const initialHref = win.location.href;
    openInSystemBrowser(url, win);
    expect(win.open).toHaveBeenCalledWith(url, '_blank', 'noopener,noreferrer');
    expect(win.location.href).toBe(initialHref);
  });

  it('falls back to open for iOS Telegram when url is not https', () => {
    const httpUrl = 'http://21.gifts/login';
    const win = systemHost({
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
      TelegramWebviewProxy: { postEvent() {} },
    });
    const initialHref = win.location.href;
    openInSystemBrowser(httpUrl, win);
    expect(win.open).toHaveBeenCalledWith(httpUrl, '_blank', 'noopener,noreferrer');
    expect(win.location.href).toBe(initialHref);
  });
});
