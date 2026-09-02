import { QRCodeSVG } from 'qrcode.react';
import type { ReactElement } from 'react';

/** Rendered edge length of the QR, in pixels. */
const QR_SIZE = 232;

/** Props for {@link QrCode}. */
export interface QrCodeProps {
  /** The string to encode — typically an uppercased LNURL. */
  value: string;
  /** Accessible name (already translated by the caller). */
  label: string;
}

/**
 * Renders a value as a scannable QR (SVG, so it works in jsdom without canvas).
 *
 * Wrapped in an `img`-role element carrying an accessible name, so assistive
 * technology announces it as a single image rather than a wall of SVG paths.
 * Callers must not mount this on a smartphone; {@link ForumBoard} gates it with
 * `isSmartphoneUserAgent`.
 *
 * @param props - See {@link QrCodeProps}.
 * @returns The QR image element.
 */
export function QrCode({ value, label }: QrCodeProps): ReactElement {
  return (
    <div
      role="img"
      aria-label={label}
      className="rounded-2xl border border-app-border bg-app-qr-bg p-4"
    >
      <QRCodeSVG value={value} size={QR_SIZE} fgColor="#000000" bgColor="#ffffff" />
    </div>
  );
}
