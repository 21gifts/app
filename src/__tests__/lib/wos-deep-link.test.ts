import { describe, expect, it } from 'vitest';
import {
  isAndroidUserAgent,
  uppercaseLnurl,
  walletOfSatoshiHref,
  walletOfSatoshiIntentHref,
  WOS_ANDROID_PACKAGE,
  WOS_URL_SCHEME,
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

describe('uppercaseLnurl', () => {
  it('uppercases a bech32 LNURL', () => {
    expect(uppercaseLnurl('lnurl1abc')).toBe('LNURL1ABC');
  });
});

describe('walletOfSatoshiHref', () => {
  it('builds the custom-scheme deep link with uppercase LNURL', () => {
    expect(walletOfSatoshiHref('lnurl1abc')).toBe('walletofsatoshi:LNURL1ABC');
    expect(walletOfSatoshiHref('lnurl1abc')).toBe(`${WOS_URL_SCHEME}:LNURL1ABC`);
  });
});

describe('walletOfSatoshiIntentHref', () => {
  it('pins walletofsatoshi: to the Wallet of Satoshi package with Play Store fallback', () => {
    const href = walletOfSatoshiIntentHref('lnurl1abc');
    expect(href).toBe(
      'intent:LNURL1ABC#Intent;scheme=walletofsatoshi;package=com.livingroomofsatoshi.wallet;S.browser_fallback_url=https%3A%2F%2Fplay.google.com%2Fstore%2Fapps%2Fdetails%3Fid%3Dcom.livingroomofsatoshi.wallet;end',
    );
    expect(href).toContain(`scheme=${WOS_URL_SCHEME}`);
    expect(href).toContain(`package=${WOS_ANDROID_PACKAGE}`);
    expect(href).not.toContain('scheme=lightning');
  });
});
