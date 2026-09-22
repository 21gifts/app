import { describe, expect, it } from 'vitest';
import { encodeLnurl } from '@/lib/lnurl';

describe('encodeLnurl', () => {
  it('encodes a URL whose byte length is not a multiple of 5', () => {
    expect(encodeLnurl('https://service.io/?q=3fc3645b439ce8e7')).toBe(
      'LNURL1DP68GURN8GHJ7UM9WFMXJCM99E5K7TELWY7NXENRXVMRGDTZXSENJCM98PJNWXQ96S9',
    );
  });

  it('encodes a URL whose byte length is a multiple of 5', () => {
    expect(encodeLnurl('https://aa')).toBe('LNURL1DP68GURN8GHJ7CTP6U9UJJ');
  });
});
