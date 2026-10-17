import { describe, expect, it, vi } from 'vitest';
import { countryDisplayName, countryOptions, ISO_COUNTRIES } from '@/lib/countries';

describe('countries', () => {
  it('includes the ISO 3166-1 alpha-2 codes the API accepts', () => {
    expect(ISO_COUNTRIES.has('CH')).toBe(true);
    expect(ISO_COUNTRIES.has('LI')).toBe(true);
    expect(ISO_COUNTRIES.has('US')).toBe(true);
    expect(ISO_COUNTRIES.has('XX')).toBe(false);
    expect(ISO_COUNTRIES.size).toBeGreaterThan(200);
  });

  it('returns a localized region name, or the code when Intl has none', () => {
    expect(countryDisplayName('CH', 'en')).toBe('Switzerland');
    expect(countryDisplayName('CH', 'de')).toMatch(/Schweiz/);
    expect(countryDisplayName('ZZ', 'en')).toBe('Unknown Region');
    const of = vi.spyOn(Intl.DisplayNames.prototype, 'of');
    of.mockReturnValueOnce(undefined);
    expect(countryDisplayName('CH', 'en')).toBe('CH');
    of.mockImplementationOnce(() => {
      throw new RangeError('invalid');
    });
    expect(countryDisplayName('CH', 'en')).toBe('CH');
    of.mockRestore();
  });

  it('lists every code once, labeled in the locale and sorted by that label', () => {
    const options = countryOptions('en');
    expect(options).toHaveLength(ISO_COUNTRIES.size);
    const codes = options.map((option) => option.value);
    expect(new Set(codes).size).toBe(ISO_COUNTRIES.size);
    for (const option of options) {
      expect(ISO_COUNTRIES.has(option.value)).toBe(true);
      expect(option.label).toBe(countryDisplayName(option.value, 'en'));
    }
    const labels = options.map((option) => option.label);
    const sorted = [...labels].sort((left, right) => left.localeCompare(right, 'en'));
    expect(labels).toEqual(sorted);
    expect(options.find((option) => option.value === 'CH')?.label).toBe('Switzerland');
  });
});
