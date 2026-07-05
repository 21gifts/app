// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { accountSchema, sessionResultSchema, startChallengeSchema } from '@/lib/api-types';

const account = {
  id: 'acc_1',
  linkingKey: '02abcdef',
  role: 'basis' as const,
  createdAt: 1_700_000_000,
};

describe('accountSchema', () => {
  it('accepts a well-formed account', () => {
    expect(accountSchema.parse(account)).toEqual(account);
  });

  it('rejects an unknown role', () => {
    expect(() => accountSchema.parse({ ...account, role: 'admin' })).toThrow();
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
