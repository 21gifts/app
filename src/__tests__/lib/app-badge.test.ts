import { afterEach, describe, expect, it, vi } from 'vitest';
import { bumpUnreadAppBadgeEpoch, setUnreadAppBadge, unreadAppBadgeEpoch } from '@/lib/app-badge';

afterEach(() => {
  vi.unstubAllGlobals();
  Reflect.deleteProperty(navigator, 'setAppBadge');
  Reflect.deleteProperty(navigator, 'clearAppBadge');
});

describe('setUnreadAppBadge', () => {
  it('calls setAppBadge with n when n > 0', () => {
    const setAppBadge = vi.fn().mockResolvedValue(undefined);
    const clearAppBadge = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'setAppBadge', {
      configurable: true,
      value: setAppBadge,
    });
    Object.defineProperty(navigator, 'clearAppBadge', {
      configurable: true,
      value: clearAppBadge,
    });
    setUnreadAppBadge(3);
    expect(setAppBadge).toHaveBeenCalledWith(3);
    expect(clearAppBadge).not.toHaveBeenCalled();
  });

  it('calls clearAppBadge when count is 0', () => {
    const setAppBadge = vi.fn().mockResolvedValue(undefined);
    const clearAppBadge = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'setAppBadge', {
      configurable: true,
      value: setAppBadge,
    });
    Object.defineProperty(navigator, 'clearAppBadge', {
      configurable: true,
      value: clearAppBadge,
    });
    setUnreadAppBadge(0);
    expect(clearAppBadge).toHaveBeenCalledTimes(1);
    expect(setAppBadge).not.toHaveBeenCalled();
  });

  it('does not throw when both APIs are missing', () => {
    expect(() => {
      setUnreadAppBadge(5);
    }).not.toThrow();
    expect(() => {
      setUnreadAppBadge(0);
    }).not.toThrow();
  });

  it('swallows setAppBadge rejections', async () => {
    const setAppBadge = vi.fn().mockRejectedValue(new Error('denied'));
    Object.defineProperty(navigator, 'setAppBadge', {
      configurable: true,
      value: setAppBadge,
    });
    expect(() => {
      setUnreadAppBadge(2);
    }).not.toThrow();
    await Promise.resolve();
    expect(setAppBadge).toHaveBeenCalledWith(2);
  });

  it('swallows clearAppBadge rejections', async () => {
    const clearAppBadge = vi.fn().mockRejectedValue(new Error('denied'));
    Object.defineProperty(navigator, 'clearAppBadge', {
      configurable: true,
      value: clearAppBadge,
    });
    expect(() => {
      setUnreadAppBadge(0);
    }).not.toThrow();
    await Promise.resolve();
    expect(clearAppBadge).toHaveBeenCalledTimes(1);
  });

  it('falls through to clearAppBadge when count > 0 but setAppBadge is missing', () => {
    const clearAppBadge = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clearAppBadge', {
      configurable: true,
      value: clearAppBadge,
    });
    setUnreadAppBadge(4);
    expect(clearAppBadge).toHaveBeenCalledTimes(1);
  });

  it('is a no-op when count > 0 and only setAppBadge is missing', () => {
    expect(() => {
      setUnreadAppBadge(1);
    }).not.toThrow();
  });

  it('bumpUnreadAppBadgeEpoch increments unreadAppBadgeEpoch', () => {
    const before = unreadAppBadgeEpoch();
    expect(bumpUnreadAppBadgeEpoch()).toBe(before + 1);
    expect(unreadAppBadgeEpoch()).toBe(before + 1);
  });

  it('is a no-op when count is 0 and clearAppBadge is missing', () => {
    const setAppBadge = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'setAppBadge', {
      configurable: true,
      value: setAppBadge,
    });
    setUnreadAppBadge(0);
    expect(setAppBadge).not.toHaveBeenCalled();
  });
});
