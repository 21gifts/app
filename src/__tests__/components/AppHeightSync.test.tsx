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
  document.documentElement.style.removeProperty('--app-offset-top');
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
    document.documentElement.style.setProperty('--app-offset-top', '9px');
    stubVisualViewport(320, { scale: 2, offsetTop: 40 });

    renderHook(() => {
      useAppHeight();
    });

    expect(document.documentElement.style.getPropertyValue('--app-height')).toBe('640px');
    expect(document.documentElement.style.getPropertyValue('--app-offset-top')).toBe('9px');
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

  it('writes the keyboard offset beside the visible height', () => {
    stubInnerHeight(700);
    stubVisualViewport(500, { offsetTop: 250 });

    renderHook(() => {
      useAppHeight();
    });

    expect(document.documentElement.style.getPropertyValue('--app-height')).toBe('500px');
    expect(document.documentElement.style.getPropertyValue('--app-offset-top')).toBe('250px');
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

  it('does not write when the offset resolver declines after the height was accepted', () => {
    stubInnerHeight(640);
    document.documentElement.style.setProperty('--app-height', '111px');
    document.documentElement.style.setProperty('--app-offset-top', '7px');
    let scaleReads = 0;
    vi.stubGlobal('visualViewport', {
      height: 640,
      offsetTop: 10,
      get scale(): number {
        scaleReads += 1;
        // Height reads scale twice (typeof, then the value). Offset does the same.
        return scaleReads <= 2 ? 1 : 2;
      },
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });

    renderHook(() => {
      useAppHeight();
    });

    expect(scaleReads).toBeGreaterThanOrEqual(4);
    expect(document.documentElement.style.getPropertyValue('--app-height')).toBe('111px');
    expect(document.documentElement.style.getPropertyValue('--app-offset-top')).toBe('7px');
  });

  it('rewrites the height on window resize, orientation change, and viewport scroll', () => {
    stubInnerHeight(800);
    const visualViewport = stubVisualViewport(800);
    renderHook(() => {
      useAppHeight();
    });

    visualViewport.height = 600;
    window.dispatchEvent(new Event('resize'));
    expect(document.documentElement.style.getPropertyValue('--app-height')).toBe('600px');

    visualViewport.height = 500;
    window.dispatchEvent(new Event('orientationchange'));
    expect(document.documentElement.style.getPropertyValue('--app-height')).toBe('500px');

    visualViewport.height = 450;
    const scroll = visualViewport.addEventListener.mock.calls.find((call) => call[0] === 'scroll');
    expect(scroll).toBeDefined();
    if (scroll === undefined || typeof scroll[1] !== 'function') {
      throw new Error('missing visualViewport scroll listener');
    }
    scroll[1]();
    expect(document.documentElement.style.getPropertyValue('--app-height')).toBe('450px');
  });

  it('reveals a focused field inside the active scrollport and ignores anything else', () => {
    stubInnerHeight(800);
    const visualViewport = stubVisualViewport(800);
    renderHook(() => {
      useAppHeight();
    });
    const scroll = visualViewport.addEventListener.mock.calls.find((call) => call[0] === 'scroll');
    if (scroll === undefined || typeof scroll[1] !== 'function') {
      throw new Error('missing visualViewport scroll listener');
    }
    const onScroll = scroll[1] as () => void;

    const scroller = document.createElement('div');
    scroller.setAttribute('data-scrollport', '');
    scroller.setAttribute('data-scroll-active', '');
    let top = 0;
    Object.defineProperty(scroller, 'scrollTop', {
      configurable: true,
      get: () => top,
      set: (value: number) => {
        top = value;
      },
    });
    const box = (y: number, height: number): DOMRect => ({
      x: 0,
      y,
      left: 0,
      right: 100,
      width: 100,
      height,
      top: y,
      bottom: y + height,
      toJSON: () => ({}),
    });
    scroller.getBoundingClientRect = () => box(0, 200);
    document.body.appendChild(scroller);

    const textarea = document.createElement('textarea');
    textarea.getBoundingClientRect = () => box(400, 30);
    scroller.appendChild(textarea);
    textarea.focus();
    onScroll();
    expect(top).toBe(242);

    const select = document.createElement('select');
    select.getBoundingClientRect = () => box(400, 30);
    scroller.appendChild(select);
    select.focus();
    top = 0;
    onScroll();
    expect(top).toBe(242);

    const outside = document.createElement('input');
    document.body.appendChild(outside);
    outside.focus();
    onScroll();
    expect(top).toBe(242);

    const button = document.createElement('button');
    document.body.appendChild(button);
    button.focus();
    onScroll();
    expect(top).toBe(242);

    scroller.remove();
    outside.remove();
    button.remove();
  });

  it('cancels a queued focus reveal when focus moves again', () => {
    stubInnerHeight(800);
    stubVisualViewport(800);
    const frames: FrameRequestCallback[] = [];
    const cancel = vi.fn();
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback): number => {
      frames.push(callback);
      return frames.length;
    });
    vi.stubGlobal('cancelAnimationFrame', cancel);

    const scroller = document.createElement('div');
    scroller.setAttribute('data-scrollport', '');
    scroller.setAttribute('data-scroll-active', '');
    let top = 0;
    Object.defineProperty(scroller, 'scrollTop', {
      configurable: true,
      get: () => top,
      set: (value: number) => {
        top = value;
      },
    });
    scroller.getBoundingClientRect = () =>
      ({
        x: 0,
        y: 0,
        left: 0,
        right: 100,
        width: 100,
        height: 200,
        top: 0,
        bottom: 200,
        toJSON: () => ({}),
      }) as DOMRect;
    document.body.appendChild(scroller);
    const textarea = document.createElement('textarea');
    textarea.getBoundingClientRect = () =>
      ({
        x: 0,
        y: 400,
        left: 0,
        right: 100,
        width: 100,
        height: 30,
        top: 400,
        bottom: 430,
        toJSON: () => ({}),
      }) as DOMRect;
    scroller.appendChild(textarea);
    const input = document.createElement('input');
    input.getBoundingClientRect = () =>
      ({
        x: 0,
        y: 400,
        left: 0,
        right: 100,
        width: 100,
        height: 30,
        top: 400,
        bottom: 430,
        toJSON: () => ({}),
      }) as DOMRect;
    scroller.appendChild(input);

    const { unmount } = renderHook(() => {
      useAppHeight();
    });
    input.focus();
    textarea.focus();
    expect(cancel).toHaveBeenCalled();
    const latest = frames.at(-1);
    if (latest === undefined) {
      throw new Error('missing focus reveal frame');
    }
    latest(0);
    expect(top).toBe(242);

    input.focus();
    unmount();
    expect(cancel.mock.calls.length).toBeGreaterThan(1);
    scroller.remove();
  });
});
