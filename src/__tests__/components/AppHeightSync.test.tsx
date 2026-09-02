import { cleanup, render } from '@testing-library/react';
import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppHeightSync, useAppHeight } from '@/components/AppHeightSync';

afterEach(() => {
  cleanup();
  document.documentElement.style.removeProperty('--app-height');
  vi.unstubAllGlobals();
});

describe('AppHeightSync', () => {
  it('calls useAppHeight and renders nothing', () => {
    const { container } = render(<AppHeightSync />);
    expect(container.firstChild).toBeNull();
    expect(document.documentElement.style.getPropertyValue('--app-height')).not.toBe('');
  });
});

describe('useAppHeight', () => {
  it('sets --app-height from visualViewport and cleans up listeners', () => {
    const addEventListener = vi.fn();
    const removeEventListener = vi.fn();
    const visualViewport = {
      height: 640,
      addEventListener,
      removeEventListener,
    };
    vi.stubGlobal('visualViewport', visualViewport);
    const winAdd = vi.spyOn(window, 'addEventListener');
    const winRemove = vi.spyOn(window, 'removeEventListener');

    const { unmount } = renderHook(() => {
      useAppHeight();
    });

    expect(document.documentElement.style.getPropertyValue('--app-height')).toBe('640px');
    expect(addEventListener).toHaveBeenCalledWith('resize', expect.any(Function));
    expect(addEventListener).toHaveBeenCalledWith('scroll', expect.any(Function));
    expect(winAdd).toHaveBeenCalledWith('orientationchange', expect.any(Function));

    unmount();

    expect(removeEventListener).toHaveBeenCalledWith('resize', expect.any(Function));
    expect(removeEventListener).toHaveBeenCalledWith('scroll', expect.any(Function));
    expect(winRemove).toHaveBeenCalledWith('orientationchange', expect.any(Function));
  });

  it('uses window.resize when visualViewport is missing', () => {
    Object.defineProperty(window, 'visualViewport', {
      configurable: true,
      value: undefined,
    });
    Object.defineProperty(window, 'innerHeight', {
      configurable: true,
      value: 500,
    });
    const winAdd = vi.spyOn(window, 'addEventListener');
    const winRemove = vi.spyOn(window, 'removeEventListener');

    const { unmount } = renderHook(() => {
      useAppHeight();
    });

    expect(document.documentElement.style.getPropertyValue('--app-height')).toBe('500px');
    expect(winAdd).toHaveBeenCalledWith('resize', expect.any(Function));

    unmount();

    expect(winRemove).toHaveBeenCalledWith('resize', expect.any(Function));
  });
});
