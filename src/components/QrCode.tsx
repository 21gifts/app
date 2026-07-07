import { QRCodeSVG } from 'qrcode.react';
import type { ReactElement } from 'react';

/** Rendered edge length of the QR, in pixels. */
const QR_SIZE = 232;

/** Props for {@link QrCode}. */
export interface QrCodeProps {
  /** The string to encode — typically an uppercased LNURL. */
  value: string;
}

/**
 * Renders a value as a scannable QR (SVG, so it works in jsdom without canvas).
 *
 * Wrapped in an `img`-role element carrying an accessible name, so assistive
 * technology announces it as a single image rather than a wall of SVG paths.
 *
 * @param props - See {@link QrCodeProps}.
 * @returns The QR image element.
 */
export function QrCode({ value }: QrCodeProps): ReactElement {
  return (
    <div
      role="img"
      aria-label="Lightning login QR code"
      className="rounded-2xl border border-neutral-200 bg-white p-4"
    >
      <QRCodeSVG value={value} size={QR_SIZE} />
    </div>
  );
}
