import { describe, expect, it } from 'vitest';
import {
  MissingRequirementsError,
  nextContactRequirement,
  nextPostRequirement,
  parseMissingRequirements,
} from '@/lib/missing-requirements';

describe('parseMissingRequirements', () => {
  it('parses a valid missing_requirements body', () => {
    const err = parseMissingRequirements({
      error: 'missing_requirements',
      missing: ['name', 'rules'],
    });
    expect(err).toBeInstanceOf(MissingRequirementsError);
    expect(err?.missing).toEqual(['name', 'rules']);
  });

  it('returns null for unrelated bodies', () => {
    expect(parseMissingRequirements(null)).toBeNull();
    expect(parseMissingRequirements({ error: 'other' })).toBeNull();
    expect(parseMissingRequirements({ error: 'missing_requirements' })).toBeNull();
    expect(
      parseMissingRequirements({ error: 'missing_requirements', missing: ['nope'] }),
    ).toBeNull();
  });
});

describe('nextPostRequirement', () => {
  it('prefers rules, then name, then lightning-address', () => {
    expect(nextPostRequirement(['name', 'rules', 'lightning-address'])).toBe('rules');
    expect(nextPostRequirement(['name', 'lightning-address'])).toBe('name');
    expect(nextPostRequirement(['lightning-address'])).toBe('lightning-address');
    expect(nextPostRequirement([])).toBeNull();
  });
});

describe('nextContactRequirement', () => {
  it('prefers rules over name and ignores lightning-address', () => {
    expect(nextContactRequirement(['name', 'rules'])).toBe('rules');
    expect(nextContactRequirement(['name'])).toBe('name');
    expect(nextContactRequirement(['lightning-address'])).toBeNull();
    expect(nextContactRequirement(['name', 'lightning-address'])).toBe('name');
    expect(nextContactRequirement([])).toBeNull();
  });
});
