import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { profileQrLogo } from '@/lib/profile-qr-logo';

describe('profileQrLogo', () => {
  it('is the inlined apple-touch icon', () => {
    const png = readFileSync('public/apple-touch-icon.png');
    expect(profileQrLogo).toBe(`data:image/png;base64,${png.toString('base64')}`);
  });
});
