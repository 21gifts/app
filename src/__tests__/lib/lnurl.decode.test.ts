import { describe, expect, it } from 'vitest';
import { decodeLnurl, encodeLnurl } from '@/lib/lnurl';

const ADA = 'LNURL1DP68GURN8GHJ7V339ENKJEN5WVHJUAM9D3KZ66MWDAMKUTMVDE6HYMRS9ASKGCGMXDMGQ';

describe('decodeLnurl', () => {
  it('round-trips an uppercase and a lowercase LNURL', () => {
    expect(decodeLnurl(ADA)).toBe('https://21.gifts/.well-known/lnurlp/ada');
    const encoded = encodeLnurl('https://21.gifts/.well-known/lnurlp/ada');
    expect(decodeLnurl(encoded)).toBe('https://21.gifts/.well-known/lnurlp/ada');
    expect(decodeLnurl(encoded.toLowerCase())).toBe('https://21.gifts/.well-known/lnurlp/ada');
  });

  it('rejects empty, mixed case, the wrong HRP, and a bad checksum', () => {
    expect(decodeLnurl('')).toBeNull();
    expect(decodeLnurl('Lnurl1dp68')).toBeNull();
    expect(decodeLnurl('bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4')).toBeNull();
    expect(decodeLnurl(`${ADA.slice(0, -1)}q`)).toBeNull();
    expect(decodeLnurl('lnurl1')).toBeNull();
    expect(decodeLnurl('not a lnurl')).toBeNull();
    expect(decodeLnurl('lnurl1qqqqqb')).toBeNull();
    expect(decodeLnurl('lnurl1qqqqqq')).toBeNull();
    expect(decodeLnurl(encodeLnurl(''))).toBeNull();
  });
});
