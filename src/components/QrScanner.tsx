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
 * camera, no camera, or a page without a secure context shows a short alert
 * instead of the preview. Tracks also stop on unmount.
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
      const decode = await frameDecoder();
      const tick = async (): Promise<void> => {
        if (stopped) {
          return;
        }
        const text = await decode(video).catch(() => null);
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
    <section aria-label={t('wallet.scanHint')} className="flex w-full flex-col items-stretch gap-3">
      <div className="w-full overflow-hidden rounded-2xl border border-app-border bg-app-card-muted">
        {error === null ? (
          <video
            ref={videoRef}
            playsInline
            muted
            autoPlay
            className="aspect-square w-full bg-black object-cover"
          />
        ) : (
          <p role="alert" className="px-6 py-6 text-center text-sm text-app-danger">
            {error === 'denied' ? t('wallet.cameraDenied') : t('wallet.cameraUnavailable')}
          </p>
        )}
      </div>
      {error === null ? (
        <p className="text-center text-sm text-app-muted">{t('wallet.scanHint')}</p>
      ) : null}
    </section>
  );
}
