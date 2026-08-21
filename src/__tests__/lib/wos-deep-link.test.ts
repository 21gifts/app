import { describe, expect, it } from 'vitest';
import {
  isAndroidUserAgent,
  walletOfSatoshiIntentHref,
  WOS_ANDROID_PACKAGE,
} from '@/lib/wos-deep-link';

describe('isAndroidUserAgent', () => {
  it('detects Android', () => {
    expect(isAndroidUserAgent('Mozilla/5.0 (Linux; Android 14; Pixel)')).toBe(true);
  });

  it('rejects iPhone and desktop', () => {
    expect(isAndroidUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)')).toBe(false);
    expect(isAndroidUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0)')).toBe(false);
  });
});

describe('walletOfSatoshiIntentHref', () => {
  it('pins lightning: to the Wallet of Satoshi package with uppercase LNURL', () => {
    const href = walletOfSatoshiIntentHref('lnurl1abc');
    expect(href).toBe(
      `intent://LNURL1ABC#Intent;scheme=lightning;package=${WOS_ANDROID_PACKAGE};end`,
    );
  });
});
