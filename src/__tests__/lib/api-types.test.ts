// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  accountSchema,
  CONTACT_MESSAGE_MAX_LENGTH,
  contactSchema,
  FORUM_MESSAGE_MAX_LENGTH,
  forumMessageSchema,
  lnAddressResolvedSchema,
  giftStatsSchema,
  passkeyBeginSchema,
  passkeySessionSchema,
  pushSubscriptionResponseSchema,
  vapidPublicSchema,
  viewProfileSchema,
} from '@/lib/api-types';

const account = {
  id: 'acc_1',
  linkingKey: '02abcdef',
  role: 'basis' as const,
  name: null,
  lightningAddress: null,
  lightningAddressVerified: false,
  forumLawsDismissed: false,
  createdAt: 1_700_000_000,
  rulesAgreedAt: null,
  viewKey: 'a'.repeat(64),
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

describe('vapidPublicSchema', () => {
  it('accepts a non-empty public key', () => {
    expect(vapidPublicSchema.parse({ publicKey: 'BAAAA' })).toEqual({ publicKey: 'BAAAA' });
  });

  it('rejects an empty public key', () => {
    expect(() => vapidPublicSchema.parse({ publicKey: '' })).toThrow();
  });
});

describe('pushSubscriptionResponseSchema', () => {
  it('accepts endpoint plus createdAt', () => {
    const body = { endpoint: 'https://push.example/sub', createdAt: '2026-08-30T00:00:00.000Z' };
    expect(pushSubscriptionResponseSchema.parse(body)).toEqual(body);
  });

  it('rejects a missing endpoint', () => {
    expect(() =>
      pushSubscriptionResponseSchema.parse({ createdAt: '2026-08-30T00:00:00.000Z' }),
    ).toThrow();
  });
});

describe('forumMessageSchema', () => {
  const base = {
    id: 'm1',
    name: 'Ada',
    text: 'Hello',
    createdAt: '2026-08-28T12:00:00.000Z',
    sats: 0,
    payable: false,
    hasPhoto: false,
    role: 'basis' as const,
  };

  it('accepts text with no photo', () => {
    expect(forumMessageSchema.parse(base)).toEqual({
      ...base,
      hasVideo: false,
      videoContentType: null,
    });
  });

  it('accepts an empty text when hasPhoto is true', () => {
    const photoOnly = { ...base, text: '', hasPhoto: true };
    expect(forumMessageSchema.parse(photoOnly)).toEqual({
      ...photoOnly,
      hasVideo: false,
      videoContentType: null,
    });
  });

  it('accepts an empty text when hasVideo is true', () => {
    const videoOnly = { ...base, text: '', hasVideo: true };
    expect(forumMessageSchema.parse(videoOnly)).toEqual({
      ...videoOnly,
      videoContentType: null,
    });
  });

  it('rejects an empty text when hasPhoto is false', () => {
    expect(() => forumMessageSchema.parse({ ...base, text: '', hasPhoto: false })).toThrow();
  });

  it('rejects a missing hasPhoto flag', () => {
    expect(() =>
      forumMessageSchema.parse({
        id: base.id,
        name: base.name,
        text: base.text,
        createdAt: base.createdAt,
      }),
    ).toThrow();
  });

  it('accepts the three video MIME values and null', () => {
    expect(
      forumMessageSchema.parse({ ...base, hasVideo: true, videoContentType: 'video/mp4' })
        .videoContentType,
    ).toBe('video/mp4');
    expect(
      forumMessageSchema.parse({ ...base, hasVideo: true, videoContentType: 'video/webm' })
        .videoContentType,
    ).toBe('video/webm');
    expect(
      forumMessageSchema.parse({ ...base, hasVideo: true, videoContentType: 'video/quicktime' })
        .videoContentType,
    ).toBe('video/quicktime');
    expect(forumMessageSchema.parse({ ...base, videoContentType: null }).videoContentType).toBe(
      null,
    );
  });

  it('rejects an unknown videoContentType string', () => {
    expect(() =>
      forumMessageSchema.parse({ ...base, hasVideo: true, videoContentType: 'video/ogg' }),
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

  it('accepts founder and verified roles', () => {
    expect(accountSchema.parse({ ...account, role: 'founder' }).role).toBe('founder');
    expect(accountSchema.parse({ ...account, role: 'verified' }).role).toBe('verified');
  });

  it('rejects an unknown role', () => {
    expect(() => accountSchema.parse({ ...account, role: 'admin' })).toThrow();
  });

  it('rejects a non-boolean verification flag', () => {
    expect(() => accountSchema.parse({ ...account, lightningAddressVerified: 'yes' })).toThrow();
  });

  it('accepts forumLawsDismissed true and false', () => {
    expect(accountSchema.parse({ ...account, forumLawsDismissed: false }).forumLawsDismissed).toBe(
      false,
    );
    expect(accountSchema.parse({ ...account, forumLawsDismissed: true }).forumLawsDismissed).toBe(
      true,
    );
  });

  it('rejects a non-boolean forumLawsDismissed flag', () => {
    expect(() => accountSchema.parse({ ...account, forumLawsDismissed: 'yes' })).toThrow();
  });

  it('accepts a null linkingKey for passkey accounts', () => {
    expect(accountSchema.parse({ ...account, linkingKey: null }).linkingKey).toBeNull();
  });

  it('accepts a null rulesAgreedAt', () => {
    expect(accountSchema.parse(account).rulesAgreedAt).toBeNull();
  });

  it('accepts a positive rulesAgreedAt timestamp', () => {
    const agreed = { ...account, rulesAgreedAt: 1_700_000_001 };
    expect(accountSchema.parse(agreed).rulesAgreedAt).toBe(1_700_000_001);
  });

  it('rejects a missing rulesAgreedAt field', () => {
    expect(() =>
      accountSchema.parse(
        Object.fromEntries(Object.entries(account).filter(([key]) => key !== 'rulesAgreedAt')),
      ),
    ).toThrow();
  });

  it('rejects a string rulesAgreedAt timestamp', () => {
    expect(() => accountSchema.parse({ ...account, rulesAgreedAt: '1700000001' })).toThrow();
  });

  it('rejects a missing viewKey', () => {
    const without: Record<string, unknown> = { ...account };
    delete without['viewKey'];
    expect(() => accountSchema.parse(without)).toThrow();
  });

  it('rejects an uppercase viewKey', () => {
    expect(() => accountSchema.parse({ ...account, viewKey: 'A'.repeat(64) })).toThrow();
  });

  it('rejects a viewKey with the wrong length', () => {
    expect(() => accountSchema.parse({ ...account, viewKey: 'a'.repeat(63) })).toThrow();
  });
});

describe('viewProfileSchema', () => {
  const profile = {
    name: 'Ada',
    lightningAddress: 'alice@walletofsatoshi.com',
    lightningAddressVerified: false,
    createdAt: 1_700_000_000,
  };

  it('accepts a well-formed named profile', () => {
    expect(viewProfileSchema.parse(profile)).toEqual(profile);
  });

  it('accepts null name and null lightningAddress', () => {
    const bare = { ...profile, name: null, lightningAddress: null };
    expect(viewProfileSchema.parse(bare)).toEqual(bare);
  });

  it('rejects an empty name', () => {
    expect(() => viewProfileSchema.parse({ ...profile, name: '' })).toThrow();
  });
});

describe('forumMessageSchema', () => {
  const message = {
    id: 'm1',
    name: 'Ada',
    text: 'Hello from Ada',
    createdAt: '2026-08-28T12:00:00.000Z',
    sats: 0,
    payable: true,
    hasPhoto: false,
  };

  it('defaults a missing role to basis', () => {
    expect(forumMessageSchema.parse(message)).toEqual({
      ...message,
      role: 'basis',
      hasVideo: false,
      videoContentType: null,
    });
  });

  it('accepts founder, verified, and moderator roles', () => {
    expect(forumMessageSchema.parse({ ...message, role: 'founder' }).role).toBe('founder');
    expect(forumMessageSchema.parse({ ...message, role: 'verified' }).role).toBe('verified');
    expect(forumMessageSchema.parse({ ...message, role: 'moderator' }).role).toBe('moderator');
  });

  it('rejects an unknown role', () => {
    expect(() => forumMessageSchema.parse({ ...message, role: 'admin' })).toThrow();
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
