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

describe('useAppHeight and the writing composer', () => {
  /** The forum home composer (`data-writing-composer`) with its text field, and a field outside. */
  function mountComposer(): {
    form: HTMLFormElement;
    field: HTMLTextAreaElement;
    other: HTMLInputElement;
  } {
    const form = document.createElement('form');
    form.setAttribute('data-writing-composer', '');
    const field = document.createElement('textarea');
    form.appendChild(field);
    document.body.appendChild(form);
    const other = document.createElement('input');
    document.body.appendChild(other);
    return { form, field, other };
  }

  function focusIn(target: Element, relatedTarget: EventTarget | null = null): void {
    target.dispatchEvent(new FocusEvent('focusin', { bubbles: true, relatedTarget }));
  }

  function focusOut(target: Element, relatedTarget: EventTarget | null = null): void {
    target.dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget }));
  }

  function viewportListener(
    visualViewport: ReturnType<typeof stubVisualViewport>,
    type: 'resize' | 'scroll',
  ): () => void {
    const call = visualViewport.addEventListener.mock.calls.find((entry) => entry[0] === type);
    if (call === undefined || typeof call[1] !== 'function') {
      throw new Error(`missing visualViewport ${type} listener`);
    }
    return call[1] as () => void;
  }

  function written(): { height: string; offset: string } {
    const style = document.documentElement.style;
    return {
      height: style.getPropertyValue('--app-height'),
      offset: style.getPropertyValue('--app-offset-top'),
    };
  }

  /** Composer focused at full height, then the keyboard shortened the viewport. */
  function openKeyboard(): {
    visualViewport: ReturnType<typeof stubVisualViewport>;
    form: HTMLFormElement;
    field: HTMLTextAreaElement;
    other: HTMLInputElement;
    unmount: () => void;
  } {
    stubInnerHeight(852);
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 393 });
    const visualViewport = stubVisualViewport(852, { offsetTop: 0 });
    const { unmount } = renderHook(() => {
      useAppHeight();
    });
    const nodes = mountComposer();
    focusIn(nodes.field);
    visualViewport.height = 511;
    visualViewport.offsetTop = 200;
    viewportListener(visualViewport, 'resize')();
    expect(written()).toEqual({ height: '511px', offset: '200px' });
    return { visualViewport, unmount, ...nodes };
  }

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.useRealTimers();
    document.body.querySelectorAll('form').forEach((node) => {
      node.remove();
    });
  });

  it('writes the full height and offset 0 at once when the focus leaves the composer for no field, until the viewport catches up', () => {
    const { visualViewport, field } = openKeyboard();
    focusOut(field);
    expect(written()).toEqual({ height: '852px', offset: '0px' });
    // The keyboard is still sliding away: the short viewport does not shrink the frame again.
    viewportListener(visualViewport, 'scroll')();
    expect(written()).toEqual({ height: '852px', offset: '0px' });
    // The late resize reports the full height: it matches, and the hold ends.
    visualViewport.height = 852;
    visualViewport.offsetTop = 0;
    viewportListener(visualViewport, 'resize')();
    expect(written()).toEqual({ height: '852px', offset: '0px' });
    visualViewport.height = 600;
    viewportListener(visualViewport, 'resize')();
    expect(written().height).toBe('600px');
  });

  it('writes the real viewport again once a second has passed without it catching up', () => {
    vi.useFakeTimers();
    const { field } = openKeyboard();
    focusOut(field);
    expect(written().height).toBe('852px');
    vi.advanceTimersByTime(999);
    expect(written().height).toBe('852px');
    vi.advanceTimersByTime(1);
    expect(written()).toEqual({ height: '511px', offset: '200px' });
  });

  it('keeps a pressed composer button inside the composer: no hold', () => {
    const { form, field } = openKeyboard();
    const button = document.createElement('button');
    form.appendChild(button);
    focusOut(field, button);
    expect(written()).toEqual({ height: '511px', offset: '200px' });
  });

  it('does not hold when another text field takes the focus', () => {
    const { field, other } = openKeyboard();
    focusOut(field, other);
    expect(written()).toEqual({ height: '511px', offset: '200px' });
    const editable = document.createElement('div');
    Object.defineProperty(editable, 'isContentEditable', { value: true });
    document.body.appendChild(editable);
    focusOut(field, editable);
    expect(written()).toEqual({ height: '511px', offset: '200px' });
    editable.remove();
  });

  it('holds when the focus moves to a control that opens no keyboard, also once it is focused', () => {
    const { field } = openKeyboard();
    const box = document.createElement('input');
    box.type = 'checkbox';
    document.body.appendChild(box);
    focusOut(field, box);
    expect(written()).toEqual({ height: '852px', offset: '0px' });
    focusIn(box, field);
    expect(written()).toEqual({ height: '852px', offset: '0px' });
  });

  it('holds nothing after entering the composer from another text field', () => {
    const { field, other } = openKeyboard();
    focusOut(field, other);
    focusIn(other, field);
    expect(written().height).toBe('511px');
    // Back into the composer straight from the other field: the keyboard is up, nothing is measured.
    focusOut(other, field);
    focusIn(field, other);
    focusOut(field);
    expect(written().height).toBe('511px');
  });

  it('keeps the measured height when the focus moves inside the composer', () => {
    const { form, field } = openKeyboard();
    const button = document.createElement('button');
    form.appendChild(button);
    focusOut(field, button);
    focusIn(button, field);
    focusOut(button);
    expect(written()).toEqual({ height: '852px', offset: '0px' });
  });

  it('ends the hold when a field takes the focus again, on orientation change, and on unmount', () => {
    vi.useFakeTimers();
    const clear = vi.spyOn(window, 'clearTimeout');
    const { visualViewport, field, other, unmount } = openKeyboard();
    focusOut(field);
    expect(written().height).toBe('852px');
    focusIn(other);
    expect(written()).toEqual({ height: '511px', offset: '200px' });

    /** The keyboard closed, then the composer takes the focus again from no field. */
    const reenter = (): void => {
      visualViewport.height = 852;
      focusIn(field);
      visualViewport.height = 511;
    };
    reenter();
    focusOut(field);
    expect(written().height).toBe('852px');
    window.dispatchEvent(new Event('orientationchange'));
    expect(written().height).toBe('511px');

    reenter();
    focusOut(field);
    expect(written().height).toBe('852px');
    const before = clear.mock.calls.length;
    unmount();
    expect(clear.mock.calls.length).toBeGreaterThan(before);
  });

  it('leaves every other field alone: leaving it writes the short viewport as before', () => {
    stubInnerHeight(852);
    const visualViewport = stubVisualViewport(852, { offsetTop: 0 });
    renderHook(() => {
      useAppHeight();
    });
    const reply = document.createElement('textarea');
    document.body.appendChild(reply);
    focusIn(reply);
    visualViewport.height = 511;
    visualViewport.offsetTop = 200;
    viewportListener(visualViewport, 'resize')();
    focusOut(reply);
    expect(written()).toEqual({ height: '511px', offset: '200px' });
  });

  it('does not hold when the composer took the focus from another field (keyboard already up)', () => {
    stubInnerHeight(852);
    const visualViewport = stubVisualViewport(511, { offsetTop: 200 });
    renderHook(() => {
      useAppHeight();
    });
    const { field, other } = mountComposer();
    focusIn(field, other);
    focusOut(field);
    expect(written()).toEqual({ height: '511px', offset: '200px' });
    expect(visualViewport.height).toBe(511);
  });

  it('measures the full height again at each entry, keeping a held one only while it is held', () => {
    const { visualViewport, field } = openKeyboard();
    focusOut(field);
    expect(written().height).toBe('852px');
    // Back into the composer while the keyboard is still closing: the held 852 stays the full height.
    focusIn(field);
    focusOut(field);
    expect(written().height).toBe('852px');
    // The viewport catches up and then shrinks for good (a toolbar came back): the next entry measures 800.
    visualViewport.height = 852;
    visualViewport.offsetTop = 0;
    viewportListener(visualViewport, 'resize')();
    visualViewport.height = 800;
    viewportListener(visualViewport, 'resize')();
    focusIn(field);
    visualViewport.height = 480;
    viewportListener(visualViewport, 'resize')();
    focusOut(field);
    expect(written().height).toBe('800px');
  });

  it('holds nothing once the width changed, after the focus or during the hold', () => {
    const { visualViewport, field } = openKeyboard();
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 852 });
    focusOut(field);
    expect(written().height).toBe('511px');
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 393 });
    focusIn(field, document.body.querySelector('input'));
    focusIn(field);
    focusOut(field);
    expect(written().height).toBe('511px');
    // A fresh entry at 393 records 511; leaving holds it, and a width change ends the hold.
    visualViewport.height = 300;
    focusOut(field);
    expect(written().height).toBe('511px');
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 852 });
    viewportListener(visualViewport, 'resize')();
    expect(written().height).toBe('300px');
  });

  it('measures nothing while pinch-zoomed', () => {
    stubInnerHeight(852);
    const visualViewport = stubVisualViewport(852, { scale: 2 });
    renderHook(() => {
      useAppHeight();
    });
    const { field } = mountComposer();
    focusIn(field);
    (visualViewport as { scale?: number }).scale = 1;
    visualViewport.height = 511;
    focusOut(field);
    expect(written().height).toBe('511px');
  });
});
