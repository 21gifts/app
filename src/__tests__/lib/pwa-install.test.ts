import { afterEach, describe, expect, it, vi } from 'vitest';
import { shouldOfferIosInstall } from '@/lib/pwa-install';

const IPHONE_SAFARI =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

const IPHONE_CRIOS =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/120.0.0.0 Mobile/15E148 Safari/604.1';

const IPHONE_TELEGRAM =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1 Telegram';

afterEach(() => {
  vi.unstubAllGlobals();
  Reflect.deleteProperty(window, 'TelegramWebviewProxy');
  Reflect.deleteProperty(window, 'TelegramWebview');
  Reflect.deleteProperty(window, 'Telegram');
  Object.defineProperty(navigator, 'standalone', {
    configurable: true,
    value: undefined,
  });
});

/**
 * Stubs UA, display-mode, and optional iOS standalone / Telegram bridges.
 */
function stubInstallEnv(options: {
  userAgent: string;
  standalone?: boolean;
  displayStandalone?: boolean;
  telegram?: boolean;
}): void {
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockReturnValue({ matches: options.displayStandalone === true }),
  );
  vi.stubGlobal('navigator', {
    userAgent: options.userAgent,
    standalone: options.standalone === true,
  });
  if (options.telegram === true) {
    Object.assign(window, { TelegramWebviewProxy: { postEvent() {} } });
  }
}

describe('shouldOfferIosInstall', () => {
  it('is true for iPhone Safari that is not standalone and not in-app', () => {
    stubInstallEnv({ userAgent: IPHONE_SAFARI, standalone: false });
    expect(shouldOfferIosInstall()).toBe(true);
  });

  it('is false for Chrome on iOS (CriOS)', () => {
    stubInstallEnv({ userAgent: IPHONE_CRIOS, standalone: false });
    expect(shouldOfferIosInstall()).toBe(false);
  });

  it('is false when already standalone', () => {
    stubInstallEnv({ userAgent: IPHONE_SAFARI, standalone: true });
    expect(shouldOfferIosInstall()).toBe(false);
  });

  it('is false in a Telegram in-app browser', () => {
    stubInstallEnv({ userAgent: IPHONE_TELEGRAM, standalone: false, telegram: true });
    expect(shouldOfferIosInstall()).toBe(false);
  });
});
