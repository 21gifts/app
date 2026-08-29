// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  accountSchema,
  CONTACT_MESSAGE_MAX_LENGTH,
  contactSchema,
  FORUM_MESSAGE_MAX_LENGTH,
  lnAddressResolvedSchema,
  giftStatsSchema,
  passkeyBeginSchema,
  passkeySessionSchema,
} from '@/lib/api-types';

const account = {
  id: 'acc_1',
  linkingKey: '02abcdef',
  role: 'basis' as const,
  name: null,
  lightningAddress: null,
  lightningAddressVerified: false,
  createdAt: 1_700_000_000,
};

describe('FORUM_MESSAGE_MAX_LENGTH', () => {
  it('matches the api POST /messages cap', () => {
    expect(FORUM_MESSAGE_MAX_LENGTH).toBe(500);
  });
});

describe('CONTACT_MESSAGE_MAX_LENGTH', () => {
  it('matches the api POST /contact cap', () => {
    expect(CONTACT_MESSAGE_MAX_LENGTH).toBe(500);
  });
});

describe('contactSchema', () => {
  it('accepts a well-formed contact message', () => {
    const message = {
      id: 'c1',
      name: 'Ada',
      text: 'Hello',
      createdAt: '2026-08-28T12:00:00.000Z',
    };
    expect(contactSchema.parse(message)).toEqual(message);
  });

  it('rejects an empty text', () => {
    expect(() =>
      contactSchema.parse({
        id: 'c1',
        name: 'Ada',
        text: '',
        createdAt: '2026-08-28T12:00:00.000Z',
      }),
    ).toThrow();
  });
});

describe('accountSchema', () => {
  it('accepts a well-formed account without a linked address', () => {
    expect(accountSchema.parse(account)).toEqual(account);
  });

  it('accepts a linked, verified account', () => {
    const linked = {
      ...account,
      lightningAddress: 'me@walletofsatoshi.com',
      lightningAddressVerified: true,
    };
    expect(accountSchema.parse(linked)).toEqual(linked);
  });

  it('accepts a named account', () => {
    const named = { ...account, name: 'Ada' };
    expect(accountSchema.parse(named)).toEqual(named);
  });

  it('rejects a non-string name', () => {
    expect(() => accountSchema.parse({ ...account, name: 1 })).toThrow();
  });

  it('rejects an empty name', () => {
    expect(() => accountSchema.parse({ ...account, name: '' })).toThrow();
  });

  it('rejects an unknown role', () => {
    expect(() => accountSchema.parse({ ...account, role: 'admin' })).toThrow();
  });

  it('rejects a non-boolean verification flag', () => {
    expect(() => accountSchema.parse({ ...account, lightningAddressVerified: 'yes' })).toThrow();
  });

  it('accepts a null linkingKey for passkey accounts', () => {
    expect(accountSchema.parse({ ...account, linkingKey: null }).linkingKey).toBeNull();
  });
});

describe('passkeyBeginSchema', () => {
  it('accepts challengeId and a JSON options object', () => {
    expect(passkeyBeginSchema.parse({ challengeId: 'ch', options: { challenge: 'aa' } })).toEqual({
      challengeId: 'ch',
      options: { challenge: 'aa' },
    });
  });
});

describe('passkeySessionSchema', () => {
  it('accepts a token plus account', () => {
    expect(
      passkeySessionSchema.parse({ token: 'tok', account: { ...account, linkingKey: null } }),
    ).toEqual({
      token: 'tok',
      account: { ...account, linkingKey: null },
    });
  });
});

describe('lnAddressResolvedSchema', () => {
  const resolved = {
    address: 'me@walletofsatoshi.com',
    callback: 'https://walletofsatoshi.com/lnurlp/callback',
    minSendable: 1000,
    maxSendable: 100_000_000,
  };

  it('accepts metadata without commentAllowed', () => {
    expect(lnAddressResolvedSchema.parse(resolved)).toEqual(resolved);
  });

  it('accepts metadata with commentAllowed', () => {
    const withComment = { ...resolved, commentAllowed: 255 };
    expect(lnAddressResolvedSchema.parse(withComment)).toEqual(withComment);
  });

  it('rejects a non-url callback', () => {
    expect(() => lnAddressResolvedSchema.parse({ ...resolved, callback: 'not-a-url' })).toThrow();
  });
});

describe('giftStatsSchema', () => {
  const fx = {
    quote: 'BTC-USD' as const,
    dayBasis: 'utc' as const,
    source: 'coinbase-exchange-daily-close' as const,
  };

  const stats = {
    totalSats: 10,
    totalBtc: '0.00000010',
    totalUsd: '0.01',
    giftCount: 1,
    recipientCount: 1,
    firstPaidAt: '2026-06-01T00:00:00.000Z',
    lastPaidAt: '2026-06-01T00:00:00.000Z',
    spendOverTime: [
      {
        day: '2026-06-01',
        sats: 10,
        cumulativeSats: 10,
        btc: '0.00000010',
        cumulativeBtc: '0.00000010',
        usd: '0.01',
        cumulativeUsd: '0.01',
      },
    ],
    byRecipient: [{ recipient: 'alice', giftCount: 1, sats: 10, btc: '0.00000010', usd: '0.01' }],
    byMonth: [{ month: '2026-06', giftCount: 1, sats: 10, btc: '0.00000010', usd: '0.01' }],
    fx,
  };

  it('accepts a full stats payload', () => {
    expect(giftStatsSchema.parse(stats)).toEqual(stats);
  });

  it('accepts null date range', () => {
    const empty = {
      ...stats,
      giftCount: 0,
      totalSats: 0,
      totalBtc: '0.00000000',
      totalUsd: '0.00',
      recipientCount: 0,
      firstPaidAt: null,
      lastPaidAt: null,
      spendOverTime: [],
      byRecipient: [],
      byMonth: [],
    };
    expect(giftStatsSchema.parse(empty)).toEqual(empty);
  });

  it('rejects a negative sat count', () => {
    expect(() => giftStatsSchema.parse({ ...stats, totalSats: -1 })).toThrow();
  });

  it('rejects a payload missing totalBtc', () => {
    expect(() =>
      giftStatsSchema.parse(
        Object.fromEntries(Object.entries(stats).filter(([key]) => key !== 'totalBtc')),
      ),
    ).toThrow();
  });

  it('rejects a payload missing totalUsd', () => {
    expect(() =>
      giftStatsSchema.parse(
        Object.fromEntries(Object.entries(stats).filter(([key]) => key !== 'totalUsd')),
      ),
    ).toThrow();
  });

  it('rejects a payload missing fx', () => {
    expect(() =>
      giftStatsSchema.parse(
        Object.fromEntries(Object.entries(stats).filter(([key]) => key !== 'fx')),
      ),
    ).toThrow();
  });

  it('rejects a bad BTC money string', () => {
    expect(() => giftStatsSchema.parse({ ...stats, totalBtc: '0.015' })).toThrow();
  });

  it('rejects a bad USD money string', () => {
    expect(() => giftStatsSchema.parse({ ...stats, totalUsd: '1425' })).toThrow();
  });
});
