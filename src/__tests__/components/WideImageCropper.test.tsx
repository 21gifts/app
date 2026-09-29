import { act, cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WideImageCropper } from '@/components/WideImageCropper';
import { renderWithLocale } from '@/__tests__/render-with-locale';

if (typeof globalThis.PointerEvent === 'undefined') {
  class PointerEventPolyfill extends MouseEvent {
    pointerId: number;
    constructor(type: string, init: MouseEventInit & { pointerId?: number } = {}) {
      super(type, init);
      this.pointerId = init.pointerId ?? 0;
    }
  }
  globalThis.PointerEvent = PointerEventPolyfill as unknown as typeof PointerEvent;
}

class FakeResizeObserver {
  static last: FakeResizeObserver | null = null;
  readonly disconnect = vi.fn();

  constructor(private readonly callback: ResizeObserverCallback) {
    FakeResizeObserver.last = this;
  }

  observe(): void {}

  fire(): void {
    this.callback([], this as unknown as ResizeObserver);
  }
}

function jpeg(name = 'shot.jpg'): File {
  return new File([new Uint8Array([0xff, 0xd8, 0xff])], name, { type: 'image/jpeg' });
}

function stubRect(width: number, height: number): void {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
    width,
    height,
    top: 0,
    left: 0,
    bottom: height,
    right: width,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  });
}

function stubBitmap(width: number, height: number, close = vi.fn()): ReturnType<typeof vi.fn> {
  return vi.fn().mockResolvedValue({ width, height, close });
}

function frame(): HTMLElement {
  return screen.getByRole('group', { name: 'Drag the photo to choose the wide image' });
}

async function enabledUse(): Promise<HTMLButtonElement> {
  const button = await waitFor(() => {
    const found = screen.getByRole('button', { name: 'Use this crop' }) as HTMLButtonElement;
    expect(found.disabled).toBe(false);
    return found;
  });
  return button;
}

beforeEach(() => {
  FakeResizeObserver.last = null;
  Object.defineProperty(HTMLElement.prototype, 'setPointerCapture', {
    configurable: true,
    value: () => undefined,
  });
  stubRect(250, 100);
  vi.stubGlobal('ResizeObserver', FakeResizeObserver);
  Object.defineProperty(URL, 'createObjectURL', {
    configurable: true,
    writable: true,
    value: vi.fn(() => 'blob:crop'),
  });
  Object.defineProperty(URL, 'revokeObjectURL', {
    configurable: true,
    writable: true,
    value: vi.fn(),
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('WideImageCropper', () => {
  it('shows the hint and frames a decoded photo', async () => {
    vi.stubGlobal('createImageBitmap', stubBitmap(1000, 1000));
    renderWithLocale(
      <WideImageCropper file={jpeg()} onConfirm={vi.fn()} onCancel={vi.fn()} onError={vi.fn()} />,
    );
    expect(screen.getByText('Drag the photo to choose the wide image')).toBeTruthy();
    const img = frame().querySelector('image');
    await enabledUse();
    expect(img?.getAttribute('width')).toBe('250');
    expect(img?.getAttribute('y')).toBe('-75');
  });

  it('leaves the photo unplaced until the frame has width', async () => {
    stubRect(0, 0);
    vi.stubGlobal('createImageBitmap', stubBitmap(1000, 800));
    renderWithLocale(
      <WideImageCropper file={jpeg()} onConfirm={vi.fn()} onCancel={vi.fn()} onError={vi.fn()} />,
    );
    await enabledUse();
    expect(frame().querySelector('image')?.getAttribute('width')).toBeNull();
  });

  it('cancels without a photo and ignores a confirm before decode', async () => {
    let resolveBitmap: (value: { width: number; height: number; close: () => void }) => void = () =>
      undefined;
    vi.stubGlobal(
      'createImageBitmap',
      () =>
        new Promise((resolve) => {
          resolveBitmap = resolve;
        }),
    );
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    const onError = vi.fn();
    const view = renderWithLocale(
      <WideImageCropper
        file={jpeg()}
        onConfirm={onConfirm}
        onCancel={onCancel}
        onError={onError}
      />,
    );
    fireEvent.pointerDown(frame(), { pointerId: 1, clientX: 1, clientY: 1 });
    fireEvent.pointerMove(frame(), { pointerId: 1, clientX: 8, clientY: 8 });
    fireEvent.pointerMove(frame(), { pointerId: 9, clientX: 8, clientY: 8 });
    fireEvent.wheel(frame(), { deltaY: -20 });
    const use = screen.getByRole('button', { name: 'Use this crop' }) as HTMLButtonElement;
    expect(use.disabled).toBe(true);
    use.disabled = false;
    fireEvent.click(use);
    expect(onConfirm).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
    expect(screen.queryByText('Cancel crop')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel crop' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    const close = vi.fn();
    view.unmount();
    await act(async () => {
      resolveBitmap({ width: 20, height: 20, close });
    });
    expect(onError).not.toHaveBeenCalled();
    expect(close).toHaveBeenCalled();
  });

  it('ignores a decode error that arrives after the cropper closes', async () => {
    let rejectBitmap: (error: Error) => void = () => undefined;
    vi.stubGlobal(
      'createImageBitmap',
      () =>
        new Promise((_resolve, reject) => {
          rejectBitmap = reject;
        }),
    );
    const onError = vi.fn();
    const view = renderWithLocale(
      <WideImageCropper file={jpeg()} onConfirm={vi.fn()} onCancel={vi.fn()} onError={onError} />,
    );
    view.unmount();
    await act(async () => {
      rejectBitmap(new Error('late'));
    });
    expect(onError).not.toHaveBeenCalled();
  });

  it('reports a photo that cannot be decoded or has no 5:2 window', async () => {
    vi.stubGlobal('createImageBitmap', vi.fn().mockRejectedValue(new Error('bad')));
    const onError = vi.fn();
    const first = renderWithLocale(
      <WideImageCropper file={jpeg()} onConfirm={vi.fn()} onCancel={vi.fn()} onError={onError} />,
    );
    await waitFor(() => {
      expect(onError).toHaveBeenCalledWith('unsupported');
    });
    first.unmount();

    const close = vi.fn();
    vi.stubGlobal('createImageBitmap', stubBitmap(0, 40, close));
    renderWithLocale(
      <WideImageCropper file={jpeg()} onConfirm={vi.fn()} onCancel={vi.fn()} onError={onError} />,
    );
    await waitFor(() => {
      expect(onError).toHaveBeenCalledTimes(2);
    });
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('falls back to an image element and revokes its object URL', async () => {
    vi.stubGlobal('createImageBitmap', undefined);
    const revoke = vi.fn();
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(revoke);
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:fallback');
    class FakeImage {
      naturalWidth = 800;
      naturalHeight = 800;
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      set src(_value: string) {
        queueMicrotask(() => {
          this.onload?.();
        });
      }
    }
    vi.stubGlobal('Image', FakeImage);
    const { unmount } = renderWithLocale(
      <WideImageCropper file={jpeg()} onConfirm={vi.fn()} onCancel={vi.fn()} onError={vi.fn()} />,
    );
    await enabledUse();
    unmount();
    expect(revoke).toHaveBeenCalledWith('blob:fallback');
  });

  it('reports an image element that fails to decode', async () => {
    vi.stubGlobal('createImageBitmap', undefined);
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:bad');
    const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    class FakeImage {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      set src(_value: string) {
        queueMicrotask(() => {
          this.onerror?.();
        });
      }
    }
    vi.stubGlobal('Image', FakeImage);
    const onError = vi.fn();
    renderWithLocale(
      <WideImageCropper file={jpeg()} onConfirm={vi.fn()} onCancel={vi.fn()} onError={onError} />,
    );
    await waitFor(() => {
      expect(onError).toHaveBeenCalledWith('unsupported');
    });
    expect(revoke).toHaveBeenCalledWith('blob:bad');
  });

  it('pans, pinches, and zooms with the wheel', async () => {
    vi.stubGlobal('createImageBitmap', stubBitmap(1000, 1000));
    renderWithLocale(
      <WideImageCropper file={jpeg()} onConfirm={vi.fn()} onCancel={vi.fn()} onError={vi.fn()} />,
    );
    await enabledUse();
    const img = frame().querySelector('image') as SVGImageElement;
    expect(img.getAttribute('y')).toBe('-75');
    fireEvent.pointerDown(frame(), { pointerId: 1, clientX: 40, clientY: 10 });
    fireEvent.pointerMove(frame(), { pointerId: 1, clientX: 40, clientY: 30 });
    expect(img.getAttribute('y')).toBe('-55');
    fireEvent.pointerUp(frame(), { pointerId: 1 });

    fireEvent.pointerDown(frame(), { pointerId: 1, clientX: 0, clientY: 0 });
    fireEvent.pointerDown(frame(), { pointerId: 2, clientX: 0, clientY: 0 });
    fireEvent.pointerMove(frame(), { pointerId: 2, clientX: 10, clientY: 0 });
    expect(img.getAttribute('width')).toBe('250');
    fireEvent.pointerUp(frame(), { pointerId: 2 });
    fireEvent.pointerUp(frame(), { pointerId: 1 });

    fireEvent.pointerDown(frame(), { pointerId: 1, clientX: 0, clientY: 0 });
    fireEvent.pointerDown(frame(), { pointerId: 2, clientX: 40, clientY: 0 });
    fireEvent.pointerDown(frame(), { pointerId: 3, clientX: 40, clientY: 30 });
    fireEvent.pointerUp(frame(), { pointerId: 3 });
    fireEvent.pointerMove(frame(), { pointerId: 2, clientX: 0, clientY: 0 });
    expect(img.getAttribute('width')).toBe('250');
    fireEvent.pointerMove(frame(), { pointerId: 2, clientX: 120, clientY: 0 });
    expect(Number.parseFloat(img.getAttribute('width') ?? '')).toBeGreaterThan(250);
    fireEvent.pointerCancel(frame(), { pointerId: 1 });
    fireEvent.pointerCancel(frame(), { pointerId: 2 });

    const zoomed = Number.parseFloat(img.getAttribute('width') ?? '');
    fireEvent.wheel(frame(), { deltaY: -40 });
    const wider = Number.parseFloat(img.getAttribute('width') ?? '');
    expect(wider).toBeGreaterThan(zoomed);
    fireEvent.wheel(frame(), { deltaY: 40 });
    expect(Number.parseFloat(img.getAttribute('width') ?? '')).toBeLessThan(wider);
  });

  it('ignores a drag whose frame has no width and a move after the photo is replaced', async () => {
    const bitmap = vi
      .fn()
      .mockResolvedValueOnce({ width: 1000, height: 1000, close: vi.fn() })
      .mockImplementationOnce(() => new Promise(() => undefined));
    vi.stubGlobal('createImageBitmap', bitmap);
    const { rerender } = renderWithLocale(
      <WideImageCropper
        file={jpeg('a.jpg')}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
        onError={vi.fn()}
      />,
    );
    await enabledUse();
    stubRect(0, 100);
    fireEvent.pointerDown(frame(), { pointerId: 1, clientX: 10, clientY: 10 });
    fireEvent.pointerMove(frame(), { pointerId: 1, clientX: 80, clientY: 40 });
    expect(frame().querySelector('image')?.getAttribute('y')).toBe('-75');
    rerender(
      <WideImageCropper
        file={jpeg('b.jpg')}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
        onError={vi.fn()}
      />,
    );
    fireEvent.pointerMove(frame(), { pointerId: 1, clientX: 90, clientY: 50 });
    expect(
      (screen.getByRole('button', { name: 'Use this crop' }) as HTMLButtonElement).disabled,
    ).toBe(true);
  });

  it('confirms a jpeg, reports a huge one, and reports a non-jpeg canvas', async () => {
    vi.stubGlobal('createImageBitmap', stubBitmap(1000, 800));
    vi.stubGlobal('atob', () => 'ok');
    const drawImage = vi.fn();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      drawImage,
    } as unknown as CanvasRenderingContext2D);
    const toDataURL = vi
      .spyOn(HTMLCanvasElement.prototype, 'toDataURL')
      .mockReturnValue('data:image/jpeg;base64,aaaa');
    const onConfirm = vi.fn();
    const onError = vi.fn();
    const view = renderWithLocale(
      <WideImageCropper file={jpeg()} onConfirm={onConfirm} onCancel={vi.fn()} onError={onError} />,
    );
    await enabledUse();
    fireEvent.click(screen.getByRole('button', { name: 'Use this crop' }));
    expect(onConfirm).toHaveBeenCalledWith({ contentType: 'image/jpeg', data: 'aaaa' });
    expect(drawImage).toHaveBeenCalled();
    view.unmount();

    toDataURL.mockReturnValue('data:image/jpeg;base64,BIGG');
    vi.stubGlobal('atob', () => 'x'.repeat(1_048_577));
    renderWithLocale(
      <WideImageCropper file={jpeg()} onConfirm={onConfirm} onCancel={vi.fn()} onError={onError} />,
    );
    await enabledUse();
    fireEvent.click(screen.getByRole('button', { name: 'Use this crop' }));
    expect(onError).toHaveBeenCalledWith('tooLarge');

    toDataURL.mockReturnValue('data:image/png;base64,aaaa');
    fireEvent.click(screen.getByRole('button', { name: 'Use this crop' }));
    expect(onError).toHaveBeenCalledWith('unsupported');
  });

  it('locks both actions and shows a spinner while busy', async () => {
    vi.stubGlobal('createImageBitmap', stubBitmap(640, 256));
    renderWithLocale(
      <WideImageCropper
        file={jpeg()}
        busy
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
        onError={vi.fn()}
      />,
    );
    await waitFor(() => {
      expect(frame().querySelector('image')).toBeTruthy();
    });
    const use = screen.getByRole('button', { name: 'Use this crop' }) as HTMLButtonElement;
    const cancel = screen.getByRole('button', { name: 'Cancel crop' }) as HTMLButtonElement;
    expect(use.disabled).toBe(true);
    expect(cancel.disabled).toBe(true);
    expect(use.querySelector('.animate-spin')).toBeTruthy();
  });

  it('measures again when the frame resizes and skips a missing observer', async () => {
    vi.stubGlobal('createImageBitmap', stubBitmap(1000, 1000));
    const first = renderWithLocale(
      <WideImageCropper file={jpeg()} onConfirm={vi.fn()} onCancel={vi.fn()} onError={vi.fn()} />,
    );
    await enabledUse();
    expect(FakeResizeObserver.last).not.toBeNull();
    stubRect(500, 200);
    act(() => {
      FakeResizeObserver.last?.fire();
    });
    expect(frame().querySelector('image')?.getAttribute('width')).toBe('500');
    first.unmount();
    expect(FakeResizeObserver.last?.disconnect).toHaveBeenCalled();

    vi.stubGlobal('ResizeObserver', undefined);
    stubRect(180, 72);
    renderWithLocale(
      <WideImageCropper file={jpeg()} onConfirm={vi.fn()} onCancel={vi.fn()} onError={vi.fn()} />,
    );
    await enabledUse();
    expect(frame().querySelector('image')?.getAttribute('width')).toBe('180');
  });

  it('revokes the preview when the file changes', async () => {
    vi.stubGlobal('createImageBitmap', stubBitmap(200, 200));
    const revoke = vi.spyOn(URL, 'revokeObjectURL');
    let n = 0;
    vi.spyOn(URL, 'createObjectURL').mockImplementation(() => `blob:crop-${n++}`);
    const { rerender } = renderWithLocale(
      <WideImageCropper
        file={jpeg('a.jpg')}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
        onError={vi.fn()}
      />,
    );
    await enabledUse();
    rerender(
      <WideImageCropper
        file={jpeg('b.jpg')}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
        onError={vi.fn()}
      />,
    );
    await waitFor(() => {
      expect(revoke).toHaveBeenCalledWith('blob:crop-0');
    });
  });
});
