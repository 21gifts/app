import { describe, expect, it } from 'vitest';
import {
  hasAgreedToRules,
  hasDisplayName,
  hasLightningAddress,
  nextOnboardingPath,
} from '@/lib/onboarding';
import type { Account } from '@/lib/api-types';

const base: Account = {
  id: 'acc_1',
  linkingKey: null,
  role: 'basis',
  name: null,
  lightningAddress: null,
  lightningAddressVerified: false,
  forumLawsDismissed: false,
  createdAt: 1,
  rulesAgreedAt: null,
  viewKey: 'a'.repeat(64),
};

describe('onboarding', () => {
  it('sends a new account to the name screen', () => {
    expect(hasDisplayName(base)).toBe(false);
    expect(nextOnboardingPath(base)).toBe('/setup/name');
  });

  it('sends a named account without an address to the address screen', () => {
    const account = { ...base, name: 'Ada' };
    expect(hasDisplayName(account)).toBe(true);
    expect(hasLightningAddress(account)).toBe(false);
    expect(nextOnboardingPath(account)).toBe('/setup/address');
  });

  it('sends name+address without agreement to the rules screen', () => {
    const account = {
      ...base,
      name: 'Ada',
      lightningAddress: 'alice@walletofsatoshi.com',
    };
    expect(hasAgreedToRules(account)).toBe(false);
    expect(nextOnboardingPath(account)).toBe('/setup/rules');
  });

  it('sends a complete account with agreement to welcome', () => {
    const account = {
      ...base,
      name: 'Ada',
      lightningAddress: 'alice@walletofsatoshi.com',
      rulesAgreedAt: 1,
    };
    expect(hasAgreedToRules(account)).toBe(true);
    expect(nextOnboardingPath(account)).toBe('/welcome');
  });

  it('sends agreement without a name to the name screen', () => {
    const account = {
      ...base,
      lightningAddress: 'alice@walletofsatoshi.com',
      rulesAgreedAt: 1,
    };
    expect(nextOnboardingPath(account)).toBe('/setup/name');
  });

  it('treats a missing name as incomplete even when an address exists', () => {
    const account = { ...base, lightningAddress: 'alice@walletofsatoshi.com' };
    expect(nextOnboardingPath(account)).toBe('/setup/name');
  });

  it('treats an empty name as incomplete', () => {
    const account = { ...base, name: '' };
    expect(hasDisplayName(account)).toBe(false);
    expect(nextOnboardingPath(account)).toBe('/setup/name');
  });

  it('treats a whitespace-only name as incomplete', () => {
    const account = { ...base, name: '   ' };
    expect(hasDisplayName(account)).toBe(false);
    expect(nextOnboardingPath(account)).toBe('/setup/name');
  });

  it('treats an empty lightning address as incomplete when named', () => {
    const account = { ...base, name: 'Ada', lightningAddress: '' };
    expect(hasLightningAddress(account)).toBe(false);
    expect(nextOnboardingPath(account)).toBe('/setup/address');
  });

  it('treats a whitespace-only lightning address as incomplete when named', () => {
    const account = { ...base, name: 'Ada', lightningAddress: '   ' };
    expect(hasLightningAddress(account)).toBe(false);
    expect(nextOnboardingPath(account)).toBe('/setup/address');
  });

  it('keeps a whitespace name on the name screen even when an address exists', () => {
    const account = {
      ...base,
      name: '   ',
      lightningAddress: 'alice@walletofsatoshi.com',
    };
    expect(nextOnboardingPath(account)).toBe('/setup/name');
  });
});
