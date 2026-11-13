import { describe, expect, it } from 'vitest';
import {
  ROLE_ORDER,
  authorCannotReceive,
  canEditDailyPayoutRoster,
  isOwnNote,
  isReplyPaymentExempt,
  roleAtLeast,
  roleRank,
  type Role,
} from '@/lib/roles';

describe('roleRank', () => {
  it('ranks basis through founder as 0 through 6', () => {
    expect(roleRank('basis')).toBe(0);
    expect(roleRank('verified')).toBe(1);
    expect(roleRank('moderator')).toBe(2);
    expect(roleRank('fond')).toBe(3);
    expect(roleRank('software_developer')).toBe(4);
    expect(roleRank('initiator')).toBe(5);
    expect(roleRank('founder')).toBe(6);
    expect(ROLE_ORDER).toEqual([
      'basis',
      'verified',
      'moderator',
      'fond',
      'software_developer',
      'initiator',
      'founder',
    ]);
  });
});

describe('roleAtLeast', () => {
  it.each([
    ['basis', 'basis', true],
    ['basis', 'verified', false],
    ['basis', 'moderator', false],
    ['basis', 'fond', false],
    ['basis', 'software_developer', false],
    ['basis', 'initiator', false],
    ['basis', 'founder', false],
    ['verified', 'basis', true],
    ['verified', 'verified', true],
    ['verified', 'moderator', false],
    ['verified', 'fond', false],
    ['verified', 'software_developer', false],
    ['verified', 'initiator', false],
    ['verified', 'founder', false],
    ['moderator', 'basis', true],
    ['moderator', 'verified', true],
    ['moderator', 'moderator', true],
    ['moderator', 'fond', false],
    ['moderator', 'software_developer', false],
    ['moderator', 'initiator', false],
    ['moderator', 'founder', false],
    ['fond', 'basis', true],
    ['fond', 'verified', true],
    ['fond', 'moderator', true],
    ['fond', 'fond', true],
    ['fond', 'software_developer', false],
    ['fond', 'initiator', false],
    ['fond', 'founder', false],
    ['software_developer', 'basis', true],
    ['software_developer', 'verified', true],
    ['software_developer', 'moderator', true],
    ['software_developer', 'fond', true],
    ['software_developer', 'software_developer', true],
    ['software_developer', 'initiator', false],
    ['software_developer', 'founder', false],
    ['initiator', 'basis', true],
    ['initiator', 'verified', true],
    ['initiator', 'moderator', true],
    ['initiator', 'fond', true],
    ['initiator', 'software_developer', true],
    ['initiator', 'initiator', true],
    ['initiator', 'founder', false],
    ['founder', 'basis', true],
    ['founder', 'verified', true],
    ['founder', 'moderator', true],
    ['founder', 'fond', true],
    ['founder', 'software_developer', true],
    ['founder', 'initiator', true],
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

describe('canEditDailyPayoutRoster', () => {
  it('is true only for initiator and founder, not fond or software developer', () => {
    expect(canEditDailyPayoutRoster('initiator')).toBe(true);
    expect(canEditDailyPayoutRoster('founder')).toBe(true);
    expect(canEditDailyPayoutRoster('software_developer')).toBe(false);
    expect(canEditDailyPayoutRoster('fond')).toBe(false);
    expect(canEditDailyPayoutRoster('moderator')).toBe(false);
    expect(canEditDailyPayoutRoster('verified')).toBe(false);
    expect(canEditDailyPayoutRoster('basis')).toBe(false);
    expect(canEditDailyPayoutRoster(null)).toBe(false);
    expect(canEditDailyPayoutRoster(undefined)).toBe(false);
  });
});

describe('authorCannotReceive', () => {
  const note = { authorCanReceive: false, accountId: 'acc_2' };

  it('is true for a live member note whose author cannot receive', () => {
    expect(authorCannotReceive(note, 'acc_1')).toBe(true);
    expect(authorCannotReceive(note, null)).toBe(true);
  });

  it('is false when the api says the author can receive or sends no field', () => {
    expect(authorCannotReceive({ ...note, authorCanReceive: true }, 'acc_1')).toBe(false);
    expect(authorCannotReceive({ accountId: 'acc_2' }, 'acc_1')).toBe(false);
  });

  it('is false on an own note, a note without an author, and a deleted note', () => {
    expect(authorCannotReceive(note, 'acc_2')).toBe(false);
    expect(authorCannotReceive({ authorCanReceive: false }, 'acc_1')).toBe(false);
    expect(authorCannotReceive({ ...note, deletedAt: '2026-08-28T10:00:00.000Z' }, 'acc_1')).toBe(
      false,
    );
  });
});

describe('isOwnNote', () => {
  it('is true only when both ids are present and equal', () => {
    expect(isOwnNote('acc_1', 'acc_1')).toBe(true);
    expect(isOwnNote('acc_1', 'acc_2')).toBe(false);
    expect(isOwnNote('acc_1', undefined)).toBe(false);
    expect(isOwnNote(null, 'acc_1')).toBe(false);
    expect(isOwnNote(undefined, undefined)).toBe(false);
    expect(isOwnNote('', '')).toBe(false);
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

  it.each(['verified', 'moderator', 'fond', 'software_developer', 'initiator', 'founder'] as const)(
    'is true for a %s account regardless of parent author',
    (role) => {
      expect(isReplyPaymentExempt(account(role), undefined)).toBe(true);
      expect(isReplyPaymentExempt(account(role), 'other')).toBe(true);
      expect(isReplyPaymentExempt(account(role), 'acc_1')).toBe(true);
    },
  );

  it('is true for a basis parent author', () => {
    expect(isReplyPaymentExempt(account('basis'), 'acc_1')).toBe(true);
  });

  it('is false for a basis account that is not the parent author', () => {
    expect(isReplyPaymentExempt(account('basis'), 'other')).toBe(false);
    expect(isReplyPaymentExempt(account('basis'), undefined)).toBe(false);
  });
});
