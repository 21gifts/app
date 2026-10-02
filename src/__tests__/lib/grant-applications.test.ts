import { describe, expect, it } from 'vitest';
import { grantApplicationsPaused } from '@/lib/grant-applications';

describe('grantApplicationsPaused', () => {
  it('returns true while applications are paused', () => {
    expect(grantApplicationsPaused()).toBe(true);
  });
});
