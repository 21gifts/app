import { afterEach, describe, expect, it, vi } from 'vitest';
import { isMacChromiumInstalledApp, type MacChromiumAppHost } from '@/lib/mac-chromium-app';

afterEach(() => {
  vi.unstubAllGlobals();
});

const MAC_CHROME_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const MAC_CHROMIUM_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chromium/120.0.0.0 Safari/537.36';
const MAC_EDGE_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0';
const MAC_SAFARI_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15';
const MAC_FIREFOX_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:121.0) Gecko/20100101 Firefox/121.0';
const LINUX_CHROME_UA =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

/** Builds a minimal host for detection tests. */
function host(partial: {
  userAgent: string;
  platform?: string;
  maxTouchPoints?: number;
  standalone?: boolean;
  minimalUi?: boolean;
  overlay?: boolean;
}): MacChromiumAppHost {
  const navigator: MacChromiumAppHost['navigator'] = { userAgent: partial.userAgent };
  if (partial.platform !== undefined) {
    navigator.platform = partial.platform;
  }
  if (partial.maxTouchPoints !== undefined) {
    navigator.maxTouchPoints = partial.maxTouchPoints;
  }
  return {
    navigator,
    matchMedia: (query: string) => {
      if (query === '(display-mode: standalone)') {
        return { matches: Boolean(partial.standalone) };
      }
      if (query === '(display-mode: minimal-ui)') {
        return { matches: Boolean(partial.minimalUi) };
      }
      if (query === '(display-mode: window-controls-overlay)') {
        return { matches: Boolean(partial.overlay) };
      }
      return { matches: false };
    },
  };
}

describe('isMacChromiumInstalledApp', () => {
  it('returns false when window is missing (SSR)', () => {
    vi.stubGlobal('window', undefined);
    expect(isMacChromiumInstalledApp()).toBe(false);
  });

  it('prefers an explicit host over window', () => {
    const chromeApp = host({
      userAgent: MAC_CHROME_UA,
      platform: 'MacIntel',
      maxTouchPoints: 0,
      standalone: true,
    });
    const safari = host({
      userAgent: MAC_SAFARI_UA,
      platform: 'MacIntel',
      maxTouchPoints: 0,
      standalone: true,
    });
    vi.stubGlobal('window', chromeApp);
    expect(isMacChromiumInstalledApp(safari)).toBe(false);
    vi.stubGlobal('window', safari);
    expect(isMacChromiumInstalledApp(chromeApp)).toBe(true);
  });

  it('returns true for the default window when it is a Chrome app', () => {
    vi.stubGlobal(
      'window',
      host({
        userAgent: MAC_CHROME_UA,
        platform: 'MacIntel',
        maxTouchPoints: 0,
        standalone: true,
      }),
    );
    expect(isMacChromiumInstalledApp()).toBe(true);
  });

  it('returns false for an iPhone UA', () => {
    expect(
      isMacChromiumInstalledApp(
        host({
          userAgent:
            'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
          standalone: true,
        }),
      ),
    ).toBe(false);
  });

  it('returns false for an iPad UA', () => {
    expect(
      isMacChromiumInstalledApp(
        host({
          userAgent:
            'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
          standalone: true,
        }),
      ),
    ).toBe(false);
  });

  it('returns false for an iPod UA', () => {
    expect(
      isMacChromiumInstalledApp(
        host({
          userAgent:
            'Mozilla/5.0 (iPod touch; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
          standalone: true,
        }),
      ),
    ).toBe(false);
  });

  it('returns false for iPadOS desktop-site even when standalone', () => {
    expect(
      isMacChromiumInstalledApp(
        host({
          userAgent: MAC_CHROME_UA,
          platform: 'MacIntel',
          maxTouchPoints: 2,
          standalone: true,
        }),
      ),
    ).toBe(false);
  });

  it('treats missing maxTouchPoints as 0 so a Mac Chrome app can match', () => {
    expect(
      isMacChromiumInstalledApp(
        host({
          userAgent: MAC_CHROME_UA,
          platform: 'MacIntel',
          standalone: true,
        }),
      ),
    ).toBe(true);
  });

  it('returns false when the UA has no Macintosh or Mac OS X token', () => {
    expect(
      isMacChromiumInstalledApp(
        host({
          userAgent: LINUX_CHROME_UA,
          platform: 'Linux x86_64',
          maxTouchPoints: 0,
          standalone: true,
        }),
      ),
    ).toBe(false);
  });

  it('returns false for Safari without a Chrome token', () => {
    expect(
      isMacChromiumInstalledApp(
        host({
          userAgent: MAC_SAFARI_UA,
          platform: 'MacIntel',
          maxTouchPoints: 0,
          standalone: true,
        }),
      ),
    ).toBe(false);
  });

  it('returns false for Firefox', () => {
    expect(
      isMacChromiumInstalledApp(
        host({
          userAgent: MAC_FIREFOX_UA,
          platform: 'MacIntel',
          maxTouchPoints: 0,
          standalone: true,
        }),
      ),
    ).toBe(false);
  });

  it('returns false for a Chrome tab when no display-mode query matches', () => {
    expect(
      isMacChromiumInstalledApp(
        host({
          userAgent: MAC_CHROME_UA,
          platform: 'MacIntel',
          maxTouchPoints: 0,
        }),
      ),
    ).toBe(false);
  });

  it('returns false for CriOS even with a Chrome token and standalone', () => {
    expect(
      isMacChromiumInstalledApp(
        host({
          userAgent: `${MAC_CHROME_UA} CriOS/120.0.0.0`,
          platform: 'MacIntel',
          maxTouchPoints: 0,
          standalone: true,
        }),
      ),
    ).toBe(false);
  });

  it('returns false for FxiOS even with a Chrome token and standalone', () => {
    expect(
      isMacChromiumInstalledApp(
        host({
          userAgent: `${MAC_CHROME_UA} FxiOS/120.0`,
          platform: 'MacIntel',
          maxTouchPoints: 0,
          standalone: true,
        }),
      ),
    ).toBe(false);
  });

  it('returns false for EdgiOS even with a Chrome token and standalone', () => {
    expect(
      isMacChromiumInstalledApp(
        host({
          userAgent: `${MAC_CHROME_UA} EdgiOS/120.0`,
          platform: 'MacIntel',
          maxTouchPoints: 0,
          standalone: true,
        }),
      ),
    ).toBe(false);
  });

  it('returns true for Chrome/ with standalone', () => {
    expect(
      isMacChromiumInstalledApp(
        host({
          userAgent: MAC_CHROME_UA,
          platform: 'MacIntel',
          maxTouchPoints: 0,
          standalone: true,
        }),
      ),
    ).toBe(true);
  });

  it('returns true for Chromium/ with minimal-ui', () => {
    expect(
      isMacChromiumInstalledApp(
        host({
          userAgent: MAC_CHROMIUM_UA,
          platform: 'MacIntel',
          maxTouchPoints: 0,
          minimalUi: true,
        }),
      ),
    ).toBe(true);
  });

  it('returns true for Edg/ with window-controls-overlay', () => {
    expect(
      isMacChromiumInstalledApp(
        host({
          userAgent: MAC_EDGE_UA,
          platform: 'MacIntel',
          maxTouchPoints: 0,
          overlay: true,
        }),
      ),
    ).toBe(true);
  });
});
