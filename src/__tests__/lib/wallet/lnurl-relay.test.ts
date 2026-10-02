import { describe, expect, it } from 'vitest';
import { encodeLnurl } from '@/lib/lnurl';
import { lnurlRelayTarget } from '@/lib/wallet/lnurl-relay';

const OUTSIDE = encodeLnurl('https://pay.example.com/lnurlp/bob');

describe('lnurlRelayTarget', () => {
  it.each([
    ['an address on another host', ' bob@example.com ', '21.gifts', 'bob@example.com'],
    ['a lightning: address', 'LIGHTNING:bob@example.com', '21.gifts', 'bob@example.com'],
    ['an LNURL on another host', OUTSIDE, '21.gifts', OUTSIDE],
    [
      'a lowercase lightning: LNURL',
      `lightning:${OUTSIDE.toLowerCase()}`,
      '21.gifts',
      OUTSIDE.toLowerCase(),
    ],
    [
      'the production host seen from another deployment',
      'bob@21.gifts',
      'dev.21.gifts',
      'bob@21.gifts',
    ],
  ])('relays %s', (_label, text, hostname, relayed) => {
    expect(lnurlRelayTarget(text, hostname)).toBe(relayed);
  });

  it.each([
    ['an address on the own host', 'bob@21.gifts', '21.gifts'],
    ['an own-host address in other case with a trailing dot', 'bob@21.GIFTS.', '21.gifts'],
    ['an own-host address from www', 'bob@21.gifts', 'www.21.gifts'],
    ['a www own-host address', 'bob@www.21.gifts', '21.gifts'],
    ['a www own-host address from www', 'bob@www.21.gifts', 'www.21.gifts'],
    ['an own-host address on a page host with a trailing dot', 'bob@21.gifts', '21.gifts.'],
    ['an own-host address on a www page host with a trailing dot', 'bob@21.gifts', 'www.21.gifts.'],
    ['the own deployment host', 'bob@dev.21.gifts', 'dev.21.gifts'],
    ['an own-host address on a local boot', 'bob@21.gifts', 'localhost'],
    ['an own-host LNURL', encodeLnurl('https://21.gifts/.well-known/lnurlp/bob'), '21.gifts'],
    ['a DNS payment address', '₿bob@example.com', '21.gifts'],
    ['a Spark address', 'sp1qqexample', '21.gifts'],
    ['a payment request', 'lnbc210n1example', '21.gifts'],
    ['an LNURL that is not a URL', encodeLnurl('not a url'), '21.gifts'],
    ['an address without a dot in the host', 'bob@localhost', '21.gifts'],
    ['empty text', '   ', '21.gifts'],
  ])('leaves %s to the wallet', (_label, text, hostname) => {
    expect(lnurlRelayTarget(text, hostname)).toBeNull();
  });
});
