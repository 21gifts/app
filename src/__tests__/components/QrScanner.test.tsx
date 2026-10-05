import { act, cleanup, screen } from '@testing-library/react';
import jsQR from 'jsqr';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QrScanner } from '@/components/QrScanner';
import { renderWithLocale } from '@/__tests__/render-with-locale';

vi.mock('jsqr', () => ({ default: vi.fn() }));

interface FakeStream {
  stream: MediaStream;
  stop: ReturnType<typeof vi.fn>;
}

/**
 * A stream with one track whose `stop` is observable.
 *
 * @returns The stream and its track's `stop` mock.
 */
function fakeStream(): FakeStream {
  const stop = vi.fn();
  const stream = { getTracks: () => [{ stop }] } as unknown as MediaStream;
  return { stream, stop };
}

/**
 * Installs `navigator.mediaDevices.getUserMedia`.
 *
 * @param getUserMedia - Implementation under test.
 */
function setCamera(getUserMedia: () => Promise<MediaStream>): ReturnType<typeof vi.fn> {
  const mock = vi.fn(getUserMedia);
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: { getUserMedia: mock },
  });
  return mock;
}

/**
 * Sets the native detector, or removes it with `undefined`.
 *
 * @param detector - Constructor to expose as `window.BarcodeDetector`.
 */
function setDetector(detector: unknown): void {
  Object.defineProperty(window, 'BarcodeDetector', {
    configurable: true,
    writable: true,
    value: detector,
  });
}

/**
 * Native detector whose `detect` answers from `results` in order, then `[]`.
 *
 * @param formats - What `getSupportedFormats` resolves to.
 * @param results - Successive `detect` results.
 * @returns The constructor and its `detect` mock.
 */
function nativeDetector(
  formats: Promise<string[]>,
  results: Array<Array<{ rawValue: string }> | Error>,
): { Detector: unknown; detect: ReturnType<typeof vi.fn> } {
  const detect = vi.fn(() => {
    const next = results.shift() ?? [];
    return next instanceof Error ? Promise.reject(next) : Promise.resolve(next);
  });
  const Detector = vi.fn(() => ({ detect }));
  Object.assign(Detector, { getSupportedFormats: () => formats });
  return { Detector, detect };
}

/**
 * Lets pending promises and timers up to `ms` run.
 *
 * @param ms - Fake milliseconds to advance.
 */
async function flush(ms = 0): Promise<void> {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

/**
 * The rendered preview.
 *
 * @returns The video element.
 */
function video(): HTMLVideoElement {
  const element = document.querySelector('video');
  if (element === null) {
    throw new Error('missing video');
  }
  return element;
}

/**
 * Gives the preview a frame size.
 *
 * @param width - `videoWidth`.
 * @param height - `videoHeight`.
 */
function setFrame(width: number, height: number): void {
  Object.defineProperty(video(), 'videoWidth', { configurable: true, value: width });
  Object.defineProperty(video(), 'videoHeight', { configurable: true, value: height });
}

const play = vi.fn(() => Promise.resolve());

beforeEach(() => {
  vi.useFakeTimers();
  Object.defineProperty(window, 'isSecureContext', { configurable: true, value: true });
  Object.defineProperty(HTMLMediaElement.prototype, 'play', {
    configurable: true,
    value: play,
  });
  play.mockReset().mockResolvedValue(undefined);
  vi.mocked(jsQR).mockReset().mockReturnValue(null);
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
  setDetector(undefined);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  Reflect.deleteProperty(navigator, 'mediaDevices');
  Reflect.deleteProperty(window, 'BarcodeDetector');
});

describe('QrScanner', () => {
  it('asks for the rear camera and shows the live preview with the hint', async () => {
    const { stream } = fakeStream();
    const getUserMedia = setCamera(() => Promise.resolve(stream));
    renderWithLocale(<QrScanner onResult={vi.fn()} />);
    await flush();
    expect(getUserMedia).toHaveBeenCalledWith({
      audio: false,
      video: { facingMode: { ideal: 'environment' } },
    });
    expect(video().srcObject).toBe(stream);
    expect(play).toHaveBeenCalledTimes(1);
    expect(
      screen.getByRole('region', { name: 'Point the camera at a Bitcoin QR code' }),
    ).toBeTruthy();
    expect(screen.getByText('Point the camera at a Bitcoin QR code')).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('says no camera was found on a page without a secure context', async () => {
    Object.defineProperty(window, 'isSecureContext', { configurable: true, value: false });
    const getUserMedia = setCamera(() => Promise.resolve(fakeStream().stream));
    renderWithLocale(<QrScanner onResult={vi.fn()} />);
    await flush();
    expect(getUserMedia).not.toHaveBeenCalled();
    expect(screen.getByRole('alert').textContent).toBe(
      'No camera found. Paste the payment request instead.',
    );
    expect(document.querySelector('video')).toBeNull();
    expect(screen.queryByText('Point the camera at a Bitcoin QR code')).toBeNull();
  });

  it('shows a large preview with a viewfinder and keeps the alert in the same box', async () => {
    setCamera(() => Promise.resolve(fakeStream().stream));
    const live = renderWithLocale(<QrScanner onResult={vi.fn()} />);
    await flush();
    const box = video().parentElement as HTMLElement;
    expect(box.className).toContain('h-[calc(var(--app-height)*0.7)]');
    expect(box.className).toContain('min-h-72');
    expect(video().className).toContain('object-cover');
    const finder = box.querySelector('[aria-hidden="true"]') as HTMLElement;
    expect(finder.className).toContain('pointer-events-none');
    expect(finder.className).toContain('size-[68cqmin]');
    const hint = screen.getByText('Point the camera at a Bitcoin QR code');
    expect(hint.parentElement).toBe(box);
    expect(hint.className).toContain('text-lg');
    const liveClass = box.className;
    live.unmount();

    setCamera(() => Promise.reject(new DOMException('blocked', 'NotAllowedError')));
    renderWithLocale(<QrScanner onResult={vi.fn()} />);
    await flush();
    const alert = screen.getByRole('alert');
    expect((alert.parentElement as HTMLElement).className).toBe(liveClass);
    expect(alert.className).toContain('text-lg');
  });

  it('says no camera was found when the browser has no media devices', async () => {
    renderWithLocale(<QrScanner onResult={vi.fn()} />);
    await flush();
    expect(screen.getByRole('alert').textContent).toBe(
      'No camera found. Paste the payment request instead.',
    );
  });

  it.each(['NotAllowedError', 'SecurityError'])(
    'says the camera was blocked on %s',
    async (name) => {
      setCamera(() => Promise.reject(new DOMException('blocked', name)));
      renderWithLocale(<QrScanner onResult={vi.fn()} />);
      await flush();
      expect(screen.getByRole('alert').textContent).toBe(
        'Camera access was blocked. Allow it in your browser settings, or paste the payment request.',
      );
      expect(document.querySelector('video')).toBeNull();
    },
  );

  it.each([new DOMException('none', 'NotFoundError'), new Error('busy')])(
    'says no camera was found on any other failure (%s)',
    async (failure) => {
      setCamera(() => Promise.reject(failure));
      renderWithLocale(<QrScanner onResult={vi.fn()} />);
      await flush();
      expect(screen.getByRole('alert').textContent).toBe(
        'No camera found. Paste the payment request instead.',
      );
    },
  );

  it('shows no alert when the camera request fails after unmount', async () => {
    let reject: (reason: unknown) => void = () => undefined;
    setCamera(
      () =>
        new Promise<MediaStream>((_resolve, fail) => {
          reject = fail;
        }),
    );
    const view = renderWithLocale(<QrScanner onResult={vi.fn()} />);
    await flush();
    view.unmount();
    reject(new DOMException('blocked', 'NotAllowedError'));
    await flush();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('stops a stream that arrives after unmount', async () => {
    const { stream, stop } = fakeStream();
    let resolve: (value: MediaStream) => void = () => undefined;
    setCamera(
      () =>
        new Promise<MediaStream>((done) => {
          resolve = done;
        }),
    );
    const view = renderWithLocale(<QrScanner onResult={vi.fn()} />);
    await flush();
    view.unmount();
    resolve(stream);
    await flush();
    expect(stop).toHaveBeenCalledTimes(1);
  });

  it('keeps scanning when the preview cannot autoplay', async () => {
    play.mockRejectedValue(new DOMException('no', 'NotAllowedError'));
    const { Detector } = nativeDetector(Promise.resolve(['qr_code']), [[{ rawValue: 'lnbc1' }]]);
    setDetector(Detector);
    setCamera(() => Promise.resolve(fakeStream().stream));
    const onResult = vi.fn();
    renderWithLocale(<QrScanner onResult={onResult} />);
    await flush();
    expect(onResult).toHaveBeenCalledWith('lnbc1');
  });

  it('reads frames with the native detector until the first QR text, then stops the camera', async () => {
    const { Detector, detect } = nativeDetector(Promise.resolve(['ean_13', 'qr_code']), [
      [],
      new Error('frame not ready'),
      [{ rawValue: '   ' }],
      [{ rawValue: 'lnbc1first' }, { rawValue: 'lnbc1second' }],
    ]);
    setDetector(Detector);
    const { stream, stop } = fakeStream();
    setCamera(() => Promise.resolve(stream));
    const onResult = vi.fn(() => {
      expect(stop).toHaveBeenCalledTimes(1);
    });
    renderWithLocale(<QrScanner onResult={onResult} />);
    await flush();
    expect(Detector).toHaveBeenCalledWith({ formats: ['qr_code'] });
    expect(detect).toHaveBeenCalledTimes(1);
    expect(detect).toHaveBeenCalledWith(video());
    await flush(120);
    await flush(120);
    expect(onResult).not.toHaveBeenCalled();
    await flush(120);
    expect(onResult).toHaveBeenCalledTimes(1);
    expect(onResult).toHaveBeenCalledWith('lnbc1first');
    await flush(1_000);
    expect(detect).toHaveBeenCalledTimes(4);
    expect(jsQR).not.toHaveBeenCalled();
  });

  it('reports to the latest callback', async () => {
    const { Detector } = nativeDetector(Promise.resolve(['qr_code']), [[], [{ rawValue: 'x' }]]);
    setDetector(Detector);
    setCamera(() => Promise.resolve(fakeStream().stream));
    const first = vi.fn();
    const second = vi.fn();
    const view = renderWithLocale(<QrScanner onResult={first} />);
    await flush();
    view.rerender(<QrScanner onResult={second} />);
    await flush(120);
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledWith('x');
  });

  it.each([
    ['lists no QR format', (): Promise<string[]> => Promise.resolve(['ean_13'])],
    ['cannot list its formats', (): Promise<string[]> => Promise.reject(new Error('no formats'))],
  ])('uses jsqr when the native detector %s', async (_label, formats) => {
    const { Detector } = nativeDetector(formats(), []);
    setDetector(Detector);
    const drawImage = vi.fn();
    const data = new Uint8ClampedArray(4);
    const getImageData = vi.fn(() => ({ data }));
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      drawImage,
      getImageData,
    } as unknown as CanvasRenderingContext2D);
    vi.mocked(jsQR)
      .mockReturnValueOnce(null)
      .mockReturnValue({
        data: 'bitcoin:bc1qexample',
      } as ReturnType<typeof jsQR>);
    setCamera(() => Promise.resolve(fakeStream().stream));
    const onResult = vi.fn();
    renderWithLocale(<QrScanner onResult={onResult} />);
    await flush();
    expect(Detector).not.toHaveBeenCalled();
    expect(jsQR).not.toHaveBeenCalled();
    setFrame(1_280, 720);
    await flush(120);
    expect(drawImage).toHaveBeenCalledWith(video(), 0, 0, 640, 360);
    expect(getImageData).toHaveBeenCalledWith(0, 0, 640, 360);
    expect(jsQR).toHaveBeenCalledWith(data, 640, 360, { inversionAttempts: 'dontInvert' });
    expect(onResult).not.toHaveBeenCalled();
    await flush(120);
    expect(onResult).toHaveBeenCalledWith('bitcoin:bc1qexample');
  });

  it('keeps a small frame at its own size for jsqr', async () => {
    const drawImage = vi.fn();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      drawImage,
      getImageData: () => ({ data: new Uint8ClampedArray(4) }),
    } as unknown as CanvasRenderingContext2D);
    setCamera(() => Promise.resolve(fakeStream().stream));
    renderWithLocale(<QrScanner onResult={vi.fn()} />);
    await flush();
    setFrame(320, 240);
    await flush(120);
    expect(drawImage).toHaveBeenCalledWith(video(), 0, 0, 320, 240);
    setFrame(320, 0);
    drawImage.mockClear();
    await flush(120);
    expect(drawImage).not.toHaveBeenCalled();
  });

  it('keeps scanning after a frame the canvas cannot read', async () => {
    const drawImage = vi
      .fn()
      .mockImplementationOnce(() => {
        throw new DOMException('not ready', 'InvalidStateError');
      })
      .mockImplementation(() => undefined);
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      drawImage,
      getImageData: () => ({ data: new Uint8ClampedArray(4) }),
    } as unknown as CanvasRenderingContext2D);
    vi.mocked(jsQR).mockReturnValue({ data: 'lnbc1after' } as ReturnType<typeof jsQR>);
    setCamera(() => Promise.resolve(fakeStream().stream));
    const onResult = vi.fn();
    renderWithLocale(<QrScanner onResult={onResult} />);
    await flush();
    setFrame(320, 240);
    await flush(120);
    expect(drawImage).toHaveBeenCalledTimes(1);
    expect(onResult).not.toHaveBeenCalled();
    await flush(120);
    expect(onResult).toHaveBeenCalledWith('lnbc1after');
  });

  it('never reads a frame when the canvas has no 2D context', async () => {
    setCamera(() => Promise.resolve(fakeStream().stream));
    const onResult = vi.fn();
    renderWithLocale(<QrScanner onResult={onResult} />);
    await flush();
    setFrame(640, 480);
    await flush(600);
    expect(jsQR).not.toHaveBeenCalled();
    expect(onResult).not.toHaveBeenCalled();
  });

  it('stops the camera and the frame loop on unmount', async () => {
    const { Detector, detect } = nativeDetector(Promise.resolve(['qr_code']), []);
    setDetector(Detector);
    const { stream, stop } = fakeStream();
    setCamera(() => Promise.resolve(stream));
    const onResult = vi.fn();
    const view = renderWithLocale(<QrScanner onResult={onResult} />);
    await flush();
    expect(detect).toHaveBeenCalledTimes(1);
    view.unmount();
    expect(stop).toHaveBeenCalledTimes(1);
    await flush(1_000);
    expect(detect).toHaveBeenCalledTimes(1);
  });

  it('drops a frame result that arrives after unmount', async () => {
    let answer: (value: Array<{ rawValue: string }>) => void = () => undefined;
    const detect = vi.fn(
      () =>
        new Promise<Array<{ rawValue: string }>>((done) => {
          answer = done;
        }),
    );
    const Detector = vi.fn(() => ({ detect }));
    Object.assign(Detector, { getSupportedFormats: () => Promise.resolve(['qr_code']) });
    setDetector(Detector);
    setCamera(() => Promise.resolve(fakeStream().stream));
    const onResult = vi.fn();
    const view = renderWithLocale(<QrScanner onResult={onResult} />);
    await flush();
    view.unmount();
    answer([{ rawValue: 'late' }]);
    await flush(1_000);
    expect(onResult).not.toHaveBeenCalled();
    expect(detect).toHaveBeenCalledTimes(1);
  });

  it('stops the camera and says no camera was found when the decoder cannot load', async () => {
    const Detector = vi.fn(() => {
      throw new Error('no detector');
    });
    Object.assign(Detector, { getSupportedFormats: () => Promise.resolve(['qr_code']) });
    setDetector(Detector);
    const { stream, stop } = fakeStream();
    setCamera(() => Promise.resolve(stream));
    renderWithLocale(<QrScanner onResult={vi.fn()} />);
    await flush();
    expect(stop).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('alert').textContent).toBe(
      'No camera found. Paste the payment request instead.',
    );
  });

  it('shows no alert when the decoder fails to load after unmount', async () => {
    let formats: (value: string[]) => void = () => undefined;
    const Detector = vi.fn(() => {
      throw new Error('no detector');
    });
    Object.assign(Detector, {
      getSupportedFormats: () =>
        new Promise<string[]>((done) => {
          formats = done;
        }),
    });
    setDetector(Detector);
    const { stream, stop } = fakeStream();
    setCamera(() => Promise.resolve(stream));
    const view = renderWithLocale(<QrScanner onResult={vi.fn()} />);
    await flush();
    view.unmount();
    formats(['qr_code']);
    await flush();
    expect(Detector).toHaveBeenCalledTimes(1);
    expect(stop).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('reads no frame when unmounted while the decoder loads', async () => {
    let formats: (value: string[]) => void = () => undefined;
    const { Detector, detect } = nativeDetector(
      new Promise<string[]>((done) => {
        formats = done;
      }),
      [],
    );
    setDetector(Detector);
    setCamera(() => Promise.resolve(fakeStream().stream));
    const view = renderWithLocale(<QrScanner onResult={vi.fn()} />);
    await flush();
    view.unmount();
    formats(['qr_code']);
    await flush(1_000);
    expect(detect).not.toHaveBeenCalled();
  });
});
