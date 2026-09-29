import { describe, expect, it } from 'vitest';
import {
  APP_HEIGHT_BOOTSTRAP_SCRIPT,
  resolveAppHeight,
  resolveAppOffsetTop,
} from '@/lib/app-height';

describe('APP_HEIGHT_BOOTSTRAP_SCRIPT', () => {
  it('is a non-empty IIFE string that sets --app-height from visualViewport', () => {
    expect(APP_HEIGHT_BOOTSTRAP_SCRIPT.length).toBeGreaterThan(0);
    expect(APP_HEIGHT_BOOTSTRAP_SCRIPT.startsWith('(function(){')).toBe(true);
    expect(APP_HEIGHT_BOOTSTRAP_SCRIPT).toContain('visualViewport');
    expect(APP_HEIGHT_BOOTSTRAP_SCRIPT).toContain('--app-height');
    expect(APP_HEIGHT_BOOTSTRAP_SCRIPT).toContain('innerHeight');
    expect(APP_HEIGHT_BOOTSTRAP_SCRIPT).toContain('setProperty');
    expect(APP_HEIGHT_BOOTSTRAP_SCRIPT).not.toContain('Math.max');
    expect(APP_HEIGHT_BOOTSTRAP_SCRIPT).toContain('--app-offset-top');
    expect(APP_HEIGHT_BOOTSTRAP_SCRIPT).not.toContain('h+top');
    expect(APP_HEIGHT_BOOTSTRAP_SCRIPT).not.toContain('offsetTop+');
    const skipWhenPinched = 'Math.abs(vv.scale-1)>0.01){return;}';
    expect(APP_HEIGHT_BOOTSTRAP_SCRIPT).toContain(skipWhenPinched);
  });
});

describe('resolveAppHeight', () => {
  it('uses the visible viewport when it is shorter than innerHeight', () => {
    expect(resolveAppHeight(800, { height: 480 })).toBe(480);
  });

  it('ignores offsetTop so the frame is not taller than the visible viewport', () => {
    expect(resolveAppHeight(700, { height: 500, offsetTop: 250 })).toBe(500);
  });

  it('uses visualViewport.height for the iPhone Safari keyboard geometry', () => {
    expect(resolveAppHeight(852, { height: 511, offsetTop: 200 })).toBe(511);
  });

  it('bootstrap IIFE writes visualViewport.height for that keyboard geometry', () => {
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 852 });
    Object.defineProperty(window, 'visualViewport', {
      configurable: true,
      value: { height: 511, offsetTop: 200, scale: 1 },
    });
    document.documentElement.style.removeProperty('--app-height');
    document.documentElement.style.removeProperty('--app-offset-top');
    new Function(APP_HEIGHT_BOOTSTRAP_SCRIPT)();
    expect(document.documentElement.style.getPropertyValue('--app-height')).toBe('511px');
    expect(document.documentElement.style.getPropertyValue('--app-offset-top')).toBe('200px');
  });

  it('skips the write when visualViewport is pinch-zoomed', () => {
    expect(resolveAppHeight(800, { height: 480, scale: 2 })).toBeNull();
  });

  it('uses visualViewport.height when scale is 1', () => {
    expect(resolveAppHeight(800, { height: 480, scale: 1 })).toBe(480);
  });

  it('falls back to innerHeight when visualViewport is null', () => {
    expect(resolveAppHeight(500, null)).toBe(500);
  });

  it('falls back to innerHeight when visualViewport is undefined', () => {
    expect(resolveAppHeight(500, undefined)).toBe(500);
  });
});

describe('resolveAppOffsetTop', () => {
  it('returns the rounded visual viewport offset and never the height', () => {
    expect(resolveAppOffsetTop({ height: 511, offsetTop: 200, scale: 1 })).toBe(200);
    expect(resolveAppHeight(852, { height: 511, offsetTop: 200, scale: 1 })).toBe(511);
    expect(resolveAppOffsetTop({ height: 400, offsetTop: 10.6, scale: 1 })).toBe(11);
  });

  it('skips the write while pinch-zoomed', () => {
    expect(resolveAppOffsetTop({ height: 511, offsetTop: 200, scale: 2 })).toBeNull();
  });

  it('is zero when the viewport or the offset is missing', () => {
    expect(resolveAppOffsetTop(null)).toBe(0);
    expect(resolveAppOffsetTop(undefined)).toBe(0);
    expect(resolveAppOffsetTop({ height: 480 })).toBe(0);
  });
});
