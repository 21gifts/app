import { describe, expect, it } from 'vitest';
import {
  MissingRequirementsError,
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
  it('prefers rules over name', () => {
    expect(nextPostRequirement(['name', 'rules'])).toBe('rules');
    expect(nextPostRequirement(['name'])).toBe('name');
    expect(nextPostRequirement(['lightning-address'])).toBeNull();
    expect(nextPostRequirement([])).toBeNull();
  });
});
