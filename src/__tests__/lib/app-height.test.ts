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
    const skipWhenPinched = 'Math.abs(vv.scale-1)>0.01){return;}';
    expect(APP_HEIGHT_BOOTSTRAP_SCRIPT).toContain(skipWhenPinched);
  });
});

describe('resolveAppHeight', () => {
  it('uses innerHeight when visualViewport is shorter and no text field is focused', () => {
    expect(resolveAppHeight(800, { height: 480 }, false)).toBe(800);
  });

  it('follows visualViewport.height while a text field is focused', () => {
    expect(resolveAppHeight(800, { height: 480 }, true)).toBe(480);
  });

  it('skips the write when visualViewport is pinch-zoomed', () => {
    expect(resolveAppHeight(800, { height: 480, scale: 2 }, false)).toBeNull();
  });

  it('uses max height when scale is 1', () => {
    expect(resolveAppHeight(800, { height: 480, scale: 1 }, false)).toBe(800);
  });

  it('falls back to innerHeight when visualViewport is null', () => {
    expect(resolveAppHeight(500, null, false)).toBe(500);
  });

  it('falls back to innerHeight when visualViewport is undefined', () => {
    expect(resolveAppHeight(500, undefined, true)).toBe(500);
  });
});
