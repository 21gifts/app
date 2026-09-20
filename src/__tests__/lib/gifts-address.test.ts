import { describe, expect, it } from 'vitest';
import { giftsLightningAddress } from '@/lib/gifts-address';

describe('giftsLightningAddress', () => {
  it('builds a 21.gifts handle', () => {
    expect(giftsLightningAddress('RoseOtero', '21.gifts')).toBe('roseotero@21.gifts');
  });

  it('uses the site host on preview domains', () => {
    expect(giftsLightningAddress('ada', 'dev.21.gifts')).toBe('ada@dev.21.gifts');
  });

  it('falls back to 21.gifts on loopback', () => {
    expect(giftsLightningAddress('ada', 'localhost')).toBe('ada@21.gifts');
  });

  it('returns null when the username is blank', () => {
    expect(giftsLightningAddress(null)).toBeNull();
    expect(giftsLightningAddress('   ')).toBeNull();
  });
});
