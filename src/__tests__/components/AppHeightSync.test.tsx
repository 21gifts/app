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
  scale?: number,
): {
  height: number;
  addEventListener: ReturnType<typeof vi.fn>;
  removeEventListener: ReturnType<typeof vi.fn>;
} {
  const visualViewport =
    scale === undefined
      ? {
          height,
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
        }
      : {
          height,
          scale,
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
        };
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
    stubVisualViewport(320, 2);

    renderHook(() => {
      useAppHeight();
    });

    expect(document.documentElement.style.getPropertyValue('--app-height')).toBe('640px');
  });

  it('sets --app-height when visualViewport.scale is 1', () => {
    stubInnerHeight(480);
    stubVisualViewport(480, 1);

    renderHook(() => {
      useAppHeight();
    });

    expect(document.documentElement.style.getPropertyValue('--app-height')).toBe('480px');
  });

  it('uses innerHeight when visualViewport is shorter and no text field is focused', () => {
    stubInnerHeight(852);
    stubVisualViewport(511);

    renderHook(() => {
      useAppHeight();
    });

    expect(document.documentElement.style.getPropertyValue('--app-height')).toBe('852px');
  });

  it('follows visualViewport.height while a textarea is focused', () => {
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

  it('follows visualViewport.height while a text input is focused', () => {
    stubInnerHeight(852);
    stubVisualViewport(511);

    const input = document.createElement('input');
    input.type = 'text';
    document.body.appendChild(input);
    input.focus();

    renderHook(() => {
      useAppHeight();
    });

    expect(document.documentElement.style.getPropertyValue('--app-height')).toBe('511px');
  });

  it('uses innerHeight while a non-text input is focused', () => {
    stubInnerHeight(852);
    stubVisualViewport(511);

    const input = document.createElement('input');
    input.type = 'checkbox';
    document.body.appendChild(input);
    input.focus();

    renderHook(() => {
      useAppHeight();
    });

    expect(document.documentElement.style.getPropertyValue('--app-height')).toBe('852px');
  });

  it('follows visualViewport.height while a contenteditable element is focused', () => {
    stubInnerHeight(852);
    stubVisualViewport(511);

    const editor = document.createElement('div');
    Object.defineProperty(editor, 'isContentEditable', {
      configurable: true,
      get: () => true,
    });
    const activeSpy = vi.spyOn(document, 'activeElement', 'get').mockReturnValue(editor);
    try {
      renderHook(() => {
        useAppHeight();
      });

      expect(document.documentElement.style.getPropertyValue('--app-height')).toBe('511px');
    } finally {
      activeSpy.mockRestore();
    }
  });

  it('treats a missing activeElement as unfocused', () => {
    stubInnerHeight(852);
    stubVisualViewport(511);
    const activeSpy = vi.spyOn(document, 'activeElement', 'get').mockReturnValue(null);
    try {
      renderHook(() => {
        useAppHeight();
      });

      expect(document.documentElement.style.getPropertyValue('--app-height')).toBe('852px');
    } finally {
      activeSpy.mockRestore();
    }
  });
});
