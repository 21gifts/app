/** 5:2 crop window in source-image pixels. */
export type BannerCrop = { x: number; y: number; width: number; height: number };

/**
 * True when `value` is a finite number greater than 0.
 *
 * @param value - Candidate dimension.
 * @returns Whether the value can be used as an image or crop size.
 */
function isPositiveFinite(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

/**
 * Approximate decoded byte length of a raw base64 string.
 *
 * @param data - Base64 without a data-URL prefix.
 * @returns Byte length of the decoded payload.
 */
function base64ByteLength(data: string): number {
  return atob(data).length;
}

/**
 * Largest 5:2 rect centered in the image, or null when width or height is not
 * finite and > 0.
 *
 * @param imageWidth - Source image width in pixels.
 * @param imageHeight - Source image height in pixels.
 * @returns The initial crop window, or `null` when a dimension is unusable.
 */
export function initialBannerCrop(imageWidth: number, imageHeight: number): BannerCrop | null {
  if (!isPositiveFinite(imageWidth) || !isPositiveFinite(imageHeight)) {
    return null;
  }
  if (imageWidth / imageHeight > 5 / 2) {
    const height = imageHeight;
    const width = height * (5 / 2);
    return { x: (imageWidth - width) / 2, y: 0, width, height };
  }
  const width = imageWidth;
  const height = width * (2 / 5);
  return { x: 0, y: (imageHeight - height) / 2, width, height };
}

/**
 * Move the window by dx/dy source pixels. Clamp so it stays inside the image.
 *
 * @param imageWidth - Source image width in pixels.
 * @param imageHeight - Source image height in pixels.
 * @param crop - Current 5:2 window.
 * @param dx - Horizontal shift in source pixels.
 * @param dy - Vertical shift in source pixels.
 * @returns The panned crop; width and height are unchanged.
 */
export function panBannerCrop(
  imageWidth: number,
  imageHeight: number,
  crop: BannerCrop,
  dx: number,
  dy: number,
): BannerCrop {
  const x = Math.min(Math.max(0, crop.x + dx), Math.max(0, imageWidth - crop.width));
  const y = Math.min(Math.max(0, crop.y + dy), Math.max(0, imageHeight - crop.height));
  return { x, y, width: crop.width, height: crop.height };
}

/**
 * Zoom around the crop center. factor > 1 zooms in (smaller window).
 * Cannot grow past initialBannerCrop. Cannot shrink below height 32, unless the
 * fitting window is already shorter than 32, in which case height stays at that max.
 * Width is always height * 5/2. Re-clamp inside the image.
 *
 * @param imageWidth - Source image width in pixels.
 * @param imageHeight - Source image height in pixels.
 * @param crop - Current 5:2 window.
 * @param factor - Scale applied to the window; values greater than 1 shrink it.
 * @returns The zoomed crop, or `crop` unchanged when no fitting window exists.
 */
export function zoomBannerCrop(
  imageWidth: number,
  imageHeight: number,
  crop: BannerCrop,
  factor: number,
): BannerCrop {
  const fitting = initialBannerCrop(imageWidth, imageHeight);
  if (fitting === null) {
    return crop;
  }
  const minHeight = fitting.height < 32 ? fitting.height : 32;
  const nextHeight = Math.min(fitting.height, Math.max(minHeight, crop.height / factor));
  const nextWidth = nextHeight * (5 / 2);
  const centerX = crop.x + crop.width / 2;
  const centerY = crop.y + crop.height / 2;
  return panBannerCrop(
    imageWidth,
    imageHeight,
    {
      x: centerX - nextWidth / 2,
      y: centerY - nextHeight / 2,
      width: nextWidth,
      height: nextHeight,
    },
    0,
    0,
  );
}

/**
 * Encoded pixel size. Width is min(1280, max(640, round(cropWidth))).
 * Height is max(1, round(width * 2 / 5)). This is the canvas size the API measures.
 *
 * @param cropWidth - Selected crop width in source pixels.
 * @returns JPEG canvas width and height.
 */
export function outputBannerSize(cropWidth: number): { width: number; height: number } {
  const width = Math.min(1280, Math.max(640, Math.round(cropWidth)));
  const height = Math.max(1, Math.round((width * 2) / 5));
  return { width, height };
}

export type WideBannerEncodeResult =
  | { ok: true; photo: { contentType: 'image/jpeg'; data: string; previewUrl: string } }
  | { ok: false; error: 'tooLarge' | 'unsupported' };

/**
 * Draw `crop` from `source` into a JPEG. Quality tries 0.8, then 0.6, then 0.4.
 * tooLarge when the decoded JPEG is still over 1_048_576 bytes (same base64 length
 * rule as base64ByteLength in forum-photo.ts: atob(data).length). unsupported when
 * getContext is null or toDataURL is not a jpeg data URL, or crop width/height is
 * not finite and > 0. previewUrl is the data URL; data is the base64 without the prefix.
 *
 * @param source - Decoded image to sample.
 * @param imageWidth - Source image width in pixels.
 * @param imageHeight - Source image height in pixels.
 * @param crop - 5:2 window in source pixels.
 * @returns Encoded JPEG payload, or a typed error. Does not throw for those failures.
 */
export function encodeWideBanner(
  source: CanvasImageSource,
  imageWidth: number,
  imageHeight: number,
  crop: BannerCrop,
): WideBannerEncodeResult {
  if (!isPositiveFinite(crop.width) || !isPositiveFinite(crop.height)) {
    return { ok: false, error: 'unsupported' };
  }

  const out = outputBannerSize(crop.width);
  const canvas = document.createElement('canvas');
  canvas.width = out.width;
  canvas.height = out.height;
  const context = canvas.getContext('2d');
  if (context === null) {
    return { ok: false, error: 'unsupported' };
  }
  if ('imageSmoothingQuality' in context) {
    context.imageSmoothingQuality = 'high';
  }

  const sx = Math.min(Math.max(crop.x, 0), imageWidth);
  const sy = Math.min(Math.max(crop.y, 0), imageHeight);
  const right = Math.min(Math.max(crop.x + crop.width, 0), imageWidth);
  const bottom = Math.min(Math.max(crop.y + crop.height, 0), imageHeight);
  context.drawImage(source, sx, sy, right - sx, bottom - sy, 0, 0, out.width, out.height);

  const prefix = 'data:image/jpeg;base64,';
  for (const quality of [0.8, 0.6, 0.4]) {
    const previewUrl = canvas.toDataURL('image/jpeg', quality);
    if (!previewUrl.startsWith(prefix)) {
      return { ok: false, error: 'unsupported' };
    }
    const data = previewUrl.slice(prefix.length);
    if (base64ByteLength(data) <= 1_048_576) {
      return {
        ok: true,
        photo: {
          contentType: 'image/jpeg',
          data,
          previewUrl,
        },
      };
    }
  }
  return { ok: false, error: 'tooLarge' };
}
