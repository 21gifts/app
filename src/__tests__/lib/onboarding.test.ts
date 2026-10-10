import { describe, expect, it } from 'vitest';
import { hasAgreedToRules, hasDisplayName, nextOnboardingPath } from '@/lib/onboarding';
import type { Account } from '@/lib/api-types';

const base: Account = {
  id: 'acc_1',
  linkingKey: null,
  role: 'basis',
  name: null,
  location: null,
  lightningAddress: null,
  lightningAddressVerified: false,
  forumLawsDismissed: false,
  createdAt: 1,
  rulesAgreedAt: null,
  viewKey: 'a'.repeat(64),
  aboutMe: null,
  aboutMeHasPhoto: false,
  setup: 'name',
  missing: ['name', 'lightning-address', 'rules'],
};

describe('onboarding', () => {
  it('maps setup wallet to the name screen when name is missing', () => {
    const account = {
      ...base,
      setup: 'wallet' as const,
      missing: ['wallet', 'name', 'lightning-address', 'rules'] as Account['missing'],
    };
    expect(nextOnboardingPath(account)).toBe('/setup/name');
  });

  it('maps setup wallet to the username screen when the name is set', () => {
    const account = {
      ...base,
      name: 'Ada',
      setup: 'wallet' as const,
      missing: ['username', 'lightning-address', 'rules'] as Account['missing'],
    };
    expect(nextOnboardingPath(account)).toBe('/setup/username');
    expect(nextOnboardingPath({ ...account, username: '  ' })).toBe('/setup/username');
  });

  it('maps setup wallet to the rules screen when the username is set, without an address step', () => {
    const account = {
      ...base,
      name: 'Ada',
      username: 'ada',
      lightningAddress: null,
      setup: 'wallet' as const,
      missing: ['lightning-address', 'rules'] as Account['missing'],
    };
    expect(nextOnboardingPath(account)).toBe('/setup/rules');
  });

  it('maps setup wallet to welcome when name, username, and rules are set', () => {
    const account = {
      ...base,
      name: 'Ada',
      username: 'ada',
      lightningAddress: null,
      rulesAgreedAt: 1,
      setup: 'wallet' as const,
      missing: ['wallet'] as Account['missing'],
    };
    expect(nextOnboardingPath(account)).toBe('/welcome');
  });

  it('maps setup name to the name screen', () => {
    expect(hasDisplayName(base)).toBe(false);
    expect(nextOnboardingPath(base)).toBe('/setup/name');
  });

  it('maps setup username to the username screen', () => {
    const account = {
      ...base,
      name: 'Ada',
      setup: 'username' as const,
      missing: ['username', 'lightning-address', 'rules'] as Account['missing'],
    };
    expect(nextOnboardingPath(account)).toBe('/setup/username');
  });

  it('maps setup lightning-address to username, rules, then welcome', () => {
    const account = {
      ...base,
      name: 'Ada',
      setup: 'lightning-address' as const,
      missing: ['username', 'lightning-address', 'rules'] as Account['missing'],
    };
    expect(hasDisplayName(account)).toBe(true);
    expect(nextOnboardingPath(account)).toBe('/setup/username');
    expect(nextOnboardingPath({ ...account, username: 'ada' })).toBe('/setup/rules');
    expect(nextOnboardingPath({ ...account, username: 'ada', rulesAgreedAt: 1 })).toBe('/welcome');
  });

  it('maps setup rules to the rules screen', () => {
    const account = {
      ...base,
      name: 'Ada',
      lightningAddress: null,
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
      lightningAddress: null,
      rulesAgreedAt: 1,
      setup: null,
      missing: [] as Account['missing'],
    };
    expect(hasAgreedToRules(account)).toBe(true);
    expect(nextOnboardingPath(account)).toBe('/welcome');
  });

  it('follows setup lightning-address past a skipped name', () => {
    const account = {
      ...base,
      setup: 'lightning-address' as const,
      missing: ['name', 'username', 'lightning-address', 'rules'] as Account['missing'],
    };
    expect(hasDisplayName(account)).toBe(false);
    expect(nextOnboardingPath(account)).toBe('/setup/username');
  });

  it('sends a skipped name with a username from setup lightning-address to rules', () => {
    const account = {
      ...base,
      name: null,
      username: 'ada',
      setup: 'lightning-address' as const,
      missing: ['name', 'lightning-address', 'rules'] as Account['missing'],
    };
    expect(hasDisplayName(account)).toBe(false);
    expect(nextOnboardingPath(account)).toBe('/setup/rules');
    expect(nextOnboardingPath({ ...account, rulesAgreedAt: 1 })).toBe('/welcome');
  });

  it('treats an empty name as incomplete for hasDisplayName', () => {
    const account = { ...base, name: '' };
    expect(hasDisplayName(account)).toBe(false);
  });

  it('treats a whitespace-only name as incomplete for hasDisplayName', () => {
    const account = { ...base, name: '   ' };
    expect(hasDisplayName(account)).toBe(false);
  });
});
