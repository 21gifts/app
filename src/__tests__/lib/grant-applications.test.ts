import { describe, expect, it } from 'vitest';
import { grantApplicationStillOpen, grantApplicationsPaused } from '@/lib/grant-applications';

describe('grantApplicationsPaused', () => {
  it('returns true while applications are paused', () => {
    expect(grantApplicationsPaused()).toBe(true);
  });
});

describe('grantApplicationStillOpen', () => {
  it('is true only for the three usernames', () => {
    expect(grantApplicationStillOpen('joey-rosima')).toBe(true);
    expect(grantApplicationStillOpen('vincent')).toBe(true);
    expect(grantApplicationStillOpen('jewel-bacolbas')).toBe(true);
  });

  it('is false for null, omitted, empty, and other usernames', () => {
    expect(grantApplicationStillOpen(null)).toBe(false);
    expect(grantApplicationStillOpen(undefined)).toBe(false);
    expect(grantApplicationStillOpen('')).toBe(false);
    expect(grantApplicationStillOpen('vincent-other')).toBe(false);
    expect(grantApplicationStillOpen('Vincent')).toBe(false);
  });
});
