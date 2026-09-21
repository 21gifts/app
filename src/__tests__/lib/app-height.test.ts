import { describe, expect, it } from 'vitest';
import { APP_HEIGHT_BOOTSTRAP_SCRIPT, resolveAppHeight } from '@/lib/app-height';

describe('APP_HEIGHT_BOOTSTRAP_SCRIPT', () => {
  it('is a non-empty IIFE string that sets --app-height from visualViewport', () => {
    expect(APP_HEIGHT_BOOTSTRAP_SCRIPT.length).toBeGreaterThan(0);
    expect(APP_HEIGHT_BOOTSTRAP_SCRIPT.startsWith('(function(){')).toBe(true);
    expect(APP_HEIGHT_BOOTSTRAP_SCRIPT).toContain('visualViewport');
    expect(APP_HEIGHT_BOOTSTRAP_SCRIPT).toContain('--app-height');
    expect(APP_HEIGHT_BOOTSTRAP_SCRIPT).toContain('innerHeight');
    expect(APP_HEIGHT_BOOTSTRAP_SCRIPT).toContain('setProperty');
    expect(APP_HEIGHT_BOOTSTRAP_SCRIPT).toContain('Math.max');
    expect(APP_HEIGHT_BOOTSTRAP_SCRIPT).toContain('offsetTop');
    const skipWhenPinched = 'Math.abs(vv.scale-1)>0.01){return;}';
    expect(APP_HEIGHT_BOOTSTRAP_SCRIPT).toContain(skipWhenPinched);
  });
});

describe('resolveAppHeight', () => {
  it('uses innerHeight when visualViewport is shorter', () => {
    expect(resolveAppHeight(800, { height: 480 })).toBe(800);
  });

  it('covers visualViewport.offsetTop so a scrolled keyboard viewport cannot leave a gap', () => {
    expect(resolveAppHeight(700, { height: 500, offsetTop: 250 })).toBe(750);
  });

  it('skips the write when visualViewport is pinch-zoomed', () => {
    expect(resolveAppHeight(800, { height: 480, scale: 2 })).toBeNull();
  });

  it('uses max height when scale is 1', () => {
    expect(resolveAppHeight(800, { height: 480, scale: 1 })).toBe(800);
  });

  it('falls back to innerHeight when visualViewport is null', () => {
    expect(resolveAppHeight(500, null)).toBe(500);
  });

  it('falls back to innerHeight when visualViewport is undefined', () => {
    expect(resolveAppHeight(500, undefined)).toBe(500);
  });
});
