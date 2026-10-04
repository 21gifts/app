import { describe, expect, it } from 'vitest';
import { encodeLnurl } from '@/lib/lnurl';
import { lnurlPayAddress, payLinkUsername } from '@/lib/pay-link';

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

describe('lnurlPayAddress', () => {
  const shop = encodeLnurl('https://pay.example/.well-known/lnurlp/shop');

  it('names the address behind a bech32 LNURL and behind a /pl/?lightning= link', () => {
    expect(lnurlPayAddress(shop)).toBe('shop@pay.example');
    expect(lnurlPayAddress(` lightning:${shop.toLowerCase()} `)).toBe('shop@pay.example');
    expect(lnurlPayAddress(`https://pay.example/pl/?lightning=${shop}`)).toBe('shop@pay.example');
    expect(lnurlPayAddress(`HTTPS://other.example/pl?lightning=${shop}`)).toBe('shop@pay.example');
    expect(lnurlPayAddress(ADA)).toBe('ada@21.gifts');
    expect(lnurlPayAddress(encodeLnurl('https://pay.example:443/.well-known/lnurlp/shop'))).toBe(
      'shop@pay.example',
    );
  });

  it('keeps the name as it stands in the URL', () => {
    expect(lnurlPayAddress(encodeLnurl('https://pay.example/.well-known/lnurlp/Shop'))).toBe(
      'Shop@pay.example',
    );
  });

  it('returns null for other text and for an LNURL that is not an address', () => {
    expect(lnurlPayAddress('bob@pay.example')).toBeNull();
    expect(lnurlPayAddress('lnbc1')).toBeNull();
    expect(lnurlPayAddress('https://')).toBeNull();
    expect(lnurlPayAddress('https://pay.example/pl/')).toBeNull();
    expect(lnurlPayAddress(`http://pay.example/pl/?lightning=${shop}`)).toBeNull();
    expect(lnurlPayAddress(`https://pay.example/pay/?lightning=${shop}`)).toBeNull();
    expect(lnurlPayAddress(encodeLnurl('not a url'))).toBeNull();
    expect(lnurlPayAddress(encodeLnurl('https://pay.example/lnurlp/shop'))).toBeNull();
    expect(lnurlPayAddress(encodeLnurl('http://pay.example/.well-known/lnurlp/shop'))).toBeNull();
    expect(
      lnurlPayAddress(encodeLnurl('https://pay.example:8443/.well-known/lnurlp/shop')),
    ).toBeNull();
    expect(
      lnurlPayAddress(encodeLnurl('https://pay.example/.well-known/lnurlp/shop?x=1')),
    ).toBeNull();
    expect(
      lnurlPayAddress(encodeLnurl('https://user@pay.example/.well-known/lnurlp/shop')),
    ).toBeNull();
    expect(
      lnurlPayAddress(encodeLnurl('https://:pw@pay.example/.well-known/lnurlp/shop')),
    ).toBeNull();
    expect(lnurlPayAddress(encodeLnurl('https://pay.example/.well-known/lnurlp/a%40b'))).toBeNull();
    expect(lnurlPayAddress(encodeLnurl('https://pay.example/.well-known/lnurlp/%'))).toBeNull();
  });
});
