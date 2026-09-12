import { describe, expect, it } from 'vitest';
import { PROJECT_DONATE_ADDRESS } from '@/lib/project-donate';

describe('PROJECT_DONATE_ADDRESS', () => {
  it('is the official 21.gifts Wallet of Satoshi address', () => {
    expect(PROJECT_DONATE_ADDRESS).toBe('21gifts@walletofsatoshi.com');
  });
});
