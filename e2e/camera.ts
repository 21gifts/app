import type { Page } from '@playwright/test';
import QRCode from 'qrcode';

/**
 * What the stubbed camera does when the page asks for it.
 *
 * - `blank`: a live stream of a plain black frame (no QR code in view).
 * - `qr`: a live stream that shows one QR code holding `text`.
 * - `denied`: the visitor blocked the camera (`NotAllowedError`).
 * - `none`: the device has no camera (`NotFoundError`).
 */
export type CameraStub =
  { kind: 'blank' } | { kind: 'qr'; text: string } | { kind: 'denied' } | { kind: 'none' };

/** Counters the stub keeps on `window` for assertions. */
export interface CameraStubStats {
  /** How many times `getUserMedia` was called. */
  requests: number;
  /** How many tracks handed out are still live. */
  live: number;
}

/**
 * Replaces `navigator.mediaDevices.getUserMedia` before any page script runs,
 * so the wallet Send camera is deterministic in headless browsers (which have
 * no camera). The stream comes from a canvas, so frames are the same on every
 * run. Track counts are kept on `window.__cameraStub`.
 *
 * @param page - Page to stub.
 * @param stub - Camera behaviour.
 */
export async function stubCamera(page: Page, stub: CameraStub): Promise<void> {
  const qr =
    stub.kind === 'qr' ? await QRCode.toDataURL(stub.text, { margin: 4, width: 360 }) : null;
  await page.addInitScript(
    ({ kind, image }) => {
      const stats = { requests: 0, live: 0 };
      Object.defineProperty(window, '__cameraStub', { value: stats });
      const draw = async (canvas: HTMLCanvasElement): Promise<void> => {
        const context = canvas.getContext('2d');
        if (context === null) {
          return;
        }
        context.fillStyle = kind === 'qr' ? '#ffffff' : '#000000';
        context.fillRect(0, 0, canvas.width, canvas.height);
        if (image === null) {
          return;
        }
        const picture = new Image();
        picture.src = image;
        await picture.decode();
        context.drawImage(picture, 60, 60, 360, 360);
      };
      const getUserMedia = async (): Promise<MediaStream> => {
        stats.requests += 1;
        if (kind === 'denied' || kind === 'none') {
          throw new DOMException(
            kind === 'denied' ? 'Permission denied' : 'Requested device not found',
            kind === 'denied' ? 'NotAllowedError' : 'NotFoundError',
          );
        }
        const canvas = document.createElement('canvas');
        canvas.width = 480;
        canvas.height = 480;
        await draw(canvas);
        const stream = canvas.captureStream(10);
        for (const track of stream.getTracks()) {
          stats.live += 1;
          const stop = track.stop.bind(track);
          track.stop = () => {
            if (track.readyState === 'live') {
              stats.live -= 1;
            }
            stop();
          };
        }
        return stream;
      };
      Object.defineProperty(navigator, 'mediaDevices', {
        configurable: true,
        value: { getUserMedia },
      });
    },
    { kind: stub.kind, image: qr },
  );
}

/**
 * Reads the stub counters.
 *
 * @param page - Page with {@link stubCamera} installed.
 * @returns Requests so far and tracks still live.
 */
export async function cameraStats(page: Page): Promise<CameraStubStats> {
  return page.evaluate(() => (window as unknown as { __cameraStub: CameraStubStats }).__cameraStub);
}
