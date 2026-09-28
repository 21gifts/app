import { afterEach, describe, expect, it } from 'vitest';
import { isMacChromiumInstalledApp, type MacChromiumAppHost } from '@/lib/mac-chromium-app';

const CHROME_MAC =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36';

function host(
  userAgent: string,
  modes: string[],
  extra?: { platform?: string; maxTouchPoints?: number },
): MacChromiumAppHost {
  return {
    navigator: {
      userAgent,
      platform: extra?.platform ?? 'MacIntel',
      maxTouchPoints: extra?.maxTouchPoints ?? 0,
    },
    matchMedia: (query) => ({ matches: modes.some((mode) => query.includes(mode)) }),
  };
}

describe('isMacChromiumInstalledApp', () => {
  const realWindow = globalThis.window;

  afterEach(() => {
    Object.defineProperty(globalThis, 'window', { configurable: true, value: realWindow });
  });

  it('is false without a window', () => {
    Object.defineProperty(globalThis, 'window', { configurable: true, value: undefined });
    expect(isMacChromiumInstalledApp()).toBe(false);
  });

  it('is true for an installed macOS Chrome, Edge, or Chromium app', () => {
    expect(isMacChromiumInstalledApp(host(CHROME_MAC, ['display-mode: standalone']))).toBe(true);
    expect(
      isMacChromiumInstalledApp(
        host(CHROME_MAC.replace('Chrome/', 'Edg/'), ['display-mode: minimal-ui']),
      ),
    ).toBe(true);
    expect(
      isMacChromiumInstalledApp(
        host(CHROME_MAC.replace('Chrome/', 'Chromium/'), ['display-mode: window-controls-overlay']),
      ),
    ).toBe(true);
  });

  it('is false for a Chrome tab, Safari, iPhone, and iPadOS', () => {
    expect(isMacChromiumInstalledApp(host(CHROME_MAC, []))).toBe(false);
    expect(
      isMacChromiumInstalledApp(
        host(
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
          ['display-mode: standalone'],
        ),
      ),
    ).toBe(false);
    expect(
      isMacChromiumInstalledApp(
        host(
          'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/151.0.0.0 Mobile/15E148 Safari/604.1',
          ['display-mode: standalone'],
        ),
      ),
    ).toBe(false);
    expect(
      isMacChromiumInstalledApp(
        host(CHROME_MAC, ['display-mode: standalone'], { maxTouchPoints: 5 }),
      ),
    ).toBe(false);
    expect(
      isMacChromiumInstalledApp(
        host(
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36',
          ['display-mode: standalone'],
          { platform: 'Win32' },
        ),
      ),
    ).toBe(false);
  });
});
