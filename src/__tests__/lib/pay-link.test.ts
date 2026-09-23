import { describe, expect, it } from 'vitest';
import { encodeLnurl } from '@/lib/lnurl';
import { payLinkUsername } from '@/lib/pay-link';

const ADA = 'LNURL1DP68GURN8GHJ7V339ENKJEN5WVHJUAM9D3KZ66MWDAMKUTMVDE6HYMRS9ASKGCGMXDMGQ';

describe('payLinkUsername', () => {
  it('reads ada from a 21.gifts LNURL on loopback, a bare IP, and the apex', () => {
    expect(payLinkUsername(ADA, 'localhost')).toBe('ada');
    expect(payLinkUsername(ADA, 'localhost:3000')).toBe('ada');
    expect(payLinkUsername(ADA, '127.0.0.1')).toBe('ada');
    expect(payLinkUsername(ADA, '::1')).toBe('ada');
    expect(payLinkUsername(ADA, '[::1]')).toBe('ada');
    expect(payLinkUsername(ADA, '[::1]:3000')).toBe('ada');
    expect(payLinkUsername(ADA, '127.0.0.1:3000')).toBe('ada');
    expect(payLinkUsername(ADA, 'app.localhost')).toBe('ada');
    expect(payLinkUsername(ADA, 'www.21.gifts')).toBe('ada');
    expect(payLinkUsername(ADA, '21.gifts')).toBe('ada');
    expect(payLinkUsername(ADA, '')).toBe('ada');
  });

  it('rejects a different host, a non-https URL, a bad path, and a bad escape', () => {
    expect(payLinkUsername(ADA, 'dev.21.gifts')).toBeNull();
    expect(payLinkUsername('not-an-lnurl', '21.gifts')).toBeNull();
    expect(payLinkUsername(encodeLnurl('http://21.gifts/.well-known/lnurlp/ada'), '21.gifts')).toBe(
      null,
    );
    expect(payLinkUsername(encodeLnurl('https://21.gifts/pay/ada'), '21.gifts')).toBeNull();
    expect(payLinkUsername(encodeLnurl('https://21.gifts/.well-known/lnurlp/%'), '21.gifts')).toBe(
      null,
    );
    expect(
      payLinkUsername(encodeLnurl('https://21.gifts/.well-known/lnurlp/a%2Fb'), '21.gifts'),
    ).toBe('a/b');
  });
});
