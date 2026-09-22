import { describe, expect, it } from 'vitest';
import { giftsLightningAddress, openCryptoPayQrValue } from '@/lib/gifts-address';

describe('giftsLightningAddress', () => {
  it('builds a 21.gifts handle', () => {
    expect(giftsLightningAddress('RoseOtero', '21.gifts')).toBe('roseotero@21.gifts');
  });

  it('uses the site host on preview domains', () => {
    expect(giftsLightningAddress('ada', 'dev.21.gifts')).toBe('ada@dev.21.gifts');
  });

  it('falls back to 21.gifts on loopback', () => {
    expect(giftsLightningAddress('ada', 'localhost')).toBe('ada@21.gifts');
  });

  it('falls back to 21.gifts on empty host, *.localhost, and IPv4', () => {
    expect(giftsLightningAddress('ada', '')).toBe('ada@21.gifts');
    expect(giftsLightningAddress('ada', 'foo.localhost')).toBe('ada@21.gifts');
    expect(giftsLightningAddress('ada', '127.0.0.1')).toBe('ada@21.gifts');
    expect(giftsLightningAddress('ada', '::1')).toBe('ada@21.gifts');
    expect(giftsLightningAddress('ada', '[::1]')).toBe('ada@21.gifts');
  });

  it('strips a www prefix', () => {
    expect(giftsLightningAddress('ada', 'www.21.gifts')).toBe('ada@21.gifts');
  });

  it('returns null when the username is blank', () => {
    expect(giftsLightningAddress(null)).toBeNull();
    expect(giftsLightningAddress('   ')).toBeNull();
  });
});

describe('openCryptoPayQrValue', () => {
  it('builds the Open CryptoPay URL for a 21.gifts handle', () => {
    expect(openCryptoPayQrValue('carol')).toBe(
      'https://21.gifts/pl/?lightning=LNURL1DP68GURN8GHJ7V339ENKJEN5WVHJUAM9D3KZ66MWDAMKUTMVDE6HYMRS9A3KZUN0DS7CX370',
    );
  });

  it('uses the site host on preview domains', () => {
    expect(openCryptoPayQrValue('ada', 'dev.21.gifts')).toBe(
      'https://dev.21.gifts/pl/?lightning=LNURL1DP68GURN8GHJ7ER9WCHRYVFWVA5KVARN9UH8WETVDSKKKMN0WAHZ7MRWW4EXCUP0V9JXZD4X5DN',
    );
  });

  it('falls back to 21.gifts on loopback', () => {
    expect(openCryptoPayQrValue('ada', 'localhost')).toBe(
      'https://21.gifts/pl/?lightning=LNURL1DP68GURN8GHJ7V339ENKJEN5WVHJUAM9D3KZ66MWDAMKUTMVDE6HYMRS9ASKGCGMXDMGQ',
    );
  });

  it('returns null when the username is blank', () => {
    expect(openCryptoPayQrValue(null)).toBeNull();
    expect(openCryptoPayQrValue('   ')).toBeNull();
  });
});
