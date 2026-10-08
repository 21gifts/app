import { describe, expect, it } from 'vitest';
import type { ForumPlaceRow } from '@/lib/api-types';
import { shopCountryFromQuery, shopCountryOptions } from '@/lib/shop-country';

const PIN: ForumPlaceRow = {
  id: 'p',
  name: 'Ada',
  createdAt: '2026-10-01T00:00:00.000Z',
  lat: 14.6,
  lng: 120.98,
  label: null,
  shop: true,
  countryCode: 'PH',
};

describe('shopCountryFromQuery', () => {
  it('reads a known two-letter code in any case', () => {
    expect(shopCountryFromQuery('PH')).toBe('PH');
    expect(shopCountryFromQuery('ke')).toBe('KE');
  });

  it('treats a missing, malformed, or unknown code as All countries', () => {
    expect(shopCountryFromQuery(null)).toBeNull();
    expect(shopCountryFromQuery('')).toBeNull();
    expect(shopCountryFromQuery('PHL')).toBeNull();
    expect(shopCountryFromQuery('P1')).toBeNull();
    expect(shopCountryFromQuery('AA')).toBeNull();
  });
});

describe('shopCountryOptions', () => {
  it('counts shops per country, names them in the UI language, and sorts by name', () => {
    const places: ForumPlaceRow[] = [
      PIN,
      { ...PIN, id: 'p2' },
      { ...PIN, id: 'k1', countryCode: 'KE' },
      { ...PIN, id: 'room', shop: false, countryCode: 'CH' },
      { ...PIN, id: 'sea', countryCode: null },
      { ...PIN, id: 'old', countryCode: undefined },
      { ...PIN, id: 'unnamed', countryCode: 'AA' },
    ];
    expect(shopCountryOptions(places, 'en', null)).toEqual([
      { code: 'AA', name: 'AA', count: 1 },
      { code: 'KE', name: 'Kenya', count: 1 },
      { code: 'PH', name: 'Philippines', count: 2 },
    ]);
    expect(shopCountryOptions(places, 'de', null).map((option) => option.name)).toEqual([
      'AA',
      'Kenia',
      'Philippinen',
    ]);
  });

  it('keeps the selected country with no shop left, and has no counts while loading', () => {
    expect(shopCountryOptions([PIN], 'en', 'KE')).toEqual([
      { code: 'KE', name: 'Kenya', count: 0 },
      { code: 'PH', name: 'Philippines', count: 1 },
    ]);
    expect(shopCountryOptions([PIN], 'en', 'PH')).toEqual([
      { code: 'PH', name: 'Philippines', count: 1 },
    ]);
    expect(shopCountryOptions(null, 'es', 'PH')).toEqual([
      { code: 'PH', name: 'Filipinas', count: null },
    ]);
    expect(shopCountryOptions(null, 'fil', null)).toEqual([]);
  });
});
