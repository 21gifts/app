import { describe, expect, it } from 'vitest';
import {
  aboutMeTextProblem,
  displayNameProblem,
  lightningAddressProblem,
  locationProblem,
  usernameProblem,
} from '@/lib/profile-fields';

describe('usernameProblem', () => {
  it('returns empty after trim and does not strip a leading @', () => {
    expect(usernameProblem('')).toBe('empty');
    expect(usernameProblem('   ')).toBe('empty');
    expect(usernameProblem('@ada')).toBe('format');
    expect(usernameProblem(' @ada ')).toBe('format');
  });

  it('returns format for length, a lone underscore, or any other invalid handle', () => {
    expect(usernameProblem('a'.repeat(33))).toBe('format');
    expect(usernameProblem('_')).toBe('format');
    expect(usernameProblem('__')).toBe('format');
    expect(usernameProblem('-ada')).toBe('format');
    expect(usernameProblem('a b')).toBe('format');
    expect(usernameProblem('Ada Lovelace')).toBe('format');
  });

  it('accepts a trimmed lowercase handle of 1 to 32 characters', () => {
    expect(usernameProblem('A')).toBeNull();
    expect(usernameProblem('  Ada.Lovelace_1-x  ')).toBeNull();
    expect(usernameProblem('a'.repeat(32))).toBeNull();
  });
});

describe('displayNameProblem', () => {
  it('returns empty, then long, then controls', () => {
    expect(displayNameProblem('')).toBe('empty');
    expect(displayNameProblem(' \t ')).toBe('empty');
    expect(displayNameProblem('a'.repeat(80))).toBeNull();
    expect(displayNameProblem(`  ${'a'.repeat(80)}  `)).toBeNull();
    expect(displayNameProblem('a'.repeat(81))).toBe('long');
    expect(displayNameProblem(`${'a'.repeat(81)}\u0001`)).toBe('long');
    expect(displayNameProblem('Ada Lovelace')).toBeNull();
    expect(displayNameProblem('Zürich')).toBeNull();
    expect(displayNameProblem('Ada\u0001')).toBe('controls');
    expect(displayNameProblem('Ada\nLovelace')).toBe('controls');
    expect(displayNameProblem('Ada\u007f')).toBe('controls');
  });
});

describe('locationProblem', () => {
  it('treats blank as a valid clear, then length, then controls', () => {
    expect(locationProblem('')).toBeNull();
    expect(locationProblem('   ')).toBeNull();
    expect(locationProblem('Zug')).toBeNull();
    expect(locationProblem('New York')).toBeNull();
    expect(locationProblem('a'.repeat(80))).toBeNull();
    expect(locationProblem('a'.repeat(81))).toBe('long');
    expect(locationProblem(`${'a'.repeat(81)}\u0001`)).toBe('long');
    expect(locationProblem('Zug\u0001')).toBe('controls');
    expect(locationProblem('Zug\u007f')).toBe('controls');
  });
});

describe('lightningAddressProblem', () => {
  it('returns empty, then long, then format', () => {
    expect(lightningAddressProblem('')).toBe('empty');
    expect(lightningAddressProblem('   ')).toBe('empty');
    expect(lightningAddressProblem('a'.repeat(256))).toBe('long');
    expect(lightningAddressProblem(`${'a'.repeat(251)}@b.co`)).toBe('long');
    expect(lightningAddressProblem(`${'a'.repeat(250)}@b.co`)).toBeNull();
    expect(lightningAddressProblem('a'.repeat(255))).toBe('format');
    expect(lightningAddressProblem('bad@example')).toBe('format');
    expect(lightningAddressProblem('a@b.c')).toBe('format');
    expect(lightningAddressProblem('@walletofsatoshi.com')).toBe('format');
    expect(lightningAddressProblem('me@walletofsatoshi.com')).toBeNull();
    expect(lightningAddressProblem('  a.b+c@d-e.co  ')).toBeNull();
  });
});

describe('aboutMeTextProblem', () => {
  it('treats blank as valid, then length, then controls other than line breaks', () => {
    expect(aboutMeTextProblem('')).toBeNull();
    expect(aboutMeTextProblem(' \n\t ')).toBeNull();
    expect(aboutMeTextProblem('I like gifts.')).toBeNull();
    expect(aboutMeTextProblem('Line one.\nLine two.')).toBeNull();
    expect(aboutMeTextProblem('Line one.\rLine two.')).toBeNull();
    expect(aboutMeTextProblem('a'.repeat(8000))).toBeNull();
    expect(aboutMeTextProblem('a'.repeat(8001))).toBe('long');
    expect(aboutMeTextProblem(`${'a'.repeat(8001)}\u0001`)).toBe('long');
    expect(aboutMeTextProblem('Hello\u0001')).toBe('controls');
    expect(aboutMeTextProblem('Hello\u007f')).toBe('controls');
  });
});
