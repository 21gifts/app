import { cleanup, render } from '@testing-library/react';
import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppHeightSync, useAppHeight } from '@/components/AppHeightSync';

function stubInnerHeight(height: number): void {
  Object.defineProperty(window, 'innerHeight', {
    configurable: true,
    value: height,
  });
}

function stubVisualViewport(
  height: number,
  extras?: { scale?: number; offsetTop?: number },
): {
  height: number;
  offsetTop?: number;
  addEventListener: ReturnType<typeof vi.fn>;
  removeEventListener: ReturnType<typeof vi.fn>;
} {
  const visualViewport: {
    height: number;
    scale?: number;
    offsetTop?: number;
    addEventListener: ReturnType<typeof vi.fn>;
    removeEventListener: ReturnType<typeof vi.fn>;
  } = {
    height,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  };
  if (extras !== undefined && extras.scale !== undefined) {
    visualViewport.scale = extras.scale;
  }
  if (extras !== undefined && extras.offsetTop !== undefined) {
    visualViewport.offsetTop = extras.offsetTop;
  }
  vi.stubGlobal('visualViewport', visualViewport);
  return visualViewport;
}

afterEach(() => {
  cleanup();
  document.documentElement.style.removeProperty('--app-height');
  vi.unstubAllGlobals();
  document.body.querySelectorAll('textarea, input, [contenteditable]').forEach((node) => {
    if (node instanceof HTMLElement) {
      node.blur();
    }
    node.remove();
  });
});

describe('AppHeightSync', () => {
  it('calls useAppHeight and renders nothing', () => {
    stubInnerHeight(640);
    const { container } = render(<AppHeightSync />);
    expect(container.firstChild).toBeNull();
    expect(document.documentElement.style.getPropertyValue('--app-height')).not.toBe('');
  });
});

describe('useAppHeight', () => {
  it('sets --app-height from visualViewport and cleans up listeners', () => {
    stubInnerHeight(640);
    const visualViewport = stubVisualViewport(640);
    const winAdd = vi.spyOn(window, 'addEventListener');
    const winRemove = vi.spyOn(window, 'removeEventListener');

    const { unmount } = renderHook(() => {
      useAppHeight();
    });

    expect(document.documentElement.style.getPropertyValue('--app-height')).toBe('640px');
    expect(visualViewport.addEventListener).toHaveBeenCalledWith('resize', expect.any(Function));
    expect(visualViewport.addEventListener).toHaveBeenCalledWith('scroll', expect.any(Function));
    expect(winAdd).toHaveBeenCalledWith('orientationchange', expect.any(Function));

    unmount();

    expect(visualViewport.removeEventListener).toHaveBeenCalledWith('resize', expect.any(Function));
    expect(visualViewport.removeEventListener).toHaveBeenCalledWith('scroll', expect.any(Function));
    expect(winRemove).toHaveBeenCalledWith('orientationchange', expect.any(Function));
  });

  it('uses window.resize when visualViewport is missing', () => {
    Object.defineProperty(window, 'visualViewport', {
      configurable: true,
      value: undefined,
    });
    stubInnerHeight(500);
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

  it('uses innerHeight when visualViewport is null', () => {
    Object.defineProperty(window, 'visualViewport', {
      configurable: true,
      value: null,
    });
    stubInnerHeight(500);

    renderHook(() => {
      useAppHeight();
    });

    expect(document.documentElement.style.getPropertyValue('--app-height')).toBe('500px');
  });

  it('does not shrink --app-height while visualViewport is zoomed', () => {
    stubInnerHeight(640);
    document.documentElement.style.setProperty('--app-height', '640px');
    stubVisualViewport(320, { scale: 2 });

    renderHook(() => {
      useAppHeight();
    });

    expect(document.documentElement.style.getPropertyValue('--app-height')).toBe('640px');
  });

  it('sets --app-height when visualViewport.scale is 1', () => {
    stubInnerHeight(480);
    stubVisualViewport(480, { scale: 1 });

    renderHook(() => {
      useAppHeight();
    });

    expect(document.documentElement.style.getPropertyValue('--app-height')).toBe('480px');
  });

  it('uses the visible viewport when visualViewport is shorter', () => {
    stubInnerHeight(852);
    stubVisualViewport(511);

    renderHook(() => {
      useAppHeight();
    });

    expect(document.documentElement.style.getPropertyValue('--app-height')).toBe('511px');
  });

  it('uses the visible viewport height while a textarea is focused', () => {
    stubInnerHeight(852);
    stubVisualViewport(511);

    const textarea = document.createElement('textarea');
    document.body.appendChild(textarea);
    textarea.focus();

    renderHook(() => {
      useAppHeight();
    });

    expect(document.documentElement.style.getPropertyValue('--app-height')).toBe('511px');
  });

  it('ignores offsetTop when the keyboard scrolls the visual viewport', () => {
    stubInnerHeight(700);
    stubVisualViewport(500, { offsetTop: 250 });

    renderHook(() => {
      useAppHeight();
    });

    expect(document.documentElement.style.getPropertyValue('--app-height')).toBe('500px');
  });

  it('follows the shortened visual viewport after focus', () => {
    stubInnerHeight(852);
    const visualViewport = stubVisualViewport(852);
    renderHook(() => {
      useAppHeight();
    });
    expect(document.documentElement.style.getPropertyValue('--app-height')).toBe('852px');

    const textarea = document.createElement('textarea');
    document.body.appendChild(textarea);
    textarea.focus();
    visualViewport.height = 511;
    visualViewport.offsetTop = 200;
    const resize = visualViewport.addEventListener.mock.calls.find((call) => call[0] === 'resize');
    expect(resize).toBeDefined();
    if (resize === undefined) {
      throw new Error('missing visualViewport resize listener');
    }
    const onResize = resize[1];
    if (typeof onResize !== 'function') {
      throw new Error('visualViewport resize listener is not a function');
    }
    onResize();

    expect(document.documentElement.style.getPropertyValue('--app-height')).toBe('511px');
  });

  it('registers document focus listeners and window resize and removes them on unmount', () => {
    stubInnerHeight(640);
    stubVisualViewport(640);
    const winAdd = vi.spyOn(window, 'addEventListener');
    const winRemove = vi.spyOn(window, 'removeEventListener');
    const docAdd = vi.spyOn(document, 'addEventListener');
    const docRemove = vi.spyOn(document, 'removeEventListener');

    const { unmount } = renderHook(() => {
      useAppHeight();
    });

    expect(winAdd).toHaveBeenCalledWith('resize', expect.any(Function));
    expect(winAdd).toHaveBeenCalledWith('orientationchange', expect.any(Function));
    expect(docAdd).toHaveBeenCalledWith('focusin', expect.any(Function));
    expect(docAdd).toHaveBeenCalledWith('focusout', expect.any(Function));

    unmount();

    expect(winRemove).toHaveBeenCalledWith('resize', expect.any(Function));
    expect(winRemove).toHaveBeenCalledWith('orientationchange', expect.any(Function));
    expect(docRemove).toHaveBeenCalledWith('focusin', expect.any(Function));
    expect(docRemove).toHaveBeenCalledWith('focusout', expect.any(Function));
  });

  it('uses the visible viewport when nothing is focused', () => {
    stubInnerHeight(852);
    stubVisualViewport(511);
    const activeSpy = vi.spyOn(document, 'activeElement', 'get').mockReturnValue(null);
    try {
      renderHook(() => {
        useAppHeight();
      });

      expect(document.documentElement.style.getPropertyValue('--app-height')).toBe('511px');
    } finally {
      activeSpy.mockRestore();
    }
  });
});
