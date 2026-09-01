/** Maximum encoded JPEG size accepted for a forum photo upload (1 MiB). */
export const FORUM_PHOTO_MAX_BYTES = 1_048_576;

/** Longest edge after client-side resize before JPEG encode. */
export const FORUM_PHOTO_MAX_EDGE = 1280;

/** JPEG quality passed to `canvas.toDataURL`. */
export const FORUM_PHOTO_JPEG_QUALITY = 0.8;

/** Client-prepared forum photo ready for `postMessage` and a local preview. */
export type ForumPhotoPayload = {
  contentType: 'image/jpeg';
  /** Raw base64, no `data:` prefix. */
  data: string;
  /** Data URL for an `<img>` preview. */
  previewUrl: string;
};

/** Result of {@link prepareForumPhoto}. */
export type PrepareForumPhotoResult =
  { ok: true; photo: ForumPhotoPayload } | { ok: false; error: 'unsupported' | 'tooLarge' };

const FORUM_PHOTO_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

/**
 * True when `file.type` is JPEG, PNG, or WebP.
 *
 * @param file - Browser file from a file input.
 * @returns Whether the mime type is accepted for forum photos.
 */
export function isForumPhotoFile(file: File): boolean {
  return FORUM_PHOTO_TYPES.has(file.type);
}

/**
 * Loads an image bitmap from a file via `createImageBitmap` or an `<img>`.
 *
 * @param file - Image file to decode.
 * @returns Width/height source that can be drawn to a canvas.
 */
async function loadImageSource(
  file: File,
): Promise<{ source: CanvasImageSource; width: number; height: number; revoke?: () => void }> {
  if (typeof createImageBitmap === 'function') {
    const bitmap = await createImageBitmap(file);
    return {
      source: bitmap,
      width: bitmap.width,
      height: bitmap.height,
      revoke: () => {
        bitmap.close();
      },
    };
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        resolve(img);
      };
      img.onerror = () => {
        reject(new Error('Could not decode image'));
      };
      img.src = objectUrl;
    });
    return {
      source: image,
      width: image.naturalWidth,
      height: image.naturalHeight,
      revoke: () => {
        URL.revokeObjectURL(objectUrl);
      },
    };
  } catch (error) {
    URL.revokeObjectURL(objectUrl);
    throw error;
  }
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
 * Resizes and JPEG-encodes a forum photo for upload.
 *
 * Rejects unsupported types and payloads larger than
 * {@link FORUM_PHOTO_MAX_BYTES} after encode. Scales so the longest edge is at
 * most {@link FORUM_PHOTO_MAX_EDGE}.
 *
 * @param file - Browser file from the composer attach control.
 * @returns Ok payload with raw base64 + preview data URL, or a typed error.
 * @throws If the browser cannot decode the file (`createImageBitmap` rejection
 * or `<img>` `onerror` → `Could not decode image`).
 */
export async function prepareForumPhoto(file: File): Promise<PrepareForumPhotoResult> {
  if (!isForumPhotoFile(file)) {
    return { ok: false, error: 'unsupported' };
  }

  const loaded = await loadImageSource(file);
  try {
    const longest = Math.max(loaded.width, loaded.height);
    const scale = longest > FORUM_PHOTO_MAX_EDGE ? FORUM_PHOTO_MAX_EDGE / longest : 1;
    const width = Math.max(1, Math.round(loaded.width * scale));
    const height = Math.max(1, Math.round(loaded.height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (context === null) {
      return { ok: false, error: 'unsupported' };
    }
    context.drawImage(loaded.source, 0, 0, width, height);

    const previewUrl = canvas.toDataURL('image/jpeg', FORUM_PHOTO_JPEG_QUALITY);
    const prefix = 'data:image/jpeg;base64,';
    if (!previewUrl.startsWith(prefix)) {
      return { ok: false, error: 'unsupported' };
    }
    const data = previewUrl.slice(prefix.length);
    if (base64ByteLength(data) > FORUM_PHOTO_MAX_BYTES) {
      return { ok: false, error: 'tooLarge' };
    }

    return {
      ok: true,
      photo: {
        contentType: 'image/jpeg',
        data,
        previewUrl,
      },
    };
  } finally {
    loaded.revoke?.();
  }
}
