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
  setup: 'name',
  missing: ['name', 'lightning-address', 'rules'],
};

describe('onboarding', () => {
  it('maps setup name to the name screen', () => {
    expect(hasDisplayName(base)).toBe(false);
    expect(nextOnboardingPath(base)).toBe('/setup/name');
  });

  it('maps setup lightning-address to the address screen', () => {
    const account = {
      ...base,
      name: 'Ada',
      setup: 'lightning-address' as const,
      missing: ['lightning-address', 'rules'] as Account['missing'],
    };
    expect(hasDisplayName(account)).toBe(true);
    expect(hasLightningAddress(account)).toBe(false);
    expect(nextOnboardingPath(account)).toBe('/setup/address');
  });

  it('maps setup rules to the rules screen', () => {
    const account = {
      ...base,
      name: 'Ada',
      lightningAddress: 'alice@walletofsatoshi.com',
      setup: 'rules' as const,
      missing: ['rules'] as Account['missing'],
    };
    expect(hasAgreedToRules(account)).toBe(false);
    expect(nextOnboardingPath(account)).toBe('/setup/rules');
  });

  it('maps setup null to welcome', () => {
    const account = {
      ...base,
      name: 'Ada',
      lightningAddress: 'alice@walletofsatoshi.com',
      rulesAgreedAt: 1,
      setup: null,
      missing: [] as Account['missing'],
    };
    expect(hasAgreedToRules(account)).toBe(true);
    expect(nextOnboardingPath(account)).toBe('/welcome');
  });

  it('follows setup even when name is still missing after a skip', () => {
    const account = {
      ...base,
      setup: 'lightning-address' as const,
      missing: ['name', 'lightning-address', 'rules'] as Account['missing'],
    };
    expect(hasDisplayName(account)).toBe(false);
    expect(nextOnboardingPath(account)).toBe('/setup/address');
  });

  it('treats an empty name as incomplete for hasDisplayName', () => {
    const account = { ...base, name: '' };
    expect(hasDisplayName(account)).toBe(false);
  });

  it('treats a whitespace-only name as incomplete for hasDisplayName', () => {
    const account = { ...base, name: '   ' };
    expect(hasDisplayName(account)).toBe(false);
  });

  it('treats an empty lightning address as incomplete for hasLightningAddress', () => {
    const account = { ...base, name: 'Ada', lightningAddress: '' };
    expect(hasLightningAddress(account)).toBe(false);
  });

  it('treats a whitespace-only lightning address as incomplete for hasLightningAddress', () => {
    const account = { ...base, name: 'Ada', lightningAddress: '   ' };
    expect(hasLightningAddress(account)).toBe(false);
  });
});
