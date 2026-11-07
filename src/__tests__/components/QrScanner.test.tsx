import { act, cleanup, fireEvent, screen } from '@testing-library/react';
import jsQR from 'jsqr';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QrScanner } from '@/components/QrScanner';
import { renderWithLocale } from '@/__tests__/render-with-locale';

vi.mock('jsqr', () => ({ default: vi.fn() }));

interface FakeStream {
  stream: MediaStream;
  stop: ReturnType<typeof vi.fn>;
  track: EventTarget & { muted: boolean; readyState: MediaStreamTrackState };
}

/**
 * A stream with one track whose `stop` is observable.
 *
 * @returns The stream, its track, and the track's `stop` mock.
 */
function fakeStream(): FakeStream {
  const stop = vi.fn();
  const track = Object.assign(new EventTarget(), {
    stop,
    muted: false,
    readyState: 'live' as MediaStreamTrackState,
  });
  const stream = Object.assign(new MediaStream(), {
    getTracks: () => [track],
    getVideoTracks: () => [track],
  });
  return { stream, stop, track };
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
  vi.stubGlobal('MediaStream', class {});
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
  vi.unstubAllGlobals();
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

  it('fills its parent with the preview, the viewfinder, and the hint on top, and keeps the alert in the same area', async () => {
    setCamera(() => Promise.resolve(fakeStream().stream));
    const live = renderWithLocale(<QrScanner onResult={vi.fn()} />);
    await flush();
    const box = video().parentElement as HTMLElement;
    expect(box.className).toContain('absolute inset-0');
    expect(box.className).toContain('bg-black');
    expect(box.className).toContain('[container-type:size]');
    expect(video().className).toContain('object-cover');
    const finder = box.querySelector('[aria-hidden="true"]') as HTMLElement;
    expect(finder.className).toContain('pointer-events-none');
    expect(finder.className).toContain('size-[68cqmin]');
    const hint = screen.getByText('Point the camera at a Bitcoin QR code');
    expect(hint.parentElement).toBe(box);
    expect(hint.className).toContain('top-0');
    expect(hint.className).toContain('text-white');
    const liveClass = box.className;
    live.unmount();

    setCamera(() => Promise.reject(new DOMException('blocked', 'NotAllowedError')));
    renderWithLocale(<QrScanner onResult={vi.fn()} />);
    await flush();
    const alert = screen.getByRole('alert');
    expect((alert.parentElement as HTMLElement).className).toBe(liveClass);
    expect(alert.className).toContain('text-white');
    expect(alert.className).not.toContain('text-app-danger');
  });

  it('uses the wording it is given for the hint, the region, and both alerts', async () => {
    const copy = {
      hint: 'heldShares.scanHint',
      denied: 'heldShares.cameraDenied',
      unavailable: 'heldShares.cameraUnavailable',
    } as const;
    setCamera(() => Promise.resolve(fakeStream().stream));
    const live = renderWithLocale(<QrScanner onResult={vi.fn()} copy={copy} />);
    await flush();
    expect(
      screen.getByRole('region', { name: 'Point the camera at the code on the other phone' }),
    ).toBeTruthy();
    expect(screen.getByText('Point the camera at the code on the other phone')).toBeTruthy();
    expect(screen.queryByText('Point the camera at a Bitcoin QR code')).toBeNull();
    live.unmount();

    setCamera(() => Promise.reject(new DOMException('blocked', 'NotAllowedError')));
    const denied = renderWithLocale(<QrScanner onResult={vi.fn()} copy={copy} />);
    await flush();
    expect(screen.getByRole('alert').textContent).toBe(
      'Camera access is off. Allow the camera to scan the code.',
    );
    denied.unmount();

    setCamera(() => Promise.reject(new DOMException('none', 'NotFoundError')));
    renderWithLocale(<QrScanner onResult={vi.fn()} copy={copy} />);
    await flush();
    expect(screen.getByRole('alert').textContent).toBe(
      'No camera found. Use a phone with a camera to scan the code.',
    );
    expect(
      screen.getByRole('region', { name: 'Point the camera at the code on the other phone' }),
    ).toBeTruthy();
  });

  it('fills the placeholders of the hint it is given', async () => {
    setCamera(() => Promise.resolve(fakeStream().stream));
    renderWithLocale(
      <QrScanner
        onResult={vi.fn()}
        copy={{
          hint: 'recover.scanHint',
          hintVars: { n: 2 },
          denied: 'recover.cameraDenied',
          unavailable: 'recover.cameraUnavailable',
        }}
      />,
    );
    await flush();
    expect(screen.getByRole('region', { name: 'Scan code 2 of 2' })).toBeTruthy();
    expect(screen.getByText('Scan code 2 of 2')).toBeTruthy();
  });

  it('says no camera was found when the browser has no media devices', async () => {
    renderWithLocale(<QrScanner onResult={vi.fn()} />);
    await flush();
    expect(screen.getByRole('alert').textContent).toBe(
      'No camera found. Paste the payment request instead.',
    );
  });

  it('reports a blocked camera to the caller', async () => {
    const onPicture = vi.fn();
    setCamera(() => Promise.reject(new DOMException('blocked', 'NotAllowedError')));
    renderWithLocale(<QrScanner onResult={vi.fn()} onPicture={onPicture} />);
    await flush();
    expect(onPicture).toHaveBeenCalledWith('denied');
  });

  it('reports when the preview starts playing', async () => {
    setCamera(() => Promise.resolve(fakeStream().stream));
    const onPicture = vi.fn();
    const view = renderWithLocale(<QrScanner onResult={vi.fn()} onPicture={onPicture} />);
    await flush();
    fireEvent.playing(video());
    expect(onPicture).toHaveBeenCalledWith('showing');
    view.rerender(<QrScanner onResult={vi.fn()} />);
    fireEvent.playing(video());
    fireEvent.pause(video());
    fireEvent.ended(video());
    expect(onPicture).toHaveBeenCalledOnce();
  });

  it('reports paused and ended previews and reports showing when playback resumes', async () => {
    setCamera(() => Promise.resolve(fakeStream().stream));
    const onPicture = vi.fn();
    renderWithLocale(<QrScanner onResult={vi.fn()} onPicture={onPicture} />);
    await flush();
    fireEvent.playing(video());
    fireEvent.pause(video());
    fireEvent.playing(video());
    fireEvent.ended(video());
    fireEvent.playing(video());
    expect(onPicture.mock.calls).toEqual([
      ['showing'],
      ['paused'],
      ['showing'],
      ['paused'],
      ['showing'],
    ]);
  });

  it('waits for an unmuted live track before reporting a playing picture', async () => {
    const { stream, track } = fakeStream();
    track.muted = true;
    setCamera(() => Promise.resolve(stream));
    const onPicture = vi.fn();
    renderWithLocale(<QrScanner onResult={vi.fn()} onPicture={onPicture} />);
    await flush();
    Object.defineProperty(video(), 'paused', { configurable: true, value: false });
    fireEvent.playing(video());
    expect(onPicture).not.toHaveBeenCalled();
    track.muted = false;
    act(() => {
      track.dispatchEvent(new Event('unmute'));
    });
    expect(onPicture.mock.calls).toEqual([['showing']]);
    track.readyState = 'ended';
    fireEvent.playing(video());
    expect(onPicture).toHaveBeenCalledOnce();
  });

  it('waits for playing when the track unmutes after play is requested', async () => {
    const { stream, track } = fakeStream();
    track.muted = true;
    setCamera(() => Promise.resolve(stream));
    const onPicture = vi.fn();
    renderWithLocale(<QrScanner onResult={vi.fn()} onPicture={onPicture} />);
    await flush();
    expect(play).toHaveBeenCalledOnce();
    Object.defineProperty(video(), 'paused', { configurable: true, value: false });
    track.muted = false;
    act(() => {
      track.dispatchEvent(new Event('unmute'));
    });
    expect(onPicture).not.toHaveBeenCalled();
    fireEvent.playing(video());
    expect(onPicture.mock.calls).toEqual([['showing']]);
  });

  it('reports playing when the preview source is not a MediaStream', async () => {
    setCamera(() => Promise.resolve(fakeStream().stream));
    const onPicture = vi.fn();
    renderWithLocale(<QrScanner onResult={vi.fn()} onPicture={onPicture} />);
    await flush();
    video().srcObject = null;
    fireEvent.playing(video());
    video().srcObject = {} as MediaStream;
    fireEvent.playing(video());
    vi.stubGlobal('MediaStream', undefined);
    fireEvent.playing(video());
    expect(onPicture.mock.calls).toEqual([['showing'], ['showing'], ['showing']]);
  });

  it('reports an interrupted track and its return while continuing to scan', async () => {
    const { stream, track, stop } = fakeStream();
    const { Detector } = nativeDetector(Promise.resolve(['qr_code']), [
      [],
      [{ rawValue: 'lnbc1' }],
    ]);
    setDetector(Detector);
    setCamera(() => Promise.resolve(stream));
    const onPicture = vi.fn();
    const onResult = vi.fn();
    renderWithLocale(<QrScanner onResult={onResult} onPicture={onPicture} />);
    await flush();
    Object.defineProperty(video(), 'paused', { configurable: true, value: false });
    fireEvent.playing(video());
    act(() => {
      track.dispatchEvent(new Event('mute'));
    });
    expect(onPicture.mock.calls).toEqual([['showing'], ['paused']]);
    expect(screen.queryByRole('alert')).toBeNull();
    expect(stop).not.toHaveBeenCalled();
    act(() => {
      track.dispatchEvent(new Event('unmute'));
    });
    expect(onPicture.mock.calls).toEqual([['showing'], ['paused'], ['showing']]);
    await flush(120);
    expect(onResult).toHaveBeenCalledWith('lnbc1');
  });

  it('ignores unmute on a paused or ended preview and reports an ended track', async () => {
    const { stream, track } = fakeStream();
    setCamera(() => Promise.resolve(stream));
    const onPicture = vi.fn();
    const view = renderWithLocale(<QrScanner onResult={vi.fn()} onPicture={onPicture} />);
    await flush();
    fireEvent.playing(video());
    fireEvent.pause(video());
    onPicture.mockClear();
    act(() => {
      track.dispatchEvent(new Event('unmute'));
    });
    expect(onPicture).not.toHaveBeenCalled();
    fireEvent.playing(video());
    fireEvent.ended(video());
    onPicture.mockClear();
    act(() => {
      track.dispatchEvent(new Event('unmute'));
      track.dispatchEvent(new Event('ended'));
    });
    expect(onPicture.mock.calls).toEqual([['paused']]);
    view.rerender(<QrScanner onResult={vi.fn()} />);
    fireEvent.playing(video());
    act(() => {
      track.dispatchEvent(new Event('mute'));
      track.dispatchEvent(new Event('unmute'));
    });
    expect(onPicture).toHaveBeenCalledOnce();
  });

  it('removes track listeners on unmount and ignores callbacks already queued', async () => {
    const { stream, track } = fakeStream();
    const addListener = vi.spyOn(track, 'addEventListener');
    setCamera(() => Promise.resolve(stream));
    const onPicture = vi.fn();
    const view = renderWithLocale(<QrScanner onResult={vi.fn()} onPicture={onPicture} />);
    await flush();
    expect(addListener).toHaveBeenCalledTimes(3);
    const listeners = addListener.mock.calls;
    for (const [, , options] of listeners) {
      expect(options).toEqual(
        expect.objectContaining({ signal: expect.objectContaining({ aborted: false }) }),
      );
    }
    view.unmount();
    for (const [, , options] of listeners) {
      expect(options).toEqual(
        expect.objectContaining({ signal: expect.objectContaining({ aborted: true }) }),
      );
    }
    act(() => {
      for (const event of ['mute', 'unmute', 'ended']) {
        track.dispatchEvent(new Event(event));
      }
      for (const [event, listener] of listeners) {
        if (typeof listener === 'function') {
          listener.call(track, new Event(event));
        }
      }
    });
    expect(onPicture).not.toHaveBeenCalled();
  });

  it('reports a missing camera to the caller', async () => {
    const onPicture = vi.fn();
    renderWithLocale(<QrScanner onResult={vi.fn()} onPicture={onPicture} />);
    await flush();
    expect(onPicture).toHaveBeenCalledWith('unavailable');
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

  it('reports a paused preview without an alert and keeps the detector running', async () => {
    play.mockRejectedValue(new DOMException('no', 'NotAllowedError'));
    const { Detector } = nativeDetector(Promise.resolve(['qr_code']), [
      [],
      [{ rawValue: 'lnbc1' }],
    ]);
    setDetector(Detector);
    const { stream, stop } = fakeStream();
    setCamera(() => Promise.resolve(stream));
    const onPicture = vi.fn();
    const onResult = vi.fn();
    renderWithLocale(<QrScanner onResult={onResult} onPicture={onPicture} />);
    await flush();
    expect(onPicture).toHaveBeenCalledOnce();
    expect(onPicture).toHaveBeenCalledWith('paused');
    expect(screen.queryByRole('alert')).toBeNull();
    expect(stop).not.toHaveBeenCalled();
    expect(onResult).not.toHaveBeenCalled();
    await flush(120);
    expect(onResult).toHaveBeenCalledWith('lnbc1');
  });

  it('does not report a preview rejection after unmount', async () => {
    let reject: (reason: unknown) => void = () => undefined;
    play.mockImplementation(
      () =>
        new Promise<void>((_resolve, fail) => {
          reject = fail;
        }),
    );
    const { stream, stop } = fakeStream();
    setCamera(() => Promise.resolve(stream));
    const onPicture = vi.fn();
    const onResult = vi.fn();
    const view = renderWithLocale(<QrScanner onResult={onResult} onPicture={onPicture} />);
    await flush();
    expect(play).toHaveBeenCalledOnce();
    view.unmount();
    reject(new DOMException('no', 'NotAllowedError'));
    await flush();
    expect(stop).toHaveBeenCalledTimes(1);
    expect(onPicture).not.toHaveBeenCalled();
    expect(onResult).not.toHaveBeenCalled();
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
