import { describe, expect, it } from 'vitest';
import { ROLE_ORDER, isReplyPaymentExempt, roleAtLeast, roleRank, type Role } from '@/lib/roles';

describe('roleRank', () => {
  it('ranks basis through founder as 0 through 3', () => {
    expect(roleRank('basis')).toBe(0);
    expect(roleRank('verified')).toBe(1);
    expect(roleRank('moderator')).toBe(2);
    expect(roleRank('founder')).toBe(3);
    expect(ROLE_ORDER).toEqual(['basis', 'verified', 'moderator', 'founder']);
  });
});

describe('roleAtLeast', () => {
  it.each([
    ['basis', 'basis', true],
    ['basis', 'verified', false],
    ['basis', 'moderator', false],
    ['basis', 'founder', false],
    ['verified', 'basis', true],
    ['verified', 'verified', true],
    ['verified', 'moderator', false],
    ['verified', 'founder', false],
    ['moderator', 'basis', true],
    ['moderator', 'verified', true],
    ['moderator', 'moderator', true],
    ['moderator', 'founder', false],
    ['founder', 'basis', true],
    ['founder', 'verified', true],
    ['founder', 'moderator', true],
    ['founder', 'founder', true],
  ] as const)('roleAtLeast(%s, %s) is %s', (role, min, expected) => {
    expect(roleAtLeast(role, min)).toBe(expected);
  });

  it('is false when the role is null or undefined', () => {
    expect(roleAtLeast(null, 'basis')).toBe(false);
    expect(roleAtLeast(undefined, 'basis')).toBe(false);
    expect(roleAtLeast(null, 'founder')).toBe(false);
    expect(roleAtLeast(undefined, 'moderator')).toBe(false);
  });
});

describe('isReplyPaymentExempt', () => {
  function account(role: Role): { id: string; role: Role } {
    return { id: 'acc_1', role };
  }

  it('is false when the account is missing', () => {
    expect(isReplyPaymentExempt(null, 'acc_1')).toBe(false);
    expect(isReplyPaymentExempt(null, undefined)).toBe(false);
  });

  it.each(['verified', 'moderator', 'founder'] as const)(
    'is true for a %s account regardless of parent author',
    (role) => {
      expect(isReplyPaymentExempt(account(role), undefined)).toBe(true);
      expect(isReplyPaymentExempt(account(role), 'other')).toBe(true);
      expect(isReplyPaymentExempt(account(role), 'acc_1')).toBe(true);
    },
  );

  it('is false for a basis parent author', () => {
    expect(isReplyPaymentExempt(account('basis'), 'acc_1')).toBe(false);
  });

  it('is false for a basis account that is not the parent author', () => {
    expect(isReplyPaymentExempt(account('basis'), 'other')).toBe(false);
    expect(isReplyPaymentExempt(account('basis'), undefined)).toBe(false);
  });
});
