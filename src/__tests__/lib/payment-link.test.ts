import { describe, expect, it } from 'vitest';
import { isSmartphoneUserAgent, lightningHref } from '@/lib/payment-link';

describe('isSmartphoneUserAgent', () => {
  it('detects iPhone', () => {
    expect(isSmartphoneUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)')).toBe(
      true,
    );
  });

  it('detects iPod', () => {
    expect(isSmartphoneUserAgent('Mozilla/5.0 (iPod; CPU iPhone OS 17_0 like Mac OS X)')).toBe(
      true,
    );
  });

  it('detects Android with Mobile', () => {
    expect(
      isSmartphoneUserAgent(
        'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
      ),
    ).toBe(true);
  });

  it('rejects Android without Mobile', () => {
    expect(isSmartphoneUserAgent('Mozilla/5.0 (Linux; Android 14; Pixel) AppleWebKit/537.36')).toBe(
      false,
    );
  });

  it('rejects iPad', () => {
    expect(isSmartphoneUserAgent('Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)')).toBe(false);
  });

  it('rejects desktop Macintosh', () => {
    expect(isSmartphoneUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0)')).toBe(false);
  });
});

describe('lightningHref', () => {
  it('builds a generic lightning: link for a payment request', () => {
    expect(lightningHref('lnbc21n1abc')).toBe('lightning:lnbc21n1abc');
  });

  it('builds a generic lightning: link for an address', () => {
    expect(lightningHref('alice@21.gifts')).toBe('lightning:alice@21.gifts');
  });

  it('trims surrounding whitespace from the request', () => {
    expect(lightningHref('  lnbc21n1abc\n')).toBe('lightning:lnbc21n1abc');
  });
});
