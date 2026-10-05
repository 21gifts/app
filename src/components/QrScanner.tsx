'use client';

import { useEffect, useRef, useState, type ReactElement } from 'react';
import { useTranslations } from '@/components/LocaleProvider';

/** Props for {@link QrScanner}. */
export interface QrScannerProps {
  /** Called once with the first decoded QR text, after the camera has stopped. */
  onResult: (text: string) => void;
}

type FrameDecoder = (video: HTMLVideoElement) => Promise<string | null>;

interface BarcodeDetectorConstructor {
  new (options: { formats: string[] }): {
    detect: (source: HTMLVideoElement) => Promise<Array<{ rawValue: string }>>;
  };
  getSupportedFormats: () => Promise<string[]>;
}

const SCAN_INTERVAL_MS = 120;
const JSQR_MAX_EDGE = 640;

/**
 * The camera box, the same size with or without the preview: edge to edge of
 * the frame on a phone, 70% of the visible height (at least 18rem), capped on
 * wider screens. `container-type: size` lets the viewfinder take 68% of the
 * smaller side.
 */
const PREVIEW_CLASS =
  'relative h-[calc(var(--app-height)*0.7)] min-h-72 w-full overflow-hidden bg-app-card-muted [container-type:size] sm:max-h-[28rem] sm:rounded-2xl sm:border sm:border-app-border';

/**
 * QR decoder for video frames: the native `BarcodeDetector` when the browser
 * lists `qr_code` among its formats, otherwise `jsqr` on a downscaled canvas
 * copy.
 *
 * @returns A function that reads one frame, resolving to the QR text or `null`.
 */
async function frameDecoder(): Promise<FrameDecoder> {
  const Native = (window as unknown as { BarcodeDetector?: BarcodeDetectorConstructor })
    .BarcodeDetector;
  const formats =
    Native === undefined ? [] : await Native.getSupportedFormats().catch(() => [] as string[]);
  if (Native !== undefined && formats.includes('qr_code')) {
    const detector = new Native({ formats: ['qr_code'] });
    return async (video) => {
      const codes = await detector.detect(video);
      return codes[0]?.rawValue ?? null;
    };
  }
  const { default: jsQR } = await import('jsqr');
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d', { willReadFrequently: true });
  return (video) => {
    if (context === null || video.videoWidth === 0 || video.videoHeight === 0) {
      return Promise.resolve(null);
    }
    const scale = Math.min(1, JSQR_MAX_EDGE / Math.max(video.videoWidth, video.videoHeight));
    const width = Math.round(video.videoWidth * scale);
    const height = Math.round(video.videoHeight * scale);
    canvas.width = width;
    canvas.height = height;
    context.drawImage(video, 0, 0, width, height);
    const image = context.getImageData(0, 0, width, height);
    const code = jsQR(image.data, width, height, { inversionAttempts: 'dontInvert' });
    return Promise.resolve(code?.data ?? null);
  };
}

/**
 * Camera QR scanner with the rear camera preferred. The camera is requested
 * once per mount. Reads frames about eight times a second until the first
 * non-empty QR text, then stops every camera track and reports it. A blocked
 * camera, no camera, a page without a secure context, or a decoder that cannot
 * load shows a short alert instead of the preview, in the same box. Tracks
 * also stop on unmount. The preview fills the box (`object-cover`) under a
 * viewfinder square that only shows where to aim; the whole frame is read.
 *
 * @param props - Result callback.
 * @returns The scanner region.
 */
export function QrScanner({ onResult }: QrScannerProps): ReactElement {
  const { t } = useTranslations();
  const videoRef = useRef<HTMLVideoElement>(null);
  const onResultRef = useRef(onResult);
  const [error, setError] = useState<'denied' | 'unavailable' | null>(null);

  useEffect(() => {
    onResultRef.current = onResult;
  }, [onResult]);

  useEffect(() => {
    let stopped = false;
    let stream: MediaStream | null = null;
    let timer: number | undefined;
    const stop = (): void => {
      stopped = true;
      window.clearTimeout(timer);
      stream?.getTracks().forEach((track) => {
        track.stop();
      });
      stream = null;
    };
    const start = async (): Promise<void> => {
      if (!window.isSecureContext || !('mediaDevices' in navigator)) {
        setError('unavailable');
        return;
      }
      let media: MediaStream;
      try {
        media = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { facingMode: { ideal: 'environment' } },
        });
      } catch (caught) {
        if (!stopped) {
          const denied =
            caught instanceof DOMException &&
            (caught.name === 'NotAllowedError' || caught.name === 'SecurityError');
          setError(denied ? 'denied' : 'unavailable');
        }
        return;
      }
      stream = media;
      if (stopped) {
        stop();
        return;
      }
      const video = videoRef.current;
      /* v8 ignore next 4 -- the preview stays mounted while this effect runs and no error is shown */
      if (video === null) {
        stop();
        return;
      }
      video.srcObject = media;
      await video.play().catch(() => undefined);
      let decode: FrameDecoder;
      try {
        decode = await frameDecoder();
      } catch {
        if (!stopped) {
          stop();
          setError('unavailable');
        }
        return;
      }
      const tick = async (): Promise<void> => {
        if (stopped) {
          return;
        }
        let text: string | null;
        try {
          text = await decode(video);
        } catch {
          // A frame that cannot be read (also a synchronous canvas or jsqr error) is skipped.
          text = null;
        }
        if (stopped) {
          return;
        }
        if (text !== null && text.trim() !== '') {
          stop();
          onResultRef.current(text);
          return;
        }
        timer = window.setTimeout(() => {
          void tick();
        }, SCAN_INTERVAL_MS);
      };
      void tick();
    };
    void start();
    return stop;
  }, []);

  return (
    <section aria-label={t('wallet.scanHint')} className="flex flex-col items-stretch max-sm:-mx-8">
      <div className={PREVIEW_CLASS}>
        {error === null ? (
          <>
            <video
              ref={videoRef}
              playsInline
              muted
              autoPlay
              className="absolute inset-0 h-full w-full bg-black object-cover"
            />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute left-1/2 top-1/2 size-[68cqmin] -translate-x-1/2 -translate-y-1/2 rounded-3xl border-2 border-white/80 shadow-[0_0_0_200rem_rgb(0_0_0/0.35)]"
            >
              <span className="absolute -left-1 -top-1 h-10 w-10 rounded-tl-3xl border-l-[6px] border-t-[6px] border-white" />
              <span className="absolute -right-1 -top-1 h-10 w-10 rounded-tr-3xl border-r-[6px] border-t-[6px] border-white" />
              <span className="absolute -bottom-1 -left-1 h-10 w-10 rounded-bl-3xl border-b-[6px] border-l-[6px] border-white" />
              <span className="absolute -bottom-1 -right-1 h-10 w-10 rounded-br-3xl border-b-[6px] border-r-[6px] border-white" />
            </div>
            <p className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-6 pb-5 pt-12 text-center text-lg font-medium text-white sm:text-xl">
              {t('wallet.scanHint')}
            </p>
          </>
        ) : (
          <p
            role="alert"
            className="flex h-full items-center justify-center px-8 text-center text-lg font-medium text-app-danger sm:text-xl"
          >
            {error === 'denied' ? t('wallet.cameraDenied') : t('wallet.cameraUnavailable')}
          </p>
        )}
      </div>
    </section>
  );
}
