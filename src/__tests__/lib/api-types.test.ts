// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  accountSchema,
  sessionResultSchema,
  startChallengeSchema,
  lnAddressResolvedSchema,
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
});

describe('startChallengeSchema', () => {
  it('accepts a well-formed challenge', () => {
    const challenge = { lnurl: 'ln', k1: 'k1', pollToken: 'pt', expiresInSeconds: 90 };
    expect(startChallengeSchema.parse(challenge)).toEqual(challenge);
  });

  it('rejects a non-numeric expiry', () => {
    const bad = { lnurl: 'x', k1: 'y', pollToken: 'z', expiresInSeconds: '90' };
    expect(() => startChallengeSchema.parse(bad)).toThrow();
  });
});

describe('sessionResultSchema', () => {
  it('accepts a pending result', () => {
    expect(sessionResultSchema.parse({ status: 'pending' })).toEqual({ status: 'pending' });
  });

  it('accepts an expired result', () => {
    expect(sessionResultSchema.parse({ status: 'expired' })).toEqual({ status: 'expired' });
  });

  it('accepts a used result', () => {
    expect(sessionResultSchema.parse({ status: 'used' })).toEqual({ status: 'used' });
  });

  it('accepts an authenticated result with token and account', () => {
    const result = { status: 'authenticated' as const, token: 'sess', account };
    expect(sessionResultSchema.parse(result)).toEqual(result);
  });

  it('rejects an authenticated result missing its token', () => {
    expect(() => sessionResultSchema.parse({ status: 'authenticated', account })).toThrow();
  });

  it('rejects an unknown status', () => {
    expect(() => sessionResultSchema.parse({ status: 'nope' })).toThrow();
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
