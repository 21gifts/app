import { describe, expect, it } from 'vitest';
import { APP_HEIGHT_BOOTSTRAP_SCRIPT } from '@/lib/app-height';

describe('APP_HEIGHT_BOOTSTRAP_SCRIPT', () => {
  it('is a non-empty IIFE string that sets --app-height from visualViewport', () => {
    expect(APP_HEIGHT_BOOTSTRAP_SCRIPT.length).toBeGreaterThan(0);
    expect(APP_HEIGHT_BOOTSTRAP_SCRIPT.startsWith('(function(){')).toBe(true);
    expect(APP_HEIGHT_BOOTSTRAP_SCRIPT).toContain('visualViewport');
    expect(APP_HEIGHT_BOOTSTRAP_SCRIPT).toContain('--app-height');
    expect(APP_HEIGHT_BOOTSTRAP_SCRIPT).toContain('innerHeight');
    expect(APP_HEIGHT_BOOTSTRAP_SCRIPT).toContain('setProperty');
  });
});
